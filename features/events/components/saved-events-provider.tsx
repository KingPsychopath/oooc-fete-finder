"use client";

import { useOptionalAuth } from "@/features/auth/auth-context";
import { getClientContext } from "@/features/events/engagement/client-tracking";
import type { Event } from "@/features/events/types";
import {
	type ReactNode,
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

const SAVED_EVENTS_STORAGE_PREFIX = "oooc:saved-events:v1";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

interface SavedEventsContextValue {
	savedEventKeys: Set<string>;
	savedEventsCount: number;
	isEventSaved: (eventKey: string) => boolean;
	getSavedEvents: (events: Event[]) => Event[];
	toggleSavedEvent: (event: Event, source?: string) => boolean;
}

const SavedEventsContext = createContext<SavedEventsContextValue | null>(null);

const normalizeEventKey = (eventKey: string): string =>
	eventKey.trim().toLowerCase();

const getStorageKey = (ownerKey: string): string =>
	`${SAVED_EVENTS_STORAGE_PREFIX}:${ownerKey}`;

const getOwnerKey = (
	email: string | null,
	isLiveAuthenticated: boolean,
): string =>
	isLiveAuthenticated && email ? `user:${email.trim().toLowerCase()}` : "anon";

const readLocalSavedEventKeys = (ownerKey: string): string[] => {
	if (typeof window === "undefined") return [];
	try {
		const raw = window.localStorage.getItem(getStorageKey(ownerKey));
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed
			.filter((value): value is string => typeof value === "string")
			.map(normalizeEventKey)
			.filter(Boolean);
	} catch {
		return [];
	}
};

const writeLocalSavedEventKeys = (ownerKey: string, eventKeys: Set<string>) => {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(
			getStorageKey(ownerKey),
			JSON.stringify(Array.from(eventKeys)),
		);
	} catch {
		// The in-memory state still works if storage is unavailable.
	}
};

const clearLocalSavedEventKeys = (ownerKey: string) => {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.removeItem(getStorageKey(ownerKey));
	} catch {
		// Ignore storage failures.
	}
};

const syncSavedEvents = (input: {
	eventKeys: string[];
	isSaved?: boolean;
	source: string;
}) => {
	if (typeof window === "undefined" || input.eventKeys.length === 0) return;
	void fetch(`${basePath}/api/user/saved-events`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			eventKeys: input.eventKeys,
			isSaved: input.isSaved,
			source: input.source,
			clientContext: getClientContext(),
		}),
		keepalive: true,
	}).catch(() => {});
};

export function SavedEventsProvider({ children }: { children: ReactNode }) {
	const { isAuthenticated, authMode, userEmail } = useOptionalAuth();
	const [savedEventKeys, setSavedEventKeys] = useState<Set<string>>(
		() => new Set(),
	);
	const canSync = isAuthenticated && authMode === "live";
	const ownerKey = getOwnerKey(userEmail, canSync);
	const previousOwnerKeyRef = useRef(ownerKey);

	useEffect(() => {
		const previousOwnerKey = previousOwnerKeyRef.current;
		previousOwnerKeyRef.current = ownerKey;
		const localKeys = new Set(readLocalSavedEventKeys(ownerKey));
		const shouldMergeAnonymousKeys =
			canSync && previousOwnerKey === "anon" && ownerKey !== "anon";

		if (shouldMergeAnonymousKeys) {
			for (const eventKey of readLocalSavedEventKeys("anon")) {
				localKeys.add(eventKey);
			}
		}

		setSavedEventKeys(localKeys);
		if (shouldMergeAnonymousKeys && localKeys.size > 0) {
			syncSavedEvents({
				eventKeys: Array.from(localKeys),
				source: "saved_events_anon_merge",
			});
			clearLocalSavedEventKeys("anon");
		}
	}, [canSync, ownerKey]);

	useEffect(() => {
		writeLocalSavedEventKeys(ownerKey, savedEventKeys);
	}, [ownerKey, savedEventKeys]);

	useEffect(() => {
		if (!canSync) return;
		let isCancelled = false;

		const loadRemoteSavedEvents = async () => {
			try {
				const response = await fetch(`${basePath}/api/user/saved-events`, {
					method: "GET",
					cache: "no-store",
				});
				const payload = (await response.json()) as {
					eventKeys?: unknown;
				};
				if (isCancelled || !Array.isArray(payload.eventKeys)) return;
				const remoteKeys = payload.eventKeys
					.filter((value): value is string => typeof value === "string")
					.map(normalizeEventKey)
					.filter(Boolean);
				setSavedEventKeys((current) => {
					const merged = new Set([...current, ...remoteKeys]);
					return merged;
				});
			} catch {
				// Local saves remain available if sync cannot complete.
			}
		};

		void loadRemoteSavedEvents();

		return () => {
			isCancelled = true;
		};
	}, [canSync]);

	const isEventSaved = useCallback(
		(eventKey: string) => savedEventKeys.has(normalizeEventKey(eventKey)),
		[savedEventKeys],
	);

	const getSavedEvents = useCallback(
		(events: Event[]) =>
			events.filter((event) =>
				savedEventKeys.has(normalizeEventKey(event.eventKey)),
			),
		[savedEventKeys],
	);

	const toggleSavedEvent = useCallback(
		(event: Event, source = "saved_events") => {
			const eventKey = normalizeEventKey(event.eventKey);
			if (!eventKey) return false;
			let nextIsSaved = false;
			setSavedEventKeys((current) => {
				const next = new Set(current);
				if (next.has(eventKey)) {
					next.delete(eventKey);
					nextIsSaved = false;
				} else {
					next.add(eventKey);
					nextIsSaved = true;
				}
				syncSavedEvents({
					eventKeys: [eventKey],
					isSaved: nextIsSaved,
					source,
				});
				return next;
			});
			return nextIsSaved;
		},
		[],
	);

	const value = useMemo(
		() => ({
			savedEventKeys,
			savedEventsCount: savedEventKeys.size,
			isEventSaved,
			getSavedEvents,
			toggleSavedEvent,
		}),
		[getSavedEvents, isEventSaved, savedEventKeys, toggleSavedEvent],
	);

	return (
		<SavedEventsContext.Provider value={value}>
			{children}
		</SavedEventsContext.Provider>
	);
}

export function useSavedEvents() {
	const context = useContext(SavedEventsContext);
	if (!context) {
		throw new Error("useSavedEvents must be used within SavedEventsProvider");
	}
	return context;
}
