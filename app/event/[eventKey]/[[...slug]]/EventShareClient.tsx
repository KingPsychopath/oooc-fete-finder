"use client";

import { useOptionalAuth } from "@/features/auth/auth-context";
import EventModal from "@/features/events/components/EventModal";
import type { EventAddToPlanResult } from "@/features/events/components/EventModal";
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
			<PlansProvider>
				<EventShareModal
					event={event}
					eventUpdateRequestsEnabled={eventUpdateRequestsEnabled}
				/>
			</PlansProvider>
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
	const { getPlansForDate, plans, upsertPlan } = usePlans();
	const [routePickerEvent, setRoutePickerEvent] = useState<Event | null>(null);
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
			"direct_event_modal_add_to_route",
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

	if (!hasHydrated) {
		return null;
	}

	return (
		<>
			<EventModal
				event={event}
				isOpen
				onClose={handleClose}
				isAuthenticated={isAuthenticated}
				submissionsEnabled={eventUpdateRequestsEnabled}
				isRequestUpdateOpen={isRequestUpdateOpen}
				onRequestUpdateOpenChange={handleRequestUpdateOpenChange}
				isSaved={isEventSaved(event.eventKey)}
				isInPlan={isInPlan}
				onToggleSaved={(selectedEvent) =>
					toggleSavedEvent(selectedEvent, "direct_event_modal_save_button")
				}
				onAddToPlan={handleAddToPlan}
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
					router.push("/plans");
				}}
			/>
		</>
	);
}
