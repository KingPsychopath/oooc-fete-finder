import type { Event } from "@/features/events/types";

export type DataSource = "remote" | "local" | "store" | "test";

export interface EventsResult {
	success: boolean;
	data: Event[];
	count: number;
	cached: boolean;
	source: DataSource;
	error?: string;
	lastUpdate?: string;
}

export interface RuntimeRefreshResult {
	success: boolean;
	message: string;
	data?: Event[];
	count?: number;
	source?: DataSource;
	error?: string;
}

export interface FullRevalidationResult {
	success: boolean;
	message: string;
	cacheRefreshed: boolean;
	pageRevalidated: boolean;
	error?: string;
}

export interface RuntimeDataStatus {
	hasCachedData: boolean;
	lastFetchTime: string | null;
	lastRemoteFetchTime: string | null;
	lastRemoteSuccessTime: string | null;
	lastRemoteErrorMessage: string;
	cacheAge: number;
	nextRemoteCheck: number;
	dataSource: DataSource;
	eventCount: number;
	memoryUsage: number;
	memoryLimit: number;
	memoryUtilization: number;
	configuredDataSource: "remote" | "local" | "test";
	localCsvLastUpdated: string;
	remoteConfigured: boolean;
	hasLocalStoreData: boolean;
	storeProvider: "file" | "memory" | "postgres";
	storeProviderLocation: string;
	storeRowCount: number;
	storeUpdatedAt: string | null;
	storeKeyCount: number;
}

export interface RuntimeMetricsData {
	cacheHits: number;
	cacheMisses: number;
	totalRequests: number;
	lastReset: number;
	errorCount: number;
	hitRate: number;
	averageFetchTimeMs: number;
}
