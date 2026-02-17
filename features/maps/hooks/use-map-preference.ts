"use client";

import { clientLog } from "@/lib/platform/client-logger";
import { useCallback, useEffect, useState } from "react";
import { MAP_PREFERENCE_STORAGE_KEY } from "../constants/map-options";
import type { MapPreferenceState, MapProvider } from "../types";

// Global state to sync across hook instances
let globalMapPreference: MapProvider = "system";
const listeners: Set<(preference: MapProvider) => void> = new Set();

// Global setter that notifies all hook instances
const setGlobalMapPreference = (preference: MapProvider) => {
	globalMapPreference = preference;
	listeners.forEach((listener) => listener(preference));
};

/**
 * Hook for managing user's preferred map application
 *
 * @returns Object containing current preference, setter, and loading state
 */
export const useMapPreference = (): MapPreferenceState => {
	const [mapPreference, setMapPreferenceState] =
		useState<MapProvider>(globalMapPreference);
	const [isLoaded, setIsLoaded] = useState(false);

	// Subscribe to global state changes
	useEffect(() => {
		const listener = (preference: MapProvider) => {
			setMapPreferenceState(preference);
		};

		listeners.add(listener);

		return () => {
			listeners.delete(listener);
		};
	}, []);

	// UI-only preference (which map app to open): localStorage is intentional;
	// server does not need this. Use cookies only for auth or server-readable state.
	useEffect(() => {
		try {
			const stored = localStorage.getItem(MAP_PREFERENCE_STORAGE_KEY);
			if (stored && ["system", "google", "apple", "ask"].includes(stored)) {
				globalMapPreference = stored as MapProvider;
				setMapPreferenceState(stored as MapProvider);
			} else {
				// First-time user - use system detection by default
				// User can change to "ask" in settings if they want the modal
				globalMapPreference = "system";
				setMapPreferenceState("system");
			}
		} catch (error) {
			clientLog.warn("maps.preference", "Failed to load map preference", {
				error: error instanceof Error ? error.message : String(error),
			});
		} finally {
			setIsLoaded(true);
		}
	}, []);

	// Update both state and localStorage
	const setMapPreference = useCallback((preference: MapProvider) => {
		try {
			localStorage.setItem(MAP_PREFERENCE_STORAGE_KEY, preference);
			// Update global state and notify all instances
			setGlobalMapPreference(preference);
		} catch (error) {
			clientLog.warn("maps.preference", "Failed to save map preference", {
				error: error instanceof Error ? error.message : String(error),
			});
			// Still update state even if localStorage fails
			setGlobalMapPreference(preference);
		}
	}, []);

	return {
		mapPreference,
		setMapPreference,
		isLoaded,
	};
};
