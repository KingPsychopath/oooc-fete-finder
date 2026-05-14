"use client";

import { useOptionalAuth } from "@/features/auth/auth-context";
import EventModal from "@/features/events/components/EventModal";
import {
	SavedEventsProvider,
	useSavedEvents,
} from "@/features/events/components/saved-events-provider";
import type { Event } from "@/features/events/types";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

interface EventShareClientProps {
	event: Event;
	eventUpdateRequestsEnabled: boolean;
}

const REQUEST_UPDATE_PARAM = "requestUpdate";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const normalizeBasePath = (value: string): string => {
	if (!value || value === "/") return "";
	return value.endsWith("/") ? value.slice(0, -1) : value;
};

const buildEventPath = (
	event: Event,
	params = new URLSearchParams(),
): string => {
	const normalizedBasePath = normalizeBasePath(basePath);
	const encodedEventKey = encodeURIComponent(event.eventKey);
	const encodedSlug = event.slug ? `/${encodeURIComponent(event.slug)}` : "";
	const query = params.toString();
	const path = `${normalizedBasePath}/event/${encodedEventKey}${encodedSlug}`;
	return query ? `${path}?${query}` : path;
};

export function EventShareClient({
	event,
	eventUpdateRequestsEnabled,
}: EventShareClientProps) {
	return (
		<SavedEventsProvider>
			<EventShareModal
				event={event}
				eventUpdateRequestsEnabled={eventUpdateRequestsEnabled}
			/>
		</SavedEventsProvider>
	);
}

function EventShareModal({
	event,
	eventUpdateRequestsEnabled,
}: EventShareClientProps) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { isAuthenticated } = useOptionalAuth();
	const { isEventSaved, toggleSavedEvent } = useSavedEvents();
	const [hasHydrated, setHasHydrated] = useState(false);
	const [isRequestUpdateOpen, setIsRequestUpdateOpen] = useState(
		() =>
			eventUpdateRequestsEnabled &&
			searchParams.get(REQUEST_UPDATE_PARAM) === "1",
	);
	const homeHref = normalizeBasePath(basePath) || "/";

	useEffect(() => {
		setHasHydrated(true);
		const previewElements = document.querySelectorAll<HTMLElement>(
			"[data-event-share-preview]",
		);
		for (const element of previewElements) {
			element.hidden = true;
		}
		return () => {
			for (const element of previewElements) {
				element.hidden = false;
			}
		};
	}, []);

	useEffect(() => {
		let idleId: number | null = null;
		let timeoutId: ReturnType<typeof setTimeout> | null = null;
		const prefetchHome = () => {
			router.prefetch(homeHref);
		};

		if (typeof window !== "undefined" && "requestIdleCallback" in window) {
			idleId = window.requestIdleCallback(prefetchHome, { timeout: 1600 });
		} else {
			timeoutId = setTimeout(prefetchHome, 900);
		}

		return () => {
			if (
				idleId !== null &&
				typeof window !== "undefined" &&
				"cancelIdleCallback" in window
			) {
				window.cancelIdleCallback(idleId);
			}
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
		};
	}, [homeHref, router]);

	useEffect(() => {
		if (eventUpdateRequestsEnabled) return;
		setIsRequestUpdateOpen(false);
		if (searchParams.get(REQUEST_UPDATE_PARAM) !== "1") return;
		const nextParams = new URLSearchParams(searchParams.toString());
		nextParams.delete(REQUEST_UPDATE_PARAM);
		router.replace(buildEventPath(event, nextParams), { scroll: false });
	}, [event, eventUpdateRequestsEnabled, router, searchParams]);

	const handleClose = () => {
		router.push(homeHref);
	};

	const handleRequestUpdateOpenChange = (open: boolean) => {
		setIsRequestUpdateOpen(open);
		const nextParams = new URLSearchParams(searchParams.toString());
		if (open) {
			nextParams.set(REQUEST_UPDATE_PARAM, "1");
		} else {
			nextParams.delete(REQUEST_UPDATE_PARAM);
		}
		router.replace(buildEventPath(event, nextParams), { scroll: false });
	};

	if (!hasHydrated) {
		return null;
	}

	return (
		<EventModal
			event={event}
			isOpen
			onClose={handleClose}
			isAuthenticated={isAuthenticated}
			submissionsEnabled={eventUpdateRequestsEnabled}
			isRequestUpdateOpen={isRequestUpdateOpen}
			onRequestUpdateOpenChange={handleRequestUpdateOpenChange}
			isSaved={isEventSaved(event.eventKey)}
			onToggleSaved={(selectedEvent) =>
				toggleSavedEvent(selectedEvent, "direct_event_modal_save_button")
			}
		/>
	);
}
