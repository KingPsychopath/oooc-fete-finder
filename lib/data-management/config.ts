/**
 * Data management configuration
 * Now uses centralized environment configuration
 * Note: Cache-related configuration has moved to lib/cache-management/cache-config.ts
 */

import { ServerEnvironmentManager } from "@/lib/config/env";

export const DATA_CONFIG = {
	/** Google Sheets CSV URL - configurable via environment variable */
	REMOTE_CSV_URL: ServerEnvironmentManager.get("REMOTE_CSV_URL"),

	/** Default Google Sheets range */
	DEFAULT_SHEET_RANGE: ServerEnvironmentManager.get("GOOGLE_SHEET_RANGE"),

	/** Google Sheet ID from environment */
	GOOGLE_SHEET_ID: ServerEnvironmentManager.get("GOOGLE_SHEET_ID"),
} as const;
