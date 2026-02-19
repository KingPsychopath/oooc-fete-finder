"use server";

import {
	revokeAllAdminSessions,
	secureCompare,
} from "@/features/auth/admin-auth-token";
import { validateAdminAccessFromServerContext } from "@/features/auth/admin-validation";
import { UserCollectionStore } from "@/features/auth/user-collection-store";
import { clearFeaturedQueueHistory as clearFeaturedQueueHistoryService } from "@/features/events/featured/service";
import { EventSubmissionSettingsStore } from "@/features/events/submissions/settings-store";
import { clearAllEventSubmissions } from "@/features/events/submissions/store";
import { EventCoordinatePopulator } from "@/features/maps/event-coordinate-populator";
import { invalidateSlidingBannerCache } from "@/features/site-settings/cache";
import { SlidingBannerStore } from "@/features/site-settings/sliding-banner-store";
import { env } from "@/lib/config/env";
import { log } from "@/lib/platform/logger";
import { getActionMetricsRepository } from "@/lib/platform/postgres/action-metrics-repository";
import { getAdminSessionRepository } from "@/lib/platform/postgres/admin-session-repository";
import { getEventStoreBackupRepository } from "@/lib/platform/postgres/event-store-backup-repository";
import { getRateLimitRepository } from "@/lib/platform/postgres/rate-limit-repository";
import { revalidatePath } from "next/cache";
import { fetchRemoteCSV } from "./csv/fetcher";
import { parseCSVContent } from "./csv/parser";
import {
	type EditableSheetColumn,
	type EditableSheetRow,
	csvToEditableSheet,
	editableSheetToCsv,
	stripLegacyFeaturedColumn,
	validateEditableSheet,
} from "./csv/sheet-editor";
import { DataManager } from "./data-manager";
import { processCSVData } from "./data-processor";
import { EventStoreBackupService } from "./event-store-backup-service";
import type {
	EventStoreBackupStatus,
	EventStoreBackupSummary,
} from "./event-store-backup-types";
import { LocalEventStore } from "./local-event-store";
import type { EventsResult, RuntimeDataStatus } from "./runtime-service";
import {
	forceRefreshEventsData,
	fullEventsRevalidation,
	getLiveEvents,
	getRuntimeDataStatusFromSource,
	revalidateEventsPaths,
} from "./runtime-service";
import {
	type CsvSchemaIssue,
	analyzeCsvSchemaRows,
} from "./validation/csv-schema-report";

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

const validateFactoryResetPasscode = (providedPasscode: string): boolean => {
	const expectedPasscode = env.ADMIN_RESET_PASSCODE?.trim() || "";
	const candidate = providedPasscode.trim();
	if (!expectedPasscode || !candidate) {
		return false;
	}
	return secureCompare(candidate, expectedPasscode);
};

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

const buildSchemaBlockingMessage = (issues: CsvSchemaIssue[]): string => {
	const blocking = issues.filter((issue) => issue.severity === "error");
	if (blocking.length === 0) return "";
	const summary = blocking
		.slice(0, 3)
		.map(
			(issue) =>
				`${issue.column} row ${issue.rowIndex}: ${issue.message} (${issue.value || "empty"})`,
		)
		.join("; ");
	return `Import blocked by schema validation (${blocking.length} issue(s)): ${summary}`;
};

const getCsvRuntimeValidationError = (csvContent: string): string | null => {
	try {
		parseCSVContent(csvContent);
		return null;
	} catch (error) {
		return error instanceof Error ? error.message : "CSV validation failed";
	}
};

const normalizeCsvForStorage = (csvContent: string): string => {
	const sheet = csvToEditableSheet(csvContent);
	return editableSheetToCsv(sheet.columns, sheet.rows);
};

const warmCoordinateCacheFromCsv = async (
	csvContent: string,
	context:
		| "save-local"
		| "import-remote"
		| "save-sheet-editor"
		| "restore-backup",
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
		const sourceRead = options?.forceRefresh
			? await DataManager.getEventsData({
					populateCoordinates: false,
				})
			: await getLiveEvents();
		if (!sourceRead.success) {
			return {
				success: false,
				error: sourceRead.error || "Failed to load events",
			};
		}

		const normalizedLimit = Math.max(5, Math.min(limit, 1000));
		const rows = sourceRead.data.slice(0, normalizedLimit).map((event) => ({
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
			source: sourceRead.source,
			totalCount: sourceRead.count,
			lastUpdate: sourceRead.lastUpdate,
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
 * Get event store backup status
 */
export async function getEventStoreBackupStatus(keyOrToken?: string): Promise<{
	success: boolean;
	supported?: boolean;
	reason?: string;
	status?: EventStoreBackupStatus;
	error?: string;
}> {
	if (!(await validateAdminAccess(keyOrToken))) {
		return { success: false, error: "Unauthorized access" };
	}

	try {
		const backupStatus = await EventStoreBackupService.getBackupStatus();
		if (!backupStatus.supported) {
			return {
				success: true,
				supported: false,
				reason: backupStatus.reason,
				status: {
					backupCount: 0,
					latestBackup: null,
				},
			};
		}

		return {
			success: true,
			supported: true,
			status: backupStatus.status,
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * Create manual event store backup
 */
export async function createEventStoreBackup(keyOrToken?: string): Promise<{
	success: boolean;
	message: string;
	backup?: EventStoreBackupStatus["latestBackup"];
	error?: string;
}> {
	if (!(await validateAdminAccess(keyOrToken))) {
		return { success: false, message: "Unauthorized access" };
	}

	try {
		const result = await EventStoreBackupService.createBackup({
			createdBy: "admin-panel",
			trigger: "manual",
		});

		if (!result.success) {
			return {
				success: false,
				message: result.message,
				error: result.error,
			};
		}

		const pruneSuffix =
			result.prunedCount && result.prunedCount > 0
				? ` (pruned ${result.prunedCount} old backups)`
				: "";

		return {
			success: true,
			message: `${result.message}${pruneSuffix}`,
			backup: result.backup,
		};
	} catch (error) {
		return {
			success: false,
			message: "Failed to create event store backup",
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * List recent event/featured snapshots for admin restore picker.
 */
export async function getEventStoreRecentBackups(
	keyOrToken?: string,
	limit = 10,
): Promise<{
	success: boolean;
	supported?: boolean;
	reason?: string;
	backups?: EventStoreBackupSummary[];
	error?: string;
}> {
	if (!(await validateAdminAccess(keyOrToken))) {
		return { success: false, error: "Unauthorized access" };
	}

	try {
		const result = await EventStoreBackupService.listRecentBackups(limit);
		if (!result.supported) {
			return {
				success: true,
				supported: false,
				reason: result.reason,
				backups: [],
			};
		}

		return {
			success: true,
			supported: true,
			backups: result.backups,
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * Restore a snapshot (latest by default), then warm coordinates and revalidate homepage.
 */
export async function restoreLatestEventStoreBackup(
	keyOrToken?: string,
	backupId?: string,
): Promise<{
	success: boolean;
	message: string;
	restoredFrom?: EventStoreBackupStatus["latestBackup"];
	preRestoreBackup?: EventStoreBackupStatus["latestBackup"];
	rowCount?: number;
	featuredEntryCount?: number;
	error?: string;
}> {
	if (!(await validateAdminAccess(keyOrToken))) {
		return { success: false, message: "Unauthorized access" };
	}

	try {
		const result = await EventStoreBackupService.restoreBackup({
			createdBy: "admin-panel-restore",
			backupId: backupId?.trim() || undefined,
		});

		if (!result.success) {
			return {
				success: false,
				message: result.message,
				error: result.error,
			};
		}

		if (result.restoredCsv) {
			await warmCoordinateCacheFromCsv(result.restoredCsv, "restore-backup");
		}
		await forceRefreshEventsData();

		return {
			success: true,
			message: "Snapshot restored and homepage revalidated",
			restoredFrom: result.restoredFrom,
			preRestoreBackup: result.preRestoreBackup,
			rowCount: result.restoredRowCount,
			featuredEntryCount: result.restoredFeaturedCount,
		};
	} catch (error) {
		return {
			success: false,
			message: "Failed to restore latest event store backup",
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

	const schemaSheet = csvToEditableSheet(csvContent);
	const schemaReport = analyzeCsvSchemaRows(schemaSheet.rows, {
		eventKeyMode: "warn",
	});
	const importBlockedReason = buildSchemaBlockingMessage(schemaReport.issues);
	if (importBlockedReason) {
		return {
			success: false,
			message: "CSV schema validation failed",
			error: importBlockedReason,
		};
	}

	const runtimeValidationError = getCsvRuntimeValidationError(csvContent);
	if (runtimeValidationError) {
		return {
			success: false,
			message: "CSV structure validation failed",
			error: runtimeValidationError,
		};
	}

	try {
		const normalizedCsv = normalizeCsvForStorage(csvContent);
		const result = await LocalEventStore.saveCsv(normalizedCsv, {
			updatedBy: "admin-panel",
			origin: "manual",
		});
		await warmCoordinateCacheFromCsv(normalizedCsv, "save-local");
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

export async function factoryResetApplicationState(
	keyOrToken: string | undefined,
	stepUpPasscode: string,
	mode: "standard" | "hard" = "standard",
): Promise<{
	success: boolean;
	message: string;
	summary?: {
		mode: "standard" | "hard";
		clearedFeaturedEntries: number;
		clearedEventSubmissions: number;
		clearedBackups: number;
		nextAdminTokenVersion?: number;
		clearedAdminSessions?: number;
		clearedActionMetrics?: number;
		clearedRateLimitCounters?: number;
	};
	error?: string;
}> {
	if (!(await validateAdminAccess(keyOrToken))) {
		return { success: false, message: "Unauthorized access" };
	}

	if (!(env.ADMIN_RESET_PASSCODE?.trim() || "")) {
		return {
			success: false,
			message: "Factory reset passcode is not configured",
			error:
				"Set ADMIN_RESET_PASSCODE in your environment before using factory reset.",
		};
	}

	if (!validateFactoryResetPasscode(stepUpPasscode)) {
		return {
			success: false,
			message: "Invalid factory reset passcode",
			error: "Step-up authentication failed.",
		};
	}

	try {
		await LocalEventStore.clearCsv();
		const clearedFeaturedEntries = await clearFeaturedQueueHistoryService();
		const clearedEventSubmissions = await clearAllEventSubmissions();
		await UserCollectionStore.clearAll();
		await EventCoordinatePopulator.clearStorage();
		await EventSubmissionSettingsStore.resetToDefault();
		await SlidingBannerStore.resetToDefault();

		const backupRepository = getEventStoreBackupRepository();
		const clearedBackups = backupRepository
			? await backupRepository.clearAllBackups()
			: 0;

		let nextAdminTokenVersion: number | undefined;
		let clearedAdminSessions: number | undefined;
		let clearedActionMetrics: number | undefined;
		let clearedRateLimitCounters: number | undefined;
		if (mode === "hard") {
			nextAdminTokenVersion = await revokeAllAdminSessions();
			const [clearedSessionsCount, clearedMetricsCount, clearedRateLimitCount] =
				await Promise.all([
					(async () => {
						const repository = getAdminSessionRepository();
						return repository ? repository.clearAllSessions() : 0;
					})(),
					(async () => {
						const repository = getActionMetricsRepository();
						return repository ? repository.clearAllMetrics() : 0;
					})(),
					(async () => {
						const repository = getRateLimitRepository();
						return repository ? repository.clearAllCounters() : 0;
					})(),
				]);
			clearedAdminSessions = clearedSessionsCount;
			clearedActionMetrics = clearedMetricsCount;
			clearedRateLimitCounters = clearedRateLimitCount;
		}

		await forceRefreshEventsData();
		revalidateEventsPaths(["/", "/submit-event"]);
		revalidatePath("/submit-event");
		invalidateSlidingBannerCache();

		log.warn("admin-reset", "Factory reset completed", {
			clearedFeaturedEntries,
			clearedEventSubmissions,
			clearedBackups,
			mode,
			nextAdminTokenVersion,
			clearedAdminSessions,
			clearedActionMetrics,
			clearedRateLimitCounters,
		});

		return {
			success: true,
			message:
				mode === "hard"
					? "Hard reset complete. Runtime/admin data, sessions, metrics, and rate limits were reset."
					: "Factory reset complete. Store, featured queue, collected users, submissions, and caches were reset.",
			summary: {
				mode,
				clearedFeaturedEntries,
				clearedEventSubmissions,
				clearedBackups,
				nextAdminTokenVersion,
				clearedAdminSessions,
				clearedActionMetrics,
				clearedRateLimitCounters,
			},
		};
	} catch (error) {
		return {
			success: false,
			message: "Factory reset failed",
			error: error instanceof Error ? error.message : "Unknown reset error",
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
	canImport?: boolean;
	importBlockedReason?: string;
	schemaIssues?: CsvSchemaIssue[];
	schemaBlockingCount?: number;
	schemaWarningCount?: number;
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
		const schemaReport = analyzeCsvSchemaRows(allRows, {
			eventKeyMode: "warn",
		});
		const importBlockedReason =
			buildSchemaBlockingMessage(schemaReport.issues) || undefined;
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
			canImport: !importBlockedReason,
			importBlockedReason,
			schemaIssues: schemaReport.issues.slice(0, 50),
			schemaBlockingCount: schemaReport.blockingCount,
			schemaWarningCount: schemaReport.warningCount,
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
		const sheet = csvToEditableSheet(remoteFetchResult.content);
		const schemaReport = analyzeCsvSchemaRows(sheet.rows, {
			eventKeyMode: "warn",
		});
		const importBlockedReason = buildSchemaBlockingMessage(schemaReport.issues);
		if (importBlockedReason) {
			return {
				success: false,
				message: "Import blocked by schema validation",
				error: importBlockedReason,
			};
		}
		const runtimeValidationError = getCsvRuntimeValidationError(
			remoteFetchResult.content,
		);
		if (runtimeValidationError) {
			return {
				success: false,
				message: "CSV structure validation failed",
				error: runtimeValidationError,
			};
		}
		const normalizedCsv = normalizeCsvForStorage(remoteFetchResult.content);
		const saved = await LocalEventStore.saveCsv(normalizedCsv, {
			updatedBy: "admin-google-import",
			origin: "google-import",
		});
		await warmCoordinateCacheFromCsv(normalizedCsv, "import-remote");
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
		const sanitized = stripLegacyFeaturedColumn(sheet.columns, sheet.rows);

		return {
			success: true,
			columns: sanitized.columns,
			rows: sanitized.rows,
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
		const schemaReport = analyzeCsvSchemaRows(validation.rows, {
			eventKeyMode: "warn",
		});
		const importBlockedReason = buildSchemaBlockingMessage(schemaReport.issues);
		if (importBlockedReason) {
			return {
				success: false,
				message: "CSV schema validation failed",
				error: importBlockedReason,
			};
		}

		const csvContent = editableSheetToCsv(validation.columns, validation.rows);
		const runtimeValidationError = getCsvRuntimeValidationError(csvContent);
		if (runtimeValidationError) {
			return {
				success: false,
				message: "CSV structure validation failed",
				error: runtimeValidationError,
			};
		}
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
			message: shouldRevalidateHomepage
				? "Saved event sheet to store and revalidated homepage"
				: "Saved event sheet to store",
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
