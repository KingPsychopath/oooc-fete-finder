"use client";

import { useOptionalAuth } from "@/features/auth/auth-context";
import { getUserProfileStorageKey } from "@/features/auth/user-profile-storage-key";
import { MAP_PREFERENCE_STORAGE_KEY } from "@/features/maps/constants/map-options";
import { useMapPreference } from "@/features/maps/hooks/use-map-preference";
import {
	canSyncAccountData,
	getClientSyncMode,
} from "@/features/sync/client-sync-mode";
import { useLocalAppSettings } from "@/hooks/useLocalAppSettings";
import { useThemeToggle } from "@/hooks/useThemeToggle";
import {
	DEFAULT_SYNCED_USER_APP_SETTINGS,
	type SyncedUserAppSettings,
	normalizeLocalAppSettings,
	normalizeMapPreference,
	normalizeThemeMode,
} from "@/lib/user-app-settings";
import { useCallback, useEffect, useMemo, useRef } from "react";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const ACTIVE_PROFILE_STORAGE_KEY = "oooc_app_settings_active_profile_v1";
const PROFILE_STORAGE_PREFIX = "oooc_app_settings_profile_v1:";
const THEME_STORAGE_KEY = "theme";
const ANONYMOUS_PROFILE_ID = "anonymous";

const getProfileStorageKey = (profileId: string) =>
	`${PROFILE_STORAGE_PREFIX}${profileId}`;

const readProfileSnapshot = (
	profileId: string,
): SyncedUserAppSettings | null => {
	try {
		const raw = window.localStorage.getItem(getProfileStorageKey(profileId));
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Partial<SyncedUserAppSettings>;
		return {
			appSettings: normalizeLocalAppSettings(parsed.appSettings),
			mapPreference: normalizeMapPreference(parsed.mapPreference),
			themeMode: normalizeThemeMode(parsed.themeMode),
			updatedAt:
				typeof parsed.updatedAt === "string" ? parsed.updatedAt : undefined,
		};
	} catch {
		return null;
	}
};

const writeProfileSnapshot = (
	profileId: string,
	snapshot: SyncedUserAppSettings,
) => {
	window.localStorage.setItem(
		getProfileStorageKey(profileId),
		JSON.stringify({ ...snapshot, updatedAt: new Date().toISOString() }),
	);
};

export function AppSettingsSync() {
	const {
		authMode,
		isAuthResolved,
		isAuthenticated,
		isOnline,
		userId,
	} = useOptionalAuth();
	const { settings, isLoaded, replaceLocalAppSettings } = useLocalAppSettings();
	const {
		mapPreference,
		setMapPreference,
		isLoaded: isMapPreferenceLoaded,
	} = useMapPreference();
	const { theme, setTheme, mounted } = useThemeToggle();
	const activeProfileRef = useRef<string | null>(null);
	const isApplyingSnapshotRef = useRef(false);
	const currentSnapshotRef = useRef<SyncedUserAppSettings>(
		DEFAULT_SYNCED_USER_APP_SETTINGS,
	);

	const payload = useMemo<SyncedUserAppSettings>(
		() => ({
			appSettings: settings,
			mapPreference,
			themeMode:
				theme === "light" || theme === "dark" || theme === "system"
					? theme
					: "system",
		}),
		[mapPreference, settings, theme],
	);
	currentSnapshotRef.current = payload;

	const isReady =
		isAuthResolved && isLoaded && isMapPreferenceLoaded && mounted;
	const syncMode = getClientSyncMode({ authMode, isAuthenticated, isOnline });
	const canSyncAccountSettings = canSyncAccountData(syncMode);
	const targetProfileId = getUserProfileStorageKey({
		userId,
		isAuthenticated,
		anonymousKey: ANONYMOUS_PROFILE_ID,
	});

	const applySnapshot = useCallback(
		(snapshot: SyncedUserAppSettings) => {
			isApplyingSnapshotRef.current = true;
			replaceLocalAppSettings(snapshot.appSettings);
			setMapPreference(snapshot.mapPreference);
			setTheme(snapshot.themeMode);
			window.setTimeout(() => {
				isApplyingSnapshotRef.current = false;
			}, 0);
		},
		[replaceLocalAppSettings, setMapPreference, setTheme],
	);

	useEffect(() => {
		if (!isReady) return;
		if (activeProfileRef.current === targetProfileId) return;

		let isCancelled = false;
		const previousProfileId =
			activeProfileRef.current ??
			window.localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY);
		if (previousProfileId && previousProfileId !== targetProfileId) {
			writeProfileSnapshot(previousProfileId, currentSnapshotRef.current);
		}

		activeProfileRef.current = targetProfileId;
		window.localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, targetProfileId);

		const switchProfile = async () => {
			const shouldUseCurrentAsAnonymousSnapshot =
				previousProfileId === null ||
				previousProfileId === ANONYMOUS_PROFILE_ID;
			const anonymousSnapshot =
				readProfileSnapshot(ANONYMOUS_PROFILE_ID) ??
				(shouldUseCurrentAsAnonymousSnapshot
					? currentSnapshotRef.current
					: DEFAULT_SYNCED_USER_APP_SETTINGS);

			if (!isAuthenticated || targetProfileId === ANONYMOUS_PROFILE_ID) {
				writeProfileSnapshot(ANONYMOUS_PROFILE_ID, anonymousSnapshot);
				if (!isCancelled) applySnapshot(anonymousSnapshot);
				return;
			}

			try {
				if (canSyncAccountSettings) {
					const response = await fetch(`${basePath}/api/user/app-settings`, {
						method: "GET",
						cache: "no-store",
					});
					if (response.ok && !isCancelled) {
						const data = (await response.json()) as {
							settings?: SyncedUserAppSettings | null;
						};
						if (data.settings) {
							writeProfileSnapshot(targetProfileId, data.settings);
							applySnapshot(data.settings);
							return;
						}
					}
				}

				const localUserSnapshot =
					readProfileSnapshot(targetProfileId) ?? anonymousSnapshot;
				writeProfileSnapshot(targetProfileId, localUserSnapshot);
				if (!isCancelled) applySnapshot(localUserSnapshot);

				if (canSyncAccountSettings) {
					await fetch(`${basePath}/api/user/app-settings`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify(localUserSnapshot),
					});
				}
			} catch {
				// Local settings remain the offline/resilient fallback.
			}
		};

		void switchProfile();

		return () => {
			isCancelled = true;
		};
	}, [
		isAuthenticated,
		canSyncAccountSettings,
		isReady,
		applySnapshot,
		targetProfileId,
	]);

	useEffect(() => {
		if (!isReady || !activeProfileRef.current) return;
		if (isApplyingSnapshotRef.current) return;

		const activeProfileId = activeProfileRef.current;
		writeProfileSnapshot(activeProfileId, payload);
		if (activeProfileId === ANONYMOUS_PROFILE_ID || !canSyncAccountSettings)
			return;

		const timeoutId = window.setTimeout(() => {
			void fetch(`${basePath}/api/user/app-settings`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			}).catch(() => {
				// Sync is opportunistic; local settings are already saved.
			});
		}, 450);

		return () => window.clearTimeout(timeoutId);
	}, [canSyncAccountSettings, isReady, payload]);

	useEffect(() => {
		try {
			if (mapPreference) {
				window.localStorage.setItem(MAP_PREFERENCE_STORAGE_KEY, mapPreference);
			}
			if (theme === "light" || theme === "dark" || theme === "system") {
				window.localStorage.setItem(THEME_STORAGE_KEY, theme);
			}
		} catch {
			// The individual hooks already handle unavailable storage.
		}
	}, [mapPreference, theme]);

	return null;
}
