import type { MapProvider } from "@/features/maps/types";

export type ThemeMode = "light" | "dark" | "system";
export type DefaultEventSortMode = "upcoming" | "fresh-activity";
export type UserMapLoadStrategy = "idle" | "expand";

export interface LocalAppSettings {
	hideFloatingFilterButton: boolean;
	hideFloatingPrompts: boolean;
	defaultEventSortMode: DefaultEventSortMode;
	mapLoadStrategy: UserMapLoadStrategy;
}

export interface SyncedUserAppSettings {
	appSettings: LocalAppSettings;
	mapPreference: MapProvider;
	themeMode: ThemeMode;
	updatedAt?: string;
}

export const DEFAULT_LOCAL_APP_SETTINGS: LocalAppSettings = {
	hideFloatingFilterButton: false,
	hideFloatingPrompts: false,
	defaultEventSortMode: "upcoming",
	mapLoadStrategy: "idle",
};

export const DEFAULT_SYNCED_USER_APP_SETTINGS: SyncedUserAppSettings = {
	appSettings: DEFAULT_LOCAL_APP_SETTINGS,
	mapPreference: "system",
	themeMode: "system",
};

export function normalizeLocalAppSettings(
	settings: Partial<LocalAppSettings> | null | undefined,
): LocalAppSettings {
	return {
		hideFloatingFilterButton:
			typeof settings?.hideFloatingFilterButton === "boolean"
				? settings.hideFloatingFilterButton
				: DEFAULT_LOCAL_APP_SETTINGS.hideFloatingFilterButton,
		hideFloatingPrompts:
			typeof settings?.hideFloatingPrompts === "boolean"
				? settings.hideFloatingPrompts
				: DEFAULT_LOCAL_APP_SETTINGS.hideFloatingPrompts,
		defaultEventSortMode:
			settings?.defaultEventSortMode === "fresh-activity" ||
			settings?.defaultEventSortMode === "upcoming"
				? settings.defaultEventSortMode
				: DEFAULT_LOCAL_APP_SETTINGS.defaultEventSortMode,
		mapLoadStrategy:
			settings?.mapLoadStrategy === "idle" ||
			settings?.mapLoadStrategy === "expand"
				? settings.mapLoadStrategy
				: DEFAULT_LOCAL_APP_SETTINGS.mapLoadStrategy,
	};
}

export function normalizeMapPreference(value: unknown): MapProvider {
	return value === "google" ||
		value === "apple" ||
		value === "system" ||
		value === "ask"
		? value
		: DEFAULT_SYNCED_USER_APP_SETTINGS.mapPreference;
}

export function normalizeThemeMode(value: unknown): ThemeMode {
	return value === "light" || value === "dark" || value === "system"
		? value
		: DEFAULT_SYNCED_USER_APP_SETTINGS.themeMode;
}
