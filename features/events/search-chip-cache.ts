import "server-only";

import { updateTag } from "next/cache";

export const SEARCH_CHIP_SETTINGS_CACHE_TAG = "search-chip-settings";
export const SEARCH_CHIP_SETTINGS_CACHE_KEY = "public-search-chip-settings";
export const SEARCH_CHIP_SIGNALS_CACHE_TAG = "search-chip-signals";
export const SEARCH_CHIP_SIGNALS_CACHE_KEY = "popular-search-chip-signals";
export const SEARCH_CHIP_SETTINGS_REVALIDATE_SECONDS = false;
export const SEARCH_CHIP_SIGNALS_REVALIDATE_SECONDS = false;

export const invalidateSearchChipSettingsCache = (): void => {
	updateTag(SEARCH_CHIP_SETTINGS_CACHE_TAG);
};
