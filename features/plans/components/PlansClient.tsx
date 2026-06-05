"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	TypeaheadCombobox,
	type TypeaheadComboboxOption,
} from "@/components/ui/typeahead-combobox";
import { useOptionalAuth } from "@/features/auth/auth-context";
import {
	EventCategoryBadge,
	getEventCategoryCardClassName,
	getEventCategoryControlClassName,
	getEventCategoryIcon,
} from "@/features/events/components/EventCategoryBadge";
import EventModal from "@/features/events/components/EventModal";
import type { EventAddToPlanResult } from "@/features/events/components/EventModal";
import {
	SavedEventsProvider,
	useSavedEvents,
} from "@/features/events/components/saved-events-provider";
import {
	EVENT_EXPERIENCE_CATEGORIES,
	type Event,
	type EventExperienceCategory,
	formatLocationAreaShort,
	getResolvedEventExperienceCategoryDefinition,
} from "@/features/events/types";
import { MapSelectionModal } from "@/features/maps/components/map-selection-modal";
import { useMapPreference } from "@/features/maps/hooks/use-map-preference";
import type { MapProvider } from "@/features/maps/types";
import { buildPlanWithAddedEvent } from "@/features/plans/add-event-to-plan";
import { trackPlanAnalytics } from "@/features/plans/analytics";
import { mergePinnedStopsIntoRoute } from "@/features/plans/pinned-route-merge";
import {
	getDefaultPlanDate,
	getPlanDateOptions,
} from "@/features/plans/plan-date-options";
import {
	PLAN_ROUTE_TOUR_STATE_COMPLETED,
	PLAN_ROUTE_TOUR_STATE_SKIPPED,
	consumePendingPlanRouteTourRequest,
	markPlansPageVisited,
	writePlanRouteTourState,
} from "@/features/plans/plan-onboarding";
import { validatePlanTitle } from "@/features/plans/plan-title";
import { PlansProvider, usePlans } from "@/features/plans/plans-provider";
import {
	buildRouteMapTarget,
	buildRouteText,
	downloadRouteICSFile,
} from "@/features/plans/route-export";
import {
	buildSuggestedPlans,
	distanceKmBetweenEvents,
	estimateTravelMinutes,
} from "@/features/plans/route-suggestion";
import type {
	PlanPreferenceInput,
	SuggestedPlan,
	UserPlan,
} from "@/features/plans/types";
import { MAX_PLANS_PER_DATE } from "@/features/plans/types";
import { useOutsideClick } from "@/hooks/useOutsideClick";
import { cn } from "@/lib/utils";
import {
	ArrowDown,
	ArrowUp,
	ArrowUpRight,
	BookmarkCheck,
	CalendarPlus,
	Check,
	ChevronDown,
	CircleHelp,
	Clock,
	Copy,
	GripVertical,
	ListChecks,
	Lock,
	MapPinned,
	Navigation,
	Pencil,
	Plus,
	RefreshCw,
	Route,
	Share2,
	Trash2,
	Unlock,
	X,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AddEventToRouteDialog } from "./AddEventToRouteDialog";
import { PlanRouteTour } from "./PlanRouteTour";

interface PlansClientProps {
	initialEvents: Event[];
}

const formatTime = (value: string | undefined | null): string =>
	value && value.toLowerCase() !== "tbc" ? value : "Time TBC";

const PLAN_TIME_INPUT_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const normalizeEventKey = (value: string): string => value.trim().toLowerCase();
const normalizePlanTimeInput = (value: string | undefined | null): string =>
	value && PLAN_TIME_INPUT_PATTERN.test(value.trim()) ? value.trim() : "";
const isKnownEventTime = (value: string | undefined | null): value is string =>
	Boolean(value && value.toLowerCase() !== "tbc");
const parsePlanTimeToMinutes = (
	value: string | undefined | null,
): number | null => {
	const normalized = normalizePlanTimeInput(value);
	if (!normalized) return null;
	const [rawHours, rawMinutes] = normalized.split(":");
	const hours = Number(rawHours);
	const minutes = Number(rawMinutes);
	return hours * 60 + minutes;
};
const CONTROL_TRANSITION =
	"transition-[background-color,border-color,color,box-shadow,transform] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] active:scale-[0.98]";
const DESKTOP_RAIL_STICKY_CLASS = "lg:sticky lg:top-[10rem] lg:self-start";
const DESKTOP_ROUTE_PANEL_HEIGHT_CLASS = "lg:max-h-[calc(100vh-11rem)]";
const eventKeysMatch = (left: string[], right: string[]): boolean =>
	left.length === right.length &&
	left.every(
		(key, index) =>
			normalizeEventKey(key) === normalizeEventKey(right[index] ?? ""),
	);
const isInteractiveTarget = (target: EventTarget | null): boolean =>
	target instanceof Element &&
	Boolean(target.closest("button,a,input,select,textarea"));
const WEEKDAY_LABELS = [
	"Sun",
	"Mon",
	"Tue",
	"Wed",
	"Thu",
	"Fri",
	"Sat",
] as const;
const MONTH_LABELS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
] as const;
const STOP_TONE_CLASSES = [
	"border-rose-400 text-rose-700",
	"border-emerald-400 text-emerald-700",
	"border-sky-400 text-sky-700",
	"border-amber-400 text-amber-700",
] as const;
const STOP_DOT_CLASSES = [
	"bg-rose-400",
	"bg-emerald-400",
	"bg-sky-400",
	"bg-amber-400",
] as const;

const getDateParts = (
	date: string,
): { weekday: string; month: string; day: number } | null => {
	const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!match) return null;
	const year = Number.parseInt(match[1], 10);
	const monthIndex = Number.parseInt(match[2], 10) - 1;
	const day = Number.parseInt(match[3], 10);
	const parsed = new Date(Date.UTC(year, monthIndex, day));
	if (
		parsed.getUTCFullYear() !== year ||
		parsed.getUTCMonth() !== monthIndex ||
		parsed.getUTCDate() !== day
	) {
		return null;
	}
	return {
		weekday: WEEKDAY_LABELS[parsed.getUTCDay()],
		month: MONTH_LABELS[monthIndex],
		day,
	};
};

const createPlanTitle = (date: string): string => {
	const parts = getDateParts(date);
	return parts
		? `Route for ${parts.weekday} ${parts.day} ${parts.month}`
		: "My route";
};

const formatPlanDateOption = (date: string): string => {
	const parts = getDateParts(date);
	return parts ? `${parts.weekday} ${parts.day} ${parts.month}` : date;
};

export function PlansClient({ initialEvents }: PlansClientProps) {
	return (
		<SavedEventsProvider>
			<PlansProvider>
				<PlansWorkspace initialEvents={initialEvents} />
			</PlansProvider>
		</SavedEventsProvider>
	);
}

function PlansWorkspace({ initialEvents }: PlansClientProps) {
	const { isAuthenticated } = useOptionalAuth();
	const { mapPreference, setMapPreference } = useMapPreference();
	const {
		plans,
		upsertPlan,
		sharePlan,
		revokePlanShare,
		deletePlan,
		getPlansForDate,
		pendingPlanMutationStatus,
	} = usePlans();
	const { savedEventKeys, isEventSaved, toggleSavedEvent } = useSavedEvents();
	const [selectedDate, setSelectedDate] = useState(() => {
		return getDefaultPlanDate(initialEvents);
	});
	const [isDateMenuOpen, setIsDateMenuOpen] = useState(false);
	const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
	const [stopCount, setStopCount] = useState(3);
	const [travelTolerance, setTravelTolerance] =
		useState<PlanPreferenceInput["travelTolerance"]>("balanced");
	const [startPeriod, setStartPeriod] =
		useState<PlanPreferenceInput["startPeriod"]>("anytime");
	const [routeStartTime, setRouteStartTime] = useState("");
	const [showRouteStartTimeInput, setShowRouteStartTimeInput] = useState(false);
	const [budget, setBudget] = useState<PlanPreferenceInput["budget"]>("any");
	const [selectedVibes, setSelectedVibes] = useState<EventExperienceCategory[]>(
		[],
	);
	const [showTour, setShowTour] = useState(false);
	const [tourRunId, setTourRunId] = useState(0);
	const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
	const [isCreatingNewRoute, setIsCreatingNewRoute] = useState(false);
	const [planLimitMessage, setPlanLimitMessage] = useState<string | null>(null);
	const [renamingPlanId, setRenamingPlanId] = useState<string | null>(null);
	const [renameValue, setRenameValue] = useState("");
	const [renameError, setRenameError] = useState<string | null>(null);
	const [draggedEventKey, setDraggedEventKey] = useState<string | null>(null);
	const [dragOverEventKey, setDragOverEventKey] = useState<string | null>(null);
	const [editingArrivalEventKey, setEditingArrivalEventKey] = useState<
		string | null
	>(null);
	const [sharingPlanId, setSharingPlanId] = useState<string | null>(null);
	const [shareStatus, setShareStatus] = useState<string | null>(null);
	const [copiedSharePlanId, setCopiedSharePlanId] = useState<string | null>(
		null,
	);
	const [routeExportStatus, setRouteExportStatus] = useState<string | null>(
		null,
	);
	const [isRouteMapPickerOpen, setIsRouteMapPickerOpen] = useState(false);
	const [routePickerEvent, setRoutePickerEvent] = useState<Event | null>(null);
	const trackedNoSuggestionKeyRef = useRef<string | null>(null);

	const eventsByKey = useMemo(
		() =>
			new Map(
				initialEvents.map((event) => [
					normalizeEventKey(event.eventKey),
					event,
				]),
			),
		[initialEvents],
	);
	const dateOptions = useMemo(
		() => getPlanDateOptions(initialEvents),
		[initialEvents],
	);
	const dayEvents = useMemo(
		() => initialEvents.filter((event) => event.date === selectedDate),
		[initialEvents, selectedDate],
	);
	const plansForDate = getPlansForDate(selectedDate);
	const savedRouteList = plans;
	const activePlan =
		(isCreatingNewRoute
			? null
			: selectedPlanId
				? plans.find((plan) => plan.id === selectedPlanId)
				: plansForDate[0]) ?? null;
	const isRouteLimitReached = plansForDate.length >= MAX_PLANS_PER_DATE;
	const isSavingSeparateRoute = !activePlan;
	const activeStops = (activePlan?.stops ?? [])
		.slice()
		.sort((left, right) => left.stopOrder - right.stopOrder);
	const lockedStopCount = activeStops.filter((stop) => stop.locked).length;
	const effectiveStopCount = Math.max(stopCount, lockedStopCount, 2);
	const activeEvents = activeStops
		.map((stop) => eventsByKey.get(normalizeEventKey(stop.eventKey)))
		.filter((event): event is Event => Boolean(event));
	const lockedEventKeys = useMemo(
		() =>
			activeStops.filter((stop) => stop.locked).map((stop) => stop.eventKey),
		[activeStops],
	);
	const anchoredStops = useMemo(
		() =>
			activeStops
				.filter((stop) => stop.locked)
				.map((stop) => ({
					eventKey: stop.eventKey,
					stopOrder: stop.stopOrder,
				})),
		[activeStops],
	);
	const preferenceInput: Partial<PlanPreferenceInput> = useMemo(
		() => ({
			stopCount: effectiveStopCount,
			startPeriod,
			routeStartTime: routeStartTime || null,
			anchoredStops,
			travelTolerance,
			budget,
			vibes: selectedVibes,
			preferSavedEvents: true,
			mustIncludeEventKeys: lockedEventKeys,
		}),
		[
			anchoredStops,
			budget,
			lockedEventKeys,
			routeStartTime,
			selectedVibes,
			startPeriod,
			effectiveStopCount,
			travelTolerance,
		],
	);
	const suggestions = useMemo(
		() =>
			buildSuggestedPlans({
				events: initialEvents,
				date: selectedDate,
				preferences: preferenceInput,
				signals: {
					savedEventKeys,
				},
			}),
		[initialEvents, preferenceInput, savedEventKeys, selectedDate],
	);
	const savedForDate = dayEvents.filter((event) =>
		savedEventKeys.has(normalizeEventKey(event.eventKey)),
	);
	const preferredSuggestionMode =
		travelTolerance === "close" ? "close" : "balanced";
	const routeSuggestionForSettings =
		suggestions.find(
			(suggestion) => suggestion.mode === preferredSuggestionMode,
		) ??
		suggestions[0] ??
		null;
	const createRouteActionLabel = "Suggest route";
	const activeEventKeys = activeEvents.map((event) => event.eventKey);
	const activeUnlockedEventKeys = activeStops
		.filter((stop) => !stop.locked)
		.map((stop) => stop.eventKey);
	const regenerationSuggestions = useMemo(
		() =>
			activePlan && activeUnlockedEventKeys.length > 0
				? buildSuggestedPlans({
						events: initialEvents,
						date: selectedDate,
						preferences: preferenceInput,
						signals: {
							savedEventKeys,
						},
						excludedEventKeys: activeUnlockedEventKeys,
						maxSuggestions: 4,
					})
				: [],
		[
			activePlan,
			activeUnlockedEventKeys,
			initialEvents,
			preferenceInput,
			savedEventKeys,
			selectedDate,
		],
	);
	const regenerationMode = preferredSuggestionMode;
	const regenerationSuggestion =
		activePlan && !isCreatingNewRoute
			? (regenerationSuggestions.find(
					(suggestion) => suggestion.mode === regenerationMode,
				) ??
				regenerationSuggestions.find(
					(suggestion) =>
						!eventKeysMatch(suggestion.eventKeys, activeEventKeys),
				) ??
				null)
			: routeSuggestionForSettings;
	const routeActionLabel = activePlan
		? "Regenerate route"
		: createRouteActionLabel;
	const routeStatusLabel = activePlan
		? `${formatPlanDateOption(activePlan.planDate)} · Changes save to this route`
		: isCreatingNewRoute
			? "Next add creates a separate route"
			: "No saved route yet";
	const activeEventKeySet = useMemo(
		() =>
			new Set(activeEvents.map((event) => normalizeEventKey(event.eventKey))),
		[activeEvents],
	);
	const savedEventOptions = useMemo<TypeaheadComboboxOption[]>(
		() =>
			savedForDate.map((event) => {
				const category = getResolvedEventExperienceCategoryDefinition(event);
				const inActiveRoute = activeEventKeySet.has(
					normalizeEventKey(event.eventKey),
				);
				return {
					value: event.eventKey,
					label: event.name,
					description: [
						formatTime(event.time),
						formatLocationAreaShort(event.arrondissement),
						category?.label,
					]
						.filter(Boolean)
						.join(" · "),
					rightLabel: inActiveRoute ? undefined : "Add",
					disabled: inActiveRoute,
				};
			}),
		[activeEventKeySet, savedForDate],
	);
	const savedEventsAlreadyAddedCount = savedForDate.filter((event) =>
		activeEventKeySet.has(normalizeEventKey(event.eventKey)),
	).length;

	useEffect(() => {
		if (dayEvents.length === 0 || suggestions.length > 0) return;
		const noSuggestionKey = [
			selectedDate,
			effectiveStopCount,
			startPeriod,
			routeStartTime || "",
			travelTolerance,
			budget,
			selectedVibes.slice().sort().join(","),
			lockedEventKeys.map(normalizeEventKey).sort().join(","),
		].join("|");
		if (trackedNoSuggestionKeyRef.current === noSuggestionKey) return;
		trackedNoSuggestionKeyRef.current = noSuggestionKey;
		trackPlanAnalytics({
			action: "route_suggest_no_results",
			surface: "planner",
			planId: activePlan?.id,
			planDate: selectedDate,
			stopCount: effectiveStopCount,
			value: activePlan ? "regenerate" : "suggest",
		});
	}, [
		activePlan,
		budget,
		dayEvents.length,
		effectiveStopCount,
		lockedEventKeys,
		routeStartTime,
		selectedDate,
		selectedVibes,
		startPeriod,
		suggestions.length,
		travelTolerance,
	]);

	const getPlanForEvent = (event: Event): UserPlan | undefined =>
		getPlansForDate(event.date).find((plan) =>
			plan.stops.some(
				(stop) =>
					normalizeEventKey(stop.eventKey) ===
					normalizeEventKey(event.eventKey),
			),
		);

	const isEventInPlan = (event: Event): boolean =>
		Boolean(getPlanForEvent(event));

	const getExistingStopForEvent = (
		plan: UserPlan | null,
		event: Event,
	): UserPlan["stops"][number] | undefined =>
		plan?.stops.find(
			(stop) =>
				normalizeEventKey(stop.eventKey) === normalizeEventKey(event.eventKey),
		);

	const getDefaultArrivalTime = (
		event: Event,
		index: number,
		existingStop: UserPlan["stops"][number] | undefined,
	): string | null => {
		if (existingStop) return existingStop.arrivalTime;
		const routeStartMinutes = parsePlanTimeToMinutes(routeStartTime);
		if (index === 0 && routeStartMinutes !== null && routeStartTime) {
			const eventStartMinutes = parsePlanTimeToMinutes(event.time);
			if (
				eventStartMinutes === null ||
				eventStartMinutes <= routeStartMinutes
			) {
				return routeStartTime;
			}
		}
		return isKnownEventTime(event.time) ? event.time : null;
	};

	const updateStopArrivalTime = (eventKey: string, value: string) => {
		if (!activePlan) return;
		const normalized = normalizePlanTimeInput(value);
		const nextStops = activeStops.map((stop) =>
			normalizeEventKey(stop.eventKey) === normalizeEventKey(eventKey)
				? { ...stop, arrivalTime: normalized || null }
				: stop,
		);
		const plan = upsertPlan(
			{
				id: activePlan.id,
				planDate: activePlan.planDate,
				title: activePlan.title,
				visibility: activePlan.visibility,
				shareOwnerNameVisible: activePlan.shareOwnerNameVisible,
				stops: nextStops,
			},
			"plans_page_arrival_time_update",
		);
		if (!plan) return;
		setSelectedPlanId(plan.id);
		trackPlanAnalytics({
			action: "arrival_time_update",
			surface: "planner",
			planId: plan.id,
			planDate: plan.planDate,
			eventKey,
			stopCount: plan.stops.length,
			value: normalized || "clear",
		});
	};

	const updateRouteStartTime = (value: string) => {
		setRouteStartTime(value);
		if (value) setStartPeriod("anytime");
	};

	const savePlanFromEvents = (
		events: Event[],
		source: string,
		existingPlan: UserPlan | null = activePlan,
	): UserPlan | null => {
		if (!existingPlan && isRouteLimitReached) {
			setPlanLimitMessage(
				`You can save up to ${MAX_PLANS_PER_DATE} routes for this day. Delete one to make another.`,
			);
			trackPlanAnalytics({
				action: "route_limit_reached",
				surface: "planner",
				planDate: selectedDate,
				stopCount: plansForDate.length,
				value: source,
			});
			return null;
		}
		setPlanLimitMessage(null);
		const plan = upsertPlan(
			{
				id: existingPlan?.id,
				planDate: selectedDate,
				title: existingPlan?.title ?? createPlanTitle(selectedDate),
				visibility: existingPlan?.visibility ?? "private",
				stops: events.map((event, index) => {
					const previous = events[index - 1];
					const distance = previous
						? distanceKmBetweenEvents(previous, event)
						: null;
					const existingStop = getExistingStopForEvent(existingPlan, event);
					return {
						id: existingStop?.id,
						eventKey: event.eventKey,
						stopOrder: index + 1,
						locked: existingStop?.locked ?? false,
						arrivalTime: getDefaultArrivalTime(event, index, existingStop),
						departureTime: existingStop?.departureTime ?? event.endTime ?? null,
						travelMinutesFromPrevious: estimateTravelMinutes(distance),
					};
				}),
			},
			source,
		);
		if (!plan) {
			setPlanLimitMessage(
				`You can save up to ${MAX_PLANS_PER_DATE} routes for this day. Delete one to make another.`,
			);
			trackPlanAnalytics({
				action: "route_limit_reached",
				surface: "planner",
				planDate: selectedDate,
				stopCount: plansForDate.length,
				value: source,
			});
			return null;
		}
		setSelectedPlanId(plan.id);
		setIsCreatingNewRoute(false);
		return plan;
	};

	const applySuggestion = (
		suggestion: SuggestedPlan,
		source = "suggested_route",
	) => {
		if (activePlan && eventKeysMatch(suggestion.eventKeys, activeEventKeys)) {
			return;
		}
		const events = suggestion.eventKeys
			.map((eventKey) => eventsByKey.get(normalizeEventKey(eventKey)))
			.filter((event): event is Event => Boolean(event));
		const plan = savePlanFromEvents(
			mergePinnedStopsIntoRoute({
				proposedEvents: events,
				existingStops: activeStops,
				eventsByKey,
			}),
			source,
		);
		if (plan) {
			trackPlanAnalytics({
				action: activePlan ? "regenerate_route" : "suggest_route",
				surface: "planner",
				planId: plan.id,
				planDate: plan.planDate,
				stopCount: plan.stops.length,
				value: suggestion.mode,
			});
		}
	};

	const addEventToPlan = (event: Event) => {
		const existingKeys = new Set(
			activeEvents.map((item) => normalizeEventKey(item.eventKey)),
		);
		if (existingKeys.has(normalizeEventKey(event.eventKey))) return;
		const plan = savePlanFromEvents(
			[...activeEvents, event],
			"plans_page_add_event",
		);
		if (plan) {
			trackPlanAnalytics({
				action: "add_saved_event",
				surface: "planner",
				planId: plan.id,
				planDate: plan.planDate,
				eventKey: event.eventKey,
				stopCount: plan.stops.length,
			});
		}
	};

	const moveStop = (eventKey: string, direction: -1 | 1) => {
		const index = activeEvents.findIndex(
			(event) =>
				normalizeEventKey(event.eventKey) === normalizeEventKey(eventKey),
		);
		const nextIndex = index + direction;
		if (index < 0 || nextIndex < 0 || nextIndex >= activeEvents.length) return;
		const next = activeEvents.slice();
		const [item] = next.splice(index, 1);
		if (!item) return;
		next.splice(nextIndex, 0, item);
		const plan = savePlanFromEvents(next, "plans_page_reorder");
		if (plan) {
			trackPlanAnalytics({
				action: "reorder_stop",
				surface: "planner",
				planId: plan.id,
				planDate: plan.planDate,
				eventKey,
				stopCount: plan.stops.length,
				value: direction,
			});
		}
	};

	const moveStopToIndex = (eventKey: string, targetIndex: number) => {
		const currentIndex = activeEvents.findIndex(
			(event) =>
				normalizeEventKey(event.eventKey) === normalizeEventKey(eventKey),
		);
		if (
			currentIndex < 0 ||
			targetIndex < 0 ||
			targetIndex >= activeEvents.length ||
			currentIndex === targetIndex
		) {
			return;
		}
		const next = activeEvents.slice();
		const [item] = next.splice(currentIndex, 1);
		if (!item) return;
		next.splice(targetIndex, 0, item);
		const plan = savePlanFromEvents(next, "plans_page_drag_reorder");
		if (plan) {
			trackPlanAnalytics({
				action: "drag_reorder_stop",
				surface: "planner",
				planId: plan.id,
				planDate: plan.planDate,
				eventKey,
				stopCount: plan.stops.length,
				value: targetIndex + 1,
			});
		}
	};

	const removeStop = (eventKey: string) => {
		const plan = savePlanFromEvents(
			activeEvents.filter(
				(event) =>
					normalizeEventKey(event.eventKey) !== normalizeEventKey(eventKey),
			),
			"plans_page_remove_stop",
		);
		if (plan) {
			trackPlanAnalytics({
				action: "remove_stop",
				surface: "planner",
				planId: plan.id,
				planDate: plan.planDate,
				eventKey,
				stopCount: plan.stops.length,
			});
		}
	};

	const toggleLock = (eventKey: string) => {
		if (!activePlan) return;
		const nextStops = activeStops.map((stop) =>
			normalizeEventKey(stop.eventKey) === normalizeEventKey(eventKey)
				? { ...stop, locked: !stop.locked }
				: stop,
		);
		const nextLockedCount = nextStops.filter((stop) => stop.locked).length;
		const plan = upsertPlan(
			{
				id: activePlan.id,
				planDate: activePlan.planDate,
				title: activePlan.title,
				visibility: activePlan.visibility,
				stops: nextStops,
			},
			"plans_page_lock_toggle",
		);
		if (!plan) return;
		setSelectedPlanId(plan.id);
		setStopCount((current) => Math.max(current, nextLockedCount, 2));
		trackPlanAnalytics({
			action: nextStops.some(
				(stop) =>
					normalizeEventKey(stop.eventKey) === normalizeEventKey(eventKey) &&
					stop.locked,
			)
				? "pin_stop"
				: "unpin_stop",
			surface: "planner",
			planId: plan.id,
			planDate: plan.planDate,
			eventKey,
			stopCount: plan.stops.length,
		});
	};

	const startDraggingStop = (
		event: React.DragEvent<HTMLButtonElement>,
		eventKey: string,
	) => {
		setDraggedEventKey(eventKey);
		event.dataTransfer.effectAllowed = "move";
		event.dataTransfer.setData("text/plain", eventKey);
		const item = event.currentTarget.closest("li");
		const card = item?.querySelector("[data-route-stop-card]");
		if (!(card instanceof HTMLElement)) return;
		const rect = card.getBoundingClientRect();
		const preview = card.cloneNode(true) as HTMLElement;
		preview.style.position = "fixed";
		preview.style.top = "-1000px";
		preview.style.left = "-1000px";
		preview.style.width = `${rect.width}px`;
		preview.style.pointerEvents = "none";
		preview.style.opacity = "0.92";
		preview.style.transform = "rotate(-1deg) scale(0.98)";
		preview.style.boxShadow = "0 18px 40px -24px rgba(20,20,20,0.55)";
		document.body.appendChild(preview);
		event.dataTransfer.setDragImage(preview, rect.width / 2, 28);
		window.requestAnimationFrame(() => preview.remove());
	};

	const finishDraggingStop = () => {
		setDraggedEventKey(null);
		setDragOverEventKey(null);
	};

	const dropStopOnIndex = (
		event: React.DragEvent<HTMLLIElement>,
		targetIndex: number,
	) => {
		event.preventDefault();
		const sourceEventKey =
			draggedEventKey || event.dataTransfer.getData("text/plain");
		if (sourceEventKey) moveStopToIndex(sourceEventKey, targetIndex);
		finishDraggingStop();
	};

	const addEventToRoute = (
		event: Event,
		targetPlan: UserPlan | undefined,
	): EventAddToPlanResult => {
		const alreadyInRoute = Boolean(
			targetPlan?.stops.some(
				(stop) =>
					normalizeEventKey(stop.eventKey) ===
					normalizeEventKey(event.eventKey),
			),
		);
		const plan = upsertPlan(
			buildPlanWithAddedEvent(event, targetPlan),
			"plans_page_modal_add_to_route",
		);
		if (!plan) {
			setPlanLimitMessage(
				`You can save up to ${MAX_PLANS_PER_DATE} routes for this day. Delete one to make another.`,
			);
			trackPlanAnalytics({
				action: "add_event_from_modal",
				surface: "planner_modal",
				planDate: event.date,
				eventKey: event.eventKey,
				value: "limit",
			});
			return {
				stopCount: targetPlan?.stops.length ?? 0,
				routeTitle: targetPlan?.title,
				alreadyInRoute,
				message: "Route limit reached for this day.",
			};
		}
		setSelectedDate(event.date);
		setSelectedPlanId(plan.id);
		setIsCreatingNewRoute(false);
		trackPlanAnalytics({
			action: "add_event_from_modal",
			surface: "planner_modal",
			planId: plan.id,
			planDate: plan.planDate,
			eventKey: event.eventKey,
			stopCount: plan.stops.length,
			value: targetPlan ? "existing_route" : "new_route",
		});
		return {
			stopCount: plan.stops.length,
			routeTitle: plan.title,
			alreadyInRoute,
		};
	};

	const addEventFromModalToPlan = (
		event: Event,
	): EventAddToPlanResult | null => {
		const sameDayPlans = getPlansForDate(event.date);
		const existingPlan =
			activePlan?.planDate === event.date ? activePlan : sameDayPlans[0];
		const alreadyInAnyRoute = sameDayPlans.some((plan) =>
			plan.stops.some(
				(stop) =>
					normalizeEventKey(stop.eventKey) ===
					normalizeEventKey(event.eventKey),
			),
		);
		if (sameDayPlans.length > 1 || alreadyInAnyRoute) {
			trackPlanAnalytics({
				action: "add_event_dialog_open",
				surface: "planner_modal",
				planDate: event.date,
				eventKey: event.eventKey,
				stopCount: sameDayPlans.length,
				value: alreadyInAnyRoute ? "already_in_route" : "multiple_routes",
			});
			setRoutePickerEvent(event);
			return null;
		}
		return addEventToRoute(event, existingPlan);
	};

	const startNewRoute = () => {
		if (isRouteLimitReached) {
			setPlanLimitMessage(
				`You can save up to ${MAX_PLANS_PER_DATE} routes for this day. Delete one to make another.`,
			);
			trackPlanAnalytics({
				action: "route_limit_reached",
				surface: "planner",
				planDate: selectedDate,
				stopCount: plansForDate.length,
				value: "new_route",
			});
			return;
		}
		setPlanLimitMessage(null);
		setSelectedPlanId(null);
		setIsCreatingNewRoute(true);
		trackPlanAnalytics({
			action: "new_route",
			surface: "planner",
			planDate: selectedDate,
			value: "start",
		});
	};

	const deletePlanById = (planId: string) => {
		const plan = plans.find((candidate) => candidate.id === planId);
		deletePlan(planId);
		setPlanLimitMessage(null);
		if (selectedPlanId === planId || activePlan?.id === planId) {
			setSelectedPlanId(null);
		}
		trackPlanAnalytics({
			action: "delete_route",
			surface: "planner",
			planId,
			planDate: plan?.planDate,
			stopCount: plan?.stops.length,
		});
	};

	const deleteActivePlan = () => {
		if (!activePlan) return;
		deletePlanById(activePlan.id);
		setSelectedPlanId(null);
	};

	const startRenamePlan = (plan: UserPlan) => {
		setRenamingPlanId(plan.id);
		setRenameValue(plan.title);
		setRenameError(null);
	};

	const cancelRenamePlan = () => {
		setRenamingPlanId(null);
		setRenameValue("");
		setRenameError(null);
	};

	const saveRenamePlan = (plan: UserPlan) => {
		const titleValidation = validatePlanTitle(renameValue);
		if (!titleValidation.success) {
			setRenameError(titleValidation.error);
			return;
		}
		const nextTitle = titleValidation.title;
		if (!nextTitle || nextTitle === plan.title) {
			cancelRenamePlan();
			return;
		}
		const renamedPlan = upsertPlan(
			{
				id: plan.id,
				planDate: plan.planDate,
				title: nextTitle,
				visibility: plan.visibility,
				stops: plan.stops,
			},
			"plans_page_rename_route",
		);
		if (renamedPlan) setSelectedPlanId(renamedPlan.id);
		if (renamedPlan) {
			trackPlanAnalytics({
				action: "rename_route",
				surface: "planner",
				planId: renamedPlan.id,
				planDate: renamedPlan.planDate,
				stopCount: renamedPlan.stops.length,
			});
		}
		cancelRenamePlan();
	};

	const startPlanTour = useCallback(() => {
		setTourRunId((current) => current + 1);
		setShowTour(true);
		trackPlanAnalytics({
			action: "tour_start",
			surface: "tour",
			planDate: selectedDate,
			stopCount: activePlan?.stops.length ?? 0,
		});
	}, [activePlan?.stops.length, selectedDate]);

	useEffect(() => {
		markPlansPageVisited();
		if (consumePendingPlanRouteTourRequest()) {
			const timer = window.setTimeout(startPlanTour, 650);
			return () => window.clearTimeout(timer);
		}
	}, [startPlanTour]);

	const selectPlanDate = (date: string) => {
		setSelectedDate(date);
		setSelectedPlanId(null);
		setIsCreatingNewRoute(false);
		setPlanLimitMessage(null);
		setIsDateMenuOpen(false);
		trackPlanAnalytics({
			action: "date_select",
			surface: "planner",
			planDate: date,
		});
	};

	const dateMenuRef = useOutsideClick<HTMLDivElement>(() => {
		setIsDateMenuOpen(false);
	});

	const openSavedRoute = (plan: UserPlan) => {
		setSelectedDate(plan.planDate);
		setSelectedPlanId(plan.id);
		setIsCreatingNewRoute(false);
		setPlanLimitMessage(null);
		trackPlanAnalytics({
			action: "open_route",
			surface: "planner",
			planId: plan.id,
			planDate: plan.planDate,
			stopCount: plan.stops.length,
		});
	};

	const buildPlanShareUrl = (shareToken: string): string => {
		if (typeof window === "undefined") return `/plans/${shareToken}`;
		return new URL(
			`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/plans/${shareToken}`,
			window.location.origin,
		).toString();
	};

	const writeClipboardText = async (value: string): Promise<boolean> => {
		try {
			await navigator.clipboard.writeText(value);
			return true;
		} catch {
			const textarea = document.createElement("textarea");
			textarea.value = value;
			textarea.setAttribute("readonly", "");
			textarea.style.position = "fixed";
			textarea.style.left = "-9999px";
			textarea.style.top = "0";
			document.body.appendChild(textarea);
			textarea.select();
			try {
				return document.execCommand("copy");
			} finally {
				document.body.removeChild(textarea);
			}
		}
	};

	const copyPlanShareUrl = async (plan: UserPlan): Promise<boolean> => {
		if (!plan.shareToken) return false;
		const didCopy = await writeClipboardText(
			buildPlanShareUrl(plan.shareToken),
		);
		if (didCopy) {
			setShareStatus(null);
			setCopiedSharePlanId(plan.id);
			trackPlanAnalytics({
				action: "share_copy",
				surface: "share",
				planId: plan.id,
				planDate: plan.planDate,
				stopCount: plan.stops.length,
				flushImmediately: true,
			});
			window.setTimeout(() => {
				setCopiedSharePlanId((current) =>
					current === plan.id ? null : current,
				);
			}, 1600);
			return true;
		}
		setShareStatus("Could not copy the share link.");
		trackPlanAnalytics({
			action: "share_copy_failed",
			surface: "share",
			planId: plan.id,
			planDate: plan.planDate,
			stopCount: plan.stops.length,
			flushImmediately: true,
		});
		return false;
	};

	const createShareLink = async (plan: UserPlan) => {
		setSharingPlanId(plan.id);
		setShareStatus(null);
		const sharedPlan =
			plan.visibility === "unlisted" && plan.shareToken
				? plan
				: await sharePlan(plan);
		setSharingPlanId(null);
		if (!sharedPlan?.shareToken) {
			setShareStatus(
				"Sign in and stay online to create a revocable share link.",
			);
			return;
		}
		trackPlanAnalytics({
			action: "share_create",
			surface: "share",
			planId: sharedPlan.id,
			planDate: sharedPlan.planDate,
			stopCount: sharedPlan.stops.length,
			flushImmediately: true,
		});
	};

	const revokeShareLink = async (plan: UserPlan) => {
		setSharingPlanId(plan.id);
		setShareStatus(null);
		const privatePlan = await revokePlanShare(plan);
		setSharingPlanId(null);
		if (privatePlan?.visibility !== "private") {
			setShareStatus("Could not revoke the share link. Try again online.");
			return;
		}
		trackPlanAnalytics({
			action: "share_revoke",
			surface: "share",
			planId: privatePlan.id,
			planDate: privatePlan.planDate,
			stopCount: privatePlan.stops.length,
			flushImmediately: true,
		});
	};

	const exportRouteToCalendar = () => {
		if (!activePlan || activeEvents.length === 0) return;
		const didExport = downloadRouteICSFile(activePlan, activeEvents);
		setRouteExportStatus(
			didExport
				? "Calendar file downloaded with stops in route order."
				: "Could not create a calendar file for this route.",
		);
		trackPlanAnalytics({
			action: "route_calendar_export",
			surface: "export",
			planId: activePlan.id,
			planDate: activePlan.planDate,
			stopCount: activeEvents.length,
			value: didExport ? "success" : "failure",
			flushImmediately: true,
		});
		if (!didExport) {
			trackPlanAnalytics({
				action: "route_calendar_export_failed",
				surface: "export",
				planId: activePlan.id,
				planDate: activePlan.planDate,
				stopCount: activeEvents.length,
				flushImmediately: true,
			});
		}
	};

	const openRouteInMapsWithProvider = async (
		provider: Exclude<MapProvider, "ask">,
	) => {
		if (!activePlan || activeEvents.length === 0) return;
		const target = buildRouteMapTarget(
			activeEvents,
			provider,
			typeof navigator === "undefined" ? "" : navigator.userAgent,
		);
		if (!target) {
			trackPlanAnalytics({
				action: "route_map_unavailable",
				surface: "export",
				planId: activePlan.id,
				planDate: activePlan.planDate,
				stopCount: activeEvents.length,
				value: provider,
				flushImmediately: true,
			});
			return;
		}

		window.open(target.url, "_blank", "noopener,noreferrer");
		trackPlanAnalytics({
			action: "route_map_open",
			surface: "export",
			planId: activePlan.id,
			planDate: activePlan.planDate,
			stopCount: activeEvents.length,
			value: `${provider}:${target.coverage}`,
			flushImmediately: true,
		});

		if (target.coverage === "first-leg") {
			try {
				await navigator.clipboard.writeText(
					buildRouteText(activePlan, activeEvents),
				);
				setRouteExportStatus(
					"Opened the first leg in Apple Maps. Full route copied.",
				);
			} catch {
				setRouteExportStatus("Opened the first leg in Apple Maps.");
			}
			return;
		}

		setRouteExportStatus(
			target.coverage === "single-stop"
				? "Opened this stop in maps."
				: "Opened the full route in maps.",
		);
	};

	const openRouteInMaps = () => {
		if (mapPreference === "ask") {
			if (activePlan) {
				trackPlanAnalytics({
					action: "route_map_picker_open",
					surface: "export",
					planId: activePlan.id,
					planDate: activePlan.planDate,
					stopCount: activeEvents.length,
					flushImmediately: true,
				});
			}
			setIsRouteMapPickerOpen(true);
			return;
		}
		void openRouteInMapsWithProvider(mapPreference);
	};

	const setShareOwnerNameVisible = async (
		plan: UserPlan,
		shareOwnerNameVisible: boolean,
	) => {
		setSharingPlanId(plan.id);
		setShareStatus(null);
		const sharedPlan = await sharePlan({ ...plan, shareOwnerNameVisible });
		setSharingPlanId(null);
		if (!sharedPlan) {
			setShareStatus("Could not update sharing settings. Try again online.");
			return;
		}
		trackPlanAnalytics({
			action: "share_owner_name_toggle",
			surface: "share",
			planId: sharedPlan.id,
			planDate: sharedPlan.planDate,
			stopCount: sharedPlan.stops.length,
			value: shareOwnerNameVisible,
		});
	};

	return (
		<div className="mx-auto flex w-full max-w-[110rem] flex-col gap-4 px-3 pb-[calc(var(--oooc-mobile-nav-clearance,5.75rem)+1rem)] pt-4 sm:px-5 lg:px-8 lg:pb-10 lg:pt-6">
			<section className="overflow-hidden rounded-2xl border border-border/70 bg-card/92 shadow-[0_18px_60px_-48px_rgba(20,20,20,0.7)]">
				<div className="grid gap-4 p-4 min-[560px]:grid-cols-[minmax(0,1fr)_auto] min-[560px]:items-end sm:p-5">
					<div className="min-w-0">
						<div className="flex flex-wrap items-center gap-2">
							<Badge className="rounded-full bg-[#111] px-3 py-1 text-white dark:bg-white dark:text-black">
								<Route className="mr-1.5 h-3.5 w-3.5" />
								Plans
							</Badge>
							{pendingPlanMutationStatus !== "idle" && (
								<Badge variant="outline" className="rounded-full">
									{pendingPlanMutationStatus === "offline"
										? "Saved locally"
										: "Sync pending"}
								</Badge>
							)}
						</div>
						<h1 className="mt-3 max-w-3xl text-balance text-[clamp(2rem,6vw,4rem)] leading-[0.94] [font-family:var(--ooo-font-display)] font-light">
							Plan a route for the day.
						</h1>
						<p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
							Set the day and mood, then let Fete Finder shape a route you can
							tune stop by stop. Changes save as you go.
						</p>
					</div>
					<div className="flex items-center justify-start min-[560px]:justify-end">
						<Button
							type="button"
							variant="outline"
							onClick={startPlanTour}
							size="sm"
							className="rounded-full border-border/70 bg-background/70 text-muted-foreground hover:text-foreground"
						>
							<CircleHelp className="mr-1.5 h-3.5 w-3.5" />
							Tour
						</Button>
					</div>
				</div>
			</section>

			<section className="grid gap-4 lg:grid-cols-[18.5rem_minmax(0,1.45fr)_20.5rem] xl:grid-cols-[19rem_minmax(0,1.6fr)_21rem]">
				<aside
					id="plans-route-settings"
					className={cn("space-y-3", DESKTOP_RAIL_STICKY_CLASS)}
				>
					<div
						id="plans-route-day"
						className="rounded-2xl border border-border/70 bg-card p-3 shadow-sm"
					>
						<label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
							Day
						</label>
						<div ref={dateMenuRef} className="relative mt-2">
							<button
								type="button"
								aria-haspopup="listbox"
								aria-expanded={isDateMenuOpen}
								onClick={() => setIsDateMenuOpen((current) => !current)}
								onKeyDown={(event) => {
									if (event.key === "Escape") setIsDateMenuOpen(false);
									if (event.key === "ArrowDown" || event.key === "Enter") {
										event.preventDefault();
										setIsDateMenuOpen(true);
									}
								}}
								className={cn(
									"flex h-12 w-full items-center justify-between gap-3 rounded-2xl border border-border bg-background pr-1.5 pl-4 text-left text-base shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] outline-none",
									CONTROL_TRANSITION,
									isDateMenuOpen && "border-foreground/30 shadow-sm",
								)}
							>
								<span>{formatPlanDateOption(selectedDate)}</span>
								<span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border/70 bg-muted/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
									<ChevronDown
										className={cn(
											"h-4 w-4 text-muted-foreground transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
											isDateMenuOpen && "rotate-180",
										)}
									/>
								</span>
							</button>
							{isDateMenuOpen && (
								<div
									role="listbox"
									aria-label="Plan date"
									className="absolute right-0 left-0 z-30 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-border/80 bg-card p-1.5 shadow-[0_18px_52px_-32px_rgba(20,20,20,0.75)]"
								>
									{dateOptions.map((date) => {
										const selected = date === selectedDate;
										return (
											<button
												key={date}
												type="button"
												role="option"
												aria-selected={selected}
												onClick={() => selectPlanDate(date)}
												className={cn(
													"flex min-h-10 w-full items-center justify-between gap-3 rounded-xl px-3 text-left text-sm",
													CONTROL_TRANSITION,
													selected
														? "bg-foreground text-background shadow-sm"
														: "text-foreground hover:bg-muted",
												)}
											>
												<span>{formatPlanDateOption(date)}</span>
												{selected && <Check className="h-4 w-4" />}
											</button>
										);
									})}
								</div>
							)}
						</div>
						<div className="mt-4">
							<p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
								Auto-suggest stops
							</p>
							<div className="grid grid-cols-3 gap-2">
								{[3, 4, 5].map((count) => (
									<Button
										key={count}
										type="button"
										variant={stopCount === count ? "default" : "outline"}
										onClick={() => setStopCount(count)}
										disabled={count < lockedStopCount}
										title={
											count < lockedStopCount
												? `${lockedStopCount} kept stops need at least ${lockedStopCount} stops`
												: undefined
										}
										className={cn("rounded-2xl", CONTROL_TRANSITION)}
									>
										{count} stops
									</Button>
								))}
							</div>
							<p className="mt-2 text-xs leading-5 text-muted-foreground">
								Add more from your saved events after the route is built.
							</p>
						</div>
					</div>

					<div className="rounded-2xl border border-border/70 bg-card p-3 shadow-sm">
						<p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
							What are you looking for?
						</p>
						<div className="mt-3 flex flex-wrap gap-2">
							{EVENT_EXPERIENCE_CATEGORIES.map((category) => {
								const selected = selectedVibes.includes(category.key);
								const CategoryIcon = getEventCategoryIcon(category);
								return (
									<Button
										key={category.key}
										type="button"
										size="sm"
										variant="outline"
										onClick={() =>
											setSelectedVibes((current) =>
												selected
													? current.filter((item) => item !== category.key)
													: [...current, category.key],
											)
										}
										className={cn(
											"rounded-full border shadow-none",
											getEventCategoryControlClassName(category, selected),
											CONTROL_TRANSITION,
										)}
									>
										<CategoryIcon className="mr-1.5 h-3.5 w-3.5" />
										{category.label}
									</Button>
								);
							})}
						</div>
						<div className="mt-4 grid gap-2">
							<Segmented
								label="When we stepping?"
								value={startPeriod}
								options={[
									["day", "Day", "Day: starts around 10:00-18:00"],
									["evening", "Evening", "Evening: starts around 17:00-22:00"],
									["late", "Late", "Late: starts around 21:00 or later"],
								]}
								onChange={(value) =>
									setStartPeriod((current) =>
										current === value
											? "anytime"
											: (value as PlanPreferenceInput["startPeriod"]),
									)
								}
								onBeforeChange={() => setRouteStartTime("")}
								emptyLabel={
									routeStartTime ? `From ${routeStartTime}` : "Anytime"
								}
							/>
							<div className="px-1">
								<div className="flex items-center justify-between gap-2">
									<button
										type="button"
										onClick={() =>
											setShowRouteStartTimeInput((current) => !current)
										}
										aria-expanded={showRouteStartTimeInput}
										aria-controls="plans-route-start-time-panel"
										className="inline-flex items-center gap-1 text-left text-xs font-medium text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline"
									>
										<ChevronDown
											className={cn(
												"h-3.5 w-3.5 transition-transform duration-200",
												showRouteStartTimeInput && "rotate-180",
											)}
										/>
										{showRouteStartTimeInput
											? "Hide specific time"
											: routeStartTime
												? `Change ${routeStartTime}`
												: "Set a specific time"}
									</button>
									{routeStartTime && (
										<button
											type="button"
											onClick={() => setRouteStartTime("")}
											className="rounded-full px-2 py-0.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
										>
											Use event times
										</button>
									)}
								</div>
								{showRouteStartTimeInput && (
									<div
										id="plans-route-start-time-panel"
										className="mt-2 rounded-2xl border border-border/70 bg-background/70 p-2"
									>
										<label
											htmlFor="plans-route-start-time"
											className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground"
										>
											Specific time
										</label>
										<input
											id="plans-route-start-time"
											type="time"
											value={routeStartTime}
											onInput={(event) =>
												updateRouteStartTime(event.currentTarget.value)
											}
											className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-foreground/40 focus:ring-2 focus:ring-ring/30"
										/>
									</div>
								)}
							</div>
							<Segmented
								label="Travel"
								value={travelTolerance}
								options={[
									["close", "Close"],
									["balanced", "Balanced"],
									["adventurous", "Flexible"],
								]}
								onChange={(value) =>
									setTravelTolerance(
										value as PlanPreferenceInput["travelTolerance"],
									)
								}
							/>
							<Segmented
								label="Budget"
								value={budget}
								options={[
									["free", "Free"],
									["low", "Low"],
									["any", "Any"],
								]}
								onChange={(value) =>
									setBudget(value as PlanPreferenceInput["budget"])
								}
							/>
						</div>
					</div>
				</aside>

				<section
					id="plans-route-line"
					className={cn(
						"flex min-w-0 flex-col rounded-2xl border border-border/70 bg-card p-3 shadow-sm sm:p-4 lg:p-5",
						DESKTOP_RAIL_STICKY_CLASS,
						DESKTOP_ROUTE_PANEL_HEIGHT_CLASS,
					)}
				>
					<div className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-3">
						<div>
							<p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
								Current route
							</p>
							{activePlan && renamingPlanId === activePlan.id ? (
								<form
									className="mt-1 max-w-md"
									onSubmit={(event) => {
										event.preventDefault();
										saveRenamePlan(activePlan);
									}}
								>
									<div className="flex items-center gap-2">
										<input
											value={renameValue}
											onChange={(event) => {
												setRenameValue(event.target.value);
												setRenameError(null);
											}}
											onKeyDown={(event) => {
												if (event.key === "Escape") cancelRenamePlan();
											}}
											autoFocus
											maxLength={60}
											aria-label="Route name"
											aria-invalid={Boolean(renameError)}
											className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xl [font-family:var(--ooo-font-display)] outline-none focus:border-foreground/40 aria-invalid:border-destructive"
										/>
										<IconButton
											label="Save route name"
											onClick={() => saveRenamePlan(activePlan)}
										>
											<Check className="h-4 w-4" />
										</IconButton>
										<IconButton
											label="Cancel rename"
											onClick={cancelRenamePlan}
										>
											<X className="h-4 w-4" />
										</IconButton>
									</div>
									{renameError && (
										<p className="mt-1 text-xs text-destructive">
											{renameError}
										</p>
									)}
								</form>
							) : (
								<div className="flex min-w-0 items-center gap-2">
									<h2 className="truncate text-2xl [font-family:var(--ooo-font-display)]">
										{isCreatingNewRoute
											? "New route"
											: (activePlan?.title ?? "No saved route yet")}
									</h2>
									{activePlan && (
										<IconButton
											label="Rename route"
											onClick={() => startRenamePlan(activePlan)}
										>
											<Pencil className="h-4 w-4" />
										</IconButton>
									)}
								</div>
							)}
							<div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
								<p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
									<ListChecks className="h-3.5 w-3.5" />
									{routeStatusLabel}
								</p>
							</div>
						</div>
						<div className="grid grid-cols-[repeat(6,max-content)] gap-2 sm:grid-cols-[repeat(3,max-content)] lg:grid-cols-[repeat(6,max-content)] lg:gap-1 xl:grid-cols-[repeat(3,max-content)] xl:gap-2">
							{activePlan && (
								<Button
									type="button"
									variant="outline"
									onClick={startNewRoute}
									aria-label="New route"
									title="New route"
									className="rounded-full px-3 sm:px-4 lg:px-3 xl:px-4"
								>
									<Plus className="h-4 w-4 sm:mr-2 lg:mr-0 xl:mr-2" />
									<span className="hidden sm:inline lg:hidden xl:inline">
										New route
									</span>
									<span className="sr-only sm:hidden">New route</span>
								</Button>
							)}
							{activePlan && (
								<Button
									type="button"
									variant="outline"
									onClick={deleteActivePlan}
									aria-label="Delete route"
									title="Delete route"
									className="rounded-full px-3 text-muted-foreground hover:text-destructive sm:px-4 lg:px-3 xl:px-4"
								>
									<Trash2 className="h-4 w-4 sm:mr-2 lg:mr-0 xl:mr-2" />
									<span className="hidden sm:inline lg:hidden xl:inline">
										Delete route
									</span>
									<span className="sr-only sm:hidden">Delete route</span>
								</Button>
							)}
							<Button
								type="button"
								onClick={() =>
									regenerationSuggestion &&
									applySuggestion(regenerationSuggestion, "regenerated_route")
								}
								disabled={
									!regenerationSuggestion ||
									(isSavingSeparateRoute && isRouteLimitReached)
								}
								aria-label={routeActionLabel}
								title={
									activePlan
										? "Build another route from the current settings. Locked stops keep their position."
										: undefined
								}
								className="rounded-full"
							>
								{activePlan ? (
									<RefreshCw className="h-4 w-4 sm:mr-2 lg:mr-0 xl:mr-2" />
								) : (
									<Navigation className="h-4 w-4 sm:mr-2 lg:mr-0 xl:mr-2" />
								)}
								<span className="hidden sm:inline lg:hidden xl:inline">
									{routeActionLabel}
								</span>
								<span className="sr-only sm:hidden">{routeActionLabel}</span>
							</Button>
							{activePlan && activeEvents.length > 0 && (
								<Button
									type="button"
									variant="outline"
									onClick={exportRouteToCalendar}
									aria-label="Export to calendar"
									title="Export route stops to calendar"
									className="rounded-full px-3 sm:px-4 lg:px-3 xl:px-4"
								>
									<CalendarPlus className="h-4 w-4 sm:mr-2 lg:mr-0 xl:mr-2" />
									<span className="hidden sm:inline lg:hidden xl:inline">
										Calendar
									</span>
									<span className="sr-only sm:hidden">Export to calendar</span>
								</Button>
							)}
							{activePlan && activeEvents.length > 0 && (
								<Button
									type="button"
									variant="outline"
									onClick={openRouteInMaps}
									aria-label="Open route in maps"
									title="Open route in maps"
									className="rounded-full px-3 sm:px-4 lg:px-3 xl:px-4"
								>
									<MapPinned className="h-4 w-4 sm:mr-2 lg:mr-0 xl:mr-2" />
									<span className="hidden sm:inline lg:hidden xl:inline">
										Maps
									</span>
									<span className="sr-only sm:hidden">Open route in maps</span>
								</Button>
							)}
							{activePlan && (
								<Button
									type="button"
									variant="outline"
									onClick={() =>
										activePlan.shareToken
											? revokeShareLink(activePlan)
											: createShareLink(activePlan)
									}
									disabled={sharingPlanId === activePlan.id}
									aria-label={
										activePlan.shareToken ? "Revoke share link" : "Share"
									}
									title={
										activePlan.shareToken
											? "Revoke share link"
											: "Create a revocable unlisted share link"
									}
									className={cn(
										"rounded-full px-3 sm:px-4 lg:px-3 xl:px-4",
										activePlan.shareToken &&
											"text-muted-foreground hover:text-destructive",
									)}
								>
									{activePlan.shareToken ? (
										<X className="h-4 w-4 sm:mr-2 lg:mr-0 xl:mr-2" />
									) : (
										<Share2 className="h-4 w-4 sm:mr-2 lg:mr-0 xl:mr-2" />
									)}
									<span className="hidden sm:inline lg:hidden xl:inline">
										{sharingPlanId === activePlan.id
											? activePlan.shareToken
												? "Revoking..."
												: "Sharing..."
											: activePlan.shareToken
												? "Revoke"
												: "Share"}
									</span>
									<span className="sr-only sm:hidden">
										{activePlan.shareToken ? "Revoke share link" : "Share"}
									</span>
								</Button>
							)}
						</div>
					</div>
					{planLimitMessage && (
						<p className="mb-4 shrink-0 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100">
							{planLimitMessage}
						</p>
					)}
					{shareStatus && (
						<p className="mb-4 shrink-0 rounded-2xl border border-border/70 bg-background px-3 py-2 text-sm text-muted-foreground">
							{shareStatus}
						</p>
					)}
					{routeExportStatus && (
						<p className="mb-4 shrink-0 rounded-2xl border border-border/70 bg-background px-3 py-2 text-sm text-muted-foreground">
							{routeExportStatus}
						</p>
					)}
					{activePlan?.shareToken && (
						<div className="mb-3 flex items-center gap-2 rounded-2xl border border-border/70 bg-background/80 px-2 py-1.5">
							<input
								type="text"
								readOnly
								value={buildPlanShareUrl(activePlan.shareToken)}
								aria-label="Shared plan link"
								onFocus={(event) => event.currentTarget.select()}
								className="min-w-0 flex-1 truncate rounded-xl border border-transparent bg-transparent px-2 py-1 text-xs text-muted-foreground outline-none transition focus:border-border focus:bg-background"
							/>
							<div className="flex shrink-0 items-center gap-1.5">
								<button
									type="button"
									aria-label={
										copiedSharePlanId === activePlan.id
											? "Share link copied"
											: "Copy share link"
									}
									title={
										copiedSharePlanId === activePlan.id
											? "Share link copied"
											: "Copy share link"
									}
									onClick={() => void copyPlanShareUrl(activePlan)}
									className={cn(
										"grid h-8 w-8 place-items-center rounded-full border border-border bg-background text-muted-foreground transition hover:border-foreground/30 hover:text-foreground",
										copiedSharePlanId === activePlan.id &&
											"border-foreground bg-foreground text-background",
									)}
								>
									<span
										className={cn(
											"grid place-items-center transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
											copiedSharePlanId === activePlan.id &&
												"scale-110 rotate-[-6deg]",
										)}
									>
										{copiedSharePlanId === activePlan.id ? (
											<Check className="h-4 w-4 animate-in zoom-in-50 duration-200" />
										) : (
											<Copy className="h-4 w-4 animate-in fade-in-0 zoom-in-75 duration-200" />
										)}
									</span>
								</button>
								<label className="flex h-8 items-center gap-1.5 rounded-full border border-border bg-muted/30 px-2 text-xs text-muted-foreground">
									<input
										type="checkbox"
										checked={activePlan.shareOwnerNameVisible !== false}
										disabled={sharingPlanId === activePlan.id}
										onChange={(event) =>
											setShareOwnerNameVisible(activePlan, event.target.checked)
										}
										className="h-3.5 w-3.5 accent-foreground"
									/>
									<span className="max-[360px]:sr-only">Show name</span>
								</label>
							</div>
						</div>
					)}
					<div id="plans-saved-events" className="mb-3 shrink-0">
						<p className="mb-1.5 text-xs text-muted-foreground">
							Add saved events to this route. There is no stop limit here.
						</p>
						<TypeaheadCombobox
							options={savedEventOptions}
							placeholder={
								savedForDate.length > 0
									? "Search saved events"
									: "No saved events for this day"
							}
							emptyMessage="No saved events match that search"
							disabled={savedForDate.length === 0}
							maxVisibleOptions={7}
							clearOnSelect
							trailingAdornment={
								savedForDate.length > 0 ? (
									<Badge
										variant="outline"
										className="rounded-full bg-background"
									>
										{savedEventsAlreadyAddedCount}/{savedForDate.length}
									</Badge>
								) : null
							}
							onSelect={(option) => {
								const event = eventsByKey.get(normalizeEventKey(option.value));
								if (event) addEventToPlan(event);
							}}
						/>
						{savedForDate.length === 0 && (
							<p className="mt-1.5 text-xs text-muted-foreground">
								Save events for this date to use your own shortlist.
							</p>
						)}
					</div>

					{activeEvents.length === 0 ? (
						<div className="grid min-h-[22rem] place-items-center rounded-2xl border border-dashed border-border/80 bg-muted/30 px-6 py-10 text-center lg:min-h-0 lg:flex-1 lg:pb-14 lg:pt-8">
							<div className="-translate-y-2">
								<MapPinned className="mx-auto h-10 w-10 text-muted-foreground" />
								<p className="mt-3 text-lg">Ready to map your day?</p>
								<p className="mt-1 text-sm text-muted-foreground">
									Use your filters to suggest a route, or add saved events from
									your shortlist.
								</p>
								{routeSuggestionForSettings && (
									<Button
										type="button"
										onClick={() => applySuggestion(routeSuggestionForSettings)}
										disabled={isSavingSeparateRoute && isRouteLimitReached}
										className="mt-6 rounded-full"
									>
										<Navigation className="mr-2 h-4 w-4" />
										{createRouteActionLabel}
									</Button>
								)}
							</div>
						</div>
					) : (
						<div className="min-h-0 lg:overflow-y-auto lg:pr-1">
							<ol className="relative space-y-3" aria-label="Plan stops">
								{activeEvents.map((event, index) => {
									const stop = activeStops.find(
										(item) =>
											normalizeEventKey(item.eventKey) ===
											normalizeEventKey(event.eventKey),
									);
									const category =
										getResolvedEventExperienceCategoryDefinition(event);
									const categoryCardClassName =
										getEventCategoryCardClassName(category);
									const previousEvent = activeEvents[index - 1];
									const directDistance =
										previousEvent && event
											? distanceKmBetweenEvents(previousEvent, event)
											: null;
									const isDragging =
										draggedEventKey !== null &&
										normalizeEventKey(draggedEventKey) ===
											normalizeEventKey(event.eventKey);
									const isDragTarget =
										dragOverEventKey !== null &&
										normalizeEventKey(dragOverEventKey) ===
											normalizeEventKey(event.eventKey);
									const savedInShortlist = isEventSaved(event.eventKey);
									const plannedArrival = normalizePlanTimeInput(
										stop?.arrivalTime,
									);
									const officialStart = isKnownEventTime(event.time)
										? event.time
										: null;
									const plannedArrivalDiffers =
										Boolean(plannedArrival) &&
										Boolean(officialStart) &&
										plannedArrival !== officialStart;
									const isEditingArrival =
										editingArrivalEventKey !== null &&
										normalizeEventKey(editingArrivalEventKey) ===
											normalizeEventKey(event.eventKey);
									const routeTimeLabel = plannedArrivalDiffers
										? `Arrive ${plannedArrival}`
										: plannedArrival || formatTime(event.time);
									return (
										<li
											key={event.eventKey}
											onDragOver={(dragEvent) => {
												if (!draggedEventKey) return;
												dragEvent.preventDefault();
												dragEvent.dataTransfer.dropEffect = "move";
												setDragOverEventKey(event.eventKey);
											}}
											onDragLeave={() => {
												setDragOverEventKey((current) =>
													current &&
													normalizeEventKey(current) ===
														normalizeEventKey(event.eventKey)
														? null
														: current,
												);
											}}
											onDrop={(dragEvent) => dropStopOnIndex(dragEvent, index)}
											className={cn(
												"group relative grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3 transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
												isDragging && "scale-[0.99] opacity-55",
												isDragTarget &&
													!isDragging &&
													"translate-y-1 before:absolute before:-top-2 before:right-0 before:left-12 before:h-0.5 before:rounded-full before:bg-foreground/35 before:content-['']",
											)}
										>
											<div className="relative flex justify-center">
												<div
													className={cn(
														"z-10 grid h-9 w-9 place-items-center rounded-full border-2 bg-background text-sm font-semibold shadow-sm",
														STOP_TONE_CLASSES[index % STOP_TONE_CLASSES.length],
													)}
												>
													{index + 1}
												</div>
												{index < activeEvents.length - 1 && (
													<div className="absolute top-8 h-[calc(100%+0.75rem)] w-1 rounded-full bg-[linear-gradient(180deg,#fb7185,#10b981,#38bdf8,#f59e0b)]" />
												)}
											</div>
											<div
												data-route-stop-card
												role="button"
												tabIndex={0}
												aria-label={`Open details for ${event.name}`}
												onClick={(clickEvent) => {
													if (isInteractiveTarget(clickEvent.target)) return;
													setSelectedEvent(event);
												}}
												onKeyDown={(keyEvent) => {
													if (
														keyEvent.currentTarget !== keyEvent.target ||
														(keyEvent.key !== "Enter" && keyEvent.key !== " ")
													) {
														return;
													}
													keyEvent.preventDefault();
													setSelectedEvent(event);
												}}
												className={cn(
													"relative cursor-pointer rounded-2xl border border-border/70 bg-background p-3 shadow-sm outline-none transition group-hover:border-foreground/25 group-hover:shadow-md focus-visible:border-foreground/40 focus-visible:ring-2 focus-visible:ring-ring/40",
													categoryCardClassName,
													savedInShortlist &&
														"border-emerald-500/20 bg-[linear-gradient(145deg,var(--background),rgba(236,252,243,0.34))] dark:border-emerald-500/18 dark:bg-[linear-gradient(145deg,var(--background),rgba(30,74,51,0.14))]",
													stop?.locked &&
														"border-amber-500/24 bg-[linear-gradient(145deg,var(--background),rgba(255,251,235,0.42))] ring-1 ring-amber-500/14 dark:border-amber-500/20 dark:bg-[linear-gradient(145deg,var(--background),rgba(73,53,24,0.16))] dark:ring-amber-400/10",
													isDragging && "cursor-grabbing",
													isDragTarget &&
														!isDragging &&
														"border-foreground/30 shadow-md",
												)}
											>
												<div className="flex items-start justify-between gap-3">
													<div className="min-w-0">
														<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
															<button
																type="button"
																onClick={(timeButtonEvent) => {
																	timeButtonEvent.stopPropagation();
																	setEditingArrivalEventKey((current) =>
																		normalizeEventKey(current ?? "") ===
																		normalizeEventKey(event.eventKey)
																			? null
																			: event.eventKey,
																	);
																}}
																aria-expanded={isEditingArrival}
																aria-controls={`plans-arrival-editor-${event.eventKey}`}
																title="Edit planned arrival"
																className="inline-flex items-center gap-1 rounded-full border border-transparent px-1 py-0.5 transition hover:border-border hover:bg-muted hover:text-foreground"
															>
																<Clock className="h-3.5 w-3.5" />
																<span>{routeTimeLabel}</span>
																<Pencil className="h-3 w-3 opacity-60" />
															</button>
															{plannedArrivalDiffers && (
																<span>starts {formatTime(event.time)}</span>
															)}
															<span>
																{formatLocationAreaShort(event.arrondissement)}
															</span>
															<EventCategoryBadge event={event} />
															{savedInShortlist && (
																<span className="inline-flex items-center gap-1 text-emerald-800/80 dark:text-emerald-200/85">
																	<BookmarkCheck className="h-3.5 w-3.5" />
																	Saved
																</span>
															)}
														</div>
														<h3 className="mt-1 truncate text-lg font-medium">
															{event.name}
														</h3>
														{isEditingArrival && (
															<div
																id={`plans-arrival-editor-${event.eventKey}`}
																onClick={(editorEvent) =>
																	editorEvent.stopPropagation()
																}
																className="mt-2 flex max-w-sm flex-wrap items-end gap-2 rounded-xl border border-border/70 bg-muted/25 p-2"
															>
																<label className="min-w-[8.5rem] flex-1">
																	<span className="block text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
																		Arrive
																	</span>
																	<input
																		type="time"
																		value={plannedArrival}
																		onInput={(timeEvent) =>
																			updateStopArrivalTime(
																				event.eventKey,
																				timeEvent.currentTarget.value,
																			)
																		}
																		aria-label={`Planned arrival for ${event.name}`}
																		className="mt-1 h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm outline-none transition focus:border-foreground/40 focus:ring-2 focus:ring-ring/30"
																	/>
																</label>
																{plannedArrival && (
																	<button
																		type="button"
																		onClick={() =>
																			updateStopArrivalTime(event.eventKey, "")
																		}
																		className="h-8 rounded-full border border-transparent bg-muted/45 px-3 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
																	>
																		Clear
																	</button>
																)}
																<button
																	type="button"
																	onClick={() =>
																		setEditingArrivalEventKey(null)
																	}
																	className="h-8 rounded-full bg-foreground px-3 text-xs text-background transition hover:opacity-90"
																>
																	Done
																</button>
																<p className="w-full text-xs leading-5 text-muted-foreground">
																	Used for this route and calendar export.
																	Official event time stays unchanged.
																</p>
															</div>
														)}
														{directDistance !== null ? (
															<p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
																<span
																	aria-hidden="true"
																	className={cn(
																		"h-1.5 w-1.5 rounded-full",
																		STOP_DOT_CLASSES[
																			(index - 1) % STOP_DOT_CLASSES.length
																		],
																	)}
																/>
																<span>
																	From Stop {index}: {directDistance.toFixed(1)}{" "}
																	km direct
																</span>
															</p>
														) : null}
													</div>
													<Badge
														variant="outline"
														className="shrink-0 rounded-full"
													>
														Stop {index + 1}
													</Badge>
												</div>
												<div className="mt-3 flex flex-wrap gap-2">
													<button
														type="button"
														draggable
														aria-label={`Drag ${event.name} to reorder`}
														title="Drag to reorder"
														onDragStart={(dragEvent) =>
															startDraggingStop(dragEvent, event.eventKey)
														}
														onDragEnd={finishDraggingStop}
														className="grid h-9 w-9 cursor-grab place-items-center rounded-full border border-border bg-background text-muted-foreground transition hover:border-foreground/30 hover:text-foreground active:cursor-grabbing"
													>
														<GripVertical className="h-4 w-4" />
													</button>
													<IconButton
														label="Move up"
														onClick={() => moveStop(event.eventKey, -1)}
														disabled={index === 0}
													>
														<ArrowUp className="h-4 w-4" />
													</IconButton>
													<IconButton
														label="Move down"
														onClick={() => moveStop(event.eventKey, 1)}
														disabled={index === activeEvents.length - 1}
													>
														<ArrowDown className="h-4 w-4" />
													</IconButton>
													<Button
														type="button"
														variant={stop?.locked ? "default" : "outline"}
														size="sm"
														aria-pressed={Boolean(stop?.locked)}
														title={
															stop?.locked
																? "Unpin stop and position from route rebuilds"
																: "Pin stop and position into route rebuilds"
														}
														onClick={() => toggleLock(event.eventKey)}
														className="h-9 rounded-full px-3"
													>
														{stop?.locked ? (
															<Lock className="h-4 w-4 sm:mr-1.5" />
														) : (
															<Unlock className="h-4 w-4 sm:mr-1.5" />
														)}
														<span className="hidden sm:inline">
															{stop?.locked ? "Pinned" : "Pin"}
														</span>
														<span className="sr-only sm:hidden">
															{stop?.locked ? "Pinned" : "Pin"}
														</span>
													</Button>
													<IconButton
														label="Remove from route"
														onClick={() => removeStop(event.eventKey)}
													>
														<Trash2 className="h-4 w-4" />
													</IconButton>
													<span
														aria-hidden="true"
														className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] group-hover:text-foreground"
													>
														<span className="hidden whitespace-nowrap sm:inline group-hover:inline">
															View details
														</span>
														<ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
													</span>
												</div>
											</div>
										</li>
									);
								})}
							</ol>
						</div>
					)}
				</section>

				<aside className={cn("space-y-3", DESKTOP_RAIL_STICKY_CLASS)}>
					<div
						id="plans-saved-routes"
						className="rounded-2xl border border-border/70 bg-card p-3 shadow-sm"
					>
						<div className="flex items-start justify-between gap-3">
							<div>
								<p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
									My saved routes
								</p>
								<p className="mt-1 text-xs leading-5 text-muted-foreground">
									Open any route to edit it.
								</p>
							</div>
							{savedRouteList.length > 0 && (
								<Badge variant="outline" className="shrink-0 rounded-full">
									{savedRouteList.length} saved
								</Badge>
							)}
						</div>
						<div className="mt-3 space-y-2">
							<div className="max-h-80 space-y-2 overflow-y-auto pr-1">
								{savedRouteList.map((plan) => {
									const isActive = activePlan?.id === plan.id;
									const isRenaming = renamingPlanId === plan.id;
									return (
										<div
											key={plan.id}
											className={cn(
												"grid grid-cols-[minmax(0,1fr)_2.25rem_2.25rem] items-center gap-2 rounded-2xl border p-2",
												isActive
													? "border-foreground bg-foreground text-background dark:border-border/80 dark:bg-muted/65 dark:text-foreground dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
													: "border-border/70 bg-background hover:border-foreground/30",
											)}
										>
											{isRenaming ? (
												<form
													className="min-w-0"
													onSubmit={(event) => {
														event.preventDefault();
														saveRenamePlan(plan);
													}}
												>
													<input
														value={renameValue}
														onChange={(event) => {
															setRenameValue(event.target.value);
															setRenameError(null);
														}}
														onKeyDown={(event) => {
															if (event.key === "Escape") cancelRenamePlan();
														}}
														autoFocus
														maxLength={60}
														aria-label={`Rename ${plan.title}`}
														aria-invalid={Boolean(renameError)}
														className={cn(
															"h-10 w-full rounded-xl border px-3 text-sm outline-none",
															isActive
																? "border-white/25 bg-white/10 text-background placeholder:text-background/60 dark:border-border dark:bg-background/55 dark:text-foreground dark:placeholder:text-muted-foreground"
																: "border-border bg-background text-foreground",
														)}
													/>
													{renameError && (
														<p className="mt-1 px-1 text-xs text-destructive">
															{renameError}
														</p>
													)}
												</form>
											) : (
												<button
													type="button"
													onClick={() => openSavedRoute(plan)}
													className="min-w-0 rounded-xl px-2 py-1.5 text-left"
													aria-current={isActive ? "true" : undefined}
												>
													<span className="flex min-w-0 items-center gap-2">
														<span className="min-w-0 truncate text-sm font-medium">
															{plan.title}
														</span>
														{plan.shareToken && (
															<span
																className={cn(
																	"inline-flex h-6 shrink-0 items-center gap-1 rounded-full border px-2 text-[0.68rem] font-medium leading-none",
																	isActive
																		? "border-white/25 bg-white/10 text-background/85 dark:border-border/80 dark:bg-background/40 dark:text-muted-foreground"
																		: "border-border bg-muted/50 text-muted-foreground",
																)}
																title="Currently shared"
															>
																<Share2
																	className="h-3 w-3"
																	aria-hidden="true"
																/>
																<span className="hidden min-[390px]:inline">
																	Shared
																</span>
																<span className="sr-only">
																	Currently shared
																</span>
															</span>
														)}
													</span>
													<span
														className={cn(
															"mt-0.5 block text-xs",
															isActive
																? "text-background/75 dark:text-muted-foreground"
																: "text-muted-foreground",
														)}
													>
														{formatPlanDateOption(plan.planDate)} ·{" "}
														{plan.stops.length} stop
														{plan.stops.length === 1 ? "" : "s"}
													</span>
												</button>
											)}
											<button
												type="button"
												aria-label={
													isRenaming
														? `Save ${plan.title}`
														: `Rename ${plan.title}`
												}
												title={
													isRenaming
														? `Save ${plan.title}`
														: `Rename ${plan.title}`
												}
												onClick={() =>
													isRenaming
														? saveRenamePlan(plan)
														: startRenamePlan(plan)
												}
												className={cn(
													"grid h-9 w-9 place-items-center rounded-full border transition",
													isActive
														? "border-white/25 bg-white text-foreground hover:bg-white/90 dark:border-border/80 dark:bg-background/55 dark:text-muted-foreground dark:hover:border-foreground/30 dark:hover:bg-muted dark:hover:text-foreground"
														: "border-border bg-muted/70 text-muted-foreground hover:border-foreground/30 hover:text-foreground",
												)}
											>
												{isRenaming ? (
													<Check className="h-4 w-4" />
												) : (
													<Pencil className="h-4 w-4" />
												)}
											</button>
											<button
												type="button"
												aria-label={
													isRenaming ? "Cancel rename" : `Delete ${plan.title}`
												}
												title={
													isRenaming ? "Cancel rename" : `Delete ${plan.title}`
												}
												onClick={() =>
													isRenaming
														? cancelRenamePlan()
														: deletePlanById(plan.id)
												}
												className={cn(
													"grid h-9 w-9 place-items-center rounded-full border transition",
													isActive
														? "border-white/25 bg-white text-foreground hover:bg-destructive hover:text-destructive-foreground dark:border-border/80 dark:bg-background/55 dark:text-muted-foreground dark:hover:border-destructive/40 dark:hover:bg-destructive dark:hover:text-destructive-foreground"
														: "border-border bg-muted/70 text-muted-foreground hover:border-destructive/40 hover:bg-destructive hover:text-destructive-foreground",
												)}
											>
												{isRenaming ? (
													<X className="h-4 w-4" />
												) : (
													<Trash2 className="h-4 w-4" />
												)}
											</button>
										</div>
									);
								})}
								{savedRouteList.length === 0 && (
									<p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
										No saved routes yet. Suggest a route or add a saved event to
										start one.
									</p>
								)}
							</div>
							{savedRouteList.length > 0 && (
								<Button
									type="button"
									variant={isCreatingNewRoute ? "default" : "outline"}
									onClick={startNewRoute}
									disabled={isRouteLimitReached}
									className="w-full rounded-2xl"
								>
									<Plus className="mr-2 h-4 w-4" />
									{isRouteLimitReached ? "Route limit reached" : "New route"}
								</Button>
							)}
						</div>
					</div>
				</aside>
			</section>
			<PlanRouteTour
				key={tourRunId}
				isOpen={showTour}
				onClose={() => setShowTour(false)}
				onComplete={() => {
					writePlanRouteTourState(PLAN_ROUTE_TOUR_STATE_COMPLETED);
					trackPlanAnalytics({
						action: "tour_complete",
						surface: "tour",
						planDate: selectedDate,
					});
				}}
				onSkip={() => {
					writePlanRouteTourState(PLAN_ROUTE_TOUR_STATE_SKIPPED);
					trackPlanAnalytics({
						action: "tour_skip",
						surface: "tour",
						planDate: selectedDate,
					});
				}}
			/>
			<EventModal
				event={selectedEvent}
				isOpen={Boolean(selectedEvent)}
				onClose={() => setSelectedEvent(null)}
				isAuthenticated={isAuthenticated}
				submissionsEnabled={false}
				isSaved={selectedEvent ? isEventSaved(selectedEvent.eventKey) : false}
				isInPlan={selectedEvent ? isEventInPlan(selectedEvent) : false}
				onToggleSaved={(event) => toggleSavedEvent(event, "plans_page_modal")}
				onAddToPlan={addEventFromModalToPlan}
			/>
			<AddEventToRouteDialog
				isOpen={Boolean(routePickerEvent)}
				event={routePickerEvent}
				plans={plans}
				suggestedPlanId={
					routePickerEvent && activePlan?.planDate === routePickerEvent.date
						? activePlan.id
						: routePickerEvent
							? getPlansForDate(routePickerEvent.date)[0]?.id
							: null
				}
				onClose={() => setRoutePickerEvent(null)}
				onAddToRoute={(event, targetPlan) => {
					addEventToRoute(event, targetPlan);
				}}
				onOpenRoute={(plan) => {
					setSelectedDate(plan.planDate);
					setSelectedPlanId(plan.id);
					setSelectedEvent(null);
					trackPlanAnalytics({
						action: "add_event_dialog_existing_route",
						surface: "route_dialog",
						planId: plan.id,
						planDate: plan.planDate,
						eventKey: routePickerEvent?.eventKey,
						stopCount: plan.stops.length,
					});
				}}
			/>
			<MapSelectionModal
				isOpen={isRouteMapPickerOpen}
				onClose={() => setIsRouteMapPickerOpen(false)}
				title="Open route in maps"
				description="Choose where to open these stops."
				onSelect={(provider) => {
					if (provider === "ask") return;
					void openRouteInMapsWithProvider(provider);
				}}
				onRememberPreference={(provider) => setMapPreference(provider)}
			/>
		</div>
	);
}

function Segmented({
	label,
	value,
	options,
	onChange,
	onBeforeChange,
	emptyLabel,
}: {
	label: string;
	value: string;
	options: Array<[string, string, string?]>;
	onChange: (value: string) => void;
	onBeforeChange?: () => void;
	emptyLabel?: string;
}) {
	const selectedIndex = options.findIndex(
		([optionValue]) => value === optionValue,
	);
	return (
		<div>
			<div className="mb-1 flex items-center justify-between gap-3">
				<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
					{label}
				</p>
				{emptyLabel &&
					!options.some(([optionValue]) => value === optionValue) && (
						<span className="text-xs text-muted-foreground">{emptyLabel}</span>
					)}
			</div>
			<div
				role="group"
				aria-label={label}
				className="relative grid grid-cols-3 gap-1 overflow-hidden rounded-2xl border border-border bg-muted/45 p-1"
			>
				<span
					aria-hidden="true"
					className={cn(
						"pointer-events-none absolute top-1 bottom-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-xl bg-background shadow-sm transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
						selectedIndex < 0 && "opacity-0",
					)}
					style={{
						transform: `translateX(calc(${Math.max(selectedIndex, 0)} * (100% + 0.25rem)))`,
					}}
				/>
				{options.map(([optionValue, optionLabel, optionDescription]) => (
					<button
						key={optionValue}
						type="button"
						aria-pressed={value === optionValue}
						aria-label={optionDescription ?? optionLabel}
						title={optionDescription}
						onClick={() => {
							onBeforeChange?.();
							onChange(optionValue);
						}}
						className={cn(
							"relative z-10 min-h-9 rounded-xl px-2 text-xs",
							CONTROL_TRANSITION,
							value === optionValue
								? "text-foreground"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						{value === optionValue && <Check className="mr-1 inline h-3 w-3" />}
						{optionLabel}
					</button>
				))}
			</div>
		</div>
	);
}

function IconButton({
	label,
	onClick,
	disabled,
	active,
	children,
}: {
	label: string;
	onClick: () => void;
	disabled?: boolean;
	active?: boolean;
	children: React.ReactNode;
}) {
	return (
		<Button
			type="button"
			variant="outline"
			size="icon"
			onClick={onClick}
			disabled={disabled}
			aria-label={label}
			aria-pressed={active}
			title={label}
			className={cn(
				"h-9 w-9 rounded-full",
				active && "border-foreground bg-foreground text-background",
			)}
		>
			{children}
		</Button>
	);
}
