"use client";

import { useOnlineStatus } from "@/components/online-status-gate";
import {
	readHomeEventSnapshot,
	writeHomeEventSnapshot,
} from "@/features/events/offline-event-snapshot";
import type { Event } from "@/features/events/types";
import { clientLog } from "@/lib/platform/client-logger";
import {
	type Dispatch,
	type ReactNode,
	type SetStateAction,
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

export type EventDataSource = "live" | "saved";
export type EventSnapshotFreshness = "fresh" | "stale" | "missing" | "error";
export type EventSnapshotSyncState = "idle" | "refreshing" | "saved" | "error";

interface EventsOfflineContextValue {
	events: Event[];
	setEvents: Dispatch<SetStateAction<Event[]>>;
	eventDataSource: EventDataSource;
	eventSnapshotError: string | null;
	eventSnapshotFreshness: EventSnapshotFreshness;
	eventSnapshotSavedAt: string | null;
	eventSnapshotSyncState: EventSnapshotSyncState;
	hasLoadedFullEvents: boolean;
	requestFullEvents: () => Promise<Event[] | null>;
}

interface EventsOfflineProviderProps {
	children: ReactNode;
	initialEvents: Event[];
	fullEventsPath?: string;
}

const EventsOfflineContext = createContext<EventsOfflineContextValue | null>(
	null,
);

const FRESH_SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const FULL_EVENTS_REFRESH_MAX_AGE_MS = 60 * 1000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isEventPayload = (value: unknown): value is Event =>
	isRecord(value) &&
	typeof value.eventKey === "string" &&
	typeof value.id === "string" &&
	typeof value.name === "string";

const parseFullEventsResponse = (value: unknown): Event[] | null => {
	if (!isRecord(value) || !Array.isArray(value.events)) return null;
	if (!value.events.every(isEventPayload)) return null;
	return value.events;
};

export const getEventSnapshotFreshness = (
	savedAt: string,
): Exclude<EventSnapshotFreshness, "missing" | "error"> => {
	const savedAtTime = new Date(savedAt).getTime();
	if (Number.isNaN(savedAtTime)) return "stale";
	return Date.now() - savedAtTime <= FRESH_SNAPSHOT_MAX_AGE_MS
		? "fresh"
		: "stale";
};

export function EventsOfflineProvider({
	children,
	initialEvents,
	fullEventsPath,
}: EventsOfflineProviderProps) {
	const [events, setEvents] = useState(initialEvents);
	const [eventDataSource, setEventDataSource] =
		useState<EventDataSource>("live");
	const [eventSnapshotSavedAt, setEventSnapshotSavedAt] = useState<
		string | null
	>(null);
	const [eventSnapshotFreshness, setEventSnapshotFreshness] =
		useState<EventSnapshotFreshness>("missing");
	const [eventSnapshotSyncState, setEventSnapshotSyncState] =
		useState<EventSnapshotSyncState>("idle");
	const [eventSnapshotError, setEventSnapshotError] = useState<string | null>(
		null,
	);
	const [hasLoadedFullEvents, setHasLoadedFullEvents] = useState(
		!fullEventsPath,
	);
	const isOnline = useOnlineStatus();
	const fullEventsPromiseRef = useRef<Promise<Event[] | null> | null>(null);
	const fullEventsLoadedAtRef = useRef<number | null>(null);

	useEffect(() => {
		if (!isOnline || initialEvents.length === 0) return;
		setEvents(initialEvents);
		setEventDataSource("live");
		setHasLoadedFullEvents(!fullEventsPath);
		fullEventsPromiseRef.current = null;
		fullEventsLoadedAtRef.current = null;
	}, [fullEventsPath, initialEvents, isOnline]);

	useEffect(() => {
		let isCancelled = false;

		setEventSnapshotSyncState("refreshing");
		void readHomeEventSnapshot()
			.then((snapshot) => {
				if (isCancelled) return;
				if (!snapshot) {
					setEventSnapshotFreshness("missing");
					setEventSnapshotSavedAt(null);
					setEventSnapshotError(null);
					return;
				}
				const freshness = getEventSnapshotFreshness(snapshot.savedAt);
				setEventSnapshotSavedAt(snapshot.savedAt);
				setEventSnapshotFreshness(freshness);
				setEventSnapshotSyncState("saved");
				setEventSnapshotError(null);
				if (initialEvents.length > 0 && isOnline) {
					setEvents(initialEvents);
					setEventDataSource("live");
					setHasLoadedFullEvents(!fullEventsPath);
					fullEventsPromiseRef.current = null;
					fullEventsLoadedAtRef.current = null;
					return;
				}
				setEvents(snapshot.events);
				setEventDataSource("saved");
				setHasLoadedFullEvents(true);
			})
			.catch((error: unknown) => {
				if (isCancelled) return;
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				clientLog.warn("events-offline", "Unable to read saved event data", {
					error: errorMessage,
				});
				setEventSnapshotFreshness("error");
				setEventSnapshotSyncState("error");
				setEventSnapshotError(errorMessage);
			})
			.finally(() => {
				if (isCancelled) return;
				setEventSnapshotSyncState((current) =>
					current === "refreshing" ? "idle" : current,
				);
			});

		return () => {
			isCancelled = true;
		};
	}, [fullEventsPath, initialEvents, isOnline]);

	useEffect(() => {
		if (eventDataSource !== "live" || events.length === 0) return;

		setEventSnapshotSyncState("refreshing");
		void writeHomeEventSnapshot(events)
			.then((snapshot) => {
				if (!snapshot) {
					setEventSnapshotSyncState("idle");
					return;
				}
				setEventSnapshotSavedAt(snapshot.savedAt);
				setEventSnapshotFreshness(getEventSnapshotFreshness(snapshot.savedAt));
				setEventSnapshotSyncState("saved");
				setEventSnapshotError(null);
			})
			.catch((error: unknown) => {
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				clientLog.warn("events-offline", "Unable to save event data", {
					error: errorMessage,
				});
				setEventSnapshotFreshness("error");
				setEventSnapshotSyncState("error");
				setEventSnapshotError(errorMessage);
			});
	}, [eventDataSource, events]);

	const requestFullEvents = useCallback(() => {
		const loadedAt = fullEventsLoadedAtRef.current;
		const isRecentlyLoaded =
			loadedAt != null &&
			Date.now() - loadedAt < FULL_EVENTS_REFRESH_MAX_AGE_MS;
		if (!fullEventsPath || (hasLoadedFullEvents && isRecentlyLoaded)) {
			return Promise.resolve(events);
		}
		if (!isOnline) {
			return Promise.resolve(events);
		}
		if (fullEventsPromiseRef.current) return fullEventsPromiseRef.current;

		setEventSnapshotSyncState("refreshing");
		const request = fetch(fullEventsPath, {
			cache: "no-store",
			headers: { Accept: "application/json" },
		})
			.then(async (response) => {
				if (!response.ok) {
					throw new Error(`Full events request failed: ${response.status}`);
				}
				const payload = parseFullEventsResponse(await response.json());
				if (!payload) {
					throw new Error("Full events response was not a valid event payload");
				}
				setEvents(payload);
				setEventDataSource("live");
				setHasLoadedFullEvents(true);
				fullEventsLoadedAtRef.current = Date.now();
				return payload;
			})
			.catch((error: unknown) => {
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				clientLog.warn("events-data", "Unable to hydrate full event payload", {
					error: errorMessage,
				});
				setEventSnapshotSyncState("error");
				setEventSnapshotError(errorMessage);
				fullEventsPromiseRef.current = null;
				return null;
			});

		fullEventsPromiseRef.current = request;
		return request;
	}, [events, fullEventsPath, hasLoadedFullEvents, isOnline]);

	const value = useMemo(
		() => ({
			events,
			setEvents,
			eventDataSource,
			eventSnapshotError,
			eventSnapshotFreshness,
			eventSnapshotSavedAt,
			eventSnapshotSyncState,
			hasLoadedFullEvents,
			requestFullEvents,
		}),
		[
			events,
			eventDataSource,
			eventSnapshotError,
			eventSnapshotFreshness,
			eventSnapshotSavedAt,
			eventSnapshotSyncState,
			hasLoadedFullEvents,
			requestFullEvents,
		],
	);

	return (
		<EventsOfflineContext.Provider value={value}>
			{children}
		</EventsOfflineContext.Provider>
	);
}

export function useEventsOffline() {
	const context = useContext(EventsOfflineContext);
	if (!context) {
		throw new Error(
			"useEventsOffline must be used within EventsOfflineProvider",
		);
	}
	return context;
}
