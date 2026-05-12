"use client";

import { migratePendingMutationOwnerKey } from "@/features/offline-mutations/pending-mutation-queue";

const SAVED_EVENTS_STORAGE_PREFIX = "oooc:saved-events:v1";
const ACTIVE_PROFILE_STORAGE_KEY = "oooc_app_settings_active_profile_v1";
const PROFILE_STORAGE_PREFIX = "oooc_app_settings_profile_v1:";

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const getSavedEventsStorageKey = (ownerKey: string): string =>
	`${SAVED_EVENTS_STORAGE_PREFIX}:${ownerKey}`;

const getProfileStorageKey = (profileId: string): string =>
	`${PROFILE_STORAGE_PREFIX}${profileId}`;

const readStringArray = (raw: string | null): string[] => {
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed
			.filter((value): value is string => typeof value === "string")
			.map((value) => value.trim().toLowerCase())
			.filter(Boolean);
	} catch {
		return [];
	}
};

const migrateSavedEventsKey = (oldOwnerKey: string, newOwnerKey: string) => {
	const oldStorageKey = getSavedEventsStorageKey(oldOwnerKey);
	const newStorageKey = getSavedEventsStorageKey(newOwnerKey);
	const oldRaw = window.localStorage.getItem(oldStorageKey);
	if (!oldRaw) return;

	const merged = new Set([
		...readStringArray(window.localStorage.getItem(newStorageKey)),
		...readStringArray(oldRaw),
	]);
	window.localStorage.setItem(
		newStorageKey,
		JSON.stringify(Array.from(merged)),
	);
	window.localStorage.removeItem(oldStorageKey);
};

const migrateProfileKey = (oldOwnerKey: string, newOwnerKey: string) => {
	const oldStorageKey = getProfileStorageKey(oldOwnerKey);
	const newStorageKey = getProfileStorageKey(newOwnerKey);
	const oldRaw = window.localStorage.getItem(oldStorageKey);
	if (!oldRaw) return;

	if (!window.localStorage.getItem(newStorageKey)) {
		window.localStorage.setItem(newStorageKey, oldRaw);
	}
	window.localStorage.removeItem(oldStorageKey);
};

const migrateActiveProfileKey = (oldOwnerKey: string, newOwnerKey: string) => {
	if (window.localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY) === oldOwnerKey) {
		window.localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, newOwnerKey);
	}
};

export const migrateUserScopedLocalStorageKeys = (input: {
	email: string | null;
	userId: string | null;
}): void => {
	if (typeof window === "undefined") return;
	const email = input.email ? normalizeEmail(input.email) : "";
	const userId = input.userId?.trim() ?? "";
	if (!email || !userId) return;

	const oldOwnerKey = `user:${email}`;
	const newOwnerKey = `user:${userId}`;
	if (oldOwnerKey === newOwnerKey) return;

	try {
		migrateSavedEventsKey(oldOwnerKey, newOwnerKey);
		migrateProfileKey(oldOwnerKey, newOwnerKey);
		migrateActiveProfileKey(oldOwnerKey, newOwnerKey);
		migratePendingMutationOwnerKey(oldOwnerKey, newOwnerKey);
	} catch {
		// Migration is best-effort; existing local state remains usable.
	}
};
