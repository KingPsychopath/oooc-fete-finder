"use server";

import {
	revokeAllAdminSessions,
	secureCompare,
} from "@/features/auth/admin-auth-token";
import { validateAdminAccessFromServerContext } from "@/features/auth/admin-validation";
import { UserCollectionStore } from "@/features/auth/user-collection-store";
import { clearFeaturedQueueHistory as clearFeaturedQueueHistoryService } from "@/features/events/featured/service";
import {
	DEFAULT_GENRE_ALIASES,
	DEFAULT_GENRE_TAXONOMY,
	type GenreTaxonomySnapshot,
	normalizeGenreKey,
	resolveMusicGenre,
	toGenreLabel,
} from "@/features/events/genre-normalization";
import { EventSubmissionSettingsStore } from "@/features/events/submissions/settings-store";
import { clearAllEventSubmissions } from "@/features/events/submissions/store";
import type { ParisArrondissement } from "@/features/events/types";
import { LocationRepository } from "@/features/locations/location-repository";
import { LocationResolver } from "@/features/locations/location-resolver";
import {
	generateLocationStorageKey,
	isCoordinateResolvableInput,
} from "@/features/locations/location-utils";
import { createGoogleGeocodingProvider } from "@/features/locations/providers/google-geocoding-provider";
import type { StoredLocationResolution } from "@/features/locations/types";
import { EventCoordinatePopulator } from "@/features/maps/event-coordinate-populator";
import { invalidateSlidingBannerCache } from "@/features/site-settings/cache";
import { SlidingBannerStore } from "@/features/site-settings/sliding-banner-store";
import { env } from "@/lib/config/env";
import { log } from "@/lib/platform/logger";
import { getActionMetricsRepository } from "@/lib/platform/postgres/action-metrics-repository";
import { getAdminSessionRepository } from "@/lib/platform/postgres/admin-session-repository";
import { getEventStoreBackupRepository } from "@/lib/platform/postgres/event-store-backup-repository";
import {
	getMusicGenreTaxonomyRepository,
	loadGenreTaxonomySnapshot,
} from "@/lib/platform/postgres/music-genre-taxonomy-repository";
import { getRateLimitRepository } from "@/lib/platform/postgres/rate-limit-repository";
import { revalidatePath } from "next/cache";
import { parseCSVContent } from "./csv/parser";
import {
	type EditableSheetColumn,
	type EditableSheetRow,
	csvToEditableSheet,
	editableSheetToCsv,
	sortEditableSheetRowsByDefaultDate,
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

const DEFAULT_ALIAS_KEYS = new Set(
	DEFAULT_GENRE_ALIASES.map(
		([alias, genreKey]) => `${normalizeGenreKey(alias)}:${genreKey}`,
	),
);
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
 * and store operations. Colocated with data management modules.
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

const COORDINATE_WARMUP_RECOVERABLE_ERROR_FRAGMENT =
	"no geocoding provider is configured";

const PARIS_COORDINATE_BOUNDS = {
	north: 48.92,
	south: 48.8,
	east: 2.48,
	west: 2.22,
} as const;

export interface EventLocationReviewItem {
	id: string;
	locationName: string;
	arrondissement: ParisArrondissement;
	eventCount: number;
	sampleEventNames: string[];
	isResolvable: boolean;
	resolution: StoredLocationResolution | null;
}

export interface EventLocationReviewPayload {
	success: boolean;
	providerConfigured: boolean;
	items?: EventLocationReviewItem[];
	error?: string;
}

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

const isParisArrondissement = (
	value: number | "unknown",
): value is ParisArrondissement =>
	value === "unknown" || (Number.isInteger(value) && value >= 1 && value <= 20);

const parseArrondissementInput = (
	value: number | "unknown",
): ParisArrondissement | null => {
	if (value === "unknown") return "unknown";
	return isParisArrondissement(value) ? value : null;
};

const isWithinParisBounds = (lat: number, lng: number): boolean =>
	lat >= PARIS_COORDINATE_BOUNDS.south &&
	lat <= PARIS_COORDINATE_BOUNDS.north &&
	lng >= PARIS_COORDINATE_BOUNDS.west &&
	lng <= PARIS_COORDINATE_BOUNDS.east;

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
			reason: "No geocoding provider is configured",
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
	userCollectionCount?: number | null;
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
			userCollectionCount: result.restoredUserCollectionCount,
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
	genreTaxonomy?: GenreTaxonomySnapshot;
	status?: Awaited<ReturnType<typeof LocalEventStore.getStatus>>;
	sheetSource?: "store";
	error?: string;
}> {
	if (!(await validateAdminAccess(keyOrToken))) {
		return { success: false, error: "Unauthorized access" };
	}

	try {
		const [status, csv, genreTaxonomy] = await Promise.all([
			LocalEventStore.getStatus(),
			LocalEventStore.getCsv(),
			loadGenreTaxonomySnapshot(),
		]);
		const sheet = csvToEditableSheet(csv);
		const sanitized = stripLegacyFeaturedColumn(sheet.columns, sheet.rows);
		const sortedRows = sortEditableSheetRowsByDefaultDate(sanitized.rows);

		return {
			success: true,
			columns: sanitized.columns,
			rows: sortedRows,
			genreTaxonomy,
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

export async function getMusicGenreTaxonomy(keyOrToken?: string): Promise<{
	success: boolean;
	genreTaxonomy?: GenreTaxonomySnapshot;
	error?: string;
}> {
	if (!(await validateAdminAccess(keyOrToken))) {
		return { success: false, error: "Unauthorized access" };
	}

	try {
		return {
			success: true,
			genreTaxonomy: await loadGenreTaxonomySnapshot(),
		};
	} catch (error) {
		return {
			success: false,
			genreTaxonomy: DEFAULT_GENRE_TAXONOMY,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

export async function createMusicGenreFromEditor(
	labelInput: string,
	keyOrToken?: string,
): Promise<{
	success: boolean;
	genreTaxonomy?: GenreTaxonomySnapshot;
	genreKey?: string;
	message?: string;
	error?: string;
}> {
	if (!(await validateAdminAccess(keyOrToken))) {
		return { success: false, error: "Unauthorized access" };
	}

	try {
		const label = toGenreLabel(labelInput);
		const key = normalizeGenreKey(label);
		if (!key) {
			return { success: false, error: "Genre label is required" };
		}

		const repository = getMusicGenreTaxonomyRepository();
		if (!repository) {
			return {
				success: false,
				error: "Genre taxonomy database unavailable",
			};
		}

		await repository.createCustomGenre({ label });
		const genreTaxonomy = await repository.listTaxonomy();
		revalidateEventsPaths(["/admin", "/"]);
		return {
			success: true,
			genreTaxonomy,
			genreKey: key,
			message: `${label} added to the genre list`,
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

export async function removeMusicGenreFromEditor(
	genreKey: string,
	keyOrToken?: string,
): Promise<{
	success: boolean;
	genreTaxonomy?: GenreTaxonomySnapshot;
	message?: string;
	error?: string;
}> {
	if (!(await validateAdminAccess(keyOrToken))) {
		return { success: false, error: "Unauthorized access" };
	}

	try {
		const repository = getMusicGenreTaxonomyRepository();
		if (!repository) {
			return {
				success: false,
				error: "Genre taxonomy database unavailable",
			};
		}

		const taxonomy = await repository.listTaxonomy();
		const genre = taxonomy.genres.find((item) => item.key === genreKey);
		if (!genre) {
			return { success: false, error: "Choose a valid genre to remove" };
		}
		if (genre.isDefault) {
			return { success: false, error: "Default genres cannot be removed" };
		}

		await repository.removeCustomGenre(genre.key);
		const genreTaxonomy = await repository.listTaxonomy();
		revalidateEventsPaths(["/admin", "/"]);
		return {
			success: true,
			genreTaxonomy,
			message: `${genre.label} removed from custom genres`,
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

export async function mapMusicGenreAliasFromEditor(
	aliasInput: string,
	genreKey: string,
	keyOrToken?: string,
): Promise<{
	success: boolean;
	genreTaxonomy?: GenreTaxonomySnapshot;
	message?: string;
	error?: string;
}> {
	if (!(await validateAdminAccess(keyOrToken))) {
		return { success: false, error: "Unauthorized access" };
	}

	try {
		const repository = getMusicGenreTaxonomyRepository();
		if (!repository) {
			return {
				success: false,
				error: "Genre taxonomy database unavailable",
			};
		}

		const taxonomy = await repository.listTaxonomy();
		const canonicalGenre = resolveMusicGenre(genreKey, taxonomy);
		if (!canonicalGenre) {
			return { success: false, error: "Choose a valid genre to map to" };
		}

		await repository.upsertAlias({
			alias: aliasInput,
			genreKey: canonicalGenre,
		});
		const genreTaxonomy = await repository.listTaxonomy();
		revalidateEventsPaths(["/admin", "/"]);
		return {
			success: true,
			genreTaxonomy,
			message: `${aliasInput} now maps to ${canonicalGenre}`,
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

export async function removeMusicGenreAliasFromEditor(
	aliasInput: string,
	keyOrToken?: string,
): Promise<{
	success: boolean;
	genreTaxonomy?: GenreTaxonomySnapshot;
	message?: string;
	error?: string;
}> {
	if (!(await validateAdminAccess(keyOrToken))) {
		return { success: false, error: "Unauthorized access" };
	}

	try {
		const repository = getMusicGenreTaxonomyRepository();
		if (!repository) {
			return {
				success: false,
				error: "Genre taxonomy database unavailable",
			};
		}

		const taxonomy = await repository.listTaxonomy();
		const alias = normalizeGenreKey(aliasInput);
		const existingAlias = taxonomy.aliases.find((item) => item.alias === alias);
		if (
			existingAlias &&
			DEFAULT_ALIAS_KEYS.has(`${existingAlias.alias}:${existingAlias.genreKey}`)
		) {
			return { success: false, error: "Default aliases cannot be removed" };
		}

		await repository.removeAlias(aliasInput);
		const genreTaxonomy = await repository.listTaxonomy();
		revalidateEventsPaths(["/admin", "/"]);
		return {
			success: true,
			genreTaxonomy,
			message: `${aliasInput} alias removed`,
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

export async function getEventLocationReviewData(
	keyOrToken?: string,
): Promise<EventLocationReviewPayload> {
	if (!(await validateAdminAccess(keyOrToken))) {
		return {
			success: false,
			providerConfigured: false,
			error: "Unauthorized access",
		};
	}

	try {
		const [csv, storedLocations] = await Promise.all([
			LocalEventStore.getCsv(),
			LocationRepository.load(),
		]);
		const processed = await processCSVData(csv ?? "", "store", false, {
			populateCoordinates: false,
		});
		const itemsByKey = new Map<
			EventLocationReviewItem["id"],
			EventLocationReviewItem
		>();

		for (const event of processed.events) {
			const locationName = event.location?.trim() || "";
			const arrondissement = event.arrondissement;
			const isResolvable = isCoordinateResolvableInput(
				locationName,
				arrondissement,
			);
			const id = isResolvable
				? generateLocationStorageKey(locationName, arrondissement)
				: `${locationName.toLowerCase()}_${String(arrondissement)}`;
			const existing = itemsByKey.get(id);
			if (existing) {
				existing.eventCount += 1;
				if (
					existing.sampleEventNames.length < 3 &&
					!existing.sampleEventNames.includes(event.name)
				) {
					existing.sampleEventNames.push(event.name);
				}
				continue;
			}

			itemsByKey.set(id, {
				id,
				locationName,
				arrondissement,
				eventCount: 1,
				sampleEventNames: [event.name].filter(Boolean).slice(0, 3),
				isResolvable,
				resolution: isResolvable ? (storedLocations.get(id) ?? null) : null,
			});
		}

		const providerConfigured = createGoogleGeocodingProvider().isConfigured();
		const items = Array.from(itemsByKey.values()).sort((left, right) => {
			const leftHasTrusted =
				left.resolution?.source === "manual" ||
				left.resolution?.source === "geocoded";
			const rightHasTrusted =
				right.resolution?.source === "manual" ||
				right.resolution?.source === "geocoded";
			if (leftHasTrusted !== rightHasTrusted) return leftHasTrusted ? 1 : -1;
			if (left.isResolvable !== right.isResolvable) {
				return left.isResolvable ? -1 : 1;
			}
			return left.locationName.localeCompare(right.locationName);
		});

		return {
			success: true,
			providerConfigured,
			items,
		};
	} catch (error) {
		return {
			success: false,
			providerConfigured: false,
			error:
				error instanceof Error
					? error.message
					: "Failed to load location review data",
		};
	}
}

export async function resolveEventLocation(
	keyOrToken: string | undefined,
	locationName: string,
	arrondissementInput: number | "unknown",
	options?: { forceRefresh?: boolean },
): Promise<{
	success: boolean;
	message: string;
	resolution?: StoredLocationResolution;
	error?: string;
}> {
	if (!(await validateAdminAccess(keyOrToken))) {
		return { success: false, message: "Unauthorized access" };
	}

	const arrondissement = parseArrondissementInput(arrondissementInput);
	if (!arrondissement) {
		return { success: false, message: "Invalid arrondissement" };
	}
	const name = locationName.trim();
	if (!isCoordinateResolvableInput(name, arrondissement)) {
		return {
			success: false,
			message:
				"Location needs a venue/address and arrondissement before resolving",
		};
	}

	const provider = createGoogleGeocodingProvider();
	if (!provider.isConfigured()) {
		return {
			success: false,
			message: "No geocoding provider configured",
			error:
				"Set GOOGLE_MAPS_API_KEY and enable the Geocoding API, or enter manual coordinates.",
		};
	}

	try {
		const storedLocations = await LocationRepository.load();
		const resolver = new LocationResolver(provider);
		const resolution = await resolver.resolve(
			{ locationName: name, arrondissement },
			storedLocations,
			{
				allowProviderLookup: true,
				allowArrondissementFallback: false,
				forceRefresh: options?.forceRefresh ?? true,
			},
		);

		if (!resolution.coordinates || resolution.source !== "geocoded") {
			return {
				success: false,
				message: "Provider did not return usable coordinates",
			};
		}

		await LocationRepository.save(storedLocations);
		revalidateEventsPaths(["/"]);

		const storageKey = generateLocationStorageKey(name, arrondissement);
		return {
			success: true,
			message: "Location resolved and saved",
			resolution: storedLocations.get(storageKey),
		};
	} catch (error) {
		return {
			success: false,
			message: "Failed to resolve location",
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

export async function saveManualEventLocation(
	keyOrToken: string | undefined,
	locationName: string,
	arrondissementInput: number | "unknown",
	coordinates: { lat: number; lng: number },
): Promise<{ success: boolean; message: string; error?: string }> {
	if (!(await validateAdminAccess(keyOrToken))) {
		return { success: false, message: "Unauthorized access" };
	}

	const arrondissement = parseArrondissementInput(arrondissementInput);
	if (!arrondissement) {
		return { success: false, message: "Invalid arrondissement" };
	}
	const name = locationName.trim();
	const lat = Number(coordinates.lat);
	const lng = Number(coordinates.lng);
	if (!isCoordinateResolvableInput(name, arrondissement)) {
		return {
			success: false,
			message:
				"Location needs a venue/address and arrondissement before saving",
		};
	}
	if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
		return { success: false, message: "Latitude and longitude are required" };
	}
	if (!isWithinParisBounds(lat, lng)) {
		return {
			success: false,
			message: "Coordinates must be within Paris bounds",
		};
	}

	try {
		await EventCoordinatePopulator.setManualLocation(name, arrondissement, {
			lat,
			lng,
		});
		revalidateEventsPaths(["/"]);
		return {
			success: true,
			message: "Manual coordinates saved",
		};
	} catch (error) {
		return {
			success: false,
			message: "Failed to save manual coordinates",
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

export async function clearEventLocationResolution(
	keyOrToken: string | undefined,
	locationName: string,
	arrondissementInput: number | "unknown",
): Promise<{ success: boolean; message: string; error?: string }> {
	if (!(await validateAdminAccess(keyOrToken))) {
		return { success: false, message: "Unauthorized access" };
	}

	const arrondissement = parseArrondissementInput(arrondissementInput);
	if (!arrondissement) {
		return { success: false, message: "Invalid arrondissement" };
	}

	try {
		const removed = await EventCoordinatePopulator.removeStoredLocation(
			locationName.trim(),
			arrondissement,
		);
		revalidateEventsPaths(["/"]);
		return {
			success: true,
			message: removed
				? "Stored coordinates removed; map links will use text search"
				: "No stored coordinates existed for this location",
		};
	} catch (error) {
		return {
			success: false,
			message: "Failed to clear stored location",
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}
