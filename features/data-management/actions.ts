"use server";

import { validateAdminAccessFromServerContext } from "@/features/auth/admin-validation";
import { env } from "@/lib/config/env";
import { log } from "@/lib/platform/logger";
import type {
	EventsResult,
	RuntimeDataStatus,
} from "./runtime-service";
import {
	forceRefreshEventsData,
	fullEventsRevalidation,
	getLiveEvents,
	getRuntimeDataStatusFromSource,
	revalidateEventsPaths,
} from "./runtime-service";
import { LocalEventStore } from "./local-event-store";
import { fetchRemoteCSV } from "./csv/fetcher";
import {
	csvToEditableSheet,
	editableSheetToCsv,
	type EditableSheetColumn,
	type EditableSheetRow,
	validateEditableSheet,
} from "./csv/sheet-editor";
import {
	type DateFormatWarning,
	WarningSystem,
} from "./validation/date-warnings";
import { processCSVData } from "./data-processor";
import { EventCoordinatePopulator } from "@/features/maps/event-coordinate-populator";

/**
 * Data Management Server Actions
 *
 * Server actions specifically related to data management, CSV processing,
 * and Google Sheets operations. Colocated with data management modules.
 */

// Helper function to validate admin access (key or session token)
async function validateAdminAccess(keyOrToken?: string): Promise<boolean> {
	return validateAdminAccessFromServerContext(keyOrToken ?? null);
}

const resolveRemoteSheetConfig = async (): Promise<{
	remoteUrl: string | null;
	sheetId: string | null;
	range: string;
}> => {
	const remoteUrl = env.REMOTE_CSV_URL || null;
	let sheetId = env.GOOGLE_SHEET_ID || null;
	const range = "A:Z";

	if (!sheetId && remoteUrl) {
		const { GoogleCloudAPI } = await import("@/lib/google/api");
		sheetId = GoogleCloudAPI.extractSheetId(remoteUrl);
	}

	return { remoteUrl, sheetId, range };
};

const COORDINATE_WARMUP_RECOVERABLE_ERROR_FRAGMENT =
	"GOOGLE_MAPS_API_KEY not set";

const LEGACY_FEATURED_COLUMN_ERROR =
	'Featured selection moved to Featured Manager. Clear values in the legacy "Featured" column and use Admin > Featured Events Manager.';

const getLegacyFeaturedViolations = (
	rows: EditableSheetRow[],
): {
	count: number;
	sampleValues: string[];
	sampleRows: number[];
} => {
	const sampleValues: string[] = [];
	const sampleRows: number[] = [];
	let count = 0;

	rows.forEach((row, index) => {
		const featuredValue = (row.featured || "").trim();
		if (!featuredValue) return;
		count += 1;
		if (sampleValues.length < 3) {
			sampleValues.push(featuredValue);
			sampleRows.push(index + 1);
		}
	});

	return {
		count,
		sampleValues,
		sampleRows,
	};
};

const buildLegacyFeaturedErrorMessage = (
	violations: ReturnType<typeof getLegacyFeaturedViolations>,
): string => {
	if (violations.count === 0) return "";
	const sampleSummary = violations.sampleValues
		.map((value, index) => `row ${violations.sampleRows[index]}: "${value}"`)
		.join(", ");

	return `${LEGACY_FEATURED_COLUMN_ERROR} Found ${violations.count} row(s) with legacy Featured values (${sampleSummary}).`;
};

const getLegacyFeaturedErrorFromCsv = (csvContent: string): string | null => {
	const sheet = csvToEditableSheet(csvContent);
	const rows = Array.isArray(sheet?.rows) ? sheet.rows : [];
	const violations = getLegacyFeaturedViolations(rows);
	if (violations.count === 0) return null;
	return buildLegacyFeaturedErrorMessage(violations);
};

const warmCoordinateCacheFromCsv = async (
	csvContent: string,
	context: "save-local" | "import-remote" | "save-sheet-editor",
): Promise<void> => {
	const processed = await processCSVData(csvContent, "store", false, {
		populateCoordinates: true,
	});
	const blockingErrors = processed.errors.filter(
		(error) => !error.includes(COORDINATE_WARMUP_RECOVERABLE_ERROR_FRAGMENT),
	);
	if (blockingErrors.length > 0) {
		throw new Error(blockingErrors.join("; "));
	}

	const pruneResult = await EventCoordinatePopulator.pruneStorageToEvents(
		processed.events,
	);

	log.info("coordinates", "Coordinate cache warm-up completed", {
		context,
		totalEvents: processed.count,
		coordinatesPopulated: processed.coordinatesPopulated ?? false,
		coordinatesCount: processed.coordinatesCount ?? 0,
		prunedKeys: pruneResult.removedCount,
		storageEntries: pruneResult.afterCount,
	});

	if (
		processed.errors.some((error) =>
			error.includes(COORDINATE_WARMUP_RECOVERABLE_ERROR_FRAGMENT),
		)
	) {
		log.warn("coordinates", "Coordinate cache warm-up skipped geocoding", {
			context,
			reason: "GOOGLE_MAPS_API_KEY not set",
		});
	}
};

/**
 * Get live events data from configured runtime source.
 */
export async function getEvents(
	_forceRefresh: boolean = false,
): Promise<EventsResult> {
	return getLiveEvents();
}

/**
 * Snapshot of currently displayed site events.
 * `forceRefresh=true` runs a dry source read that does not mutate runtime state.
 */
export async function getLiveSiteEventsSnapshot(
	keyOrToken?: string,
	limit = 200,
	options?: {
		forceRefresh?: boolean;
	},
): Promise<{
	success: boolean;
	source?: EventsResult["source"];
	totalCount?: number;
	lastUpdate?: string;
	rows?: Array<{
		id: string;
		name: string;
		date: string;
		time: string;
		location: string;
		arrondissement: string;
		genre: string;
		type: string;
	}>;
	error?: string;
}> {
	if (!(await validateAdminAccess(keyOrToken))) {
		return { success: false, error: "Unauthorized access" };
	}

	try {
		void options;
		const result = await getLiveEvents();
		if (!result.success) {
			return { success: false, error: result.error || "Failed to load events" };
		}

		const normalizedLimit = Math.max(5, Math.min(limit, 1000));
		const rows = result.data.slice(0, normalizedLimit).map((event) => ({
			id: event.id,
			name: event.name,
			date: event.date || "",
			time: event.time || "",
			location: event.location || "",
			arrondissement: String(event.arrondissement ?? ""),
			genre: event.genre.join(", "),
			type: event.type,
		}));

		return {
			success: true,
			source: result.source,
			totalCount: result.count,
			lastUpdate: result.lastUpdate,
			rows,
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * Force a live data reload and revalidate public routes.
 */
export async function forceRefreshEvents(): Promise<{
	success: boolean;
	message: string;
	data?: import("@/features/events/types").Event[];
	count?: number;
	source?: "remote" | "local" | "store" | "test";
	error?: string;
}> {
	return forceRefreshEventsData();
}

/**
 * Get live data/system status from source of truth.
 */
export async function getRuntimeDataStatus(): Promise<RuntimeDataStatus> {
	return getRuntimeDataStatusFromSource();
}

/**
 * Revalidate pages and reload live data.
 */
export async function revalidatePages(
	keyOrToken?: string,
	path: string = "/",
): Promise<{
	success: boolean;
	message?: string;
	cacheRefreshed?: boolean;
	pageRevalidated?: boolean;
	processingTimeMs?: number;
	error?: string;
}> {
	const startTime = Date.now();
	log.info("cache", "Revalidate server action called");

	if (!(await validateAdminAccess(keyOrToken))) {
		return { success: false, error: "Unauthorized access" };
	}

	const normalizePath = (inputPath: string): string => {
		if (!inputPath || typeof inputPath !== "string") {
			return "/";
		}

		const normalizedPath = inputPath.startsWith("/")
			? inputPath
			: `/${inputPath}`;

		if (
			normalizedPath.includes("..") ||
			!normalizedPath.match(/^\/[\w\-\/]*$/)
		) {
			log.warn("cache", "Invalid revalidate path provided; using root", {
				inputPath,
			});
			return "/";
		}

		return normalizedPath;
	};

	const normalizedPath = normalizePath(path);

	try {
		const revalidationResult = await fullEventsRevalidation(normalizedPath);
		const processingTime = Date.now() - startTime;
		return {
			...revalidationResult,
			processingTimeMs: processingTime,
		};
	} catch (error) {
		const processingTime = Date.now() - startTime;
		log.error("cache", "Revalidation error", undefined, error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
			processingTimeMs: processingTime,
		};
	}
}

/**
 * Get local event store status
 */
export async function getLocalEventStoreStatus(keyOrToken?: string): Promise<{
	success: boolean;
	status?: Awaited<ReturnType<typeof LocalEventStore.getStatus>>;
	error?: string;
}> {
	if (!(await validateAdminAccess(keyOrToken))) {
		return { success: false, error: "Unauthorized access" };
	}

	try {
		const status = await LocalEventStore.getStatus();
		return { success: true, status };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * Get local event store CSV content
 */
export async function getLocalEventStoreCsv(keyOrToken?: string): Promise<{
	success: boolean;
	csvContent?: string;
	error?: string;
}> {
	if (!(await validateAdminAccess(keyOrToken))) {
		return { success: false, error: "Unauthorized access" };
	}

	try {
		const csvContent = await LocalEventStore.getCsv();
		return { success: true, csvContent: csvContent || "" };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * Save local event store CSV content
 */
export async function saveLocalEventStoreCsv(
	keyOrToken: string | undefined,
	csvContent: string,
): Promise<{
	success: boolean;
	message: string;
	rowCount?: number;
	error?: string;
}> {
	if (!(await validateAdminAccess(keyOrToken))) {
		return { success: false, message: "Unauthorized access" };
	}

	const legacyFeaturedError = getLegacyFeaturedErrorFromCsv(csvContent);
	if (legacyFeaturedError) {
		return {
			success: false,
			message: LEGACY_FEATURED_COLUMN_ERROR,
			error: legacyFeaturedError,
		};
	}

		try {
			const result = await LocalEventStore.saveCsv(csvContent, {
				updatedBy: "admin-panel",
				origin: "manual",
			});
			await warmCoordinateCacheFromCsv(csvContent, "save-local");
			await forceRefreshEventsData();
			return {
				success: true,
			message: "Managed store updated and homepage revalidated",
			rowCount: result.rowCount,
		};
	} catch (error) {
		return {
			success: false,
			message: "Failed to save managed store",
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * Clear local event store CSV content
 */
export async function clearLocalEventStoreCsv(keyOrToken?: string): Promise<{
	success: boolean;
	message: string;
	error?: string;
}> {
	if (!(await validateAdminAccess(keyOrToken))) {
		return { success: false, message: "Unauthorized access" };
	}

	try {
		await LocalEventStore.clearCsv();
		await forceRefreshEventsData();
		return {
			success: true,
			message: "Managed store cleared and homepage revalidated",
		};
	} catch (error) {
		return {
			success: false,
			message: "Failed to clear managed store",
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * Preview Google backup CSV without writing to Postgres store
 */
export async function previewRemoteCsvForAdmin(
	keyOrToken?: string,
	limit = 5,
	options?: {
		random?: boolean;
	},
): Promise<{
	success: boolean;
	columns?: EditableSheetColumn[];
	rows?: EditableSheetRow[];
	totalRows?: number;
	fetchedAt?: string;
	error?: string;
}> {
	if (!(await validateAdminAccess(keyOrToken))) {
		return { success: false, error: "Unauthorized access" };
	}

		try {
			const { remoteUrl, sheetId, range } = await resolveRemoteSheetConfig();
			const remoteFetchResult = await fetchRemoteCSV(remoteUrl, sheetId, range, {
				allowLocalFallback: false,
		});
		const sheet = csvToEditableSheet(remoteFetchResult.content);
		const normalizedLimit = Math.max(1, Math.min(limit, 50));
		const allRows = sheet.rows;
		let previewRows = allRows.slice(0, normalizedLimit);

		if (options?.random && allRows.length > normalizedLimit) {
			const maxStart = Math.max(0, allRows.length - normalizedLimit);
			const start = Math.floor(Math.random() * (maxStart + 1));
			previewRows = allRows.slice(start, start + normalizedLimit);
		}

		return {
			success: true,
			columns: sheet.columns,
			rows: previewRows,
			totalRows: sheet.rows.length,
			fetchedAt: new Date(remoteFetchResult.timestamp).toISOString(),
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * Import CSV from remote Google source into local event store
 */
export async function importRemoteCsvToLocalEventStore(
	keyOrToken?: string,
): Promise<{
	success: boolean;
	message: string;
	rowCount?: number;
	error?: string;
}> {
	if (!(await validateAdminAccess(keyOrToken))) {
		return { success: false, message: "Unauthorized access" };
	}

	try {
		const { remoteUrl, sheetId, range } = await resolveRemoteSheetConfig();
		const remoteFetchResult = await fetchRemoteCSV(remoteUrl, sheetId, range, {
			allowLocalFallback: false,
		});
		const legacyFeaturedError = getLegacyFeaturedErrorFromCsv(
			remoteFetchResult.content,
		);
		if (legacyFeaturedError) {
			return {
				success: false,
				message: LEGACY_FEATURED_COLUMN_ERROR,
				error: legacyFeaturedError,
			};
		}
			const saved = await LocalEventStore.saveCsv(remoteFetchResult.content, {
				updatedBy: "admin-google-import",
				origin: "google-import",
			});
			await warmCoordinateCacheFromCsv(remoteFetchResult.content, "import-remote");
			await forceRefreshEventsData();

			return {
			success: true,
			message: `Imported ${saved.rowCount} rows from remote source into managed store`,
			rowCount: saved.rowCount,
		};
	} catch (error) {
		return {
			success: false,
			message: "Failed to import remote CSV into managed store",
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * Preview local event store rows
 */
export async function getLocalEventStorePreview(
	keyOrToken?: string,
	limit = 20,
	options?: {
		random?: boolean;
	},
): Promise<{
	success: boolean;
	headers?: readonly string[];
	rows?: Awaited<ReturnType<typeof LocalEventStore.getPreview>>["rows"];
	error?: string;
}> {
	if (!(await validateAdminAccess(keyOrToken))) {
		return { success: false, error: "Unauthorized access" };
	}

	try {
		const preview = await LocalEventStore.getPreview(limit, options);
		return { success: true, headers: preview.headers, rows: preview.rows };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * Load full event sheet data for admin table editor
 */
export async function getEventSheetEditorData(keyOrToken?: string): Promise<{
	success: boolean;
	columns?: EditableSheetColumn[];
	rows?: EditableSheetRow[];
	status?: Awaited<ReturnType<typeof LocalEventStore.getStatus>>;
	sheetSource?: "store";
	error?: string;
}> {
	if (!(await validateAdminAccess(keyOrToken))) {
		return { success: false, error: "Unauthorized access" };
	}

	try {
		const [status, csv] = await Promise.all([
			LocalEventStore.getStatus(),
			LocalEventStore.getCsv(),
		]);
		const sheet = csvToEditableSheet(csv);

		return {
			success: true,
			columns: sheet.columns,
			rows: sheet.rows,
			status,
			sheetSource: "store",
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * Persist table-editor rows to local event store and revalidate homepage.
 */
export async function saveEventSheetEditorRows(
	keyOrToken: string | undefined,
	columns: EditableSheetColumn[],
	rows: EditableSheetRow[],
	options?: {
		revalidateHomepage?: boolean;
	},
): Promise<{
	success: boolean;
	message: string;
	rowCount?: number;
	updatedAt?: string;
	error?: string;
}> {
	if (!(await validateAdminAccess(keyOrToken))) {
		return { success: false, message: "Unauthorized access" };
	}

	try {
		const validation = validateEditableSheet(columns, rows);
		if (!validation.valid) {
			return {
				success: false,
				message: validation.error || "Invalid sheet payload",
			};
		}
		const featuredViolations = getLegacyFeaturedViolations(validation.rows);
		if (featuredViolations.count > 0) {
			return {
				success: false,
				message: LEGACY_FEATURED_COLUMN_ERROR,
				error: buildLegacyFeaturedErrorMessage(featuredViolations),
			};
		}

		const csvContent = editableSheetToCsv(validation.columns, validation.rows);
			const saved = await LocalEventStore.saveCsv(csvContent, {
				updatedBy: "admin-sheet-editor",
				origin: "manual",
			});
			const shouldRevalidateHomepage = options?.revalidateHomepage !== false;
			if (shouldRevalidateHomepage) {
				await warmCoordinateCacheFromCsv(csvContent, "save-sheet-editor");
				await forceRefreshEventsData();
			} else {
				revalidateEventsPaths(["/"]);
			}

		return {
			success: true,
			message:
				shouldRevalidateHomepage ?
					"Saved event sheet to store and revalidated homepage"
				:	"Saved event sheet to store",
			rowCount: saved.rowCount,
			updatedAt: saved.updatedAt,
		};
	} catch (error) {
		return {
			success: false,
			message: "Failed to save event sheet",
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * Configuration for which columns to check for date format issues
 */
const DATE_COLUMNS_TO_CHECK = {
	featured: false, // Featured scheduling is no longer read from CSV
	date: false, // Check the Date column for ambiguous dates
	startTime: false, // Check the Start Time column for time format issues
	endTime: false, // Check the End Time column for time format issues
} as const;

/**
 * Analyze date formats from Google Sheets data
 */
export async function analyzeDateFormats(keyOrToken?: string): Promise<{
	success: boolean;
	warnings?: DateFormatWarning[];
	error?: string;
}> {
	"use server";

	// Verify admin access first
	if (!(await validateAdminAccess(keyOrToken))) {
		return { success: false, error: "Unauthorized access" };
	}

	try {
		// Force refresh to ensure we get fresh parsing warnings
		const eventsResult = await getLiveEvents();

		if (!eventsResult.success || !eventsResult.data) {
			return {
				success: false,
				error: "Failed to load events data for analysis",
			};
		}

		// Get real warnings captured during CSV parsing
		const allWarnings = WarningSystem.getDateFormatWarnings();

		// Filter warnings based on configured columns
		const warnings = allWarnings.filter((warning: DateFormatWarning) => {
			switch (warning.columnType) {
				case "featured":
					return DATE_COLUMNS_TO_CHECK.featured;
				case "date":
					return DATE_COLUMNS_TO_CHECK.date;
				case "startTime":
					return DATE_COLUMNS_TO_CHECK.startTime;
				case "endTime":
					return DATE_COLUMNS_TO_CHECK.endTime;
				default:
					return false;
			}
		});

		log.info("data-validation", "Date format warnings found", {
			count: warnings.length,
		});
		if (warnings.length > 0) {
			log.info("data-validation", "Date warning summary follows");
			warnings.forEach((warning: DateFormatWarning, index: number) => {
				log.info("data-validation", "Date warning", {
					index: index + 1,
					type: warning.warningType,
					value: warning.originalValue,
					eventName: warning.eventName,
					columnType: warning.columnType,
				});
			});
		}

		return {
			success: true,
			warnings,
		};
	} catch (error) {
		log.error("data-validation", "Error analyzing date formats", undefined, error);
		return {
			success: false,
			error:
				error instanceof Error
					? error.message
					: "Unknown error analyzing date formats",
		};
	}
}
