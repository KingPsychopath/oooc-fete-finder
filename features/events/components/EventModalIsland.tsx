"use client";

import EventModal from "@/features/events/components/EventModal";
import { useEventsSearchFilters } from "@/features/events/components/events-search-filters-provider";
import { useSavedEvents } from "@/features/events/components/saved-events-provider";
import type { SocialProofDisplayMode } from "@/features/events/social-proof";
import type { Event } from "@/features/events/types";
import { buildPlanWithAddedEvent } from "@/features/plans/add-event-to-plan";
import { usePlans } from "@/features/plans/plans-provider";

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
	const { getPlansForDate, upsertPlan } = usePlans();

	if (!event) return null;

	const socialProofMode: SocialProofDisplayMode | undefined =
		socialProofDisplayModes.get(event.eventKey);
	const planForEventDate = getPlansForDate(event.date)[0];
	const isInPlan = Boolean(
		planForEventDate?.stops.some(
			(stop) =>
				stop.eventKey.trim().toLowerCase() ===
				event.eventKey.trim().toLowerCase(),
		),
	);

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
			isInPlan={isInPlan}
			onToggleSaved={(selectedEvent) =>
				toggleSavedEvent(selectedEvent, "modal_save_button")
			}
			onAddToPlan={(selectedEvent) => {
				const plan = upsertPlan(
					buildPlanWithAddedEvent(selectedEvent, planForEventDate),
					"modal_add_to_plan",
				);
				return plan?.stops.length ?? planForEventDate?.stops.length ?? 0;
			}}
			seriesEvents={seriesEvents}
			onNavigateSeriesEvent={onNavigateSeriesEvent}
		/>
	);
}
