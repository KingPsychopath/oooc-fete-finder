"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	TypeaheadCombobox,
	type TypeaheadComboboxOption,
} from "@/components/ui/typeahead-combobox";
import { useOptionalAuth } from "@/features/auth/auth-context";
import EventModal from "@/features/events/components/EventModal";
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
import { buildPlanWithAddedEvent } from "@/features/plans/add-event-to-plan";
import { mergePinnedStopsIntoRoute } from "@/features/plans/pinned-route-merge";
import { PlansProvider, usePlans } from "@/features/plans/plans-provider";
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
	Check,
	ChevronDown,
	CircleHelp,
	Clock,
	GripVertical,
	ListChecks,
	Lock,
	MapPinned,
	Navigation,
	Pencil,
	Plus,
	RefreshCw,
	Route,
	Trash2,
	Unlock,
	X,
} from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import { PlanRouteTour } from "./PlanRouteTour";

interface PlansClientProps {
	initialEvents: Event[];
}

const formatTime = (value: string | undefined | null): string =>
	value && value.toLowerCase() !== "tbc" ? value : "Time TBC";

const normalizeEventKey = (value: string): string => value.trim().toLowerCase();
const CONTROL_TRANSITION =
	"transition-[background-color,border-color,color,box-shadow,transform] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] active:scale-[0.98]";
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

const getDefaultPlanDate = (events: Event[]): string => {
	const countsByDate = new Map<string, number>();
	for (const event of events) {
		if (!event.date) continue;
		countsByDate.set(event.date, (countsByDate.get(event.date) ?? 0) + 1);
	}
	const dates = Array.from(countsByDate.keys()).sort();
	if (dates.length === 0) return new Date().toISOString().slice(0, 10);
	const maxYear = dates.reduce(
		(currentMax, date) => Math.max(currentMax, Number.parseInt(date, 10)),
		0,
	);
	const currentFestivalDates = dates.filter(
		(date) => Number.parseInt(date, 10) === maxYear,
	);
	return (
		currentFestivalDates.find((date) => (countsByDate.get(date) ?? 0) >= 3) ??
		currentFestivalDates.find((date) => (countsByDate.get(date) ?? 0) >= 2) ??
		currentFestivalDates[0] ??
		dates[0]
	);
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
	const {
		plans,
		upsertPlan,
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
	const [draggedEventKey, setDraggedEventKey] = useState<string | null>(null);
	const [dragOverEventKey, setDragOverEventKey] = useState<string | null>(null);

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
		() =>
			Array.from(
				new Set(initialEvents.map((event) => event.date).filter(Boolean)),
			).sort(),
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
	const preferenceInput: Partial<PlanPreferenceInput> = useMemo(
		() => ({
			stopCount: effectiveStopCount,
			startPeriod,
			travelTolerance,
			budget,
			vibes: selectedVibes,
			preferSavedEvents: true,
			mustIncludeEventKeys: lockedEventKeys,
		}),
		[
			budget,
			lockedEventKeys,
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

	const savePlanFromEvents = (
		events: Event[],
		source: string,
		existingPlan: UserPlan | null = activePlan,
	) => {
		if (!existingPlan && isRouteLimitReached) {
			setPlanLimitMessage(
				`You can save up to ${MAX_PLANS_PER_DATE} routes for this day. Delete one to make another.`,
			);
			return;
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
					return {
						eventKey: event.eventKey,
						stopOrder: index + 1,
						locked:
							existingPlan?.stops.find(
								(stop) =>
									normalizeEventKey(stop.eventKey) ===
									normalizeEventKey(event.eventKey),
							)?.locked ?? false,
						arrivalTime: event.time ?? null,
						departureTime: event.endTime ?? null,
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
			return;
		}
		setSelectedPlanId(plan.id);
		setIsCreatingNewRoute(false);
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
		savePlanFromEvents(
			mergePinnedStopsIntoRoute({
				proposedEvents: events,
				existingStops: activeStops,
				eventsByKey,
			}),
			source,
		);
	};

	const addEventToPlan = (event: Event) => {
		const existingKeys = new Set(
			activeEvents.map((item) => normalizeEventKey(item.eventKey)),
		);
		if (existingKeys.has(normalizeEventKey(event.eventKey))) return;
		savePlanFromEvents([...activeEvents, event], "plans_page_add_event");
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
		savePlanFromEvents(next, "plans_page_reorder");
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
		savePlanFromEvents(next, "plans_page_drag_reorder");
	};

	const removeStop = (eventKey: string) => {
		savePlanFromEvents(
			activeEvents.filter(
				(event) =>
					normalizeEventKey(event.eventKey) !== normalizeEventKey(eventKey),
			),
			"plans_page_remove_stop",
		);
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

	const addEventFromModalToPlan = (event: Event): number => {
		const existingPlan =
			activePlan?.planDate === event.date
				? activePlan
				: getPlansForDate(event.date)[0];
		const plan = upsertPlan(
			buildPlanWithAddedEvent(event, existingPlan),
			"plans_page_modal_add_to_plan",
		);
		if (!plan) {
			setPlanLimitMessage(
				`You can save up to ${MAX_PLANS_PER_DATE} routes for this day. Delete one to make another.`,
			);
			return existingPlan?.stops.length ?? 0;
		}
		setSelectedDate(event.date);
		setSelectedPlanId(plan.id);
		setIsCreatingNewRoute(false);
		return plan.stops.length;
	};

	const startNewRoute = () => {
		if (isRouteLimitReached) {
			setPlanLimitMessage(
				`You can save up to ${MAX_PLANS_PER_DATE} routes for this day. Delete one to make another.`,
			);
			return;
		}
		setPlanLimitMessage(null);
		setSelectedPlanId(null);
		setIsCreatingNewRoute(true);
	};

	const deletePlanById = (planId: string) => {
		deletePlan(planId);
		setPlanLimitMessage(null);
		if (selectedPlanId === planId || activePlan?.id === planId) {
			setSelectedPlanId(null);
		}
	};

	const deleteActivePlan = () => {
		if (!activePlan) return;
		deletePlanById(activePlan.id);
		setSelectedPlanId(null);
	};

	const startRenamePlan = (plan: UserPlan) => {
		setRenamingPlanId(plan.id);
		setRenameValue(plan.title);
	};

	const cancelRenamePlan = () => {
		setRenamingPlanId(null);
		setRenameValue("");
	};

	const saveRenamePlan = (plan: UserPlan) => {
		const nextTitle = renameValue.trim();
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
		cancelRenamePlan();
	};

	const startPlanTour = () => {
		setTourRunId((current) => current + 1);
		setShowTour(true);
	};

	const selectPlanDate = (date: string) => {
		setSelectedDate(date);
		setSelectedPlanId(null);
		setIsCreatingNewRoute(false);
		setPlanLimitMessage(null);
		setIsDateMenuOpen(false);
	};

	const dateMenuRef = useOutsideClick<HTMLDivElement>(() => {
		setIsDateMenuOpen(false);
	});

	const openSavedRoute = (plan: UserPlan) => {
		setSelectedDate(plan.planDate);
		setSelectedPlanId(plan.id);
		setIsCreatingNewRoute(false);
		setPlanLimitMessage(null);
	};

	return (
		<div className="mx-auto flex w-full max-w-[110rem] flex-col gap-4 px-3 pb-[calc(var(--oooc-mobile-nav-offset,5.75rem)+1rem)] pt-4 sm:px-5 lg:px-8 lg:pb-10 lg:pt-6">
			<section className="overflow-hidden rounded-2xl border border-border/70 bg-card/92 shadow-[0_18px_60px_-48px_rgba(20,20,20,0.7)]">
				<div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
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
							Pick a date, choose a suggested route, then pin, move or remove
							stops. Everything saves locally as you edit.
						</p>
					</div>
					<div className="flex items-center justify-start lg:justify-end">
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
					className="space-y-3 lg:sticky lg:top-5 lg:self-start"
				>
					<div
						id="plans-saved-routes"
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
						<div className="mt-4 grid grid-cols-3 gap-2">
							{[2, 3, 4].map((count) => (
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
					</div>

					<div className="rounded-2xl border border-border/70 bg-card p-3 shadow-sm">
						<p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
							What are you looking for?
						</p>
						<div className="mt-3 flex flex-wrap gap-2">
							{EVENT_EXPERIENCE_CATEGORIES.map((category) => {
								const selected = selectedVibes.includes(category.key);
								return (
									<Button
										key={category.key}
										type="button"
										size="sm"
										variant={selected ? "default" : "outline"}
										onClick={() =>
											setSelectedVibes((current) =>
												selected
													? current.filter((item) => item !== category.key)
													: [...current, category.key],
											)
										}
										className={cn("rounded-full", CONTROL_TRANSITION)}
									>
										{category.label}
									</Button>
								);
							})}
						</div>
						<div className="mt-4 grid gap-2">
							<Segmented
								label="Start"
								value={startPeriod}
								options={[
									["day", "Day"],
									["evening", "Evening"],
									["late", "Late"],
								]}
								onChange={(value) =>
									setStartPeriod((current) =>
										current === value
											? "anytime"
											: (value as PlanPreferenceInput["startPeriod"]),
									)
								}
								emptyLabel="Any start"
							/>
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
					className="flex min-w-0 flex-col rounded-2xl border border-border/70 bg-card p-3 shadow-sm sm:p-4 lg:sticky lg:top-5 lg:max-h-[calc(100vh-2.5rem)] lg:p-5"
				>
					<div className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-3">
						<div>
							<p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
								Current route
							</p>
							{activePlan && renamingPlanId === activePlan.id ? (
								<form
									className="mt-1 flex max-w-md items-center gap-2"
									onSubmit={(event) => {
										event.preventDefault();
										saveRenamePlan(activePlan);
									}}
								>
									<input
										value={renameValue}
										onChange={(event) => setRenameValue(event.target.value)}
										onKeyDown={(event) => {
											if (event.key === "Escape") cancelRenamePlan();
										}}
										autoFocus
										maxLength={80}
										aria-label="Route name"
										className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xl [font-family:var(--ooo-font-display)] outline-none focus:border-foreground/40"
									/>
									<IconButton
										label="Save route name"
										onClick={() => saveRenamePlan(activePlan)}
									>
										<Check className="h-4 w-4" />
									</IconButton>
									<IconButton label="Cancel rename" onClick={cancelRenamePlan}>
										<X className="h-4 w-4" />
									</IconButton>
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
							<p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
								<ListChecks className="h-3.5 w-3.5" />
								{routeStatusLabel}
							</p>
						</div>
						<div className="flex flex-wrap items-center gap-2">
							{activePlan && (
								<Button
									type="button"
									variant="outline"
									onClick={startNewRoute}
									title="New route"
									className="rounded-full px-3 sm:px-4"
								>
									<Plus className="h-4 w-4 sm:mr-2" />
									<span className="hidden sm:inline">New route</span>
									<span className="sr-only sm:hidden">New route</span>
								</Button>
							)}
							{activePlan && (
								<Button
									type="button"
									variant="outline"
									onClick={deleteActivePlan}
									title="Delete route"
									className="rounded-full px-3 text-muted-foreground hover:text-destructive sm:px-4"
								>
									<Trash2 className="h-4 w-4 sm:mr-2" />
									<span className="hidden sm:inline">Delete route</span>
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
								title={
									activePlan
										? "Build another route from the current settings. Pinned stops keep their position."
										: undefined
								}
								className="rounded-full"
							>
								{activePlan ? (
									<RefreshCw className="mr-2 h-4 w-4" />
								) : (
									<Navigation className="mr-2 h-4 w-4" />
								)}
								{routeActionLabel}
							</Button>
						</div>
					</div>
					{planLimitMessage && (
						<p className="mb-4 shrink-0 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100">
							{planLimitMessage}
						</p>
					)}

					{activeEvents.length === 0 ? (
						<div className="grid min-h-[22rem] place-items-center rounded-2xl border border-dashed border-border/80 bg-muted/30 px-6 text-center lg:min-h-0 lg:flex-1">
							<div>
								<MapPinned className="mx-auto h-10 w-10 text-muted-foreground" />
								<p className="mt-3 text-lg">Start from your settings.</p>
								<p className="mt-1 text-sm text-muted-foreground">
									Suggest a route from the controls, or add saved events from
									your shortlist.
								</p>
								{routeSuggestionForSettings && (
									<Button
										type="button"
										onClick={() => applySuggestion(routeSuggestionForSettings)}
										disabled={isSavingSeparateRoute && isRouteLimitReached}
										className="mt-4 rounded-full"
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
														index % 4 === 0 && "border-rose-400 text-rose-700",
														index % 4 === 1 &&
															"border-emerald-400 text-emerald-700",
														index % 4 === 2 && "border-sky-400 text-sky-700",
														index % 4 === 3 &&
															"border-amber-400 text-amber-700",
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
													savedInShortlist &&
														"border-emerald-500/20 bg-[linear-gradient(145deg,var(--background),rgba(236,252,243,0.34))] dark:border-emerald-500/18 dark:bg-[linear-gradient(145deg,var(--background),rgba(30,74,51,0.14))]",
													isDragging && "cursor-grabbing",
													isDragTarget &&
														!isDragging &&
														"border-foreground/30 shadow-md",
												)}
											>
												<div className="flex items-start justify-between gap-3">
													<div className="min-w-0">
														<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
															<span className="inline-flex items-center">
																<Clock className="mr-1 h-3.5 w-3.5" />
																{formatTime(event.time)}
															</span>
															<span>
																{formatLocationAreaShort(event.arrondissement)}
															</span>
															{category && (
																<Badge variant="outline">
																	{category.label}
																</Badge>
															)}
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
														{directDistance !== null ? (
															<p className="mt-1 text-xs text-muted-foreground">
																From Stop {index}: {directDistance.toFixed(1)}{" "}
																km direct
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
														className="rounded-full"
													>
														{stop?.locked ? (
															<Lock className="mr-1.5 h-3.5 w-3.5" />
														) : (
															<Unlock className="mr-1.5 h-3.5 w-3.5" />
														)}
														{stop?.locked ? "Pinned" : "Pin"}
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

				<aside className="space-y-3 lg:sticky lg:top-5 lg:self-start">
					<div
						id="plans-saved-events"
						className="rounded-2xl border border-border/70 bg-card p-3 shadow-sm"
					>
						<div className="flex items-start justify-between gap-3">
							<div>
								<p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
									Add events you saved
								</p>
								<p className="mt-1 text-xs leading-5 text-muted-foreground">
									Focus to add from your shortlist.
								</p>
							</div>
							<Badge variant="outline" className="shrink-0 rounded-full">
								{savedEventsAlreadyAddedCount}/{savedForDate.length}
							</Badge>
						</div>
						<TypeaheadCombobox
							className="mt-3"
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
							onSelect={(option) => {
								const event = eventsByKey.get(normalizeEventKey(option.value));
								if (event) addEventToPlan(event);
							}}
						/>
						{savedForDate.length === 0 && (
							<p className="mt-3 text-sm text-muted-foreground">
								Save events for this date to build from your own shortlist.
							</p>
						)}
					</div>

					<div className="rounded-2xl border border-border/70 bg-card p-3 shadow-sm">
						<div className="flex items-start justify-between gap-3">
							<div>
								<p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
									My saved routes
								</p>
								<p className="mt-1 text-xs leading-5 text-muted-foreground">
									Open any route to edit it.
								</p>
							</div>
							<Badge variant="outline" className="shrink-0 rounded-full">
								{savedRouteList.length} saved
							</Badge>
						</div>
						<div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
							{savedRouteList.map((plan) => {
								const isActive = activePlan?.id === plan.id;
								const isRenaming = renamingPlanId === plan.id;
								return (
									<div
										key={plan.id}
										className={cn(
											"grid grid-cols-[minmax(0,1fr)_2.25rem_2.25rem] items-center gap-2 rounded-2xl border p-2",
											isActive
												? "border-foreground bg-foreground text-background"
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
													onChange={(event) =>
														setRenameValue(event.target.value)
													}
													onKeyDown={(event) => {
														if (event.key === "Escape") cancelRenamePlan();
													}}
													autoFocus
													maxLength={80}
													aria-label={`Rename ${plan.title}`}
													className={cn(
														"h-10 w-full rounded-xl border px-3 text-sm outline-none",
														isActive
															? "border-white/25 bg-white/10 text-background placeholder:text-background/60"
															: "border-border bg-background text-foreground",
													)}
												/>
											</form>
										) : (
											<button
												type="button"
												onClick={() => openSavedRoute(plan)}
												className="min-w-0 rounded-xl px-2 py-1.5 text-left"
												aria-current={isActive ? "true" : undefined}
											>
												<span className="block truncate text-sm font-medium">
													{plan.title}
												</span>
												<span
													className={cn(
														"mt-0.5 block text-xs",
														isActive
															? "text-background/75"
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
													? "border-white/25 bg-white text-foreground hover:bg-white/90"
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
													? "border-white/25 bg-white text-foreground hover:bg-destructive hover:text-destructive-foreground"
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
							{savedRouteList.length === 0 && (
								<p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
									No saved routes yet. Suggest a route or add a saved event to
									start one.
								</p>
							)}
						</div>
					</div>
				</aside>
			</section>
			<PlanRouteTour
				key={tourRunId}
				isOpen={showTour}
				onClose={() => setShowTour(false)}
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
		</div>
	);
}

function Segmented({
	label,
	value,
	options,
	onChange,
	emptyLabel,
}: {
	label: string;
	value: string;
	options: Array<[string, string]>;
	onChange: (value: string) => void;
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
				{options.map(([optionValue, optionLabel]) => (
					<button
						key={optionValue}
						type="button"
						aria-pressed={value === optionValue}
						onClick={() => onChange(optionValue)}
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
