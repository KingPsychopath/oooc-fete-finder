/**
 * Cache Configuration Management
 * Now uses centralized environment configuration
 */

import { getCacheConfig } from "@/lib/config/env";
import type { CacheConfiguration } from "./cache-types";

/**
 * Cache Configuration Manager
 * Now delegates to centralized environment management
 */
export class CacheConfigManager {
	private static config: CacheConfiguration | null = null;

	/**
	 * Load configuration from centralized environment manager
	 */
	private static loadConfig(): CacheConfiguration {
		return getCacheConfig();
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

// Export commonly used configuration getters for convenience
export const getCacheManagerConfig = () => CacheConfigManager.getConfig();
export const getMemoryConfig = () => CacheConfigManager.getMemoryConfig();
export const getPerformanceConfig = () =>
	CacheConfigManager.getPerformanceConfig();
