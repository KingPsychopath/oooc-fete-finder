import "server-only";

import { revalidatePath, revalidateTag, updateTag } from "next/cache";

export const SLIDING_BANNER_CACHE_TAG = "sliding-banner";
export const SLIDING_BANNER_CACHE_KEY = "public-sliding-banner-settings";
export const SLIDING_BANNER_REVALIDATE_SECONDS = 300;
export const SLIDING_BANNER_LAYOUT_PATHS = ["/", "/feature-event"] as const;

export const invalidateSlidingBannerCache = (): void => {
	for (const path of SLIDING_BANNER_LAYOUT_PATHS) {
		revalidatePath(path, "layout");
	}
	updateTag(SLIDING_BANNER_CACHE_TAG);
	revalidateTag(SLIDING_BANNER_CACHE_TAG, "max");
};
