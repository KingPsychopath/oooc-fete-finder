/**
 * Cache Management Type Definitions
 * Centralized type definitions for all cache-related interfaces
 */

import { Event } from "@/types/events";

// ========================================
// Core Cache Operation Results
// ========================================

export interface EventsResult {
	success: boolean;
	data: Event[];
	count: number;
	cached: boolean;
	source: "remote" | "local" | "store" | "cached";
	error?: string;
	lastUpdate?: string;
}

export interface CacheRefreshResult {
	success: boolean;
	message: string;
	data?: Event[];
	count?: number;
	source?: "remote" | "local" | "store" | "cached";
	error?: string;
}

export interface FullRevalidationResult {
	success: boolean;
	message: string;
	cacheRefreshed: boolean;
	pageRevalidated: boolean;
	error?: string;
	details?: {
		cacheResult?: CacheRefreshResult;
		cacheError?: string;
		revalidationError?: string;
	};
}

// ========================================
// Cache Status & State
// ========================================

export interface CacheState {
	events: Event[] | null;
	lastFetchTime: number;
	lastRemoteFetchTime: number;
	lastRemoteSuccessTime: number;
	lastRemoteErrorMessage: string;
	lastDataSource: "remote" | "local" | "store" | "cached";
	// Memory management fields
	memoryUsage: number;
	lastMemoryCheck: number;
}

export interface CacheStateStatus {
	hasCachedData: boolean;
	lastFetchTime: string | null;
	lastRemoteFetchTime: string | null;
	lastRemoteSuccessTime: string | null;
	lastRemoteErrorMessage: string;
	cacheAge: number;
	nextRemoteCheck: number;
	dataSource: "remote" | "local" | "store" | "cached";
	eventCount: number;
	// Memory management status
	memoryUsage: number;
	memoryLimit: number;
	memoryUtilization: number;
}

export interface CacheStatus extends CacheStateStatus {
	configuredDataSource: "remote" | "local" | "static";
	localCsvLastUpdated: string;
	remoteConfigured: boolean;
	hasLocalStoreData: boolean;
}

// ========================================
// Memory Management
// ========================================

export interface MemoryStats {
	currentUsage: number;
	maxLimit: number;
	utilizationPercent: number;
	eventCount: number;
	averageSizePerEvent: number;
	lastCleanup?: string;
}

export interface MemoryLimitsCheck {
	withinLimits: boolean;
	needsCleanup: boolean;
	needsEmergencyCleanup: boolean;
	stats: MemoryStats;
}

// ========================================
// Cache Invalidation
// ========================================

export interface ChangeDetails {
	countChanged: boolean;
	addedEvents: string[];
	removedEvents: string[];
	modifiedEvents: string[];
}

export interface InvalidationResult {
	success: boolean;
	dataChanged: boolean;
	invalidated: boolean;
	message: string;
	changeDetails?: ChangeDetails;
}

export interface CacheClearResult {
	success: boolean;
	clearedPaths: string[];
	errors: string[];
}

export interface EmergencyCacheBustResult {
	success: boolean;
	message: string;
	operations: string[];
	errors: string[];
}

// ========================================
// Performance Metrics
// ========================================

export interface CacheMetricsData {
	cacheHits: number;
	cacheMisses: number;
	totalRequests: number;
	lastReset: number;
	fetchTimes: number[];
	errorCount: number;
	memoryCleanups: number;
	hitRate: number;
	averageFetchTime: number;
	uptime: number;
}

// ========================================
// Configuration
// ========================================

export interface CacheConfiguration {
	// Core cache settings
	cacheDuration: number;
	remoteRefreshInterval: number;
	maxCacheAge: number;
	cacheExtensionDuration: number;

	// Memory management
	maxMemoryUsage: number;
	memoryCheckInterval: number;
	cleanupThreshold: number;
	emergencyThreshold: number;

	// Performance settings
	maxMetricsHistory: number;
	metricsResetInterval: number;
	deduplicationTimeout: number;

	// Error handling
	maxRetryAttempts: number;
	retryBackoffMs: number;
	bootstrapMode: boolean;

	// Logging
	verboseLogging: boolean;
	logMemoryUsage: boolean;
	logPerformanceMetrics: boolean;

	// Data source metadata
	localCsvLastUpdated: string;
}

// ========================================
// Type Utilities & Helpers
// ========================================

export type DataSource = "remote" | "local" | "store" | "cached";
export type CacheOperationResult<T = unknown> = {
	success: boolean;
	data?: T;
	error?: string;
	timestamp: number;
};

export type MemoryHealthStatus = "healthy" | "warning" | "critical";
export type CacheOperation = "get" | "set" | "clear" | "invalidate" | "refresh";
