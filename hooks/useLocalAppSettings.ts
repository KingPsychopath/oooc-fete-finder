"use client";

import { clientLog } from "@/lib/platform/client-logger";
import {
	DEFAULT_LOCAL_APP_SETTINGS,
	type DefaultEventSortMode,
	type LocalAppSettings,
	normalizeLocalAppSettings,
} from "@/lib/user-app-settings";
import { useCallback, useEffect, useState } from "react";

export const LOCAL_APP_SETTINGS_STORAGE_KEY = "oooc_local_app_settings";

const listeners = new Set<(settings: LocalAppSettings) => void>();
let currentSettings = DEFAULT_LOCAL_APP_SETTINGS;

function parseSettings(raw: string | null): LocalAppSettings {
	if (!raw) return DEFAULT_LOCAL_APP_SETTINGS;

	const parsed: unknown = JSON.parse(raw);
	if (!parsed || typeof parsed !== "object") {
		return DEFAULT_LOCAL_APP_SETTINGS;
	}

	return normalizeLocalAppSettings(parsed as Partial<LocalAppSettings>);
}

function notifySettings(settings: LocalAppSettings) {
	currentSettings = settings;
	listeners.forEach((listener) => listener(settings));
}

function readStoredSettings(): LocalAppSettings {
	if (typeof window === "undefined") return DEFAULT_LOCAL_APP_SETTINGS;

	try {
		return parseSettings(
			window.localStorage.getItem(LOCAL_APP_SETTINGS_STORAGE_KEY),
		);
	} catch (error) {
		clientLog.warn("settings.local", "Failed to load local app settings", {
			error: error instanceof Error ? error.message : String(error),
		});
		return DEFAULT_LOCAL_APP_SETTINGS;
	}
}

function writeStoredSettings(settings: LocalAppSettings) {
	if (typeof window === "undefined") return;

	try {
		window.localStorage.setItem(
			LOCAL_APP_SETTINGS_STORAGE_KEY,
			JSON.stringify(settings),
		);
	} catch (error) {
		clientLog.warn("settings.local", "Failed to save local app settings", {
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

export function useLocalAppSettings() {
	const [settings, setSettingsState] = useState(currentSettings);
	const [isLoaded, setIsLoaded] = useState(false);

	useEffect(() => {
		const listener = (nextSettings: LocalAppSettings) => {
			setSettingsState(nextSettings);
		};

		listeners.add(listener);
		const storedSettings = readStoredSettings();
		notifySettings(storedSettings);
		setIsLoaded(true);

		return () => {
			listeners.delete(listener);
		};
	}, []);

	const updateSettings = useCallback(
		(updater: (settings: LocalAppSettings) => LocalAppSettings) => {
			const nextSettings = updater(currentSettings);
			writeStoredSettings(nextSettings);
			notifySettings(nextSettings);
		},
		[],
	);

	const setHideFloatingFilterButton = useCallback(
		(hideFloatingFilterButton: boolean) => {
			updateSettings((existingSettings) => ({
				...existingSettings,
				hideFloatingFilterButton,
			}));
		},
		[updateSettings],
	);

	const setHideFloatingPrompts = useCallback(
		(hideFloatingPrompts: boolean) => {
			updateSettings((existingSettings) => ({
				...existingSettings,
				hideFloatingPrompts,
			}));
		},
		[updateSettings],
	);

	const setDefaultEventSortMode = useCallback(
		(defaultEventSortMode: DefaultEventSortMode) => {
			updateSettings((existingSettings) => ({
				...existingSettings,
				defaultEventSortMode,
			}));
		},
		[updateSettings],
	);

	const resetLocalAppSettings = useCallback(() => {
		writeStoredSettings(DEFAULT_LOCAL_APP_SETTINGS);
		notifySettings(DEFAULT_LOCAL_APP_SETTINGS);
	}, []);

	const replaceLocalAppSettings = useCallback((settings: LocalAppSettings) => {
		const normalizedSettings = normalizeLocalAppSettings(settings);
		writeStoredSettings(normalizedSettings);
		notifySettings(normalizedSettings);
	}, []);

	return {
		settings,
		isLoaded,
		setHideFloatingFilterButton,
		setHideFloatingPrompts,
		setDefaultEventSortMode,
		resetLocalAppSettings,
		replaceLocalAppSettings,
	};
}
