"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import { useOptionalAuth } from "@/features/auth/auth-context";
import EventModal from "@/features/events/components/EventModal";
import type { EventAddToPlanResult } from "@/features/events/components/EventModal";
import {
	SavedEventsProvider,
	useSavedEvents,
} from "@/features/events/components/saved-events-provider";
import type { Event } from "@/features/events/types";
import { requestClientLocation } from "@/features/locations/client-location";
import { calculateDistanceKm } from "@/features/locations/nearby-event-service";
import { MapSelectionModal } from "@/features/maps/components/map-selection-modal";
import { useMapPreference } from "@/features/maps/hooks/use-map-preference";
import type { MapProvider } from "@/features/maps/types";
import { buildPlanWithAddedEvent } from "@/features/plans/add-event-to-plan";
import { trackPlanAnalytics } from "@/features/plans/analytics";
import {
	OFFICIAL_FETE_PLAN,
	getOfficialFetePlanHref,
} from "@/features/plans/official-plan-config";
import { formatPublicPlanTitle } from "@/features/plans/plan-title";
import { PlansProvider, usePlans } from "@/features/plans/plans-provider";
import {
	buildRouteMapTarget,
	downloadRouteICSFile,
} from "@/features/plans/route-export";
import type { SharedPlan, UserPlan } from "@/features/plans/types";
import { cn } from "@/lib/utils";
import {
	ArrowUpRight,
	CalendarPlus,
	Check,
	Copy,
	LocateFixed,
	MapPinned,
	Plus,
	Route,
	Settings,
	Share2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AddEventToRouteDialog } from "./AddEventToRouteDialog";
import { PlanRouteSummary, getPlanStopElementId } from "./PlanRouteSummary";

export type SharedPlanPresentation = {
	kind: "shared" | "official";
	badge: string;
	title: string;
	description: string;
	saveCta: string;
	savedCta: string;
	showOfficialPlanPrompt: boolean;
};

const normalizeEventKey = (value: string): string => value.trim().toLowerCase();
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

const formatShortDate = (date: string): string => {
	const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!match) return date;
	const monthIndex = Number.parseInt(match[2], 10) - 1;
	const day = Number.parseInt(match[3], 10);
	const month = MONTH_LABELS[monthIndex];
	return month ? `${day} ${month}` : date;
};

type ClosestStopState =
	| { status: "idle"; eventKey: null; message: null }
	| { status: "locating"; eventKey: null; message: string }
	| { status: "found"; eventKey: string; message: string }
	| { status: "unavailable"; eventKey: null; message: string };

const formatDistanceLabel = (distanceKm: number): string => {
	if (distanceKm < 1) return `${Math.max(30, Math.round(distanceKm * 1000))} m`;
	return `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km`;
};

export function SharedPlanClient({
	plan,
	initialEvents,
	presentation,
}: {
	plan: SharedPlan;
	initialEvents: Event[];
	presentation?: SharedPlanPresentation;
}) {
	return (
		<SavedEventsProvider>
			<PlansProvider>
				<SharedPlanWorkspace
					plan={plan}
					initialEvents={initialEvents}
					presentation={presentation}
				/>
			</PlansProvider>
		</SavedEventsProvider>
	);
}

function SharedPlanWorkspace({
	plan,
	initialEvents,
	presentation,
}: {
	plan: SharedPlan;
	initialEvents: Event[];
	presentation?: SharedPlanPresentation;
}) {
	const { isAuthenticated, isOnline } = useOptionalAuth();
	const { mapPreference, setMapPreference } = useMapPreference();
	const { upsertPlan, plans } = usePlans();
	const { savedEventKeys, isEventSaved, toggleSavedEvent } = useSavedEvents();
	const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "limit">(
		"idle",
	);
	const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");
	const [routeExportStatus, setRouteExportStatus] = useState<string | null>(
		null,
	);
	const [showRouteMapPreferenceAction, setShowRouteMapPreferenceAction] =
		useState(false);
	const [closestStopState, setClosestStopState] = useState<ClosestStopState>({
		status: "idle",
		eventKey: null,
		message: null,
	});
	const [isRouteMapPickerOpen, setIsRouteMapPickerOpen] = useState(false);
	const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
	const [routePickerEvent, setRoutePickerEvent] = useState<Event | null>(null);
	const trackedViewKeyRef = useRef<string | null>(null);
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
	const visibleStops = plan.stops.filter((stop) =>
		eventsByKey.has(normalizeEventKey(stop.eventKey)),
	);
	const ownerTitle = presentation
		? presentation.title
		: plan.shareOwnerNameVisible === false
			? "Shared plan"
			: `${plan.ownerDisplayName}'s plan`;
	const routeBadge = presentation?.badge ?? "Shared plan";
	const routeDescription =
		presentation?.description ??
		"Open each stop for details, copy the link, or save the route to your own Fete Finder plans.";
	const routeSaveCta = presentation?.saveCta ?? "Save to my plans";
	const routeSavedCta = presentation?.savedCta ?? "Saved to my plans";
	const showFeaturedRoutePrompt =
		presentation?.showOfficialPlanPrompt ??
		(OFFICIAL_FETE_PLAN.active && presentation?.kind !== "official");
	const publicPlanTitle = formatPublicPlanTitle(plan.planDate);
	const routeEvents = visibleStops
		.slice()
		.sort((left, right) => left.stopOrder - right.stopOrder)
		.map((stop) => eventsByKey.get(normalizeEventKey(stop.eventKey)))
		.filter((event): event is Event => Boolean(event));
	const publicPlanForExport: SharedPlan = {
		...plan,
		title: publicPlanTitle,
	};
	const savedStopsCount = visibleStops.filter((stop) =>
		savedEventKeys.has(normalizeEventKey(stop.eventKey)),
	).length;
	const alreadySaved = plans.some(
		(candidate) =>
			candidate.planDate === plan.planDate &&
			candidate.stops.length === plan.stops.length &&
			candidate.stops.every(
				(stop, index) =>
					normalizeEventKey(stop.eventKey) ===
					normalizeEventKey(plan.stops[index]?.eventKey ?? ""),
			),
	);

	useEffect(() => {
		const viewKey = `${plan.id}:${plan.planDate}:${plan.stops.length}`;
		if (trackedViewKeyRef.current === viewKey) return;
		trackedViewKeyRef.current = viewKey;
		trackPlanAnalytics({
			action: "shared_plan_view",
			surface: "shared_plan",
			planId: plan.id,
			planDate: plan.planDate,
			stopCount: plan.stops.length,
		});
	}, [plan.id, plan.planDate, plan.stops.length]);

	const saveToMyPlans = () => {
		const saved = upsertPlan(
			{
				planDate: plan.planDate,
				title: publicPlanTitle,
				visibility: "private",
				stops: plan.stops.map((stop, index) => ({
					eventKey: stop.eventKey,
					stopOrder: index + 1,
					locked: false,
					arrivalTime: stop.arrivalTime,
					departureTime: stop.departureTime,
					travelMinutesFromPrevious: stop.travelMinutesFromPrevious,
				})),
			},
			"shared_plan_save",
		);
		setSaveStatus(saved ? "saved" : "limit");
		trackPlanAnalytics({
			action: "shared_plan_save",
			surface: "shared_plan",
			planId: plan.id,
			planDate: plan.planDate,
			stopCount: plan.stops.length,
			value: saved ? "success" : "limit",
		});
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
		const saved = upsertPlan(
			buildPlanWithAddedEvent(event, targetPlan),
			"shared_plan_modal_add_to_route",
		);
		if (!saved) {
			trackPlanAnalytics({
				action: "add_event_from_modal",
				surface: "shared_plan_modal",
				planId: targetPlan?.id ?? plan.id,
				planDate: targetPlan?.planDate ?? event.date,
				eventKey: event.eventKey,
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
			surface: "shared_plan_modal",
			planId: saved.id,
			planDate: saved.planDate,
			eventKey: event.eventKey,
			stopCount: saved.stops.length,
			value: targetPlan ? "existing_route" : "new_route",
		});
		return {
			stopCount: saved.stops.length,
			routeTitle: saved.title,
			alreadyInRoute,
		};
	};

	const addEventFromModalToPlan = (
		event: Event,
	): EventAddToPlanResult | null => {
		const sameDayPlans = plans.filter(
			(candidate) => candidate.planDate === event.date,
		);
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
				surface: "shared_plan_modal",
				planId: plan.id,
				planDate: event.date,
				eventKey: event.eventKey,
				stopCount: sameDayPlans.length,
				value: alreadyInAnyRoute ? "already_in_route" : "multiple_routes",
			});
			setRoutePickerEvent(event);
			return null;
		}
		return addEventToRoute(event, sameDayPlans[0]);
	};

	const copyUrl = async () => {
		try {
			await navigator.clipboard.writeText(window.location.href);
			setCopyStatus("copied");
			trackPlanAnalytics({
				action: "shared_plan_copy",
				surface: "shared_plan",
				planId: plan.id,
				planDate: plan.planDate,
				stopCount: plan.stops.length,
				flushImmediately: true,
			});
			window.setTimeout(() => setCopyStatus("idle"), 1800);
		} catch {
			setCopyStatus("idle");
			trackPlanAnalytics({
				action: "share_copy_failed",
				surface: "shared_plan",
				planId: plan.id,
				planDate: plan.planDate,
				stopCount: plan.stops.length,
				flushImmediately: true,
			});
		}
	};

	const exportRouteToCalendar = () => {
		if (routeEvents.length === 0) return;
		const didExport = downloadRouteICSFile(publicPlanForExport, routeEvents);
		setShowRouteMapPreferenceAction(false);
		setRouteExportStatus(
			didExport
				? "Calendar file downloaded with stops in route order."
				: "Could not create a calendar file for this route.",
		);
		trackPlanAnalytics({
			action: "route_calendar_export",
			surface: "shared_plan",
			planId: plan.id,
			planDate: plan.planDate,
			stopCount: routeEvents.length,
			value: didExport ? "success" : "failure",
			flushImmediately: true,
		});
		if (!didExport) {
			trackPlanAnalytics({
				action: "route_calendar_export_failed",
				surface: "shared_plan",
				planId: plan.id,
				planDate: plan.planDate,
				stopCount: routeEvents.length,
				flushImmediately: true,
			});
		}
	};

	const openRouteInMapsWithProvider = (
		provider: Exclude<MapProvider, "ask">,
	) => {
		if (routeEvents.length === 0) return;
		const target = buildRouteMapTarget(
			routeEvents,
			provider,
			typeof navigator === "undefined" ? "" : navigator.userAgent,
		);
		if (!target) {
			trackPlanAnalytics({
				action: "route_map_unavailable",
				surface: "shared_plan",
				planId: plan.id,
				planDate: plan.planDate,
				stopCount: routeEvents.length,
				value: provider,
				flushImmediately: true,
			});
			setShowRouteMapPreferenceAction(false);
			return;
		}

		window.open(target.url, "_blank", "noopener,noreferrer");
		trackPlanAnalytics({
			action: "route_map_open",
			surface: "shared_plan",
			planId: plan.id,
			planDate: plan.planDate,
			stopCount: routeEvents.length,
			value: `${target.provider}:${target.coverage}`,
			flushImmediately: true,
		});

		const providerLabel =
			target.provider === "apple" ? "Apple Maps" : "Google Maps";
		setShowRouteMapPreferenceAction(true);
		setRouteExportStatus(
			target.coverage === "single-stop"
				? `Opened this stop in ${providerLabel}.`
				: `Opened the full route in ${providerLabel}.`,
		);
	};

	const openRouteMapPicker = () => {
		trackPlanAnalytics({
			action: "route_map_picker_open",
			surface: "shared_plan",
			planId: plan.id,
			planDate: plan.planDate,
			stopCount: routeEvents.length,
			flushImmediately: true,
		});
		setIsRouteMapPickerOpen(true);
	};

	const openRouteInMaps = () => {
		if (mapPreference === "ask") {
			openRouteMapPicker();
			return;
		}
		openRouteInMapsWithProvider(mapPreference);
	};

	const findClosestStop = async () => {
		const mappableStops = routeEvents.filter(
			(
				event,
			): event is Event & { coordinates: NonNullable<Event["coordinates"]> } =>
				Boolean(
					event.coordinates &&
						Number.isFinite(event.coordinates.lat) &&
						Number.isFinite(event.coordinates.lng),
				),
		);

		if (mappableStops.length === 0) {
			setClosestStopState({
				status: "unavailable",
				eventKey: null,
				message: "No stops have map locations yet.",
			});
			trackPlanAnalytics({
				action: "route_nearest_stop_unavailable",
				surface: "shared_plan",
				planId: plan.id,
				planDate: plan.planDate,
				stopCount: routeEvents.length,
				value: "missing_stop_coordinates",
				flushImmediately: true,
			});
			return;
		}

		setClosestStopState({
			status: "locating",
			eventKey: null,
			message: "Checking your location...",
		});
		trackPlanAnalytics({
			action: "route_nearest_stop_find",
			surface: "shared_plan",
			planId: plan.id,
			planDate: plan.planDate,
			stopCount: routeEvents.length,
			flushImmediately: true,
		});

		const locationResult = await requestClientLocation();
		if (!locationResult.location) {
			setClosestStopState({
				status: "unavailable",
				eventKey: null,
				message: "We could not get your location.",
			});
			trackPlanAnalytics({
				action: "route_nearest_stop_unavailable",
				surface: "shared_plan",
				planId: plan.id,
				planDate: plan.planDate,
				stopCount: routeEvents.length,
				value: "location_unavailable",
				flushImmediately: true,
			});
			return;
		}

		const closestStop = mappableStops
			.map((event) => ({
				event,
				distanceKm: calculateDistanceKm(
					locationResult.location.coordinates,
					event.coordinates,
				),
			}))
			.sort((left, right) => left.distanceKm - right.distanceKm)[0];

		if (!closestStop) {
			setClosestStopState({
				status: "unavailable",
				eventKey: null,
				message: "No nearby stop found.",
			});
			return;
		}

		const distanceLabel = formatDistanceLabel(closestStop.distanceKm);
		const sourceLabel =
			locationResult.status === "last-known"
				? "Closest from your last known location"
				: "Closest to you";
		setClosestStopState({
			status: "found",
			eventKey: closestStop.event.eventKey,
			message: `${sourceLabel}: ${closestStop.event.name} (${distanceLabel} away).`,
		});
		trackPlanAnalytics({
			action: "route_nearest_stop_found",
			surface: "shared_plan",
			planId: plan.id,
			planDate: plan.planDate,
			eventKey: closestStop.event.eventKey,
			stopCount: routeEvents.length,
			value: Number(closestStop.distanceKm.toFixed(2)),
			flushImmediately: true,
		});

		window.setTimeout(() => {
			document
				.getElementById(getPlanStopElementId(closestStop.event.eventKey))
				?.scrollIntoView({ behavior: "smooth", block: "center" });
		}, 60);
	};

	return (
		<div className="relative overflow-hidden">
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[linear-gradient(115deg,rgba(251,113,133,0.16),transparent_34%),linear-gradient(245deg,rgba(16,185,129,0.15),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.72),transparent)] dark:bg-[linear-gradient(115deg,rgba(251,113,133,0.12),transparent_34%),linear-gradient(245deg,rgba(16,185,129,0.1),transparent_36%)]"
			/>
			<div className="relative mx-auto flex w-full max-w-6xl flex-col gap-5 px-3 pb-[calc(var(--oooc-mobile-nav-clearance,5.75rem)+1rem)] pt-4 sm:px-5 lg:px-8 lg:pb-12 lg:pt-8">
				<section className="grid items-end gap-8 pt-10 pb-8 sm:pt-14 lg:grid-cols-[minmax(0,0.95fr)_minmax(24rem,0.72fr)] lg:pt-18 lg:pb-12">
					<div className="min-w-0 animate-in fade-in-0 slide-in-from-bottom-3 duration-700">
						<div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/72 px-3 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur">
							{presentation?.kind === "official" ? (
								<Route className="h-3.5 w-3.5" />
							) : (
								<Share2 className="h-3.5 w-3.5" />
							)}
							{routeBadge}
						</div>
						<h1 className="mt-5 max-w-4xl text-balance text-[clamp(3rem,12vw,7.5rem)] leading-[0.86] [font-family:var(--ooo-font-display)] font-light">
							{ownerTitle}
						</h1>
						<p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
							{routeDescription}
						</p>
						<div className="mt-6 space-y-2">
							<div className="flex flex-wrap items-center gap-2">
								<Button
									type="button"
									onClick={saveToMyPlans}
									disabled={alreadySaved || saveStatus === "saved"}
									className="rounded-full"
								>
									{alreadySaved || saveStatus === "saved" ? (
										<Check className="mr-2 h-4 w-4" />
									) : (
										<Plus className="mr-2 h-4 w-4" />
									)}
									{alreadySaved || saveStatus === "saved"
										? routeSavedCta
										: routeSaveCta}
								</Button>
								<Button
									type="button"
									variant="outline"
									onClick={copyUrl}
									className="rounded-full bg-background/70"
								>
									{copyStatus === "copied" ? (
										<Check className="mr-2 h-4 w-4" />
									) : (
										<Copy className="mr-2 h-4 w-4" />
									)}
									{copyStatus === "copied" ? "Copied" : "Copy link"}
								</Button>
								<Link
									href="/plans"
									onClick={() =>
										trackPlanAnalytics({
											action: "shared_plan_open_planner",
											surface: "shared_plan",
											planId: plan.id,
											planDate: plan.planDate,
											stopCount: plan.stops.length,
										})
									}
									className={cn(
										buttonVariants({ variant: "outline" }),
										"rounded-full bg-background/70",
									)}
								>
									<Route className="mr-2 h-4 w-4" />
									Open planner
								</Link>
							</div>
							{routeEvents.length > 0 && (
								<div className="flex flex-wrap items-center gap-2">
									<Button
										type="button"
										variant="outline"
										onClick={exportRouteToCalendar}
										className="rounded-full bg-background/55 text-muted-foreground hover:text-foreground"
									>
										<CalendarPlus className="mr-2 h-4 w-4" />
										Add to calendar
									</Button>
									<Button
										type="button"
										variant="outline"
										onClick={openRouteInMaps}
										className="rounded-full bg-background/55 text-muted-foreground hover:text-foreground"
									>
										<MapPinned className="mr-2 h-4 w-4" />
										Open in maps
									</Button>
									<Button
										type="button"
										variant="outline"
										onClick={() => void findClosestStop()}
										disabled={closestStopState.status === "locating"}
										className="rounded-full bg-background/55 text-muted-foreground hover:text-foreground"
									>
										<LocateFixed className="mr-2 h-4 w-4" />
										{closestStopState.status === "locating"
											? "Finding..."
											: "Find closest stop"}
									</Button>
								</div>
							)}
						</div>
						<p
							className={cn(
								"mt-3 min-h-5 text-sm text-muted-foreground",
								saveStatus === "limit" && "text-amber-800 dark:text-amber-200",
							)}
						>
							{saveStatus === "limit"
								? "Your route limit for this day is full. Delete one route to save this plan."
								: saveStatus === "saved"
									? isAuthenticated && isOnline
										? "Saved to your account."
										: "Saved locally on this device."
									: savedStopsCount > 0
										? `${savedStopsCount} stop${savedStopsCount === 1 ? "" : "s"} already in your shortlist.`
										: "Saving creates your own private copy."}
						</p>
						{routeExportStatus && (
							<div
								className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground"
								aria-live="polite"
							>
								<span>{routeExportStatus}</span>
								{showRouteMapPreferenceAction && (
									<Button
										type="button"
										variant="ghost"
										size="xs"
										onClick={openRouteMapPicker}
										className="-my-1 text-muted-foreground hover:text-foreground"
									>
										<Settings className="h-3 w-3" />
										Change default
									</Button>
								)}
							</div>
						)}
						{closestStopState.message && (
							<p
								className={cn(
									"mt-1 text-sm",
									closestStopState.status === "unavailable"
										? "text-amber-800 dark:text-amber-200"
										: "text-muted-foreground",
								)}
								aria-live="polite"
							>
								{closestStopState.message}
							</p>
						)}
					</div>
					<div className="max-w-md animate-in fade-in-0 slide-in-from-bottom-2 border-y border-border/70 py-5 text-sm text-muted-foreground duration-700 lg:justify-self-end">
						<p className="text-xs uppercase tracking-[0.16em]">Route details</p>
						<div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-base text-foreground">
							<span>{formatShortDate(plan.planDate)}</span>
							<span aria-hidden="true" className="text-muted-foreground">
								/
							</span>
							<span>
								{visibleStops.length} stop
								{visibleStops.length === 1 ? "" : "s"}
							</span>
							<span aria-hidden="true" className="text-muted-foreground">
								/
							</span>
							<span>
								{savedStopsCount}/{visibleStops.length} already saved
							</span>
						</div>
					</div>
				</section>

				<section className="grid animate-in fade-in-0 slide-in-from-bottom-2 gap-4 duration-700 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start">
					<div className="rounded-2xl border border-border/70 bg-card/86 p-3 shadow-sm sm:p-5">
						<div className="mb-4">
							<p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
								Stops
							</p>
							<h2 className="mt-1 text-2xl [font-family:var(--ooo-font-display)]">
								Tap a stop for details.
							</h2>
						</div>
						<PlanRouteSummary
							plan={plan}
							eventsByKey={eventsByKey}
							highlightedEventKey={closestStopState.eventKey}
							onEventSelect={setSelectedEvent}
						/>
					</div>
					<aside className="rounded-2xl border border-border/70 bg-card p-4 text-sm leading-6 text-muted-foreground shadow-sm lg:sticky lg:top-5">
						<p>
							Anyone with this link can view the plan. The owner can turn the
							link off whenever they want.
						</p>
						{showFeaturedRoutePrompt && (
							<div className="mt-4 border-t border-border/70 pt-4">
								<p className="font-medium leading-5 text-foreground">
									{OFFICIAL_FETE_PLAN.crossSellHeadline}
								</p>
								<p className="mt-1 leading-5">
									{OFFICIAL_FETE_PLAN.crossSellSummary}
								</p>
								<Link
									href={getOfficialFetePlanHref()}
									onClick={() =>
										trackPlanAnalytics({
											action: "open_route",
											surface: "shared_plan",
											planId: plan.id,
											planDate: plan.planDate,
											stopCount: plan.stops.length,
											value: "featured_route_prompt",
										})
									}
									className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:underline"
								>
									Follow our route
									<ArrowUpRight className="h-3.5 w-3.5" />
								</Link>
							</div>
						)}
					</aside>
				</section>
			</div>
			<EventModal
				event={selectedEvent}
				isOpen={Boolean(selectedEvent)}
				onClose={() => setSelectedEvent(null)}
				isAuthenticated={isAuthenticated}
				submissionsEnabled={false}
				isSaved={selectedEvent ? isEventSaved(selectedEvent.eventKey) : false}
				isInPlan={
					selectedEvent
						? plans.some((candidate) =>
								candidate.stops.some(
									(stop) =>
										normalizeEventKey(stop.eventKey) ===
										normalizeEventKey(selectedEvent.eventKey),
								),
							)
						: false
				}
				onToggleSaved={(event) => toggleSavedEvent(event, "shared_plan_modal")}
				onAddToPlan={addEventFromModalToPlan}
			/>
			<AddEventToRouteDialog
				isOpen={Boolean(routePickerEvent)}
				event={routePickerEvent}
				plans={plans}
				suggestedPlanId={
					routePickerEvent
						? plans.find(
								(candidate) => candidate.planDate === routePickerEvent.date,
							)?.id
						: null
				}
				onClose={() => setRoutePickerEvent(null)}
				onAddToRoute={(event, targetPlan) => {
					addEventToRoute(event, targetPlan);
				}}
				onOpenRoute={(targetPlan) => {
					trackPlanAnalytics({
						action: "add_event_dialog_existing_route",
						surface: "route_dialog",
						planId: targetPlan.id,
						planDate: targetPlan.planDate,
						eventKey: routePickerEvent?.eventKey,
						stopCount: targetPlan.stops.length,
					});
					window.location.href = "/plans";
				}}
			/>
			<MapSelectionModal
				isOpen={isRouteMapPickerOpen}
				onClose={() => setIsRouteMapPickerOpen(false)}
				title="Open route in maps"
				description="Choose where to open these stops, or set a default for next time."
				onSelect={(provider) => {
					if (provider === "ask") return;
					openRouteInMapsWithProvider(provider);
				}}
				onRememberPreference={(provider) => {
					setMapPreference(provider);
				}}
			/>
		</div>
	);
}
