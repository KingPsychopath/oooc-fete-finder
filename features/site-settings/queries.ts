import "server-only";

import { unstable_cache } from "next/cache";
import { SlidingBannerStore } from "./sliding-banner-store";
import type { SlidingBannerPublicSettings } from "./types";

const getCachedSlidingBannerSettings = unstable_cache(
	async (): Promise<SlidingBannerPublicSettings> => {
		return SlidingBannerStore.getPublicSettings();
	},
	["public-sliding-banner-settings"],
	{
		revalidate: 300,
		tags: ["sliding-banner"],
	},
);

export async function getPublicSlidingBannerSettingsCached(): Promise<SlidingBannerPublicSettings> {
	try {
		return await getCachedSlidingBannerSettings();
	} catch {
		return SlidingBannerStore.getDefaultPublicSettings();
	}
}
