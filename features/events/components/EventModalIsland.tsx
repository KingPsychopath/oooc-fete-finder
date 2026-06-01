"use client";

import EventModal from "@/features/events/components/EventModal";
import type { EventAddToPlanResult } from "@/features/events/components/EventModal";
import { useEventsSearchFilters } from "@/features/events/components/events-search-filters-provider";
import { useSavedEvents } from "@/features/events/components/saved-events-provider";
import type { SocialProofDisplayMode } from "@/features/events/social-proof";
import type { Event } from "@/features/events/types";
import { buildPlanWithAddedEvent } from "@/features/plans/add-event-to-plan";
import { trackPlanAnalytics } from "@/features/plans/analytics";
import { AddEventToRouteDialog } from "@/features/plans/components/AddEventToRouteDialog";
import { usePlans } from "@/features/plans/plans-provider";
import type { UserPlan } from "@/features/plans/types";
import { useState } from "react";

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
	const { getPlansForDate, plans, upsertPlan } = usePlans();
	const [routePickerEvent, setRoutePickerEvent] = useState<Event | null>(null);

	if (!event) return null;

	const socialProofMode: SocialProofDisplayMode | undefined =
		socialProofDisplayModes.get(event.eventKey);
	const plansForEventDate = getPlansForDate(event.date);
	const routePickerSuggestedPlan = routePickerEvent
		? getPlansForDate(routePickerEvent.date)[0]
		: null;
	const isInPlan = Boolean(
		plansForEventDate.some((plan) =>
			plan.stops.some(
				(stop) =>
					stop.eventKey.trim().toLowerCase() ===
					event.eventKey.trim().toLowerCase(),
			),
		),
	);
	const addEventToRoute = (
		selectedEvent: Event,
		targetPlan: UserPlan | undefined,
	): EventAddToPlanResult => {
		const alreadyInRoute = Boolean(
			targetPlan?.stops.some(
				(stop) =>
					stop.eventKey.trim().toLowerCase() ===
					selectedEvent.eventKey.trim().toLowerCase(),
			),
		);
		const plan = upsertPlan(
			buildPlanWithAddedEvent(selectedEvent, targetPlan),
			"modal_add_to_route",
		);
		if (!plan) {
			trackPlanAnalytics({
				action: "add_event_from_modal",
				surface: "planner_modal",
				planId: targetPlan?.id,
				planDate: targetPlan?.planDate ?? selectedEvent.date,
				eventKey: selectedEvent.eventKey,
				stopCount: targetPlan?.stops.length ?? 0,
				value: "limit",
			});
			return {
				stopCount: targetPlan?.stops.length ?? 0,
				routeTitle: targetPlan?.title,
				alreadyInRoute,
				message: "Route limit reached for this day.",
			};
		}
		trackPlanAnalytics({
			action: "add_event_from_modal",
			surface: "planner_modal",
			planId: plan.id,
			planDate: plan.planDate,
			eventKey: selectedEvent.eventKey,
			stopCount: plan.stops.length,
			value: targetPlan ? "existing_route" : "new_route",
		});
		return {
			stopCount: plan.stops.length,
			routeTitle: plan.title,
			alreadyInRoute,
		};
	};
	const handleAddToPlan = (
		selectedEvent: Event,
	): EventAddToPlanResult | null => {
		const sameDayPlans = getPlansForDate(selectedEvent.date);
		const alreadyInAnyRoute = sameDayPlans.some((plan) =>
			plan.stops.some(
				(stop) =>
					stop.eventKey.trim().toLowerCase() ===
					selectedEvent.eventKey.trim().toLowerCase(),
			),
		);
		if (sameDayPlans.length > 1 || alreadyInAnyRoute) {
			trackPlanAnalytics({
				action: "add_event_dialog_open",
				surface: "planner_modal",
				planDate: selectedEvent.date,
				eventKey: selectedEvent.eventKey,
				stopCount: sameDayPlans.length,
				value: alreadyInAnyRoute ? "already_in_route" : "multiple_routes",
			});
			setRoutePickerEvent(selectedEvent);
			return null;
		}
		return addEventToRoute(selectedEvent, sameDayPlans[0]);
	};

	return (
		<>
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
				onAddToPlan={handleAddToPlan}
				seriesEvents={seriesEvents}
				onNavigateSeriesEvent={onNavigateSeriesEvent}
			/>
			<AddEventToRouteDialog
				isOpen={Boolean(routePickerEvent)}
				event={routePickerEvent}
				plans={plans}
				suggestedPlanId={routePickerSuggestedPlan?.id}
				onClose={() => setRoutePickerEvent(null)}
				onAddToRoute={(selectedEvent, targetPlan) => {
					addEventToRoute(selectedEvent, targetPlan);
				}}
				onOpenRoute={(plan) => {
					trackPlanAnalytics({
						action: "add_event_dialog_existing_route",
						surface: "route_dialog",
						planId: plan.id,
						planDate: plan.planDate,
						eventKey: routePickerEvent?.eventKey,
						stopCount: plan.stops.length,
					});
					window.location.href = "/plans";
				}}
			/>
		</>
	);
}
