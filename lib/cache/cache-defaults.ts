/**
 * In-code cache defaults. Override only when needed via optional env vars.
 */

import type { CacheConfiguration } from "./cache-types";

const ONE_HOUR_MS = 60 * 60 * 1000;
const THIRTY_MIN_MS = 30 * 60 * 1000;
const TWENTY_FOUR_HOUR_MS = 24 * 60 * 60 * 1000;
const TWO_HOUR_MS = 2 * 60 * 60 * 1000;
const FIVE_MIN_MS = 5 * 60 * 1000;
const FIFTY_MB = 50 * 1024 * 1024;

export const CACHE_DEFAULTS: Omit<CacheConfiguration, "localCsvLastUpdated"> = {
	cacheDuration: ONE_HOUR_MS,
	remoteRefreshInterval: THIRTY_MIN_MS,
	maxCacheAge: TWENTY_FOUR_HOUR_MS,
	cacheExtensionDuration: TWO_HOUR_MS,
	maxMemoryUsage: FIFTY_MB,
	memoryCheckInterval: FIVE_MIN_MS,
	cleanupThreshold: 0.8,
	emergencyThreshold: 0.95,
	maxMetricsHistory: 100,
	metricsResetInterval: TWENTY_FOUR_HOUR_MS,
	deduplicationTimeout: 5000,
	maxRetryAttempts: 3,
	retryBackoffMs: 1000,
	bootstrapMode: true,
	verboseLogging: false,
	logMemoryUsage: false,
	logPerformanceMetrics: false,
};

function coercePositiveInt(value: unknown, defaultVal: number): number {
	if (value === undefined || value === "") return defaultVal;
	const n = Number(value);
	return Number.isInteger(n) && n >= 1 ? n : defaultVal;
}

/**
 * Build cache config from defaults and optional env overrides.
 * Only CACHE_DURATION_MS and REMOTE_REFRESH_INTERVAL_MS are read from env; rest are in-code.
 */
export function getCacheConfigFromEnv(): CacheConfiguration {
	const duration = coercePositiveInt(
		process.env.CACHE_DURATION_MS,
		CACHE_DEFAULTS.cacheDuration,
	);
	const refresh = coercePositiveInt(
		process.env.REMOTE_REFRESH_INTERVAL_MS,
		CACHE_DEFAULTS.remoteRefreshInterval,
	);
	return {
		...CACHE_DEFAULTS,
		cacheDuration: duration,
		remoteRefreshInterval: refresh,
		localCsvLastUpdated: process.env.LOCAL_CSV_LAST_UPDATED ?? "",
	};
}
