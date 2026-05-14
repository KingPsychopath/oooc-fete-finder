import "server-only";

import { getDiscoveryAnalyticsRepository } from "@/lib/platform/postgres/discovery-analytics-repository";
import { unstable_cache } from "next/cache";
import {
	SEARCH_CHIP_SETTINGS_CACHE_KEY,
	SEARCH_CHIP_SETTINGS_CACHE_TAG,
	SEARCH_CHIP_SETTINGS_REVALIDATE_SECONDS,
	SEARCH_CHIP_SIGNALS_CACHE_KEY,
	SEARCH_CHIP_SIGNALS_CACHE_TAG,
	SEARCH_CHIP_SIGNALS_REVALIDATE_SECONDS,
} from "./search-chip-cache";
import { SearchChipSettingsStore } from "./search-chip-settings-store";
import type { SearchChipPublicSettings } from "./search-chip-settings-store";
import type { SearchChipSignal } from "./search-chips";

const buildWindow = (
	days: number,
): { startAt: string; endAt: string; recentStartAt: string } => {
	const end = new Date();
	const start = new Date(end);
	start.setDate(start.getDate() - days);
	const recentStart = new Date(end);
	recentStart.setDate(recentStart.getDate() - 2);
	return {
		startAt: start.toISOString(),
		endAt: end.toISOString(),
		recentStartAt: recentStart.toISOString(),
	};
};

const getCachedSearchChipSettings = unstable_cache(
	async (): Promise<SearchChipPublicSettings> => {
		return SearchChipSettingsStore.getPublicSettings();
	},
	[SEARCH_CHIP_SETTINGS_CACHE_KEY],
	{
		revalidate: SEARCH_CHIP_SETTINGS_REVALIDATE_SECONDS,
		tags: [SEARCH_CHIP_SETTINGS_CACHE_TAG],
	},
);

const getCachedPopularSearchSignals = unstable_cache(
	async (): Promise<SearchChipSignal[]> => {
		const repository = getDiscoveryAnalyticsRepository();
		if (!repository) return [];
		const { startAt, endAt, recentStartAt } = buildWindow(7);
		return repository.listTopSearchSignals({
			startAt,
			endAt,
			recentStartAt,
			limit: 250,
			excludeSearchSource: "popular_chip",
		});
	},
	[SEARCH_CHIP_SIGNALS_CACHE_KEY],
	{
		revalidate: SEARCH_CHIP_SIGNALS_REVALIDATE_SECONDS,
		tags: [SEARCH_CHIP_SIGNALS_CACHE_TAG],
	},
);

export async function getPublicSearchChipSettingsCached(): Promise<SearchChipPublicSettings> {
	try {
		return await getCachedSearchChipSettings();
	} catch {
		return SearchChipSettingsStore.getDefaultPublicSettings();
	}
}

export async function getPopularSearchChipSignalsCached(): Promise<
	SearchChipSignal[]
> {
	try {
		return await getCachedPopularSearchSignals();
	} catch {
		return [];
	}
}
