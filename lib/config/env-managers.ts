/**
 * Environment Variable Managers
 * Complex access patterns and manager classes for environment variables
 */

import { SERVER_ENV_SCHEMA, CLIENT_ENV_SCHEMA, type ServerEnvironmentConfig, type ClientEnvironmentConfig } from "./env-schema";
import { validateEnvironmentConfig, validateGoogleSheetsConfig } from "./env-validation";

// ========================================
// ENVIRONMENT MANAGERS
// ========================================

/**
 * Server-side Environment Manager
 * 
 * SECURITY: Contains sensitive data that should NEVER be exposed to the client
 * 
 * Use in: API routes, Server actions, Middleware, Node.js scripts
 * DO NOT use in: React components, Custom hooks, Client-side utilities
 * 
 * Protection: Throws runtime error if accessed on client-side
 */
export class ServerEnvironmentManager {
	private static config: ServerEnvironmentConfig = SERVER_ENV_SCHEMA;
	private static validated = false;

	/**
	 * Get complete server environment configuration
	 * Server-only: Throws error if called on client-side
	 * Validation: Runs startup validation on first access
	 * Production: Throws error if validation fails in production
	 */
	static getConfig(): ServerEnvironmentConfig {
		if (typeof window !== "undefined") {
			throw new Error("ServerEnvironmentManager can only be used on the server-side");
		}

		if (!this.validated) {
			const validation = validateEnvironmentConfig();
			if (!validation.isValid) {
				console.error("Server environment validation failed:");
				validation.errors.forEach(error => console.error(`   - ${error}`));
				if (process.env.NODE_ENV === "production") {
					throw new Error("Invalid server environment configuration");
				}
			}
			if (validation.warnings.length > 0) {
				console.warn("Server environment warnings:");
				validation.warnings.forEach(warning => console.warn(`   - ${warning}`));
			}
			this.validated = true;
		}

		return this.config;
	}

	/**
	 * Get specific environment variable by key
	 * Server-only with validation
	 */
	static get<K extends keyof ServerEnvironmentConfig>(key: K): ServerEnvironmentConfig[K] {
		return this.getConfig()[key];
	}

	/**
	 * Check if running in development mode
	 */
	static isDevelopment(): boolean {
		return this.get("NODE_ENV") === "development";
	}

	/**
	 * Check if running in production mode
	 */
	static isProduction(): boolean {
		return this.get("NODE_ENV") === "production";
	}

	/**
	 * Get Google Sheets configuration status
	 */
	static getGoogleSheetsStatus() {
		const config = this.getConfig();
		return {
			hasApiKey: !!(config.GOOGLE_SHEETS_API_KEY && config.GOOGLE_SHEET_ID),
			hasServiceAccount: !!(
				(config.GOOGLE_SERVICE_ACCOUNT_KEY || config.GOOGLE_SERVICE_ACCOUNT_FILE) && 
				config.GOOGLE_SHEET_ID
			),
			hasDirectUrl: !!(config.GOOGLE_SHEETS_URL && config.GOOGLE_SHEETS_URL.startsWith("https://")),
			hasRemoteUrl: !!(config.REMOTE_CSV_URL && config.REMOTE_CSV_URL.startsWith("https://")),
			isConfigured: validateGoogleSheetsConfig(),
		};
	}

	/**
	 * Get cache configuration
	 */
	static getCacheConfig() {
		const config = this.getConfig();
		return {
			// Core cache settings
			cacheDuration: config.CACHE_DURATION_MS,
			remoteRefreshInterval: config.REMOTE_REFRESH_INTERVAL_MS,
			maxCacheAge: config.MAX_CACHE_AGE_MS,
			cacheExtensionDuration: config.CACHE_EXTENSION_DURATION_MS,

			// Memory management
			maxMemoryUsage: config.CACHE_MAX_MEMORY_BYTES,
			memoryCheckInterval: config.CACHE_MEMORY_CHECK_INTERVAL_MS,
			cleanupThreshold: config.CACHE_CLEANUP_THRESHOLD,
			emergencyThreshold: config.CACHE_EMERGENCY_THRESHOLD,

			// Performance settings
			maxMetricsHistory: config.CACHE_MAX_METRICS_HISTORY,
			metricsResetInterval: config.CACHE_METRICS_RESET_INTERVAL_MS,
			deduplicationTimeout: config.CACHE_DEDUPLICATION_TIMEOUT_MS,

			// Error handling
			maxRetryAttempts: config.CACHE_MAX_RETRY_ATTEMPTS,
			retryBackoffMs: config.CACHE_RETRY_BACKOFF_MS,
			bootstrapMode: config.CACHE_BOOTSTRAP_MODE,

			// Logging
			verboseLogging: config.CACHE_VERBOSE_LOGGING,
			logMemoryUsage: config.CACHE_LOG_MEMORY_USAGE,
			logPerformanceMetrics: config.CACHE_LOG_PERFORMANCE_METRICS,

			// Data source metadata
			localCsvLastUpdated: config.LOCAL_CSV_LAST_UPDATED,
		};
	}

	/**
	 * Get admin configuration
	 */
	static getAdminConfig() {
		const config = this.getConfig();
		return {
			key: config.ADMIN_KEY,
			isDevelopment: this.isDevelopment(),
		};
	}

	/**
	 * Log current configuration status (for debugging)
	 */
	static logConfigStatus(): void {
		if (typeof window !== "undefined") return;
		
		const config = this.getConfig();
		const googleStatus = this.getGoogleSheetsStatus();
		
		console.log("🔧 Environment Configuration Status:");
		console.log(`   Environment: ${config.NODE_ENV}`);
		console.log(`   Admin Key: ${config.ADMIN_KEY ? "✅ Set" : "❌ Missing"}`);
		console.log(`   Google Sheets: ${googleStatus.isConfigured ? "✅ Configured" : "⚠️ Not configured"}`);
		console.log(`   Cache Duration: ${config.CACHE_DURATION_MS}ms`);
		console.log(`   Max Cache Age: ${config.MAX_CACHE_AGE_MS}ms`);
		console.log(`   Site URL: ${config.NODE_ENV === "production" ? "✅ Production" : "🔧 Development"}`);
		
		if (googleStatus.isConfigured) {
			console.log("   Google Sheets Details:");
			if (googleStatus.hasApiKey) console.log("     - API Key: ✅");
			if (googleStatus.hasServiceAccount) console.log("     - Service Account: ✅");
			if (googleStatus.hasDirectUrl) console.log("     - Direct URL: ✅");
			if (googleStatus.hasRemoteUrl) console.log("     - Remote CSV: ✅");
		}
	}
}

/**
 * Client-side Environment Manager
 * 
 * SAFE: Only contains non-sensitive data that can be exposed to the browser
 * Use in: React components, Custom hooks, Client-side utilities
 */
export class ClientEnvironmentManager {
	private static config: ClientEnvironmentConfig = CLIENT_ENV_SCHEMA;

	/**
	 * Get complete client environment configuration
	 * Safe for client-side use
	 */
	static getConfig(): ClientEnvironmentConfig {
		return this.config;
	}

	/**
	 * Get specific client environment variable by key
	 */
	static get<K extends keyof ClientEnvironmentConfig>(key: K): ClientEnvironmentConfig[K] {
		return this.getConfig()[key];
	}

	/**
	 * Get site configuration
	 */
	static getSiteConfig() {
		const config = this.getConfig();
		return {
			basePath: config.NEXT_PUBLIC_BASE_PATH,
			siteUrl: config.NEXT_PUBLIC_SITE_URL,
		};
	}

	/**
	 * Get admin UI configuration
	 */
	static getAdminUIConfig() {
		const config = this.getConfig();
		return {
			sessionHours: config.NEXT_PUBLIC_ADMIN_SESSION_HOURS,
			authExpiryDays: config.NEXT_PUBLIC_AUTH_EXPIRY_DAYS,
		};
	}
} 