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
} from "@/features/events/featured/actions";
import { useCallback, useEffect, useMemo, useState } from "react";

type FeaturedQueuePayload = Awaited<ReturnType<typeof listFeaturedQueue>>;

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

export const FeaturedEventsManagerCard = ({
	onScheduleUpdated,
}: {
	onScheduleUpdated?: () => Promise<void> | void;
}) => {
	const [payload, setPayload] = useState<FeaturedQueuePayload | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [isMutating, setIsMutating] = useState(false);
	const [statusMessage, setStatusMessage] = useState("");
	const [errorMessage, setErrorMessage] = useState("");
	const [eventQuery, setEventQuery] = useState("");
	const [selectedEventKey, setSelectedEventKey] = useState("");
	const [scheduleAt, setScheduleAt] = useState(
		getDateTimeInputForTimezone("Europe/Paris"),
	);
	const [durationHours, setDurationHours] = useState("48");
	const [rescheduleInputs, setRescheduleInputs] = useState<
		Record<string, string>
	>({});

	const loadQueue = useCallback(async () => {
		setIsLoading(true);
		setErrorMessage("");
		try {
			const result = await listFeaturedQueue();
			setPayload(result);
			if (!result.success) {
				setErrorMessage(result.error || "Failed to load featured queue");
			}
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadQueue();
	}, [loadQueue]);

	const matchedEvents = useMemo(() => {
		if (!payload?.events) return [];
		const needle = eventQuery.trim().toLowerCase();
		if (!needle) {
			return payload.events.slice(0, 10);
		}
		return payload.events
			.filter((event) => {
				return (
					event.name.toLowerCase().includes(needle) ||
					event.eventKey.toLowerCase().includes(needle)
				);
			})
			.slice(0, 50);
	}, [eventQuery, payload?.events]);

	const suggestedEvents = useMemo(
		() => matchedEvents.slice(0, 2),
		[matchedEvents],
	);

	const selectedEvent = useMemo(
		() => payload?.events?.find((event) => event.eventKey === selectedEventKey),
		[payload?.events, selectedEventKey],
	);

	const activeCount = payload?.activeCount ?? 0;
	const maxConcurrent = payload?.slotConfig?.maxConcurrent ?? 3;
	const queueRows = payload?.queue ?? [];
	const scheduleTimezone = payload?.slotConfig?.timezone || "Europe/Paris";
	const timezoneDisplayLabel = `${scheduleTimezone} (CET / GMT+1)`;
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
				await loadQueue();
				if (onScheduleUpdated) {
					await onScheduleUpdated();
				}
			} catch (error) {
				setErrorMessage(
					error instanceof Error
						? error.message
						: "Unknown featured mutation error",
				);
			} finally {
				setIsMutating(false);
			}
		},
		[loadQueue, onScheduleUpdated],
	);

	const handleFeatureNow = useCallback(async () => {
		if (!selectedEventKey) {
			setErrorMessage("Select an event first");
			return;
		}
		await withMutation(() =>
			scheduleFeaturedEvent(
				selectedEventKey,
				"",
				Number.parseInt(durationHours, 10),
			),
		);
	}, [durationHours, selectedEventKey, withMutation]);

	const handleSchedule = useCallback(async () => {
		if (!selectedEventKey) {
			setErrorMessage("Select an event first");
			return;
		}
		if (!scheduleAt.trim()) {
			setErrorMessage("Select a Paris schedule time");
			return;
		}
		await withMutation(() =>
			scheduleFeaturedEvent(
				selectedEventKey,
				scheduleAt,
				Number.parseInt(durationHours, 10),
			),
		);
	}, [durationHours, scheduleAt, selectedEventKey, withMutation]);

	const handleClearQueue = useCallback(async () => {
		if (hasActiveSlots) {
			const firstConfirm = window.confirm(
				"This will remove currently active featured slots. Continue?",
			);
			if (!firstConfirm) return;
			const secondConfirm = window.confirm(
				"Final confirmation: clear scheduled queue now?",
			);
			if (!secondConfirm) return;
		} else {
			const confirmed = window.confirm(
				"Clear scheduled featured queue entries? Upcoming entries will be removed.",
			);
			if (!confirmed) return;
		}
		await withMutation(() => clearFeaturedQueue());
	}, [hasActiveSlots, withMutation]);

	const handleClearHistory = useCallback(async () => {
		const confirmed = window.confirm(
			"Clear featured history entries (completed/cancelled)? This cannot be undone.",
		);
		if (!confirmed) return;
		await withMutation(() => clearFeaturedHistory());
	}, [withMutation]);

	return (
		<Card className="ooo-admin-card-soft min-w-0 overflow-hidden">
			<CardHeader className="space-y-4">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="space-y-1">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Featured Scheduling
						</p>
						<CardTitle>Featured Events Manager</CardTitle>
						<CardDescription>
							Dedicated scheduler for featured slots. Legacy sheet `Featured`
							values are no longer used.
						</CardDescription>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<Badge variant="outline">Timezone: {timezoneDisplayLabel}</Badge>
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={() => void loadQueue()}
							disabled={isLoading || isMutating}
						>
							{isLoading ? "Refreshing..." : "Refresh queue"}
						</Button>
					</div>
				</div>
				<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
					<div className="rounded-md border bg-background/60 px-2.5 py-2">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Active Slots
						</p>
						<p className="mt-0.5 text-sm font-semibold tabular-nums">
							{activeCount}/{maxConcurrent}
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
						<h3 className="text-sm font-semibold">Plan a featured slot</h3>
						<p className="text-xs text-muted-foreground">
							Select an event, then feature now or schedule using the timezone
							above.
						</p>
					</div>
					<div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,280px)]">
						<div className="space-y-2">
							<Label htmlFor="featured-event-filter">Find event</Label>
							<Input
								id="featured-event-filter"
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
								<div className="flex flex-wrap items-center gap-2 rounded-md border bg-background/60 px-2.5 py-2">
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
										}}
									>
										Clear
									</Button>
								</div>
							) : (
								<p className="text-[11px] text-muted-foreground">
									Pick one of the 2 suggestions above to set the featured
									target.
								</p>
							)}
						</div>
						<div className="flex h-full flex-col rounded-md border bg-background/60 p-3">
							<div className="space-y-3">
								<div className="space-y-2">
									<Label htmlFor="featured-schedule-at">Schedule at</Label>
									<Input
										id="featured-schedule-at"
										type="datetime-local"
										value={scheduleAt}
										onChange={(event) => setScheduleAt(event.target.value)}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="featured-duration-hours">
										Duration (hours)
									</Label>
									<Input
										id="featured-duration-hours"
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
										onClick={() => void handleFeatureNow()}
										disabled={isMutating || isLoading}
									>
										Feature now
									</Button>
									<Button
										type="button"
										onClick={() => void handleSchedule()}
										disabled={isMutating || isLoading}
									>
										Schedule
									</Button>
								</div>
							</div>
						</div>
					</div>
				</section>

				{statusMessage && (
					<div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
						{statusMessage}
					</div>
				)}
				{errorMessage && (
					<div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
						{errorMessage}
					</div>
				)}

				<section className="space-y-3">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<div className="space-y-1">
							<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
								Schedule Timeline
							</p>
							<h3 className="text-sm font-semibold">Queue and history</h3>
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
							>
								Clear Scheduled Queue
							</Button>
							<Button
								type="button"
								size="sm"
								variant="destructive"
								onClick={() => void handleClearHistory()}
								disabled={isMutating || isLoading || historyCount === 0}
							>
								Clear History
							</Button>
						</div>
					</div>
					<div className="max-w-full overflow-auto rounded-md border">
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
								{!hasQueueRows ? (
									<tr>
										<td
											colSpan={7}
											className="px-3 py-5 text-center text-muted-foreground"
										>
											No featured schedule entries yet.
										</td>
									</tr>
								) : (
									queueRows.map((row) => (
										<tr
											key={row.id}
											className={`border-t align-top ${stateRowClassName(row.state)}`}
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
												{row.queuePosition ? `#${row.queuePosition}` : "—"}
											</td>
											<td className="px-2.5 py-2.5 font-mono text-[11px] tabular-nums whitespace-nowrap">
												{row.requestedStartAtParis}
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
															disabled={
																row.status !== "scheduled" || isMutating
															}
															onClick={() =>
																void withMutation(() =>
																	rescheduleFeaturedEvent(
																		row.id,
																		rescheduleInputs[row.id] ??
																			row.requestedStartAtParisInput,
																		row.durationHours,
																	),
																)
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
															onClick={() =>
																void withMutation(() =>
																	cancelFeaturedSchedule(row.id),
																)
															}
														>
															Cancel
														</Button>
													</div>
												</div>
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				</section>
			</CardContent>
		</Card>
	);
};
