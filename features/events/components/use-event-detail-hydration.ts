"use client";

import {
	isEventPayload,
	readEventDetailSnapshot,
	writeEventDetailSnapshot,
} from "@/features/events/offline-event-snapshot";
import type { Event } from "@/features/events/types";
import { clientLog } from "@/lib/platform/client-logger";
import { type Dispatch, type SetStateAction, useCallback, useRef } from "react";

interface UseEventDetailHydrationOptions {
	setEvents: Dispatch<SetStateAction<Event[]>>;
	setSelectedEvent: Dispatch<SetStateAction<Event | null>>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const parseEventDetailsResponse = (value: unknown): Event | null => {
	if (!isRecord(value) || !isEventPayload(value.event)) return null;
	return value.event;
};

const normalizeBasePath = (value: string): string => {
	if (!value || value === "/") return "";
	return value.endsWith("/") ? value.slice(0, -1) : value;
};

const isBrowserOffline = () =>
	typeof navigator !== "undefined" && navigator.onLine === false;

export function useEventDetailHydration({
	setEvents,
	setSelectedEvent,
}: UseEventDetailHydrationOptions) {
	const eventDetailsPromiseRef = useRef(
		new Map<string, Promise<Event | null>>(),
	);

	const applyEventDetail = useCallback(
		(event: Event) => {
			const normalizedEventKey = event.eventKey.toLowerCase();
			setEvents((currentEvents) =>
				currentEvents.map((currentEvent) =>
					currentEvent.eventKey.toLowerCase() === normalizedEventKey
						? event
						: currentEvent,
				),
			);
			setSelectedEvent((currentEvent) =>
				currentEvent?.eventKey.toLowerCase() === normalizedEventKey
					? event
					: currentEvent,
			);
		},
		[setEvents, setSelectedEvent],
	);

	const readSavedEventDetail = useCallback(
		async (eventKey: string) => {
			const snapshot = await readEventDetailSnapshot(eventKey);
			if (!snapshot) return null;
			applyEventDetail(snapshot.event);
			return snapshot.event;
		},
		[applyEventDetail],
	);

	return useCallback(
		(eventKey: string) => {
			const normalizedEventKey = eventKey.trim().toLowerCase();
			const cachedRequest =
				eventDetailsPromiseRef.current.get(normalizedEventKey);
			if (cachedRequest) return cachedRequest;

			const request = (async () => {
				if (isBrowserOffline()) {
					const savedEvent = await readSavedEventDetail(normalizedEventKey);
					if (savedEvent) return savedEvent;
				}

				const basePath = normalizeBasePath(
					process.env.NEXT_PUBLIC_BASE_PATH || "",
				);

				try {
					const response = await fetch(
						`${basePath}/api/events/${encodeURIComponent(eventKey)}`,
						{
							headers: { Accept: "application/json" },
						},
					);
					if (!response.ok) {
						throw new Error(`Event details request failed: ${response.status}`);
					}

					const event = parseEventDetailsResponse(await response.json());
					if (!event) {
						throw new Error(
							"Event details response was not a valid event payload",
						);
					}

					applyEventDetail(event);
					await writeEventDetailSnapshot(event);
					return event;
				} catch (error: unknown) {
					clientLog.warn("events-data", "Unable to hydrate event details", {
						error: error instanceof Error ? error.message : String(error),
						eventKey,
					});
					const savedEvent = await readSavedEventDetail(normalizedEventKey);
					if (savedEvent) return savedEvent;
					eventDetailsPromiseRef.current.delete(normalizedEventKey);
					return null;
				}
			})();

			eventDetailsPromiseRef.current.set(normalizedEventKey, request);
			return request;
		},
		[applyEventDetail, readSavedEventDetail],
	);
}
