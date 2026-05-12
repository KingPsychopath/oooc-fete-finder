"use client";

import { useOptionalAuth } from "@/features/auth/auth-context";
import { getUserProfileStorageKey } from "@/features/auth/user-profile-storage-key";
import { getClientContext } from "@/features/events/engagement/client-tracking";
import type { Event } from "@/features/events/types";
import {
	discardPendingMutations,
	enqueueSavedEventMutation,
	flushPendingMutations,
	getPendingMutationCount,
	getPendingSavedEventMutations,
} from "@/features/offline-mutations/pending-mutation-queue";
import {
	type PendingSyncStatus,
	canSyncAccountData,
	getClientSyncMode,
	getPendingSyncStatus,
} from "@/features/sync/client-sync-mode";
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
	pendingSavedMutationCount: number;
	pendingSavedMutationStatus: PendingSyncStatus;
	isEventSaved: (eventKey: string) => boolean;
	getSavedEvents: (events: Event[]) => Event[];
	toggleSavedEvent: (event: Event, source?: string) => boolean;
}

const SavedEventsContext = createContext<SavedEventsContextValue | null>(null);

const normalizeEventKey = (eventKey: string): string =>
	eventKey.trim().toLowerCase();

const getStorageKey = (ownerKey: string): string =>
	`${SAVED_EVENTS_STORAGE_PREFIX}:${ownerKey}`;

export const getSavedEventsOwnerKey = (
	userId: string | null,
	email: string | null,
	isAuthenticated: boolean,
): string =>
	getUserProfileStorageKey({
		userId,
		email,
		isAuthenticated,
		anonymousKey: "anon",
	});

export const applyPendingSavedEventMutations = (
	eventKeys: Iterable<string>,
	pendingMutations: Iterable<{
		payload: { eventKey: string; isSaved: boolean };
	}>,
): Set<string> => {
	const next = new Set(
		Array.from(eventKeys, normalizeEventKey).filter(Boolean),
	);
	for (const mutation of pendingMutations) {
		const eventKey = normalizeEventKey(mutation.payload.eventKey);
		if (!eventKey) continue;
		if (mutation.payload.isSaved) {
			next.add(eventKey);
		} else {
			next.delete(eventKey);
		}
	}
	return next;
};

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
	ownerKey: string;
	eventKeys: string[];
	isSaved?: boolean;
	source: string;
	queueOnFailure?: boolean;
	idempotencyKey?: string;
}): Promise<boolean> => {
	if (typeof window === "undefined" || input.eventKeys.length === 0) {
		return Promise.resolve(false);
	}
	return fetch(`${basePath}/api/user/saved-events`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			eventKeys: input.eventKeys,
			isSaved: input.isSaved,
			source: input.source,
			idempotencyKey: input.idempotencyKey,
			clientContext: getClientContext(),
		}),
		keepalive: true,
	})
		.then((response) => {
			if (response.ok) return true;
			if (input.queueOnFailure && typeof input.isSaved === "boolean") {
				for (const eventKey of input.eventKeys) {
					enqueueSavedEventMutation({
						ownerKey: input.ownerKey,
						eventKey,
						isSaved: input.isSaved,
						source: input.source,
					});
				}
			}
			return false;
		})
		.catch(() => {
			if (input.queueOnFailure && typeof input.isSaved === "boolean") {
				for (const eventKey of input.eventKeys) {
					enqueueSavedEventMutation({
						ownerKey: input.ownerKey,
						eventKey,
						isSaved: input.isSaved,
						source: input.source,
					});
				}
			}
			return false;
		});
};

export function SavedEventsProvider({ children }: { children: ReactNode }) {
	const { isAuthenticated, authMode, isOnline, userEmail, userId } =
		useOptionalAuth();
	const [savedEventKeys, setSavedEventKeys] = useState<Set<string>>(
		() => new Set(),
	);
	const [pendingSavedMutationCount, setPendingSavedMutationCount] = useState(0);
	const syncMode = getClientSyncMode({ authMode, isAuthenticated, isOnline });
	const canSync = canSyncAccountData(syncMode);
	const ownerKey = getSavedEventsOwnerKey(userId, userEmail, isAuthenticated);
	const canQueueAccountMutation = isAuthenticated && ownerKey !== "anon";
	const pendingSavedMutationStatus = getPendingSyncStatus(
		pendingSavedMutationCount,
		isOnline,
	);
	const previousOwnerKeyRef = useRef(ownerKey);
	const pendingAnonymousMergeKeysRef = useRef<Set<string>>(new Set());

	useEffect(() => {
		const previousOwnerKey = previousOwnerKeyRef.current;
		previousOwnerKeyRef.current = ownerKey;
		const localKeys = applyPendingSavedEventMutations(
			readLocalSavedEventKeys(ownerKey),
			getPendingSavedEventMutations(ownerKey),
		);
		const anonymousKeys = new Set(readLocalSavedEventKeys("anon"));
		const shouldMergeAnonymousKeys =
			canSync &&
			previousOwnerKey === "anon" &&
			ownerKey !== "anon" &&
			anonymousKeys.size > 0;

		if (shouldMergeAnonymousKeys) {
			for (const eventKey of anonymousKeys) {
				localKeys.add(eventKey);
			}
			pendingAnonymousMergeKeysRef.current = anonymousKeys;
		} else {
			pendingAnonymousMergeKeysRef.current = new Set();
		}

		setSavedEventKeys(localKeys);
		if (shouldMergeAnonymousKeys) {
			syncSavedEvents({
				ownerKey,
				eventKeys: Array.from(anonymousKeys),
				isSaved: true,
				source: "saved_events_anon_merge",
				queueOnFailure: true,
			});
			clearLocalSavedEventKeys("anon");
		}
		discardPendingMutations("anon");
		setPendingSavedMutationCount(getPendingMutationCount(ownerKey));
	}, [canSync, ownerKey]);

	useEffect(() => {
		writeLocalSavedEventKeys(ownerKey, savedEventKeys);
	}, [ownerKey, savedEventKeys]);

	useEffect(() => {
		if (!canSync) return;
		let isCancelled = false;
		const activeOwnerKey = ownerKey;

		const loadRemoteSavedEvents = async () => {
			try {
				const response = await fetch(`${basePath}/api/user/saved-events`, {
					method: "GET",
					cache: "no-store",
				});
				const payload = (await response.json()) as {
					eventKeys?: unknown;
				};
				if (
					isCancelled ||
					activeOwnerKey !== previousOwnerKeyRef.current ||
					!Array.isArray(payload.eventKeys)
				) {
					return;
				}
				const remoteKeys = payload.eventKeys
					.filter((value): value is string => typeof value === "string")
					.map(normalizeEventKey)
					.filter(Boolean);
				setSavedEventKeys(
					applyPendingSavedEventMutations(
						[...remoteKeys, ...pendingAnonymousMergeKeysRef.current],
						getPendingSavedEventMutations(activeOwnerKey),
					),
				);
			} catch {
				// Local saves remain available if sync cannot complete.
			}
		};

		void loadRemoteSavedEvents();

		return () => {
			isCancelled = true;
		};
	}, [canSync, ownerKey]);

	useEffect(() => {
		if (!canSync) return;

		const flushForCurrentOwner = async () => {
			const result = await flushPendingMutations({
				ownerKey,
				savedEvent: ({ mutation }) =>
					syncSavedEvents({
						ownerKey: mutation.ownerKey,
						eventKeys: [mutation.payload.eventKey],
						isSaved: mutation.payload.isSaved,
						source: mutation.payload.source,
						idempotencyKey: mutation.idempotencyKey,
					}),
			});
			setPendingSavedMutationCount(result.remaining);
		};

		void flushForCurrentOwner();
	}, [canSync, ownerKey]);

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
				if (!canSync) {
					if (canQueueAccountMutation) {
						enqueueSavedEventMutation({
							ownerKey,
							eventKey,
							isSaved: nextIsSaved,
							source,
						});
						setPendingSavedMutationCount(getPendingMutationCount(ownerKey));
					} else {
						setPendingSavedMutationCount(0);
					}
					return next;
				}
				syncSavedEvents({
					ownerKey,
					eventKeys: [eventKey],
					isSaved: nextIsSaved,
					source,
					queueOnFailure: true,
				}).then(() => {
					setPendingSavedMutationCount(getPendingMutationCount(ownerKey));
				});
				return next;
			});
			return nextIsSaved;
		},
		[canQueueAccountMutation, canSync, ownerKey],
	);

	const value = useMemo(
		() => ({
			savedEventKeys,
			savedEventsCount: savedEventKeys.size,
			pendingSavedMutationCount,
			pendingSavedMutationStatus,
			isEventSaved,
			getSavedEvents,
			toggleSavedEvent,
		}),
		[
			getSavedEvents,
			isEventSaved,
			pendingSavedMutationCount,
			pendingSavedMutationStatus,
			savedEventKeys,
			toggleSavedEvent,
		],
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
