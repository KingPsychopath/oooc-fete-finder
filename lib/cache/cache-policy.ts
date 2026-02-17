import "server-only";

import { revalidatePath, revalidateTag, updateTag } from "next/cache";

export const EVENTS_CACHE_TAGS = ["events", "events-data"] as const;
export const EVENTS_LAYOUT_PATHS = [
	"/",
	"/events",
	"/admin",
	"/feature-event",
] as const;
export const DEFAULT_EVENTS_PAGE_PATHS = ["/"] as const;

export const SLIDING_BANNER_CACHE_TAG = "sliding-banner";
export const SLIDING_BANNER_CACHE_KEY = "public-sliding-banner-settings";
export const SLIDING_BANNER_REVALIDATE_SECONDS = 300;
export const SLIDING_BANNER_LAYOUT_PATHS = ["/", "/feature-event"] as const;

type InvalidateOptions = {
	pagePaths?: string[];
	layoutPaths?: readonly string[];
	tags?: readonly string[];
	immediateTagUpdate?: boolean;
};

const revalidatePagePaths = (paths: readonly string[]): void => {
	for (const path of paths) {
		revalidatePath(path, "page");
	}
};

const revalidateLayoutPaths = (paths: readonly string[]): void => {
	for (const path of paths) {
		revalidatePath(path, "layout");
	}
};

const revalidateTags = (
	tags: readonly string[],
	immediateTagUpdate: boolean,
): void => {
	for (const tag of tags) {
		if (immediateTagUpdate) {
			updateTag(tag);
		}
		revalidateTag(tag, "max");
	}
};

const invalidate = ({
	pagePaths = [],
	layoutPaths = [],
	tags = [],
	immediateTagUpdate = false,
}: InvalidateOptions): void => {
	revalidatePagePaths(pagePaths);
	revalidateLayoutPaths(layoutPaths);
	revalidateTags(tags, immediateTagUpdate);
};

export const invalidateEventsCache = (pagePaths: string[] = ["/"]): void => {
	invalidate({
		pagePaths,
		layoutPaths: EVENTS_LAYOUT_PATHS,
		tags: EVENTS_CACHE_TAGS,
	});
};

export const invalidateSlidingBannerCachePolicy = (): void => {
	invalidate({
		layoutPaths: SLIDING_BANNER_LAYOUT_PATHS,
		tags: [SLIDING_BANNER_CACHE_TAG],
		immediateTagUpdate: true,
	});
};
