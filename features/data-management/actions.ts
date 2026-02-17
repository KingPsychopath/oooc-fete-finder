"use server";

import { validateAdminAccessFromServerContext } from "@/features/auth/admin-validation";
import { CacheManager } from "@/lib/cache/cache-manager";
import { env } from "@/lib/config/env";
import type {
	CacheStatus,
	EventsResult,
} from "@/lib/cache/cache-manager";
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

/**
 * Get events data using the centralized cache manager
 */
export async function getEvents(
	forceRefresh: boolean = false,
): Promise<EventsResult> {
	return CacheManager.getEvents(forceRefresh);
}

/**
 * Snapshot of currently displayed site events (same cache path as homepage)
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
	cached?: boolean;
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
		const result = await CacheManager.getEvents(Boolean(options?.forceRefresh));
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
			cached: result.cached,
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
 * Force refresh the events cache using the centralized cache manager with smart invalidation
 */
export async function forceRefreshEvents(): Promise<{
	success: boolean;
	message: string;
	data?: import("@/features/events/types").Event[];
	count?: number;
	source?: "remote" | "local" | "store" | "test" | "cached";
	error?: string;
}> {
	return CacheManager.forceRefresh();
}

/**
 * Get cache and system status using the centralized cache manager
 */
export async function getCacheStatus(): Promise<CacheStatus> {
	return CacheManager.getCacheStatus();
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

	try {
		const result = await LocalEventStore.saveCsv(csvContent, {
			updatedBy: "admin-panel",
			origin: "manual",
		});
		await CacheManager.forceRefresh();
		return {
			success: true,
			message: "Managed store updated and cache refreshed",
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
		await CacheManager.forceRefresh();
		return {
			success: true,
			message: "Managed store cleared and cache refreshed",
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
 * Update local event store settings
 */
export async function updateLocalEventStoreSettings(
	keyOrToken: string | undefined,
	updates: {
		autoSyncFromGoogle?: boolean;
	},
): Promise<{
	success: boolean;
	settings?: Awaited<ReturnType<typeof LocalEventStore.getSettings>>;
	error?: string;
}> {
	if (!(await validateAdminAccess(keyOrToken))) {
		return { success: false, error: "Unauthorized access" };
	}

	try {
		const settings = await LocalEventStore.updateSettings(updates);
		await CacheManager.forceRefresh();
		return { success: true, settings };
	} catch (error) {
		return {
			success: false,
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

		return {
			success: true,
			columns: sheet.columns,
			rows: sheet.rows.slice(0, normalizedLimit),
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
		const saved = await LocalEventStore.saveCsv(remoteFetchResult.content, {
			updatedBy: "admin-google-import",
			origin: "google-import",
		});
		await CacheManager.forceRefresh();

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
 * Persist table-editor rows to local event store and refresh cache
 */
export async function saveEventSheetEditorRows(
	keyOrToken: string | undefined,
	columns: EditableSheetColumn[],
	rows: EditableSheetRow[],
	options?: {
		refreshCache?: boolean;
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

		const csvContent = editableSheetToCsv(validation.columns, validation.rows);
		const saved = await LocalEventStore.saveCsv(csvContent, {
			updatedBy: "admin-sheet-editor",
			origin: "manual",
		});
		const shouldRefreshCache = options?.refreshCache !== false;
		if (shouldRefreshCache) {
			await CacheManager.forceRefresh();
		}

		return {
			success: true,
			message:
				shouldRefreshCache ?
					"Saved event sheet to store and refreshed cache"
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
	featured: true, // Check the Featured column for timestamp issues
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
		const eventsResult = await CacheManager.getEvents(true);

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

		console.log(
			`📊 Found ${warnings.length} date format warnings from CSV parsing`,
		);
		if (warnings.length > 0) {
			console.log("📋 Warning summary:");
			warnings.forEach((warning: DateFormatWarning, index: number) => {
				console.log(
					`   ${index + 1}. ${warning.warningType}: "${warning.originalValue}" in ${warning.eventName} (${warning.columnType} column)`,
				);
			});
		}

		return {
			success: true,
			warnings,
		};
	} catch (error) {
		console.error("❌ Error analyzing date formats:", error);
		return {
			success: false,
			error:
				error instanceof Error
					? error.message
					: "Unknown error analyzing date formats",
		};
	}
}
