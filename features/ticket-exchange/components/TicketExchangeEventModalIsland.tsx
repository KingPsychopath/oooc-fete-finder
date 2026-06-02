"use client";

import EventModal, {
	type EventAddToPlanResult,
} from "@/features/events/components/EventModal";
import {
	SavedEventsProvider,
	useSavedEvents,
} from "@/features/events/components/saved-events-provider";
import type { Event } from "@/features/events/types";
import { buildPlanWithAddedEvent } from "@/features/plans/add-event-to-plan";
import { trackPlanAnalytics } from "@/features/plans/analytics";
import { AddEventToRouteDialog } from "@/features/plans/components/AddEventToRouteDialog";
import { PlansProvider, usePlans } from "@/features/plans/plans-provider";
import type { UserPlan } from "@/features/plans/types";
import { useState } from "react";

type TicketExchangeEventModalIslandProps = {
	event: Event | null;
	isAuthenticated: boolean;
	isRequestUpdateOpen: boolean;
	onClose: () => void;
	onRequestUpdateOpenChange: (open: boolean) => void;
	seriesEvents?: Event[];
	onNavigateSeriesEvent?: (event: Event) => void;
};

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

function TicketExchangeEventModalContent({
	event,
	isAuthenticated,
	isRequestUpdateOpen,
	onClose,
	onRequestUpdateOpenChange,
	seriesEvents = [],
	onNavigateSeriesEvent,
}: TicketExchangeEventModalIslandProps) {
	const { isEventSaved, toggleSavedEvent } = useSavedEvents();
	const { getPlansForDate, plans, upsertPlan } = usePlans();
	const [routePickerEvent, setRoutePickerEvent] = useState<Event | null>(null);

	if (!event) return null;

	const plansForEventDate = getPlansForDate(event.date);
	const routePickerSuggestedPlan = routePickerEvent
		? getPlansForDate(routePickerEvent.date)[0]
		: null;
	const isInPlan = plansForEventDate.some((plan) =>
		plan.stops.some(
			(stop) =>
				stop.eventKey.trim().toLowerCase() ===
				event.eventKey.trim().toLowerCase(),
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
			"ticket_exchange_modal_add_to_route",
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
				submissionsEnabled
				isRequestUpdateOpen={isRequestUpdateOpen}
				onRequestUpdateOpenChange={onRequestUpdateOpenChange}
				isSaved={isEventSaved(event.eventKey)}
				isInPlan={isInPlan}
				onToggleSaved={(selectedEvent) =>
					toggleSavedEvent(selectedEvent, "ticket_exchange_modal_save_button")
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
					window.location.href = `${basePath}/plans`;
				}}
			/>
		</>
	);
}

export function TicketExchangeEventModalIsland(
	props: TicketExchangeEventModalIslandProps,
) {
	if (!props.event) return null;

	return (
		<SavedEventsProvider>
			<PlansProvider>
				<TicketExchangeEventModalContent {...props} />
			</PlansProvider>
		</SavedEventsProvider>
	);
}
