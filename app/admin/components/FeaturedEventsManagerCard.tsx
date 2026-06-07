"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	cancelFeaturedSchedule,
	clearFeaturedHistory,
	clearFeaturedQueue,
	listFeaturedQueue,
	rescheduleFeaturedEvent,
	scheduleFeaturedEvent,
	scheduleFeaturedEvents,
} from "@/features/events/featured/actions";
import { getSpotlightRotationContext } from "@/features/events/featured/selection";
import { getCurrentParisYearDateRange } from "@/features/events/filtering";
import {
	cancelPromotedSchedule,
	clearPromotedHistory,
	clearPromotedQueue,
	listPromotedQueue,
	reschedulePromotedEvent,
	schedulePromotedEvent,
	schedulePromotedEvents,
} from "@/features/events/promoted/actions";
import {
	getOrCreatePartnerReportForPlacement,
	listPartnerReportsForPlacements,
} from "@/features/partners/activation-actions";
import { useCallback, useEffect, useMemo, useState } from "react";

type FeaturedQueuePayload = Awaited<ReturnType<typeof listFeaturedQueue>>;
type PromotedQueuePayload = Awaited<ReturnType<typeof listPromotedQueue>>;
type PlacementMode = "spotlight" | "promoted";
type PlacementScope = "single" | "series";

type QueueRow = {
	id: string;
	eventKey: string;
	eventName: string;
	requestedStartAtParisInput: string;
	effectiveStartAt: string;
	effectiveStartAtParis: string;
	effectiveEndAt: string;
	effectiveEndAtParis: string;
	durationHours: number;
	status: "scheduled" | "cancelled" | "completed";
	state: "active" | "upcoming" | "recent-ended" | "completed" | "cancelled";
	requestedStartAtParis?: string;
	queuePosition?: number | null;
};

type TimelineStateFilter = "all" | QueueRow["state"];

const TIMELINE_LIMIT_OPTIONS = [10, 20, 50, 100] as const;

const getDateTimeInputForTimezone = (
	timeZone: string,
	value?: Date,
): string => {
	const date = value || new Date();
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).formatToParts(date);

	const read = (type: Intl.DateTimeFormatPartTypes): string =>
		parts.find((part) => part.type === type)?.value || "00";

	return `${read("year")}-${read("month")}-${read("day")}T${read("hour")}:${read("minute")}`;
};

const toStateLabel = (state: string): string =>
	state
		.split("-")
		.map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
		.join(" ");

const stateBadgeVariant = (state: string) => {
	switch (state) {
		case "active":
			return "default" as const;
		case "upcoming":
			return "secondary" as const;
		case "recent-ended":
			return "outline" as const;
		case "cancelled":
			return "destructive" as const;
		default:
			return "outline" as const;
	}
};

const stateRowClassName = (state: string): string => {
	switch (state) {
		case "active":
			return "bg-emerald-50/50";
		case "upcoming":
			return "bg-amber-50/35";
		case "recent-ended":
			return "bg-slate-50/40";
		default:
			return "";
	}
};

const MODE_LABEL: Record<PlacementMode, string> = {
	spotlight: "Spotlight",
	promoted: "Promoted",
};

export const FeaturedEventsManagerCard = ({
	initialPayload,
	initialPromotedPayload,
	onScheduleUpdated,
}: {
	initialPayload?: FeaturedQueuePayload;
	initialPromotedPayload?: PromotedQueuePayload;
	onScheduleUpdated?: () => Promise<void> | void;
}) => {
	const [placementMode, setPlacementMode] =
		useState<PlacementMode>("spotlight");
	const [placementScope, setPlacementScope] =
		useState<PlacementScope>("single");
	const [featuredPayload, setFeaturedPayload] =
		useState<FeaturedQueuePayload | null>(initialPayload ?? null);
	const [promotedPayload, setPromotedPayload] =
		useState<PromotedQueuePayload | null>(initialPromotedPayload ?? null);
	const [isLoading, setIsLoading] = useState(false);
	const [isMutating, setIsMutating] = useState(false);
	const [statusMessage, setStatusMessage] = useState("");
	const [errorMessage, setErrorMessage] = useState("");
	const [partnerReportLinks, setPartnerReportLinks] = useState<
		Record<string, { activationId: string; statsPath: string }>
	>({});
	const [eventQuery, setEventQuery] = useState("");
	const [timelineSearchTerm, setTimelineSearchTerm] = useState("");
	const [timelineStateFilter, setTimelineStateFilter] =
		useState<TimelineStateFilter>("all");
	const [timelineVisibleLimit, setTimelineVisibleLimit] = useState<number>(
		TIMELINE_LIMIT_OPTIONS[1],
	);
	const [selectedEventKey, setSelectedEventKey] = useState("");
	const [scheduleAt, setScheduleAt] = useState(
		getDateTimeInputForTimezone("Europe/Paris"),
	);
	const [durationHours, setDurationHours] = useState("48");
	const [rescheduleInputs, setRescheduleInputs] = useState<
		Record<string, string>
	>({});

	const loadQueue = useCallback(async (mode: PlacementMode) => {
		setIsLoading(true);
		setErrorMessage("");
		try {
			if (mode === "spotlight") {
				const result = await listFeaturedQueue();
				setFeaturedPayload(result);
				if (!result.success) {
					setErrorMessage(result.error || "Failed to load Spotlight queue");
				}
				return;
			}
			const result = await listPromotedQueue();
			setPromotedPayload(result);
			if (!result.success) {
				setErrorMessage(result.error || "Failed to load promoted queue");
			}
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		if (initialPayload?.success) {
			return;
		}
		void loadQueue("spotlight");
	}, [initialPayload?.success, loadQueue]);

	useEffect(() => {
		if (initialPromotedPayload?.success) {
			return;
		}
		void loadQueue("promoted");
	}, [initialPromotedPayload?.success, loadQueue]);

	const currentPayload = useMemo(
		() => (placementMode === "spotlight" ? featuredPayload : promotedPayload),
		[featuredPayload, placementMode, promotedPayload],
	);

	const events = currentPayload?.events ?? [];
	const queueRows = useMemo(
		() => (currentPayload?.queue ?? []) as QueueRow[],
		[currentPayload?.queue],
	);
	const matchedEvents = useMemo(() => {
		const needle = eventQuery.trim().toLowerCase();
		if (!needle) {
			return events.slice(0, 10);
		}
		return events
			.filter((event) => {
				return (
					event.name.toLowerCase().includes(needle) ||
					event.eventKey.toLowerCase().includes(needle)
				);
			})
			.slice(0, 50);
	}, [eventQuery, events]);
	const suggestedEvents = useMemo(
		() => matchedEvents.slice(0, 2),
		[matchedEvents],
	);
	const selectedEvent = useMemo(
		() => events.find((event) => event.eventKey === selectedEventKey),
		[events, selectedEventKey],
	);
	const selectedSeriesEvents = useMemo(() => {
		if (!selectedEvent?.seriesKey) return [];
		return events
			.filter((event) => event.seriesKey === selectedEvent.seriesKey)
			.sort((left, right) => left.date.localeCompare(right.date));
	}, [events, selectedEvent]);
	const targetEventKeys = useMemo(() => {
		if (!selectedEvent) return [];
		if (placementScope === "series" && selectedSeriesEvents.length > 1) {
			return selectedSeriesEvents.map((event) => event.eventKey);
		}
		return [selectedEvent.eventKey];
	}, [placementScope, selectedEvent, selectedSeriesEvents]);
	const canTargetSeries = selectedSeriesEvents.length > 1;
	useEffect(() => {
		if (!canTargetSeries && placementScope === "series") {
			setPlacementScope("single");
		}
	}, [canTargetSeries, placementScope]);

	const scheduleTimezone =
		currentPayload?.slotConfig?.timezone || "Europe/Paris";
	const timezoneDisplayLabel = `${scheduleTimezone} (CET / GMT+1)`;
	const spotlightRotationContext = useMemo(
		() =>
			getSpotlightRotationContext({
				dateRange: getCurrentParisYearDateRange(),
			}),
		[],
	);
	const activeCount = currentPayload?.activeCount ?? 0;
	const spotlightMaxConcurrent =
		featuredPayload?.slotConfig?.maxConcurrent ?? 3;
	const maxConcurrentDisplay =
		placementMode === "spotlight"
			? `${activeCount}/${spotlightMaxConcurrent}`
			: `${activeCount}`;
	const upcomingCount = queueRows.filter(
		(row) => row.state === "upcoming",
	).length;
	const recentEndedCount = queueRows.filter(
		(row) => row.state === "recent-ended",
	).length;
	const scheduledCount = queueRows.filter(
		(row) => row.status === "scheduled",
	).length;
	const historyCount = queueRows.filter(
		(row) => row.status !== "scheduled",
	).length;
	const hasQueueRows = queueRows.length > 0;
	const hasActiveSlots = activeCount > 0;
	const parsedDurationHours = Number.parseInt(durationHours, 10);
	const hasValidDuration =
		Number.isFinite(parsedDurationHours) &&
		parsedDurationHours >= 1 &&
		parsedDurationHours <= 168;
	const canScheduleNow =
		!isMutating &&
		!isLoading &&
		Boolean(selectedEventKey) &&
		hasValidDuration;
	const canScheduleForLater =
		canScheduleNow &&
		scheduleAt.trim().length > 0 &&
		Number.isFinite(new Date(scheduleAt).getTime());
	const scheduleNowTitle = canScheduleNow
		? `${placementMode === "spotlight" ? "Feature" : "Promote"} the selected event immediately`
		: "Select an event and enter a duration from 1 to 168 hours";
	const scheduleLaterTitle = canScheduleForLater
		? "Schedule the selected event for the chosen time"
		: "Select an event, valid start time, and duration from 1 to 168 hours";
	const filteredTimelineRows = useMemo(() => {
		const needle = timelineSearchTerm.trim().toLowerCase();
		return queueRows.filter((row) => {
			const matchesState =
				timelineStateFilter === "all" || row.state === timelineStateFilter;
			if (!matchesState) return false;
			if (!needle) return true;
			return [row.eventName, row.eventKey, row.state].some((value) =>
				value.toLowerCase().includes(needle),
			);
		});
	}, [queueRows, timelineSearchTerm, timelineStateFilter]);
	const visibleTimelineRows = useMemo(
		() => filteredTimelineRows.slice(0, timelineVisibleLimit),
		[filteredTimelineRows, timelineVisibleLimit],
	);
	const hasVisibleTimelineRows = visibleTimelineRows.length > 0;
	const clearQueueTitle =
		scheduledCount > 0
			? `Clear ${scheduledCount} scheduled ${MODE_LABEL[placementMode].toLowerCase()} entr${scheduledCount === 1 ? "y" : "ies"}`
			: "No scheduled entries to clear";
	const clearHistoryTitle =
		historyCount > 0
			? `Clear ${historyCount} historical ${MODE_LABEL[placementMode].toLowerCase()} entr${historyCount === 1 ? "y" : "ies"}`
			: "No historical entries to clear";

	useEffect(() => {
		if (!hasQueueRows) {
			setPartnerReportLinks({});
			return;
		}
		let isCancelled = false;
		const loadReports = async () => {
			const result = await listPartnerReportsForPlacements({
				placements: queueRows.map((row) => ({
					placementId: row.id,
					eventKey: row.eventKey,
					tier: placementMode,
					startAt: row.effectiveStartAt,
					endAt: row.effectiveEndAt,
				})),
			});
			if (isCancelled || !result.success) return;
			setPartnerReportLinks(result.reports);
		};
		void loadReports();
		return () => {
			isCancelled = true;
		};
	}, [hasQueueRows, placementMode, queueRows]);

	const withMutation = useCallback(
		async (
			task: () => Promise<{
				success: boolean;
				message: string;
				error?: string;
			}>,
		) => {
			setIsMutating(true);
			setStatusMessage("");
			setErrorMessage("");
			try {
				const result = await task();
				if (!result.success) {
					throw new Error(result.error || result.message);
				}
				setStatusMessage(result.message);
				await loadQueue(placementMode);
				if (onScheduleUpdated) {
					await onScheduleUpdated();
				}
			} catch (error) {
				setErrorMessage(
					error instanceof Error ? error.message : "Unknown mutation error",
				);
			} finally {
				setIsMutating(false);
			}
		},
		[loadQueue, onScheduleUpdated, placementMode],
	);

	const handleScheduleNow = useCallback(async () => {
		if (!selectedEventKey) {
			setErrorMessage("Select an event first");
			return;
		}
		if (!hasValidDuration) {
			setErrorMessage("Use a duration between 1 and 168 hours");
			return;
		}
		if (placementMode === "spotlight") {
			await withMutation(() =>
				targetEventKeys.length > 1
					? scheduleFeaturedEvents(targetEventKeys, "", parsedDurationHours)
					: scheduleFeaturedEvent(selectedEventKey, "", parsedDurationHours),
			);
			return;
		}
		await withMutation(() =>
			targetEventKeys.length > 1
				? schedulePromotedEvents(targetEventKeys, "", parsedDurationHours)
				: schedulePromotedEvent(selectedEventKey, "", parsedDurationHours),
		);
	}, [
		hasValidDuration,
		placementMode,
		parsedDurationHours,
		selectedEventKey,
		targetEventKeys,
		withMutation,
	]);

	const handleSchedule = useCallback(async () => {
		if (!selectedEventKey) {
			setErrorMessage("Select an event first");
			return;
		}
		if (!scheduleAt.trim()) {
			setErrorMessage("Select a Paris schedule time");
			return;
		}
		if (!hasValidDuration) {
			setErrorMessage("Use a duration between 1 and 168 hours");
			return;
		}
		if (placementMode === "spotlight") {
			await withMutation(() =>
				targetEventKeys.length > 1
					? scheduleFeaturedEvents(
							targetEventKeys,
							scheduleAt,
							parsedDurationHours,
						)
					: scheduleFeaturedEvent(
							selectedEventKey,
							scheduleAt,
							parsedDurationHours,
						),
			);
			return;
		}
		await withMutation(() =>
			targetEventKeys.length > 1
				? schedulePromotedEvents(targetEventKeys, scheduleAt, parsedDurationHours)
				: schedulePromotedEvent(
						selectedEventKey,
						scheduleAt,
						parsedDurationHours,
					),
		);
	}, [
		hasValidDuration,
		placementMode,
		parsedDurationHours,
		scheduleAt,
		selectedEventKey,
		targetEventKeys,
		withMutation,
	]);

	const handleClearQueue = useCallback(async () => {
		if (hasActiveSlots) {
			const firstConfirm = window.confirm(
				`This will remove currently active ${MODE_LABEL[placementMode].toLowerCase()} slots. Continue?`,
			);
			if (!firstConfirm) return;
			const secondConfirm = window.confirm(
				`Final confirmation: clear scheduled ${MODE_LABEL[placementMode].toLowerCase()} queue now?`,
			);
			if (!secondConfirm) return;
		} else {
			const confirmed = window.confirm(
				`Clear scheduled ${MODE_LABEL[placementMode].toLowerCase()} queue entries? Upcoming entries will be removed.`,
			);
			if (!confirmed) return;
		}
		if (placementMode === "spotlight") {
			await withMutation(() => clearFeaturedQueue());
			return;
		}
		await withMutation(() => clearPromotedQueue());
	}, [hasActiveSlots, placementMode, withMutation]);

	const handleClearHistory = useCallback(async () => {
		const confirmed = window.confirm(
			`Clear ${MODE_LABEL[placementMode].toLowerCase()} history entries (completed/cancelled)? This cannot be undone.`,
		);
		if (!confirmed) return;
		if (placementMode === "spotlight") {
			await withMutation(() => clearFeaturedHistory());
			return;
		}
		await withMutation(() => clearPromotedHistory());
	}, [placementMode, withMutation]);

	const handleCreatePartnerReport = useCallback(
		async (row: QueueRow) => {
			setIsMutating(true);
			setStatusMessage("");
			setErrorMessage("");
			try {
				const result = await getOrCreatePartnerReportForPlacement({
					placementId: row.id,
					eventKey: row.eventKey,
					eventName: row.eventName,
					tier: placementMode,
					startAt: row.effectiveStartAt,
					endAt: row.effectiveEndAt,
				});
				if (!result.success) {
					setErrorMessage(result.error || result.message);
					return;
				}
				setPartnerReportLinks((current) => ({
					...current,
					[row.id]: {
						activationId: result.activationId,
						statsPath: result.statsPath,
					},
				}));
				setStatusMessage(
					result.existing
						? `Existing partner report found for ${row.eventName}.`
						: `Partner report created for ${row.eventName}. It also appears under Fulfilled / Reports.`,
				);
			} finally {
				setIsMutating(false);
			}
		},
		[placementMode],
	);

	const scheduleActionLabel =
		placementMode === "spotlight" ? "Feature now" : "Promote now";
	const scheduleHeadingLabel =
		placementMode === "spotlight"
			? "Plan a Spotlight slot"
			: "Plan a promoted listing";

	return (
		<Card className="ooo-admin-card-soft min-w-0 overflow-hidden">
			<CardHeader className="space-y-4">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="space-y-1">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Placement Scheduling
						</p>
						<CardTitle>Spotlight & Promoted Scheduler</CardTitle>
						<CardDescription>
							Use one control surface for Spotlight and Promoted placements.
							Paid order fulfillment happens in Paid Orders Queue.
						</CardDescription>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<div className="inline-flex rounded-md border border-border/70 bg-background/70 p-1">
							<Button
								type="button"
								size="sm"
								variant={placementMode === "spotlight" ? "default" : "ghost"}
								className="h-8 px-3"
								onClick={() => setPlacementMode("spotlight")}
								disabled={isMutating}
							>
								Spotlight
							</Button>
							<Button
								type="button"
								size="sm"
								variant={placementMode === "promoted" ? "default" : "ghost"}
								className="h-8 px-3"
								onClick={() => setPlacementMode("promoted")}
								disabled={isMutating}
							>
								Promoted
							</Button>
						</div>
						<Badge variant="outline">Timezone: {timezoneDisplayLabel}</Badge>
						{placementMode === "spotlight" && (
							<Badge variant="outline">
								Rotation: {spotlightRotationContext.label}
							</Badge>
						)}
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={() => void loadQueue(placementMode)}
							disabled={isLoading || isMutating}
						>
							{isLoading ? "Refreshing..." : "Refresh queue"}
						</Button>
					</div>
				</div>
				{placementMode === "spotlight" && (
					<div className="rounded-md border border-border/70 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
						<span className="font-medium text-foreground/80">
							Current spotlight fallback intent:
						</span>{" "}
						{spotlightRotationContext.intentLabel}. Cadence:{" "}
						{spotlightRotationContext.cadence === "daily" ? "daily" : "6-hour"}{" "}
						rotation. Phase: {spotlightRotationContext.eventPhase}.
					</div>
				)}
				<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
					<div className="rounded-md border bg-background/60 px-2.5 py-2">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Active Slots
						</p>
						<p className="mt-0.5 text-sm font-semibold tabular-nums">
							{maxConcurrentDisplay}
						</p>
					</div>
					<div className="rounded-md border bg-background/60 px-2.5 py-2">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Upcoming
						</p>
						<p className="mt-0.5 text-sm font-semibold tabular-nums">
							{upcomingCount}
						</p>
					</div>
					<div className="rounded-md border bg-background/60 px-2.5 py-2">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Recent Ended
						</p>
						<p className="mt-0.5 text-sm font-semibold tabular-nums">
							{recentEndedCount}
						</p>
					</div>
					<div className="rounded-md border bg-background/60 px-2.5 py-2">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Scheduled
						</p>
						<p className="mt-0.5 text-sm font-semibold tabular-nums">
							{scheduledCount}
						</p>
					</div>
				</div>
			</CardHeader>
			<CardContent className="space-y-6">
				<section className="space-y-4 rounded-lg border border-border/60 bg-background/45 p-4">
					<div className="space-y-1">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Create Schedule Entry
						</p>
						<h3 className="text-sm font-semibold">{scheduleHeadingLabel}</h3>
						<p className="text-xs text-muted-foreground">
							Select an event, then activate now or schedule using the timezone
							above.
						</p>
					</div>
					<div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,280px)]">
						<div className="space-y-2">
							<Label htmlFor="placement-event-filter">Find event</Label>
							<Input
								id="placement-event-filter"
								placeholder="Search by event name or key"
								value={eventQuery}
								onChange={(event) => setEventQuery(event.target.value)}
							/>
							<div className="space-y-1">
								{suggestedEvents.length > 0 ? (
									suggestedEvents.map((event) => (
										<button
											key={event.eventKey}
											type="button"
											className={`w-full rounded-md border px-3 py-2 text-left text-xs transition-colors ${
												event.eventKey === selectedEventKey
													? "border-foreground/40 bg-accent"
													: "border-border bg-background hover:bg-accent/60"
											}`}
											onClick={() => {
												setSelectedEventKey(event.eventKey);
												setEventQuery(event.name);
											}}
										>
											<p className="truncate font-medium">{event.name}</p>
											<p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
												{event.eventKey}
											</p>
											<p className="mt-1 text-[10px] text-muted-foreground">
												{event.date}
												{event.time ? ` at ${event.time}` : ""}
											</p>
										</button>
									))
								) : (
									<p className="text-[11px] text-muted-foreground">
										No matching events found.
									</p>
								)}
							</div>
							{selectedEvent ? (
								<div className="space-y-2 rounded-md border bg-background/60 px-2.5 py-2">
									<div className="flex flex-wrap items-center gap-2">
										<Badge variant="outline">Selected</Badge>
										<p className="max-w-full truncate text-xs font-medium">
											{selectedEvent.name}
										</p>
										<Button
											type="button"
											size="sm"
											variant="ghost"
											className="h-7 px-2"
											onClick={() => {
												setSelectedEventKey("");
												setEventQuery("");
												setPlacementScope("single");
											}}
										>
											Clear
										</Button>
									</div>
									<div className="flex flex-wrap items-center gap-2 text-xs">
										<Badge variant="secondary">
											Targeting {targetEventKeys.length} occurrence
											{targetEventKeys.length === 1 ? "" : "s"}
										</Badge>
										{canTargetSeries && (
											<div className="inline-flex overflow-hidden rounded-md border bg-background">
												<button
													type="button"
													className={`px-2 py-1 ${
														placementScope === "single"
															? "bg-muted text-foreground"
															: "text-muted-foreground"
													}`}
													onClick={() => setPlacementScope("single")}
												>
													Single date
												</button>
												<button
													type="button"
													className={`border-l px-2 py-1 ${
														placementScope === "series"
															? "bg-muted text-foreground"
															: "text-muted-foreground"
													}`}
													onClick={() => setPlacementScope("series")}
												>
													Whole series
												</button>
											</div>
										)}
										{canTargetSeries && (
											<span className="text-muted-foreground">
												{selectedSeriesEvents[0]?.date} to{" "}
												{selectedSeriesEvents.at(-1)?.date}
											</span>
										)}
									</div>
								</div>
							) : (
								<p className="text-[11px] text-muted-foreground">
									Pick one of the 2 suggestions above to set the{" "}
									{MODE_LABEL[placementMode].toLowerCase()} target.
								</p>
							)}
						</div>
						<div className="flex h-full flex-col rounded-md border bg-background/60 p-3">
							<div className="space-y-3">
								<div className="space-y-2">
									<Label htmlFor="placement-schedule-at">Schedule at</Label>
									<Input
										id="placement-schedule-at"
										type="datetime-local"
										value={scheduleAt}
										onChange={(event) => setScheduleAt(event.target.value)}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="placement-duration-hours">
										Duration (hours)
									</Label>
									<Input
										id="placement-duration-hours"
										type="number"
										min={1}
										max={168}
										value={durationHours}
										onChange={(event) => setDurationHours(event.target.value)}
									/>
								</div>
							</div>
							<div className="mt-auto pt-3">
								<div className="grid grid-cols-2 gap-2">
									<Button
										type="button"
										variant="outline"
										onClick={() => void handleScheduleNow()}
										disabled={!canScheduleNow}
										title={scheduleNowTitle}
									>
										{scheduleActionLabel}
									</Button>
									<Button
										type="button"
										onClick={() => void handleSchedule()}
										disabled={!canScheduleForLater}
										title={scheduleLaterTitle}
									>
										Schedule
									</Button>
								</div>
							</div>
						</div>
					</div>
				</section>

				{statusMessage ? (
					<div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
						{statusMessage}
					</div>
				) : null}
				{errorMessage ? (
					<div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
						{errorMessage}
					</div>
				) : null}

				<section className="space-y-3">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<div className="space-y-1">
							<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
								Schedule Timeline
							</p>
							<h3 className="text-sm font-semibold">
								Queue and history ({MODE_LABEL[placementMode]})
							</h3>
						</div>
						<div className="flex items-center gap-2">
							<p className="text-xs text-muted-foreground">
								All times use the timezone shown above.
							</p>
							<Button
								type="button"
								size="sm"
								variant="destructive"
								onClick={() => void handleClearQueue()}
								disabled={isMutating || isLoading || scheduledCount === 0}
								title={clearQueueTitle}
							>
								Clear Scheduled Queue
							</Button>
							<Button
								type="button"
								size="sm"
								variant="destructive"
								onClick={() => void handleClearHistory()}
								disabled={isMutating || isLoading || historyCount === 0}
								title={clearHistoryTitle}
							>
								Clear History
							</Button>
						</div>
					</div>
					<div className="flex flex-wrap items-end justify-between gap-2">
						<div className="min-w-[220px] flex-1 space-y-1">
							<label
								htmlFor="placement-timeline-search"
								className="text-xs text-muted-foreground"
							>
								Search timeline
							</label>
							<Input
								id="placement-timeline-search"
								className="h-8 text-xs"
								value={timelineSearchTerm}
								onChange={(event) => setTimelineSearchTerm(event.target.value)}
								placeholder="Event name or key"
							/>
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<label
								htmlFor="placement-timeline-state"
								className="text-xs text-muted-foreground"
							>
								State
							</label>
							<select
								id="placement-timeline-state"
								className="h-8 rounded-md border border-border bg-background px-2 text-xs"
								value={timelineStateFilter}
								onChange={(event) =>
									setTimelineStateFilter(
										event.target.value as TimelineStateFilter,
									)
								}
							>
								<option value="all">All</option>
								<option value="active">Active</option>
								<option value="upcoming">Upcoming</option>
								<option value="recent-ended">Recent ended</option>
								<option value="completed">Completed</option>
								<option value="cancelled">Cancelled</option>
							</select>
							<label
								htmlFor="placement-timeline-limit"
								className="text-xs text-muted-foreground"
							>
								Show
							</label>
							<select
								id="placement-timeline-limit"
								className="h-8 rounded-md border border-border bg-background px-2 text-xs"
								value={timelineVisibleLimit}
								onChange={(event) =>
									setTimelineVisibleLimit(
										Number.parseInt(event.target.value, 10),
									)
								}
							>
								{TIMELINE_LIMIT_OPTIONS.map((limit) => (
									<option key={limit} value={limit}>
										{limit}
									</option>
								))}
							</select>
						</div>
					</div>
					<p className="text-xs text-muted-foreground">
						Showing {visibleTimelineRows.length} of{" "}
						{filteredTimelineRows.length} matching schedule entries.
					</p>
					<div className="max-h-[42rem] max-w-full overflow-auto rounded-md border">
						<table className="min-w-[980px] w-full text-xs">
							<thead className="bg-muted/40">
								<tr>
									<th className="px-3 py-2 text-left font-medium">Event</th>
									<th className="px-3 py-2 text-left font-medium">State</th>
									<th className="px-3 py-2 text-left font-medium">Queue</th>
									<th className="px-3 py-2 text-left font-medium">Requested</th>
									<th className="px-3 py-2 text-left font-medium">Effective</th>
									<th className="px-3 py-2 text-left font-medium">Ends</th>
									<th className="px-3 py-2 text-left font-medium">Actions</th>
								</tr>
							</thead>
							<tbody>
								{!hasVisibleTimelineRows ? (
									<tr>
										<td
											colSpan={7}
											className="px-3 py-5 text-center text-muted-foreground"
										>
											No {MODE_LABEL[placementMode].toLowerCase()} schedule
											entries match this view.
										</td>
									</tr>
								) : (
									visibleTimelineRows.map((row) => {
										const nextStart =
											rescheduleInputs[row.id] ??
											row.requestedStartAtParisInput;
										const canReschedule =
											row.status === "scheduled" &&
											Number.isFinite(new Date(nextStart).getTime()) &&
											nextStart !== row.requestedStartAtParisInput;
										const rescheduleTitle =
											row.status !== "scheduled"
												? "Only scheduled entries can be rescheduled"
												: canReschedule
													? "Apply the changed start time"
													: "Choose a different valid start time";
										const cancelTitle =
											row.status === "scheduled"
												? "Cancel this scheduled entry"
												: "Only scheduled entries can be cancelled";
										return (
											<tr
												key={row.id}
												id={`placement-${row.id}`}
												className={`scroll-mt-44 border-t align-top ${stateRowClassName(row.state)}`}
											>
											<td className="px-2.5 py-2.5">
												<div className="font-medium">{row.eventName}</div>
												<div className="font-mono text-[11px] text-muted-foreground">
													{row.eventKey}
												</div>
											</td>
											<td className="px-2.5 py-2.5">
												<Badge variant={stateBadgeVariant(row.state)}>
													{toStateLabel(row.state)}
												</Badge>
											</td>
											<td className="px-2.5 py-2.5 font-mono text-[11px] tabular-nums">
												{placementMode === "spotlight" && row.queuePosition
													? `#${row.queuePosition}`
													: "—"}
											</td>
											<td className="px-2.5 py-2.5 font-mono text-[11px] tabular-nums whitespace-nowrap">
												{row.requestedStartAtParis || "—"}
											</td>
											<td className="px-2.5 py-2.5 font-mono text-[11px] tabular-nums whitespace-nowrap">
												{row.effectiveStartAtParis}
											</td>
											<td className="px-2.5 py-2.5 font-mono text-[11px] tabular-nums whitespace-nowrap">
												{row.effectiveEndAtParis}
											</td>
											<td className="px-2.5 py-2.5">
												<div className="flex min-w-[210px] flex-col gap-1.5">
													<Input
														id={`placement-reschedule-${row.id}`}
														type="datetime-local"
														className="h-8 text-xs"
														value={
															rescheduleInputs[row.id] ??
															row.requestedStartAtParisInput
														}
														onChange={(event) =>
															setRescheduleInputs((current) => ({
																...current,
																[row.id]: event.target.value,
															}))
														}
														disabled={row.status !== "scheduled" || isMutating}
													/>
													<div className="flex gap-1.5">
														<Button
															type="button"
															size="sm"
															variant="outline"
															className="h-8 px-2.5"
															disabled={isMutating || !canReschedule}
															title={rescheduleTitle}
															onClick={() =>
																void withMutation(() => {
																	return placementMode === "spotlight"
																		? rescheduleFeaturedEvent(
																				row.id,
																				nextStart,
																				row.durationHours,
																			)
																		: reschedulePromotedEvent(
																				row.id,
																				nextStart,
																				row.durationHours,
																			);
																})
															}
														>
															Reschedule
														</Button>
														<Button
															type="button"
															size="sm"
															variant="destructive"
															className="h-8 px-2.5"
															disabled={
																row.status !== "scheduled" || isMutating
															}
															title={cancelTitle}
															onClick={() =>
																void withMutation(() =>
																	placementMode === "spotlight"
																		? cancelFeaturedSchedule(row.id)
																		: cancelPromotedSchedule(row.id),
																)
															}
														>
															Cancel
														</Button>
													</div>
													<div className="flex flex-wrap gap-1.5">
														{partnerReportLinks[row.id] ? (
															<Button
																type="button"
																size="sm"
																variant="outline"
																className="h-8 px-2.5"
																nativeButton={false}
																render={
																	<a
																		href={partnerReportLinks[row.id]?.statsPath}
																		target="_blank"
																		rel="noreferrer"
																	/>
																}
															>
																Open Report
															</Button>
														) : (
															<Button
																type="button"
																size="sm"
																variant="outline"
																className="h-8 px-2.5"
																disabled={isMutating}
																onClick={() =>
																	void handleCreatePartnerReport(row)
																}
															>
																Create Report
															</Button>
														)}
													</div>
												</div>
											</td>
											</tr>
										);
									})
								)}
							</tbody>
						</table>
					</div>
					{filteredTimelineRows.length > visibleTimelineRows.length ? (
						<div className="flex justify-center">
							<Button
								type="button"
								size="sm"
								variant="outline"
								onClick={() =>
									setTimelineVisibleLimit((current) =>
										Math.min(current + 20, filteredTimelineRows.length),
									)
								}
							>
								Show 20 more
							</Button>
						</div>
					) : null}
				</section>
			</CardContent>
		</Card>
	);
};
