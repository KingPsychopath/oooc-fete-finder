/**
 * Environment Variable Schema Definitions
 * Pure schema definitions - no validation, no managers, just the structure
 */

import { env } from "./env-parser";

// ========================================
// SERVER-ONLY ENVIRONMENT VARIABLES
// ========================================

/**
 * Server-side environment schema factory
 * These variables are NEVER sent to the client
 * 
 * IMPORTANT: This is a function to prevent client-side evaluation
 */
export function createServerEnvironmentSchema() {
	// Only create schema on server-side
	if (typeof window !== "undefined") {
		throw new Error("Server environment schema cannot be accessed on client-side");
	}

	return {
		// Core settings
		NODE_ENV: env.string("NODE_ENV", "development"),
		
		// Admin & Security (NEVER expose to client)
		ADMIN_KEY: process.env.NODE_ENV === "production" 
			? env.string("ADMIN_KEY").required()
			: env.string("ADMIN_KEY", "dev-key-123"),
		
		// Google Sheets Integration (server-only for security)
		REMOTE_CSV_URL: env.string("REMOTE_CSV_URL", ""),
		GOOGLE_SHEETS_API_KEY: env.string("GOOGLE_SHEETS_API_KEY", ""),
		GOOGLE_SHEET_ID: env.string("GOOGLE_SHEET_ID", ""),
		GOOGLE_SHEET_RANGE: env.string("GOOGLE_SHEET_RANGE", "A1:O1000"),
		GOOGLE_SERVICE_ACCOUNT_KEY: env.string("GOOGLE_SERVICE_ACCOUNT_KEY", ""),
		GOOGLE_SERVICE_ACCOUNT_FILE: env.string("GOOGLE_SERVICE_ACCOUNT_FILE", ""),
		GOOGLE_SHEETS_URL: env.string("GOOGLE_SHEETS_URL", ""),
		
		// Cache Configuration (server-side only)
		CACHE_DURATION_MS: env.int("CACHE_DURATION_MS", 3600000),        // 1 hour
		REMOTE_REFRESH_INTERVAL_MS: env.int("REMOTE_REFRESH_INTERVAL_MS", 300000), // 5 minutes
		MAX_CACHE_AGE_MS: env.int("MAX_CACHE_AGE_MS", 21600000),        // 6 hours
		CACHE_EXTENSION_DURATION_MS: env.int("CACHE_EXTENSION_DURATION_MS", 1800000), // 30 minutes
		CACHE_MAX_MEMORY_BYTES: env.int("CACHE_MAX_MEMORY_BYTES", 52428800),  // 50MB
		CACHE_MEMORY_CHECK_INTERVAL_MS: env.int("CACHE_MEMORY_CHECK_INTERVAL_MS", 300000), // 5 minutes
		CACHE_CLEANUP_THRESHOLD: env.float("CACHE_CLEANUP_THRESHOLD", 0.8),      // 80%
		CACHE_EMERGENCY_THRESHOLD: env.float("CACHE_EMERGENCY_THRESHOLD", 0.95),   // 95%
		CACHE_MAX_METRICS_HISTORY: env.int("CACHE_MAX_METRICS_HISTORY", 100),
		CACHE_METRICS_RESET_INTERVAL_MS: env.int("CACHE_METRICS_RESET_INTERVAL_MS", 86400000), // 24 hours
		CACHE_DEDUPLICATION_TIMEOUT_MS: env.int("CACHE_DEDUPLICATION_TIMEOUT_MS", 30000), // 30 seconds
		CACHE_MAX_RETRY_ATTEMPTS: env.int("CACHE_MAX_RETRY_ATTEMPTS", 3),
		CACHE_RETRY_BACKOFF_MS: env.int("CACHE_RETRY_BACKOFF_MS", 1000),      // 1 second
		CACHE_BOOTSTRAP_MODE: env.bool("CACHE_BOOTSTRAP_MODE", false),
		CACHE_VERBOSE_LOGGING: env.bool("CACHE_VERBOSE_LOGGING", false),
		CACHE_LOG_MEMORY_USAGE: env.bool("CACHE_LOG_MEMORY_USAGE", true),
		CACHE_LOG_PERFORMANCE_METRICS: env.bool("CACHE_LOG_PERFORMANCE_METRICS", false),
		
		// Data source
		LOCAL_CSV_LAST_UPDATED: env.string("LOCAL_CSV_LAST_UPDATED", "2025-01-18"),
		
		// OG Images
		DEFAULT_OG_IMAGE: env.string("DEFAULT_OG_IMAGE", ""),
	};
}

/**
 * Lazy-initialized server environment schema
 * Only evaluated when accessed on server-side
 */
let _serverEnvSchema: ReturnType<typeof createServerEnvironmentSchema> | null = null;

export const SERVER_ENV_SCHEMA = new Proxy({} as ReturnType<typeof createServerEnvironmentSchema>, {
	get(_target, prop) {
		if (!_serverEnvSchema) {
			_serverEnvSchema = createServerEnvironmentSchema();
		}
		return _serverEnvSchema[prop as keyof typeof _serverEnvSchema];
	}
});

// ========================================
// CLIENT-SAFE ENVIRONMENT VARIABLES
// ========================================

/**
 * Client-side environment schema
 * These variables are sent to the browser and should NOT contain secrets
 */
export const CLIENT_ENV_SCHEMA = {
	// Site configuration (safe for client)
	NEXT_PUBLIC_BASE_PATH: env.string("NEXT_PUBLIC_BASE_PATH", ""),
	NEXT_PUBLIC_SITE_URL: env.string("NEXT_PUBLIC_SITE_URL", "http://localhost:3000"),
	
	// Admin UI settings (non-sensitive)
	NEXT_PUBLIC_ADMIN_SESSION_HOURS: env.int("NEXT_PUBLIC_ADMIN_SESSION_HOURS", 24),
	
	// Auth settings (client-side duration only)
	NEXT_PUBLIC_AUTH_EXPIRY_DAYS: env.int("NEXT_PUBLIC_AUTH_EXPIRY_DAYS", 30),
} as const;

// ========================================
// TYPE DEFINITIONS
// ========================================

export type ServerEnvironmentConfig = ReturnType<typeof createServerEnvironmentSchema>;
export type ClientEnvironmentConfig = typeof CLIENT_ENV_SCHEMA; 