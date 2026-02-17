import { DataManager } from "@/features/data-management/data-manager";
import { isValidEventsData } from "@/features/data-management/data-processor";
import type { Event } from "@/features/events/types";
import { invalidateEventsCache } from "./cache-policy";
import { RuntimeCache } from "./runtime-cache";
import type {
	CacheMetricsData,
	CacheRefreshResult,
	CacheStatus,
	DataSource,
	EventsResult,
	FullRevalidationResult,
} from "./cache-types";

const DEFAULT_CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_TTL_MS = Number.parseInt(
	process.env.CACHE_DURATION_MS ?? `${DEFAULT_CACHE_TTL_MS}`,
	10,
);
const RESOLVED_CACHE_TTL_MS =
	Number.isFinite(CACHE_TTL_MS) && CACHE_TTL_MS > 0
		? CACHE_TTL_MS
		: DEFAULT_CACHE_TTL_MS;
const MEMORY_LIMIT_BYTES = 50 * 1024 * 1024;

type EventsMeta = {
	source: DataSource;
	lastUpdateIso: string | null;
};

type MetricsState = {
	hits: number;
	misses: number;
	errors: number;
	totalFetchMs: number;
	fetchCount: number;
	lastReset: number;
};

const estimateEventsBytes = (events: Event[] | null): number => {
	if (!events) return 0;
	return Buffer.byteLength(JSON.stringify(events), "utf8");
};

const eventsCache = new RuntimeCache<Event[], EventsMeta>({
	ttlMs: RESOLVED_CACHE_TTL_MS,
	estimateBytes: estimateEventsBytes,
	initialMeta: {
		source: "cached",
		lastUpdateIso: null,
	},
});

const metrics: MetricsState = {
	hits: 0,
	misses: 0,
	errors: 0,
	totalFetchMs: 0,
	fetchCount: 0,
	lastReset: Date.now(),
};

const loadFreshEvents = async (): Promise<{ value: Event[]; meta: EventsMeta }> => {
	const startedAt = Date.now();
	const result = await DataManager.getEventsData();

	if (!result.success || !isValidEventsData(result.data) || result.data.length === 0) {
		throw new Error(result.error || "Fresh events fetch failed");
	}

	metrics.totalFetchMs += Date.now() - startedAt;
	metrics.fetchCount += 1;

	return {
		value: result.data,
		meta: {
			source: result.source,
			lastUpdateIso: result.lastUpdate ?? new Date().toISOString(),
		},
	};
};

const toCachedResult = (
	cachedEvents: Event[],
	meta: EventsMeta,
	errorMessage?: string,
): EventsResult => ({
	success: true,
	data: cachedEvents,
	count: cachedEvents.length,
	cached: true,
	source: meta.source,
	lastUpdate: meta.lastUpdateIso ?? undefined,
	error: errorMessage,
});

export class CacheManager {
	static getEventsSnapshot(): EventsResult {
		const snapshot = eventsCache.getSnapshot();
		if (snapshot.value && snapshot.meta && snapshot.value.length > 0) {
			return toCachedResult(
				snapshot.value,
				snapshot.meta,
				snapshot.lastErrorMessage || undefined,
			);
		}

		return {
			success: false,
			data: [],
			count: 0,
			cached: true,
			source: "cached",
			error: snapshot.lastErrorMessage || "No cached events available",
		};
	}

	static async getEvents(forceRefresh = false): Promise<EventsResult> {
		const snapshot = eventsCache.getSnapshot();

		try {
			const result = await eventsCache.get(loadFreshEvents, { forceRefresh });

			if (result.fromCache) {
				metrics.hits += 1;
				return toCachedResult(result.value, result.meta);
			}

			metrics.misses += 1;
			return {
				success: true,
				data: result.value,
				count: result.value.length,
				cached: false,
				source: result.meta.source,
				lastUpdate: result.meta.lastUpdateIso ?? undefined,
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown cache error";
			eventsCache.setError(message);
			metrics.errors += 1;

			if (snapshot.value && snapshot.meta && snapshot.value.length > 0) {
				eventsCache.setStaleMeta({
					source: snapshot.meta.source,
					lastUpdateIso: snapshot.meta.lastUpdateIso,
				});
				return toCachedResult(snapshot.value, snapshot.meta, `Using previous cache: ${message}`);
			}

			return {
				success: false,
				data: [],
				count: 0,
				cached: false,
				source: "local",
				error: message,
			};
		}
	}

	static async forceRefresh(): Promise<CacheRefreshResult> {
		const result = await this.getEvents(true);
		invalidateEventsCache(["/"]);

		if (!result.success) {
			return {
				success: false,
				message: "Force refresh failed",
				error: result.error,
			};
		}

		return {
			success: true,
			message: `Refreshed ${result.count} events from ${result.source}`,
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
				message: refreshResult.success
					? "Cache refreshed and revalidated"
					: "Revalidation completed with cache refresh errors",
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
		eventsCache.clear();
	}

	static async getCacheStatus(): Promise<CacheStatus> {
		const configStatus = await DataManager.getDataConfigStatus();
		const snapshot = eventsCache.getSnapshot();
		const now = Date.now();
		const cacheAge = snapshot.lastLoadedAt ? now - snapshot.lastLoadedAt : 0;
		const memoryUsage = snapshot.memoryUsageBytes;

		return {
			hasCachedData: Boolean(snapshot.value && snapshot.value.length > 0),
			lastFetchTime: snapshot.lastLoadedAt
				? new Date(snapshot.lastLoadedAt).toISOString()
				: null,
			lastRemoteFetchTime: snapshot.lastLoadedAt
				? new Date(snapshot.lastLoadedAt).toISOString()
				: null,
			lastRemoteSuccessTime: snapshot.lastSuccessAt
				? new Date(snapshot.lastSuccessAt).toISOString()
				: null,
			lastRemoteErrorMessage: snapshot.lastErrorMessage,
			cacheAge,
			nextRemoteCheck: snapshot.lastLoadedAt
				? Math.max(0, RESOLVED_CACHE_TTL_MS - cacheAge)
				: 0,
			dataSource: snapshot.meta?.source ?? "cached",
			eventCount: snapshot.value?.length ?? 0,
			memoryUsage,
			memoryLimit: MEMORY_LIMIT_BYTES,
			memoryUtilization:
				MEMORY_LIMIT_BYTES > 0
					? Number(((memoryUsage / MEMORY_LIMIT_BYTES) * 100).toFixed(1))
					: 0,
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
		const totalRequests = metrics.hits + metrics.misses;
		return {
			cacheHits: metrics.hits,
			cacheMisses: metrics.misses,
			totalRequests,
			lastReset: metrics.lastReset,
			errorCount: metrics.errors,
			hitRate:
				totalRequests > 0
					? Number(((metrics.hits / totalRequests) * 100).toFixed(1))
					: 0,
			averageFetchTimeMs:
				metrics.fetchCount > 0
					? Number((metrics.totalFetchMs / metrics.fetchCount).toFixed(1))
					: 0,
		};
	}

	static async prewarmInBackground(): Promise<void> {
		try {
			const configStatus = await DataManager.getDataConfigStatus();
			// Startup prewarm should only happen for real managed-store data.
			// If remote mode has no store rows yet, skip warming to avoid seeding
			// runtime cache with local CSV fallback at boot.
			if (
				configStatus.dataSource === "remote" &&
				!configStatus.hasLocalStoreData
			) {
				return;
			}
			await this.getEvents(false);
		} catch {
			// Silent by design: prewarm should not crash startup.
		}
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
