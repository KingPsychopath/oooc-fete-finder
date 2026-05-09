"use client";

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

interface EventsOfflineContextValue {
	events: Event[];
	setEvents: Dispatch<SetStateAction<Event[]>>;
	eventDataSource: EventDataSource;
	eventSnapshotSavedAt: string | null;
	hasLoadedFullEvents: boolean;
	requestFullEvents: () => Promise<Event[] | null>;
}

interface EventsOfflineProviderProps {
	children: ReactNode;
	initialEvents: Event[];
	fullEventsPath?: string;
}

const EventsOfflineContext =
	createContext<EventsOfflineContextValue | null>(null);

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
	const [hasLoadedFullEvents, setHasLoadedFullEvents] =
		useState(!fullEventsPath);
	const fullEventsPromiseRef = useRef<Promise<Event[] | null> | null>(null);

	useEffect(() => {
		let isCancelled = false;

		void readHomeEventSnapshot()
			.then((snapshot) => {
				if (isCancelled || !snapshot) return;
				setEventSnapshotSavedAt(snapshot.savedAt);
				if (initialEvents.length > 0 && navigator.onLine) return;
				setEvents(snapshot.events);
				setEventDataSource("saved");
				setHasLoadedFullEvents(true);
			})
			.catch((error: unknown) => {
				clientLog.warn("events-offline", "Unable to read saved event data", {
					error: error instanceof Error ? error.message : String(error),
				});
			});

		return () => {
			isCancelled = true;
		};
	}, [initialEvents.length]);

	useEffect(() => {
		if (eventDataSource !== "live" || events.length === 0) return;

		void writeHomeEventSnapshot(events)
			.then((snapshot) => {
				if (!snapshot) return;
				setEventSnapshotSavedAt(snapshot.savedAt);
			})
			.catch((error: unknown) => {
				clientLog.warn("events-offline", "Unable to save event data", {
					error: error instanceof Error ? error.message : String(error),
				});
			});
	}, [eventDataSource, events]);

	const requestFullEvents = useCallback(() => {
		if (!fullEventsPath || hasLoadedFullEvents) {
			return Promise.resolve(events);
		}
		if (fullEventsPromiseRef.current) return fullEventsPromiseRef.current;

		const request = fetch(fullEventsPath, {
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
				return payload;
			})
			.catch((error: unknown) => {
				clientLog.warn("events-data", "Unable to hydrate full event payload", {
					error: error instanceof Error ? error.message : String(error),
				});
				fullEventsPromiseRef.current = null;
				return null;
			});

		fullEventsPromiseRef.current = request;
		return request;
	}, [events, fullEventsPath, hasLoadedFullEvents]);

	const value = useMemo(
		() => ({
			events,
			setEvents,
			eventDataSource,
			eventSnapshotSavedAt,
			hasLoadedFullEvents,
			requestFullEvents,
		}),
		[
			events,
			eventDataSource,
			eventSnapshotSavedAt,
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
		throw new Error("useEventsOffline must be used within EventsOfflineProvider");
	}
	return context;
}
