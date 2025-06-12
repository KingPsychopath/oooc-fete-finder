/**
 * Data management configuration
 * Centralized configuration for data fetching and processing
 */

export const CACHE_CONFIG = {
	/** Cache duration in milliseconds (1 hour default) */
	CACHE_DURATION: parseInt(process.env.CACHE_DURATION_MS || "3600000"),
	
	/** Remote refresh interval in milliseconds (5 minutes default) */
	REMOTE_REFRESH_INTERVAL: parseInt(process.env.REMOTE_REFRESH_INTERVAL_MS || "300000"),
	
	/** Maximum cache age before forcing refresh to current time (6 hours default) */
	MAX_CACHE_AGE: parseInt(process.env.MAX_CACHE_AGE_MS || "21600000"),
	
	/** Extension duration when refreshing cache validity (30 minutes default) */
	CACHE_EXTENSION_DURATION: parseInt(process.env.CACHE_EXTENSION_DURATION_MS || "1800000"),
	
	/** Local CSV file last updated date */
	LOCAL_CSV_LAST_UPDATED: process.env.LOCAL_CSV_LAST_UPDATED || "2025-01-18",
} as const;

export const DATA_CONFIG = {
	/** Google Sheets CSV URL - configurable via environment variable */
	REMOTE_CSV_URL: process.env.REMOTE_CSV_URL || "",
	
	/** Default Google Sheets range */
	DEFAULT_SHEET_RANGE: process.env.GOOGLE_SHEET_RANGE || "A1:O1000",
	
	/** Google Sheet ID from environment */
	GOOGLE_SHEET_ID: process.env.GOOGLE_SHEET_ID || "",
} as const; 