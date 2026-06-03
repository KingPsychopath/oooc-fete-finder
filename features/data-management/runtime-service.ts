import "server-only";

import { applyFeaturedProjectionToEvents } from "@/features/events/featured/service";
import {
	getCurrentParisYearDateRange,
	getEventCountForDateRange,
} from "@/features/events/filtering";
import { applyPromotedProjectionToEvents } from "@/features/events/promoted/service";
import {
	CARD_SOCIAL_PROOF_HISTORICAL_WINDOW_DAYS,
	getSocialProofSaveWindowDays,
} from "@/features/events/social-proof";
import type { Event } from "@/features/events/types";
import { getEventEngagementRepository } from "@/lib/platform/postgres/event-engagement-repository";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { cache } from "react";
import { DataManager } from "./data-manager";
import { isValidEventsData } from "./validation/event-validation";

export type DataSource = "backup" | "local" | "store" | "test";

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
	lastFetchTime: string | null;
	lastRemoteErrorMessage: string;
	dataSource: DataSource;
	eventCount: number;
	currentYearEventCount: number;
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
	totalRequests: number;
	lastReset: number;
	errorCount: number;
	averageFetchTimeMs: number;
}

const EVENTS_CACHE_TAGS = [
	"events",
	"events-data",
	"featured-events",
	"promoted-events",
] as const;
const EVENTS_PUBLIC_LAYOUT_PATHS = ["/", "/feature-event"] as const;
const SOCIAL_PROOF_COUNTS_REVALIDATE_SECONDS = 30 * 60;
const SOURCE_EVENTS_REVALIDATE_SECONDS = 5 * 60;
const SOURCE_EVENTS_CACHE_KEY = ["source-events"];

type EventRevalidationScope = "event-data" | "placements" | "page-only";

interface EventRevalidationOptions {
	scope?: EventRevalidationScope;
	includeLayouts?: boolean;
}

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

const getCachedSourceEvents = unstable_cache(
	async (populateCoordinates: boolean) =>
		DataManager.getEventsData({ populateCoordinates }),
	SOURCE_EVENTS_CACHE_KEY,
	{
		revalidate: SOURCE_EVENTS_REVALIDATE_SECONDS,
		tags: ["events", "events-data"],
	},
);

const getSourceEventsForRequest = cache((populateCoordinates: boolean) =>
	getCachedSourceEvents(populateCoordinates),
);

const getCachedSocialProofSaveCountEntries = unstable_cache(
	async (
		eventKeys: string[],
		windowDays: number,
	): Promise<Array<[string, number]>> => {
		const repository = getEventEngagementRepository();
		if (!repository) return [];
		const counts = await repository.getSocialProofSaveCounts({
			eventKeys,
			windowDays,
		});
		return [...counts.entries()];
	},
	["event-social-proof-save-counts"],
	{
		revalidate: SOCIAL_PROOF_COUNTS_REVALIDATE_SECONDS,
		tags: ["event-engagement", "events"],
	},
);

const getLiveEventsForRequest = cache(
	async (
		includeFeaturedProjection: boolean,
		includeEngagementProjection: boolean,
		populateCoordinates: boolean,
		bypassSourceCache: boolean,
	): Promise<EventsResult> => {
		const startedAt = Date.now();
		try {
			const result = bypassSourceCache
				? await DataManager.getEventsData({ populateCoordinates })
				: await getSourceEventsForRequest(populateCoordinates);
			metrics.totalFetchMs += Date.now() - startedAt;
			metrics.fetchCount += 1;

			const normalized = toEventsResult(result);
			if (normalized.success && includeFeaturedProjection) {
				normalized.data = await applyFeaturedProjectionToEvents(
					normalized.data,
				);
				normalized.data = await applyPromotedProjectionToEvents(
					normalized.data,
				);
			}
			if (normalized.success && includeEngagementProjection) {
				const eventKeys = normalized.data.map((event) => event.eventKey);
				const [socialProofSaveCounts, socialProofHistoricalSaveCounts] =
					await Promise.all([
						getCachedSocialProofSaveCountEntries(
							eventKeys,
							getSocialProofSaveWindowDays(),
						),
						getCachedSocialProofSaveCountEntries(
							eventKeys,
							CARD_SOCIAL_PROOF_HISTORICAL_WINDOW_DAYS,
						),
					]);
				const socialProofSaveCountMap = new Map(socialProofSaveCounts);
				const socialProofHistoricalSaveCountMap = new Map(
					socialProofHistoricalSaveCounts,
				);
				normalized.data = normalized.data.map((event) => ({
					...event,
					socialProofSaveCount:
						socialProofSaveCountMap.get(event.eventKey) ?? 0,
					socialProofHistoricalSaveCount:
						socialProofHistoricalSaveCountMap.get(event.eventKey) ?? 0,
				}));
			}
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
				error:
					error instanceof Error ? error.message : "Unknown events fetch error",
			};
		}
	},
);

export async function getLiveEvents(options?: {
	includeFeaturedProjection?: boolean;
	includeEngagementProjection?: boolean;
	populateCoordinates?: boolean;
	bypassSourceCache?: boolean;
}): Promise<EventsResult> {
	return getLiveEventsForRequest(
		options?.includeFeaturedProjection !== false,
		options?.includeEngagementProjection !== false,
		options?.populateCoordinates ?? false,
		options?.bypassSourceCache ?? false,
	);
}

export async function getLiveEventByKey(
	eventKey: string,
	options?: {
		includeFeaturedProjection?: boolean;
		includeEngagementProjection?: boolean;
		bypassSourceCache?: boolean;
	},
): Promise<Event | null> {
	const normalizedEventKey = eventKey.trim().toLowerCase();
	if (!normalizedEventKey) return null;

	const result = await getLiveEvents({
		includeFeaturedProjection: options?.includeFeaturedProjection ?? false,
		includeEngagementProjection: options?.includeEngagementProjection ?? false,
		populateCoordinates: false,
		bypassSourceCache: options?.bypassSourceCache ?? false,
	});
	if (!result.success) return null;

	return (
		result.data.find(
			(event) => event.eventKey.trim().toLowerCase() === normalizedEventKey,
		) ?? null
	);
}

export const revalidateEventsPaths = (
	paths: readonly string[] = ["/"],
	options: EventRevalidationOptions = {},
): void => {
	const scope = options.scope ?? "event-data";
	for (const path of paths) {
		revalidatePath(path, "page");
	}

	if (options.includeLayouts) {
		for (const path of EVENTS_PUBLIC_LAYOUT_PATHS) {
			revalidatePath(path, "layout");
		}
	}

	const tags =
		scope === "page-only"
			? []
			: scope === "placements"
				? (["featured-events", "promoted-events"] as const)
				: EVENTS_CACHE_TAGS;

	for (const tag of tags) {
		revalidateTag(tag, "max");
	}
};

export async function forceRefreshEventsData(
	options: { revalidate?: boolean } = {},
): Promise<RuntimeRefreshResult> {
	if (options.revalidate !== false) {
		revalidateEventsPaths(["/"]);
	}
	const result = await getLiveEvents({ bypassSourceCache: true });

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
		const refreshResult = await forceRefreshEventsData({ revalidate: false });
		revalidateEventsPaths([path]);
		return {
			success: refreshResult.success,
			message: refreshResult.success
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
	const currentYearDateRange = getCurrentParisYearDateRange();
	const currentYearEventCount = statusRead.success
		? getEventCountForDateRange(statusRead.data, currentYearDateRange)
		: 0;
	const lastFetchTime = statusRead.success
		? (statusRead.lastUpdate ?? new Date().toISOString())
		: null;
	const errorMessage = statusRead.success ? "" : (statusRead.error ?? "");

	return {
		lastFetchTime,
		lastRemoteErrorMessage: errorMessage,
		dataSource: source,
		eventCount,
		currentYearEventCount,
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
		totalRequests,
		lastReset: metrics.lastReset,
		errorCount: metrics.errors,
		averageFetchTimeMs:
			metrics.fetchCount > 0
				? Number((metrics.totalFetchMs / metrics.fetchCount).toFixed(1))
				: 0,
	};
}
