import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
	/**
	 * Server-side Environment Variables
	 * These are never sent to the client and can only be accessed on the server
	 */
	server: {
		// Core settings
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),
		ADMIN_KEY: z.string().min(1, "ADMIN_KEY is required"),
		AUTH_SECRET: z.string().optional(),

		// Google configuration
		GOOGLE_SHEETS_API_KEY: z.string().optional(),
		GOOGLE_MAPS_API_KEY: z.string().optional(),
		GOOGLE_SHEET_ID: z.string().optional(),
		GOOGLE_SERVICE_ACCOUNT_KEY: z.string().optional(),
		GOOGLE_SERVICE_ACCOUNT_FILE: z.string().default("service-account.json"),
		GOOGLE_SHEETS_URL: z.string().url().optional().or(z.literal("")),
		REMOTE_CSV_URL: z.string().url().optional().or(z.literal("")),

		// Cache configuration
		CACHE_DURATION_MS: z.coerce.number().int().min(1).default(3600000), // 1 hour
		REMOTE_REFRESH_INTERVAL_MS: z.coerce.number().int().min(1).default(1800000), // 30 mins
		MAX_CACHE_AGE_MS: z.coerce.number().int().min(1).default(86400000), // 24 hours
		CACHE_EXTENSION_DURATION_MS: z.coerce
			.number()
			.int()
			.min(1)
			.default(7200000), // 2 hours

		// Memory management
		CACHE_MAX_MEMORY_BYTES: z.coerce.number().int().min(1).default(52428800), // 50MB
		CACHE_MEMORY_CHECK_INTERVAL_MS: z.coerce
			.number()
			.int()
			.min(1)
			.default(300000), // 5 mins
		CACHE_CLEANUP_THRESHOLD: z.coerce.number().min(0).max(1).default(0.8), // 80%
		CACHE_EMERGENCY_THRESHOLD: z.coerce.number().min(0).max(1).default(0.95), // 95%

		// Performance settings
		CACHE_MAX_METRICS_HISTORY: z.coerce.number().int().min(1).default(100),
		CACHE_METRICS_RESET_INTERVAL_MS: z.coerce
			.number()
			.int()
			.min(1)
			.default(86400000), // 24 hours
		CACHE_DEDUPLICATION_TIMEOUT_MS: z.coerce
			.number()
			.int()
			.min(1)
			.default(5000), // 5 seconds

		// Error handling
		CACHE_MAX_RETRY_ATTEMPTS: z.coerce.number().int().min(0).default(3),
		CACHE_RETRY_BACKOFF_MS: z.coerce.number().int().min(1).default(1000), // 1 second
		CACHE_BOOTSTRAP_MODE: z
			.enum(["strict", "fallback", "graceful"])
			.default("graceful"),

		// Logging
		CACHE_VERBOSE_LOGGING: z.coerce.boolean().default(false),
		CACHE_LOG_MEMORY_USAGE: z.coerce.boolean().default(true),
		CACHE_LOG_PERFORMANCE_METRICS: z.coerce.boolean().default(false),

		// Data source metadata
		LOCAL_CSV_LAST_UPDATED: z.string().optional(),

		// OG Image default (optional)
		DEFAULT_OG_IMAGE: z.string().optional(),
	},

	/**
	 * Client-side Environment Variables
	 * These are sent to the client and can be accessed anywhere
	 * Must be prefixed with NEXT_PUBLIC_
	 */
	client: {
		NEXT_PUBLIC_BASE_PATH: z.string().default(""),
		NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
		NEXT_PUBLIC_ADMIN_SESSION_HOURS: z.coerce.number().int().min(1).default(24),
		NEXT_PUBLIC_AUTH_EXPIRY_DAYS: z.coerce.number().int().min(1).default(30),
	},

	/**
	 * Runtime Environment Variables
	 * Maps the actual process.env values to the schema
	 */
	runtimeEnv: {
		// Server
		NODE_ENV: process.env.NODE_ENV,
		ADMIN_KEY: process.env.ADMIN_KEY,
		AUTH_SECRET: process.env.AUTH_SECRET,

		// Google configuration
		GOOGLE_SHEETS_API_KEY: process.env.GOOGLE_SHEETS_API_KEY,
		GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,
		GOOGLE_SHEET_ID: process.env.GOOGLE_SHEET_ID,
		GOOGLE_SERVICE_ACCOUNT_KEY: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
		GOOGLE_SERVICE_ACCOUNT_FILE: process.env.GOOGLE_SERVICE_ACCOUNT_FILE,
		GOOGLE_SHEETS_URL: process.env.GOOGLE_SHEETS_URL,
		REMOTE_CSV_URL: process.env.REMOTE_CSV_URL,

		// Cache configuration
		CACHE_DURATION_MS: process.env.CACHE_DURATION_MS,
		REMOTE_REFRESH_INTERVAL_MS: process.env.REMOTE_REFRESH_INTERVAL_MS,
		MAX_CACHE_AGE_MS: process.env.MAX_CACHE_AGE_MS,
		CACHE_EXTENSION_DURATION_MS: process.env.CACHE_EXTENSION_DURATION_MS,

		// Memory management
		CACHE_MAX_MEMORY_BYTES: process.env.CACHE_MAX_MEMORY_BYTES,
		CACHE_MEMORY_CHECK_INTERVAL_MS: process.env.CACHE_MEMORY_CHECK_INTERVAL_MS,
		CACHE_CLEANUP_THRESHOLD: process.env.CACHE_CLEANUP_THRESHOLD,
		CACHE_EMERGENCY_THRESHOLD: process.env.CACHE_EMERGENCY_THRESHOLD,

		// Performance settings
		CACHE_MAX_METRICS_HISTORY: process.env.CACHE_MAX_METRICS_HISTORY,
		CACHE_METRICS_RESET_INTERVAL_MS:
			process.env.CACHE_METRICS_RESET_INTERVAL_MS,
		CACHE_DEDUPLICATION_TIMEOUT_MS: process.env.CACHE_DEDUPLICATION_TIMEOUT_MS,

		// Error handling
		CACHE_MAX_RETRY_ATTEMPTS: process.env.CACHE_MAX_RETRY_ATTEMPTS,
		CACHE_RETRY_BACKOFF_MS: process.env.CACHE_RETRY_BACKOFF_MS,
		CACHE_BOOTSTRAP_MODE: process.env.CACHE_BOOTSTRAP_MODE,

		// Logging
		CACHE_VERBOSE_LOGGING: process.env.CACHE_VERBOSE_LOGGING,
		CACHE_LOG_MEMORY_USAGE: process.env.CACHE_LOG_MEMORY_USAGE,
		CACHE_LOG_PERFORMANCE_METRICS: process.env.CACHE_LOG_PERFORMANCE_METRICS,

		// Data source metadata
		LOCAL_CSV_LAST_UPDATED: process.env.LOCAL_CSV_LAST_UPDATED,
		DEFAULT_OG_IMAGE: process.env.DEFAULT_OG_IMAGE,

		// Client
		NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH,
		NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
		NEXT_PUBLIC_ADMIN_SESSION_HOURS:
			process.env.NEXT_PUBLIC_ADMIN_SESSION_HOURS,
		NEXT_PUBLIC_AUTH_EXPIRY_DAYS: process.env.NEXT_PUBLIC_AUTH_EXPIRY_DAYS,
	},

	/**
	 * Skip validation during build time in some cases
	 */
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});

// ========================================
// HELPER FUNCTIONS (STREAMLINED)
// ========================================

/**
 * Check if running in development mode
 */
export const isDev = () => env.NODE_ENV === "development";

/**
 * Check if running in production mode
 */
export const isProd = () => env.NODE_ENV === "production";

/**
 * Check if running in test mode
 */
export const isTest = () => env.NODE_ENV === "test";

/**
 * Get current environment name
 */
export const currentEnv = () => env.NODE_ENV;

/**
 * Get cache configuration
 */
export const getCacheConfig = () => ({
	// Core cache settings
	cacheDuration: env.CACHE_DURATION_MS,
	remoteRefreshInterval: env.REMOTE_REFRESH_INTERVAL_MS,
	maxCacheAge: env.MAX_CACHE_AGE_MS,
	cacheExtensionDuration: env.CACHE_EXTENSION_DURATION_MS,

	// Memory management
	maxMemoryUsage: env.CACHE_MAX_MEMORY_BYTES,
	memoryCheckInterval: env.CACHE_MEMORY_CHECK_INTERVAL_MS,
	cleanupThreshold: env.CACHE_CLEANUP_THRESHOLD,
	emergencyThreshold: env.CACHE_EMERGENCY_THRESHOLD,

	// Performance settings
	maxMetricsHistory: env.CACHE_MAX_METRICS_HISTORY,
	metricsResetInterval: env.CACHE_METRICS_RESET_INTERVAL_MS,
	deduplicationTimeout: env.CACHE_DEDUPLICATION_TIMEOUT_MS,

	// Error handling
	maxRetryAttempts: env.CACHE_MAX_RETRY_ATTEMPTS,
	retryBackoffMs: env.CACHE_RETRY_BACKOFF_MS,
	bootstrapMode: env.CACHE_BOOTSTRAP_MODE !== "strict", // Convert enum to boolean

	// Logging
	verboseLogging: env.CACHE_VERBOSE_LOGGING,
	logMemoryUsage: env.CACHE_LOG_MEMORY_USAGE,
	logPerformanceMetrics: env.CACHE_LOG_PERFORMANCE_METRICS,

	// Data source metadata
	localCsvLastUpdated: env.LOCAL_CSV_LAST_UPDATED || "",
});

/**
 * Get memory configuration (legacy helper for existing code)
 */
export const getMemoryConfig = () => ({
	MAX_MEMORY_USAGE: env.CACHE_MAX_MEMORY_BYTES,
	MEMORY_CHECK_INTERVAL: env.CACHE_MEMORY_CHECK_INTERVAL_MS,
	CLEANUP_THRESHOLD: env.CACHE_CLEANUP_THRESHOLD,
	EMERGENCY_THRESHOLD: env.CACHE_EMERGENCY_THRESHOLD,
});

/**
 * Get Google Sheets configuration status
 */
export const getGoogleSheetsStatus = () => ({
	hasApiKey: !!(env.GOOGLE_SHEETS_API_KEY && env.GOOGLE_SHEET_ID),
	hasServiceAccount: !!(
		(env.GOOGLE_SERVICE_ACCOUNT_KEY || env.GOOGLE_SERVICE_ACCOUNT_FILE) &&
		env.GOOGLE_SHEET_ID
	),
	hasDirectUrl: !!(
		env.GOOGLE_SHEETS_URL && env.GOOGLE_SHEETS_URL.startsWith("https://")
	),
	hasRemoteUrl: !!(
		env.REMOTE_CSV_URL && env.REMOTE_CSV_URL.startsWith("https://")
	),
	isConfigured: function () {
		return (
			this.hasApiKey ||
			this.hasServiceAccount ||
			this.hasDirectUrl ||
			this.hasRemoteUrl
		);
	},
});

/**
 * Get admin configuration
 */
export const getAdminConfig = () => {
	return {
		key: env.ADMIN_KEY,
		isDevelopment: isDev(),
		isProduction: isProd(),
	};
};

/**
 * Get site configuration
 */
export const getSiteConfig = () => {
	return {
		basePath: env.NEXT_PUBLIC_BASE_PATH,
		siteUrl: env.NEXT_PUBLIC_SITE_URL,
	};
};

/**
 * Get admin UI configuration
 */
export const getAdminUIConfig = () => {
	return {
		sessionHours: env.NEXT_PUBLIC_ADMIN_SESSION_HOURS,
		authExpiryDays: env.NEXT_PUBLIC_AUTH_EXPIRY_DAYS,
	};
};

/**
 * Log current configuration status (for debugging)
 */
export const logConfigStatus = (): void => {
	if (typeof window !== "undefined") return;

	const googleStatus = getGoogleSheetsStatus();

	console.log("🔧 Environment Configuration Status:");
	console.log(`   Environment: ${env.NODE_ENV}`);
	console.log(`   Admin Key: ${env.ADMIN_KEY ? "✅ Set" : "❌ Missing"}`);
	console.log(
		`   Google Sheets: ${googleStatus.isConfigured() ? "✅ Configured" : "⚠️ Not configured"}`,
	);
	console.log(`   Cache Duration: ${env.CACHE_DURATION_MS}ms`);
	console.log(`   Max Cache Age: ${env.MAX_CACHE_AGE_MS}ms`);
	console.log(`   Site URL: ${env.NEXT_PUBLIC_SITE_URL}`);

	if (googleStatus.isConfigured()) {
		console.log("   Google Sheets Details:");
		if (googleStatus.hasApiKey) console.log("     - API Key: ✅");
		if (googleStatus.hasServiceAccount)
			console.log("     - Service Account: ✅");
		if (googleStatus.hasDirectUrl) console.log("     - Direct URL: ✅");
		if (googleStatus.hasRemoteUrl) console.log("     - Remote CSV: ✅");
	}
};
