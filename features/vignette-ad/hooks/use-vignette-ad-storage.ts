"use client";

import { useEffect, useState, useCallback } from "react";
import type {
	UseVignetteAdStorageOptions,
	VignetteAdStorageReturn,
} from "../types";
import { STORAGE_KEYS, DELAY_CONFIG } from "../constants";

export function useVignetteAdStorage({
	delayAfterChatClick = DELAY_CONFIG.CHAT_CLICKED_DELAY,
	delayAfterDismiss = DELAY_CONFIG.DISMISSED_DELAY,
	initialDelay = 1000,
}: UseVignetteAdStorageOptions = {}): VignetteAdStorageReturn {
	const [shouldShow, setShouldShow] = useState(false);
	const [forceUpdate, setForceUpdate] = useState(0);

	// Check if localStorage is available
	const isLocalStorageAvailable = useCallback((): boolean => {
		try {
			const test = "__localStorage_test__";
			localStorage.setItem(test, test);
			localStorage.removeItem(test);
			return true;
		} catch {
			return false;
		}
	}, []);

	// Get timestamp from localStorage safely
	const getTimestamp = useCallback(
		(key: string): number | null => {
			if (!isLocalStorageAvailable()) return null;

			try {
				const value = localStorage.getItem(key);
				return value ? parseInt(value, 10) : null;
			} catch {
				return null;
			}
		},
		[isLocalStorageAvailable],
	);

	// Set timestamp in localStorage safely
	const setTimestamp = useCallback(
		(key: string, timestamp: number = Date.now()): void => {
			if (!isLocalStorageAvailable()) return;

			try {
				localStorage.setItem(key, timestamp.toString());
			} catch {
				// Silently fail
			}
		},
		[isLocalStorageAvailable],
	);

	// Remove item from localStorage safely
	const removeItem = useCallback(
		(key: string): void => {
			if (!isLocalStorageAvailable()) return;

			try {
				localStorage.removeItem(key);
			} catch {
				// Silently fail
			}
		},
		[isLocalStorageAvailable],
	);

	// Check if the ad should be shown
	const checkShouldShow = useCallback((): boolean => {
		const chatClickedTimestamp = getTimestamp(STORAGE_KEYS.CLICKED_CHAT);
		const dismissedTimestamp = getTimestamp(STORAGE_KEYS.DISMISSED);
		const now = Date.now();

		// If user clicked the chat link, check if enough time has passed
		if (chatClickedTimestamp) {
			const timeSinceClick = now - chatClickedTimestamp;
			if (timeSinceClick < delayAfterChatClick) {
				return false;
			}
		}

		// If user dismissed the ad, check if enough time has passed
		if (dismissedTimestamp) {
			const timeSinceDismiss = now - dismissedTimestamp;
			if (timeSinceDismiss < delayAfterDismiss) {
				return false;
			}
		}

		return true;
	}, [delayAfterChatClick, delayAfterDismiss, getTimestamp]);

	// Mark that user clicked the chat link
	const markChatClicked = useCallback((): void => {
		setTimestamp(STORAGE_KEYS.CLICKED_CHAT);
		// Clear dismissed timestamp since user engaged
		removeItem(STORAGE_KEYS.DISMISSED);
		// Force immediate update
		setForceUpdate((prev) => prev + 1);
	}, [setTimestamp, removeItem]);

	// Mark that user dismissed the ad
	const markDismissed = useCallback((): void => {
		setTimestamp(STORAGE_KEYS.DISMISSED);
		// Force immediate update
		setForceUpdate((prev) => prev + 1);
	}, [setTimestamp]);

	// Clear all storage (useful for testing)
	const clearStorage = useCallback((): void => {
		removeItem(STORAGE_KEYS.CLICKED_CHAT);
		removeItem(STORAGE_KEYS.DISMISSED);
		// Force immediate update
		setForceUpdate((prev) => prev + 1);
	}, [removeItem]);

	// Update shouldShow whenever dependencies change
	useEffect(() => {
		const timer = setTimeout(() => {
			setShouldShow(checkShouldShow());
		}, initialDelay);

		return () => clearTimeout(timer);
	}, [initialDelay, checkShouldShow]);

	// Update shouldShow immediately when storage changes
	useEffect(() => {
		if (forceUpdate > 0) {
			setShouldShow(checkShouldShow());
		}
	}, [forceUpdate, checkShouldShow]);

	return {
		shouldShow,
		markChatClicked,
		markDismissed,
		clearStorage,
		checkShouldShow,
	};
}
