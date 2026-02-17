import { DataManager } from "@/features/data-management/data-manager";
import { isValidEventsData } from "@/features/data-management/data-processor";
import { invalidateEventsCache } from "./cache-policy";
import type {
	CacheMetricsData,
	CacheRefreshResult,
	CacheStatus,
	DataSource,
	EventsResult,
	FullRevalidationResult,
} from "./cache-types";

type RuntimeStatusState = {
	lastFetchTime: string | null;
	lastErrorMessage: string;
	lastSource: DataSource | null;
	lastEventCount: number;
};

type MetricsState = {
	errors: number;
	totalFetchMs: number;
	fetchCount: number;
	lastReset: number;
};

const runtimeStatus: RuntimeStatusState = {
	lastFetchTime: null,
	lastErrorMessage: "",
	lastSource: null,
	lastEventCount: 0,
};

const metrics: MetricsState = {
	errors: 0,
	totalFetchMs: 0,
	fetchCount: 0,
	lastReset: Date.now(),
};

const normalizeFailureSource = (
	lastSource: DataSource | null,
	configuredMode: "remote" | "local" | "test",
): DataSource => {
	if (lastSource) return lastSource;
	if (configuredMode === "test") return "test";
	if (configuredMode === "local") return "local";
	return "store";
};

export class CacheManager {
	static getEventsSnapshot(): EventsResult {
		return {
			success: false,
			data: [],
			count: 0,
			cached: false,
			source: runtimeStatus.lastSource ?? "store",
			lastUpdate: runtimeStatus.lastFetchTime ?? undefined,
			error: "Runtime in-memory cache is disabled. Load live events instead.",
		};
	}

	static async getEvents(_forceRefresh = false): Promise<EventsResult> {
		const startedAt = Date.now();
		try {
			const result = await DataManager.getEventsData();
			metrics.totalFetchMs += Date.now() - startedAt;
			metrics.fetchCount += 1;

			if (!result.success || !isValidEventsData(result.data)) {
				const message = result.error || "Live events fetch failed";
				runtimeStatus.lastErrorMessage = message;
				metrics.errors += 1;
				return {
					success: false,
					data: [],
					count: 0,
					cached: false,
					source: result.source,
					error: message,
				};
			}

			runtimeStatus.lastFetchTime = result.lastUpdate ?? new Date().toISOString();
			runtimeStatus.lastErrorMessage = "";
			runtimeStatus.lastSource = result.source;
			runtimeStatus.lastEventCount = result.count;

			return {
				success: true,
				data: result.data,
				count: result.count,
				cached: false,
				source: result.source,
				lastUpdate: runtimeStatus.lastFetchTime,
			};
		} catch (error) {
			metrics.totalFetchMs += Date.now() - startedAt;
			metrics.fetchCount += 1;
			metrics.errors += 1;
			runtimeStatus.lastErrorMessage =
				error instanceof Error ? error.message : "Unknown events fetch error";
			return {
				success: false,
				data: [],
				count: 0,
				cached: false,
				source: runtimeStatus.lastSource ?? "store",
				error: runtimeStatus.lastErrorMessage,
			};
		}
	}

	static async forceRefresh(): Promise<CacheRefreshResult> {
		const result = await this.getEvents(true);
		invalidateEventsCache(["/"]);

		if (!result.success) {
			return {
				success: false,
				message: "Homepage revalidation failed",
				error: result.error,
			};
		}

		return {
			success: true,
			message: `Loaded ${result.count} events from ${result.source} and revalidated homepage`,
			data: result.data,
			count: result.count,
			source: result.source,
			error: result.error,
		};
	}

	static async fullRevalidation(path = "/"): Promise<FullRevalidationResult> {
		try {
			const refreshResult = await this.forceRefresh();
			invalidateEventsCache([path]);
			return {
				success: refreshResult.success,
				message:
					refreshResult.success ?
						"Live data loaded and pages revalidated"
					:	"Revalidation completed with live data errors",
				cacheRefreshed: refreshResult.success,
				pageRevalidated: true,
				error: refreshResult.error,
			};
		} catch (error) {
			return {
				success: false,
				message: "Full revalidation failed",
				cacheRefreshed: false,
				pageRevalidated: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	static clearCache(): void {
		runtimeStatus.lastFetchTime = null;
		runtimeStatus.lastErrorMessage = "";
		runtimeStatus.lastSource = null;
		runtimeStatus.lastEventCount = 0;
	}

	static async getCacheStatus(): Promise<CacheStatus> {
		const [configStatus, liveResult] = await Promise.all([
			DataManager.getDataConfigStatus(),
			this.getEvents(false),
		]);

		const source =
			liveResult.success ?
				liveResult.source
			:	normalizeFailureSource(runtimeStatus.lastSource, configStatus.dataSource);
		const eventCount = liveResult.success ? liveResult.count : 0;
		const lastFetchTime =
			liveResult.success ?
				liveResult.lastUpdate ?? runtimeStatus.lastFetchTime
			:	runtimeStatus.lastFetchTime;
		const errorMessage =
			liveResult.success ?
				""
			:	(liveResult.error ?? runtimeStatus.lastErrorMessage);

		return {
			hasCachedData: false,
			lastFetchTime: lastFetchTime ?? null,
			lastRemoteFetchTime: lastFetchTime ?? null,
			lastRemoteSuccessTime: liveResult.success ? (lastFetchTime ?? null) : null,
			lastRemoteErrorMessage: errorMessage,
			cacheAge: 0,
			nextRemoteCheck: 0,
			dataSource: source,
			eventCount,
			memoryUsage: 0,
			memoryLimit: 0,
			memoryUtilization: 0,
			configuredDataSource: configStatus.dataSource,
			localCsvLastUpdated: configStatus.localCsvLastUpdated,
			remoteConfigured: configStatus.remoteConfigured,
			hasLocalStoreData: configStatus.hasLocalStoreData,
			storeProvider: configStatus.storeProvider,
			storeProviderLocation: configStatus.storeProviderLocation,
			storeRowCount: configStatus.storeRowCount,
			storeUpdatedAt: configStatus.storeUpdatedAt,
			storeKeyCount: configStatus.storeKeyCount,
		};
	}

	static getCacheMetrics(): CacheMetricsData {
		const totalRequests = metrics.fetchCount;
		return {
			cacheHits: 0,
			cacheMisses: totalRequests,
			totalRequests,
			lastReset: metrics.lastReset,
			errorCount: metrics.errors,
			hitRate: 0,
			averageFetchTimeMs:
				metrics.fetchCount > 0 ?
					Number((metrics.totalFetchMs / metrics.fetchCount).toFixed(1))
				:	0,
		};
	}

	static async prewarmInBackground(): Promise<void> {
		return;
	}
}

export type {
	CacheMetricsData,
	CacheRefreshResult,
	CacheStatus,
	DataSource,
	EventsResult,
	FullRevalidationResult,
} from "./cache-types";
