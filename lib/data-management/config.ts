/**
 * Data management configuration
 * Settings specific to data fetching and processing (Google Sheets, CSV, etc.)
 * Note: Cache-related configuration has moved to lib/cache-management/cache-config.ts
 */

export const DATA_CONFIG = {
	/** Google Sheets CSV URL - configurable via environment variable */
	REMOTE_CSV_URL: process.env.REMOTE_CSV_URL || "",
	
	/** Default Google Sheets range */
	DEFAULT_SHEET_RANGE: process.env.GOOGLE_SHEET_RANGE || "A1:O1000",
	
	/** Google Sheet ID from environment */
	GOOGLE_SHEET_ID: process.env.GOOGLE_SHEET_ID || "",
} as const; 