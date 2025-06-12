/**
 * Cache Configuration Management
 * Centralized configuration for all cache-related settings
 */

import type { CacheConfiguration } from "./cache-types";

/**
 * Default cache configuration
 */
const DEFAULT_CONFIG: CacheConfiguration = {
	// Core cache settings (1 hour cache, 5 min refresh check)
	cacheDuration: 3600000, // 1 hour
	remoteRefreshInterval: 300000, // 5 minutes
	maxCacheAge: 21600000, // 6 hours
	cacheExtensionDuration: 1800000, // 30 minutes
	
	// Memory management (50MB limit)
	maxMemoryUsage: 52428800, // 50MB
	memoryCheckInterval: 300000, // 5 minutes
	cleanupThreshold: 0.8, // 80%
	emergencyThreshold: 0.95, // 95%
	
	// Performance settings
	maxMetricsHistory: 100, // Keep last 100 measurements
	metricsResetInterval: 86400000, // 24 hours
	deduplicationTimeout: 30000, // 30 seconds
	
	// Error handling
	maxRetryAttempts: 3,
	retryBackoffMs: 1000,
	bootstrapMode: true,
	
	// Logging
	verboseLogging: false,
	logMemoryUsage: true,
	logPerformanceMetrics: false,
	
	// Data source metadata
	localCsvLastUpdated: "2025-01-18",
};

/**
 * Environment variable mappings
 */
const ENV_MAPPINGS = {
	CACHE_DURATION_MS: 'cacheDuration',
	REMOTE_REFRESH_INTERVAL_MS: 'remoteRefreshInterval',
	MAX_CACHE_AGE_MS: 'maxCacheAge',
	CACHE_EXTENSION_DURATION_MS: 'cacheExtensionDuration',
	CACHE_MAX_MEMORY_BYTES: 'maxMemoryUsage',
	CACHE_MEMORY_CHECK_INTERVAL_MS: 'memoryCheckInterval',
	CACHE_CLEANUP_THRESHOLD: 'cleanupThreshold',
	CACHE_EMERGENCY_THRESHOLD: 'emergencyThreshold',
	CACHE_MAX_METRICS_HISTORY: 'maxMetricsHistory',
	CACHE_METRICS_RESET_INTERVAL_MS: 'metricsResetInterval',
	CACHE_DEDUPLICATION_TIMEOUT_MS: 'deduplicationTimeout',
	CACHE_MAX_RETRY_ATTEMPTS: 'maxRetryAttempts',
	CACHE_RETRY_BACKOFF_MS: 'retryBackoffMs',
	CACHE_BOOTSTRAP_MODE: 'bootstrapMode',
	CACHE_VERBOSE_LOGGING: 'verboseLogging',
	CACHE_LOG_MEMORY_USAGE: 'logMemoryUsage',
	CACHE_LOG_PERFORMANCE_METRICS: 'logPerformanceMetrics',
	LOCAL_CSV_LAST_UPDATED: 'localCsvLastUpdated',
} as const;

/**
 * Cache Configuration Manager
 */
export class CacheConfigManager {
	private static config: CacheConfiguration | null = null;
	
	/**
	 * Load configuration from environment variables and defaults
	 */
	private static loadConfig(): CacheConfiguration {
		const config = { ...DEFAULT_CONFIG };
		
		// Load from environment variables
		for (const [envKey, configKey] of Object.entries(ENV_MAPPINGS)) {
			const envValue = process.env[envKey];
			if (envValue !== undefined) {
				const defaultValue = DEFAULT_CONFIG[configKey as keyof CacheConfiguration];
				
				if (typeof defaultValue === 'number') {
					const parsed = configKey.includes('Threshold') ? parseFloat(envValue) : parseInt(envValue, 10);
					if (!isNaN(parsed)) {
						(config as Record<string, number | boolean | string>)[configKey] = parsed;
					}
				} else if (typeof defaultValue === 'boolean') {
					(config as Record<string, number | boolean | string>)[configKey] = envValue.toLowerCase() === 'true';
				} else if (typeof defaultValue === 'string') {
					(config as Record<string, number | boolean | string>)[configKey] = envValue;
				}
			}
		}
		
		return config;
	}
	
	/**
	 * Get current configuration
	 */
	static getConfig(): CacheConfiguration {
		if (!this.config) {
			this.config = this.loadConfig();
		}
		return this.config;
	}
	
	/**
	 * Update configuration at runtime
	 */
	static updateConfig(updates: Partial<CacheConfiguration>): void {
		this.config = {
			...this.getConfig(),
			...updates,
		};
		console.log("⚙️ Cache configuration updated:", Object.keys(updates));
	}
	
	/**
	 * Reset configuration to defaults
	 */
	static resetConfig(): void {
		this.config = this.loadConfig();
		console.log("⚙️ Cache configuration reset to defaults");
	}
	
	/**
	 * Get configuration summary for logging
	 */
	static getConfigSummary(): string {
		const config = this.getConfig();
		return [
			"⚙️ Cache Configuration:",
			`   Cache Duration: ${(config.cacheDuration / 60000).toFixed(1)}min`,
			`   Remote Refresh: ${(config.remoteRefreshInterval / 60000).toFixed(1)}min`,
			`   Max Memory: ${(config.maxMemoryUsage / 1024 / 1024).toFixed(1)}MB`,
			`   Memory Cleanup: ${(config.cleanupThreshold * 100).toFixed(0)}%`,
			`   Emergency Threshold: ${(config.emergencyThreshold * 100).toFixed(0)}%`,
			`   Bootstrap Mode: ${config.bootstrapMode ? 'enabled' : 'disabled'}`,
			`   Verbose Logging: ${config.verboseLogging ? 'enabled' : 'disabled'}`,
		].join('\n');
	}
	
	/**
	 * Validate configuration values
	 */
	static validateConfig(): { valid: boolean; errors: string[] } {
		const config = this.getConfig();
		const errors: string[] = [];
		
		// Validate memory settings
		if (config.maxMemoryUsage < 1024 * 1024) { // 1MB minimum
			errors.push("maxMemoryUsage must be at least 1MB");
		}
		
		if (config.cleanupThreshold >= config.emergencyThreshold) {
			errors.push("cleanupThreshold must be less than emergencyThreshold");
		}
		
		if (config.cleanupThreshold <= 0 || config.cleanupThreshold >= 1) {
			errors.push("cleanupThreshold must be between 0 and 1");
		}
		
		if (config.emergencyThreshold <= 0 || config.emergencyThreshold >= 1) {
			errors.push("emergencyThreshold must be between 0 and 1");
		}
		
		// Validate timing settings
		if (config.cacheDuration <= 0) {
			errors.push("cacheDuration must be positive");
		}
		
		if (config.remoteRefreshInterval <= 0) {
			errors.push("remoteRefreshInterval must be positive");
		}
		
		if (config.maxRetryAttempts < 0) {
			errors.push("maxRetryAttempts must be non-negative");
		}
		
		return {
			valid: errors.length === 0,
			errors,
		};
	}
	
	/**
	 * Get memory configuration specifically
	 */
	static getMemoryConfig() {
		const config = this.getConfig();
		return {
			maxMemoryUsage: config.maxMemoryUsage,
			memoryCheckInterval: config.memoryCheckInterval,
			cleanupThreshold: config.cleanupThreshold,
			emergencyThreshold: config.emergencyThreshold,
			maxMemoryMB: (config.maxMemoryUsage / 1024 / 1024).toFixed(1),
			cleanupThresholdMB: ((config.maxMemoryUsage * config.cleanupThreshold) / 1024 / 1024).toFixed(1),
			emergencyThresholdMB: ((config.maxMemoryUsage * config.emergencyThreshold) / 1024 / 1024).toFixed(1),
		};
	}
	
	/**
	 * Get performance configuration
	 */
	static getPerformanceConfig() {
		const config = this.getConfig();
		return {
			maxMetricsHistory: config.maxMetricsHistory,
			metricsResetInterval: config.metricsResetInterval,
			deduplicationTimeout: config.deduplicationTimeout,
			logPerformanceMetrics: config.logPerformanceMetrics,
		};
	}
	
	/**
	 * Check if verbose logging is enabled
	 */
	static isVerboseLoggingEnabled(): boolean {
		return this.getConfig().verboseLogging;
	}
	
	/**
	 * Check if memory usage logging is enabled
	 */
	static isMemoryLoggingEnabled(): boolean {
		return this.getConfig().logMemoryUsage;
	}
}

// Export commonly used configuration getters for convenience
export const getCacheConfig = () => CacheConfigManager.getConfig();
export const getMemoryConfig = () => CacheConfigManager.getMemoryConfig();
export const getPerformanceConfig = () => CacheConfigManager.getPerformanceConfig(); 