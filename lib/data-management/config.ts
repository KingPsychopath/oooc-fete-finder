/**
 * Data management configuration
 * Now uses centralized environment configuration
 * Note: Cache-related configuration has moved to lib/cache-management/cache-config.ts
 */

import { env } from "@/lib/config/env";

export const DATA_CONFIG = {
	/** Google Sheets CSV URL - configurable via environment variable */
	REMOTE_CSV_URL: env.server.REMOTE_CSV_URL,

	/** Default Google Sheets range */
	DEFAULT_SHEET_RANGE: env.server.GOOGLE_SHEET_RANGE,

	/** Google Sheet ID from environment */
	GOOGLE_SHEET_ID: env.server.GOOGLE_SHEET_ID,
} as const;
