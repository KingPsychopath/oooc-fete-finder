/**
 * Cache Configuration Management
 * Defaults live in cache-defaults; optional overrides via CACHE_DURATION_MS, REMOTE_REFRESH_INTERVAL_MS.
 */

import { log } from "@/lib/platform/logger";
import { getCacheConfigFromEnv } from "./cache-defaults";
import type { CacheConfiguration } from "./cache-types";

export class CacheConfigManager {
	private static config: CacheConfiguration | null = null;

	private static loadConfig(): CacheConfiguration {
		return getCacheConfigFromEnv();
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
		log.info("cache", "Configuration updated", { keys: Object.keys(updates) });
	}

	/**
	 * Reset configuration to defaults
	 */
	static resetConfig(): void {
		this.config = this.loadConfig();
		log.info("cache", "Configuration reset to defaults");
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
			`   Bootstrap Mode: ${config.bootstrapMode ? "enabled" : "disabled"}`,
			`   Verbose Logging: ${config.verboseLogging ? "enabled" : "disabled"}`,
		].join("\n");
	}

	/**
	 * Validate configuration values
	 */
	static validateConfig(): { valid: boolean; errors: string[] } {
		const config = this.getConfig();
		const errors: string[] = [];

		// Validate memory settings
		if (config.maxMemoryUsage < 1024 * 1024) {
			// 1MB minimum
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
			cleanupThresholdMB: (
				(config.maxMemoryUsage * config.cleanupThreshold) /
				1024 /
				1024
			).toFixed(1),
			emergencyThresholdMB: (
				(config.maxMemoryUsage * config.emergencyThreshold) /
				1024 /
				1024
			).toFixed(1),
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

export const getCacheConfig = () => CacheConfigManager.getConfig();
export const getCacheManagerConfig = getCacheConfig;
export const getMemoryConfig = () => CacheConfigManager.getMemoryConfig();
export const getPerformanceConfig = () =>
	CacheConfigManager.getPerformanceConfig();
