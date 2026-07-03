import "server-only";

import { isArchiveModeEnabled } from "@/lib/archive-mode";
import { ARCHIVE_KV_KEYS, getArchiveKVValue } from "@/lib/archive-static-data";
import { unstable_cache } from "next/cache";
import {
	SLIDING_BANNER_CACHE_KEY,
	SLIDING_BANNER_CACHE_TAG,
	SLIDING_BANNER_REVALIDATE_SECONDS,
} from "./cache";
import { SlidingBannerStore } from "./sliding-banner-store";
import type { SlidingBannerPublicSettings } from "./types";

const getCachedSlidingBannerSettings = unstable_cache(
	async (): Promise<SlidingBannerPublicSettings> => {
		return SlidingBannerStore.getPublicSettings();
	},
	[SLIDING_BANNER_CACHE_KEY],
	{
		revalidate: SLIDING_BANNER_REVALIDATE_SECONDS,
		tags: [SLIDING_BANNER_CACHE_TAG],
	},
);

export async function getPublicSlidingBannerSettingsCached(): Promise<SlidingBannerPublicSettings> {
	if (isArchiveModeEnabled()) {
		return SlidingBannerStore.getPublicSettingsFromValue(
			getArchiveKVValue(ARCHIVE_KV_KEYS.slidingBanner),
		);
	}

	try {
		return await getCachedSlidingBannerSettings();
	} catch {
		return SlidingBannerStore.getDefaultPublicSettings();
	}
}
