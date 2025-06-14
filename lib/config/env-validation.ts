/**
 * Environment Variable Validation
 * Pure validation functions - no managers, no schemas, just validation logic
 */

import { SERVER_ENV_SCHEMA, CLIENT_ENV_SCHEMA } from "./env-schema";

// ========================================
// VALIDATION FUNCTIONS
// ========================================

/**
 * Validate cache configuration values
 * Called during app initialization to catch configuration errors early
 */
export function validateCacheConfig(): void {
	const config = SERVER_ENV_SCHEMA;
	
	// Validate cache durations are positive
	if (config.CACHE_DURATION_MS < 0 || config.CACHE_DURATION_MS > 86400000) {
		throw new Error("CACHE_DURATION_MS must be between 0 and 86400000 (24 hours)");
	}
	
	if (config.MAX_CACHE_AGE_MS < 0 || config.MAX_CACHE_AGE_MS > 604800000) {
		throw new Error("MAX_CACHE_AGE_MS must be between 0 and 604800000 (7 days)");
	}
	
	if (config.CACHE_EXTENSION_DURATION_MS < 0 || config.CACHE_EXTENSION_DURATION_MS > 3600000) {
		throw new Error("CACHE_EXTENSION_DURATION_MS must be between 0 and 3600000 (1 hour)");
	}
	
	// Validate thresholds are between 0 and 1
	if (config.CACHE_CLEANUP_THRESHOLD <= 0 || config.CACHE_CLEANUP_THRESHOLD > 1) {
		throw new Error("CACHE_CLEANUP_THRESHOLD must be between 0 and 1");
	}
}

/**
 * Validate Google Sheets configuration
 * Returns true if properly configured for remote data fetching
 */
export function validateGoogleSheetsConfig(): boolean {
	const config = SERVER_ENV_SCHEMA;
	
	// Check if we have either API key or service account setup
	const hasApiKey = config.GOOGLE_SHEETS_API_KEY && config.GOOGLE_SHEET_ID;
	const hasServiceAccount = (config.GOOGLE_SERVICE_ACCOUNT_KEY || config.GOOGLE_SERVICE_ACCOUNT_FILE) && config.GOOGLE_SHEET_ID;
	const hasDirectUrl = config.GOOGLE_SHEETS_URL && config.GOOGLE_SHEETS_URL.startsWith("https://");
	const hasRemoteUrl = config.REMOTE_CSV_URL && config.REMOTE_CSV_URL.startsWith("https://");
	
	return !!(hasApiKey || hasServiceAccount || hasDirectUrl || hasRemoteUrl);
}

/**
 * Validate environment configuration
 * Returns validation results with errors and warnings
 */
export function validateEnvironmentConfig(): { isValid: boolean; errors: string[]; warnings: string[] } {
	const errors: string[] = [];
	const warnings: string[] = [];
	
	// Check required variables in production
	if (process.env.NODE_ENV === "production") {
		if (!SERVER_ENV_SCHEMA.ADMIN_KEY) {
			errors.push("ADMIN_KEY: Admin key is required in production for security");
		}
	}
	
	// Check recommended variables
	if (!CLIENT_ENV_SCHEMA.NEXT_PUBLIC_SITE_URL || CLIENT_ENV_SCHEMA.NEXT_PUBLIC_SITE_URL === "http://localhost:3000") {
		warnings.push("NEXT_PUBLIC_SITE_URL: Site URL should be set for proper OG image generation");
	}
	
	if (!validateGoogleSheetsConfig()) {
		warnings.push("Google Sheets: No valid configuration found for remote data fetching");
	}
	
	// Validate admin session hours
	if (CLIENT_ENV_SCHEMA.NEXT_PUBLIC_ADMIN_SESSION_HOURS < 1 || CLIENT_ENV_SCHEMA.NEXT_PUBLIC_ADMIN_SESSION_HOURS > 168) {
		errors.push("NEXT_PUBLIC_ADMIN_SESSION_HOURS must be between 1 and 168 hours");
	}
	
	// Validate cache thresholds
	if (SERVER_ENV_SCHEMA.CACHE_EMERGENCY_THRESHOLD < 0 || SERVER_ENV_SCHEMA.CACHE_EMERGENCY_THRESHOLD > 1) {
		errors.push("CACHE_EMERGENCY_THRESHOLD must be between 0 and 1");
	}
	
	// Validate cache durations are positive
	const durationChecks = [
		{ key: 'CACHE_DURATION_MS', value: SERVER_ENV_SCHEMA.CACHE_DURATION_MS },
		{ key: 'REMOTE_REFRESH_INTERVAL_MS', value: SERVER_ENV_SCHEMA.REMOTE_REFRESH_INTERVAL_MS },
		{ key: 'MAX_CACHE_AGE_MS', value: SERVER_ENV_SCHEMA.MAX_CACHE_AGE_MS },
		{ key: 'CACHE_EXTENSION_DURATION_MS', value: SERVER_ENV_SCHEMA.CACHE_EXTENSION_DURATION_MS },
	];

	for (const { key, value } of durationChecks) {
		if (value <= 0) {
			errors.push(`${key} must be greater than 0`);
		}
	}
	
	// Validate site URL format in production
	if (SERVER_ENV_SCHEMA.NODE_ENV === "production" && CLIENT_ENV_SCHEMA.NEXT_PUBLIC_SITE_URL) {
		const siteUrl = CLIENT_ENV_SCHEMA.NEXT_PUBLIC_SITE_URL;
		if (!siteUrl.startsWith("https://") && !siteUrl.startsWith("http://")) {
			warnings.push("NEXT_PUBLIC_SITE_URL should include protocol (https://)");
		}
	}

	return {
		isValid: errors.length === 0,
		errors,
		warnings,
	};
}

/**
 * Get environment info for debugging
 */
export function getEnvInfo() {
	return {
		nodeEnv: SERVER_ENV_SCHEMA.NODE_ENV,
		hasGoogleConfig: validateGoogleSheetsConfig(),
		cacheConfig: {
			duration: SERVER_ENV_SCHEMA.CACHE_DURATION_MS,
			maxAge: SERVER_ENV_SCHEMA.MAX_CACHE_AGE_MS,
			extension: SERVER_ENV_SCHEMA.CACHE_EXTENSION_DURATION_MS,
		},
	};
} 