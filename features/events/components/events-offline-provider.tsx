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
	useContext,
	useEffect,
	useMemo,
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
}

interface EventsOfflineProviderProps {
	children: ReactNode;
	initialEvents: Event[];
}

const EventsOfflineContext = createContext<EventsOfflineContextValue | null>(
	null,
);

const FRESH_SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

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
	const isOnline = useOnlineStatus();

	useEffect(() => {
		if (!isOnline || initialEvents.length === 0) return;
		setEvents(initialEvents);
		setEventDataSource("live");
	}, [initialEvents, isOnline]);

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
					return;
				}
				setEvents(snapshot.events);
				setEventDataSource("saved");
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
	}, [initialEvents, isOnline]);

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

	const value = useMemo(
		() => ({
			events,
			setEvents,
			eventDataSource,
			eventSnapshotError,
			eventSnapshotFreshness,
			eventSnapshotSavedAt,
			eventSnapshotSyncState,
		}),
		[
			events,
			eventDataSource,
			eventSnapshotError,
			eventSnapshotFreshness,
			eventSnapshotSavedAt,
			eventSnapshotSyncState,
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
