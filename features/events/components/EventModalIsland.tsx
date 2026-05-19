"use client";

import EventModal from "@/features/events/components/EventModal";
import { useEventsSearchFilters } from "@/features/events/components/events-search-filters-provider";
import { useSavedEvents } from "@/features/events/components/saved-events-provider";
import type { SocialProofDisplayMode } from "@/features/events/social-proof";
import type { Event } from "@/features/events/types";

interface EventModalIslandProps {
	event: Event | null;
	isAuthenticated: boolean;
	isRequestUpdateOpen: boolean;
	onClose: () => void;
	onRequestUpdateOpenChange: (open: boolean) => void;
	submissionsEnabled: boolean;
	seriesEvents?: Event[];
	onNavigateSeriesEvent?: (event: Event) => void;
}

export function EventModalIsland({
	event,
	isAuthenticated,
	isRequestUpdateOpen,
	onClose,
	onRequestUpdateOpenChange,
	submissionsEnabled,
	seriesEvents = [],
	onNavigateSeriesEvent,
}: EventModalIslandProps) {
	const { socialProofDisplayModes } = useEventsSearchFilters();
	const { isEventSaved, toggleSavedEvent } = useSavedEvents();

	if (!event) return null;

	const socialProofMode: SocialProofDisplayMode | undefined =
		socialProofDisplayModes.get(event.eventKey);

	return (
		<EventModal
			event={event}
			isOpen
			onClose={onClose}
			isAuthenticated={isAuthenticated}
			submissionsEnabled={submissionsEnabled}
			isRequestUpdateOpen={isRequestUpdateOpen}
			onRequestUpdateOpenChange={onRequestUpdateOpenChange}
			socialProofMode={socialProofMode}
			isSaved={isEventSaved(event.eventKey)}
			onToggleSaved={(selectedEvent) =>
				toggleSavedEvent(selectedEvent, "modal_save_button")
			}
			seriesEvents={seriesEvents}
			onNavigateSeriesEvent={onNavigateSeriesEvent}
		/>
	);
}
