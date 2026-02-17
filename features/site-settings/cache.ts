import "server-only";

import {
	SLIDING_BANNER_CACHE_KEY,
	SLIDING_BANNER_CACHE_TAG,
	SLIDING_BANNER_REVALIDATE_SECONDS,
	invalidateSlidingBannerCachePolicy,
} from "@/lib/cache/cache-policy";

export {
	SLIDING_BANNER_CACHE_KEY,
	SLIDING_BANNER_CACHE_TAG,
	SLIDING_BANNER_REVALIDATE_SECONDS,
};

export const invalidateSlidingBannerCache = (): void => {
	invalidateSlidingBannerCachePolicy();
};
