import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";
import type { Event } from "@/features/events/types";
import { DataManager } from "./data-manager";
import { isValidEventsData } from "./data-processor";

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

const EVENTS_CACHE_TAGS = ["events", "events-data"] as const;
const EVENTS_LAYOUT_PATHS = ["/", "/events", "/admin", "/feature-event"] as const;

const metrics = {
	errors: 0,
	totalFetchMs: 0,
	fetchCount: 0,
	lastReset: Date.now(),
};

const normalizeFailureSource = (
	configuredMode: "remote" | "local" | "test",
): DataSource => {
	if (configuredMode === "test") return "test";
	if (configuredMode === "local") return "local";
	return "store";
};

const toEventsResult = (
	result: Awaited<ReturnType<typeof DataManager.getEventsData>>,
): EventsResult => {
	if (!result.success || !isValidEventsData(result.data)) {
		return {
			success: false,
			data: [],
			count: 0,
			cached: false,
			source: result.source,
			error: result.error || "Live events fetch failed",
		};
	}

	return {
		success: true,
		data: result.data,
		count: result.count,
		cached: false,
		source: result.source,
		lastUpdate: result.lastUpdate ?? new Date().toISOString(),
		error: result.warnings.length > 0 ? result.warnings.join("; ") : undefined,
	};
};

export async function getLiveEvents(): Promise<EventsResult> {
	const startedAt = Date.now();
	try {
		const result = await DataManager.getEventsData();
		metrics.totalFetchMs += Date.now() - startedAt;
		metrics.fetchCount += 1;

		const normalized = toEventsResult(result);
		if (!normalized.success) {
			metrics.errors += 1;
		}
		return normalized;
	} catch (error) {
		metrics.totalFetchMs += Date.now() - startedAt;
		metrics.fetchCount += 1;
		metrics.errors += 1;
		return {
			success: false,
			data: [],
			count: 0,
			cached: false,
			source: "store",
			error: error instanceof Error ? error.message : "Unknown events fetch error",
		};
	}
}

export const revalidateEventsPaths = (paths: readonly string[] = ["/"]): void => {
	for (const path of paths) {
		revalidatePath(path, "page");
	}

	for (const path of EVENTS_LAYOUT_PATHS) {
		revalidatePath(path, "layout");
	}

	for (const tag of EVENTS_CACHE_TAGS) {
		revalidateTag(tag, "max");
	}
};

export async function forceRefreshEventsData(): Promise<RuntimeRefreshResult> {
	const result = await getLiveEvents();
	revalidateEventsPaths(["/"]);

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

export async function fullEventsRevalidation(
	path = "/",
): Promise<FullRevalidationResult> {
	try {
		const refreshResult = await forceRefreshEventsData();
		revalidateEventsPaths([path]);
		return {
			success: refreshResult.success,
			message:
				refreshResult.success
					? "Live data loaded and pages revalidated"
					: "Revalidation completed with live data errors",
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

export async function getRuntimeDataStatusFromSource(): Promise<RuntimeDataStatus> {
	const [configStatus, statusRead] = await Promise.all([
		DataManager.getDataConfigStatus(),
		DataManager.getEventsData({ populateCoordinates: false }),
	]);

	const source = statusRead.success
		? statusRead.source
		: normalizeFailureSource(configStatus.dataSource);
	const eventCount = statusRead.success ? statusRead.count : 0;
	const lastFetchTime = statusRead.success
		? (statusRead.lastUpdate ?? new Date().toISOString())
		: null;
	const errorMessage = statusRead.success ? "" : (statusRead.error ?? "");

	return {
		hasCachedData: false,
		lastFetchTime,
		lastRemoteFetchTime: lastFetchTime,
		lastRemoteSuccessTime: statusRead.success ? lastFetchTime : null,
		lastRemoteErrorMessage: errorMessage,
		cacheAge: 0,
		nextRemoteCheck: 0,
		dataSource: source,
		eventCount,
		memoryUsage: 0,
		memoryLimit: 0,
		memoryUtilization: 0,
		configuredDataSource: configStatus.dataSource,
		remoteConfigured: configStatus.remoteConfigured,
		hasLocalStoreData: configStatus.hasLocalStoreData,
		storeProvider: configStatus.storeProvider,
		storeProviderLocation: configStatus.storeProviderLocation,
		storeRowCount: configStatus.storeRowCount,
		storeUpdatedAt: configStatus.storeUpdatedAt,
		storeKeyCount: configStatus.storeKeyCount,
	};
}

export function getRuntimeMetrics(): RuntimeMetricsData {
	const totalRequests = metrics.fetchCount;
	return {
		cacheHits: 0,
		cacheMisses: totalRequests,
		totalRequests,
		lastReset: metrics.lastReset,
		errorCount: metrics.errors,
		hitRate: 0,
		averageFetchTimeMs:
			metrics.fetchCount > 0
				? Number((metrics.totalFetchMs / metrics.fetchCount).toFixed(1))
				: 0,
	};
}
