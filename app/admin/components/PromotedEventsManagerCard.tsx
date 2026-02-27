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
	cancelPromotedSchedule,
	clearPromotedHistory,
	clearPromotedQueue,
	listPromotedQueue,
	reschedulePromotedEvent,
	schedulePromotedEvent,
} from "@/features/events/promoted/actions";
import { useCallback, useEffect, useMemo, useState } from "react";

type PromotedQueuePayload = Awaited<ReturnType<typeof listPromotedQueue>>;

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

export const PromotedEventsManagerCard = ({
	initialPayload,
	onScheduleUpdated,
}: {
	initialPayload?: PromotedQueuePayload;
	onScheduleUpdated?: () => Promise<void> | void;
}) => {
	const [payload, setPayload] = useState<PromotedQueuePayload | null>(
		initialPayload ?? null,
	);
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
			const result = await listPromotedQueue();
			setPayload(result);
			if (!result.success) {
				setErrorMessage(result.error || "Failed to load promoted queue");
			}
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		if (initialPayload?.success) return;
		void loadQueue();
	}, [initialPayload?.success, loadQueue]);

	const matchedEvents = useMemo(() => {
		if (!payload?.events) return [];
		const needle = eventQuery.trim().toLowerCase();
		if (!needle) return payload.events.slice(0, 10);
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

	const queueRows = payload?.queue ?? [];
	const scheduleTimezone = payload?.slotConfig?.timezone || "Europe/Paris";
	const timezoneDisplayLabel = `${scheduleTimezone} (CET / GMT+1)`;
	const activeCount = payload?.activeCount ?? 0;
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
						: "Unknown promoted mutation error",
				);
			} finally {
				setIsMutating(false);
			}
		},
		[loadQueue, onScheduleUpdated],
	);

	const handlePromoteNow = useCallback(async () => {
		if (!selectedEventKey) {
			setErrorMessage("Select an event first");
			return;
		}
		await withMutation(() =>
			schedulePromotedEvent(
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
			schedulePromotedEvent(
				selectedEventKey,
				scheduleAt,
				Number.parseInt(durationHours, 10),
			),
		);
	}, [durationHours, scheduleAt, selectedEventKey, withMutation]);

	return (
		<Card className="ooo-admin-card-soft min-w-0 overflow-hidden">
			<CardHeader className="space-y-4">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="space-y-1">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Promoted Scheduling
						</p>
						<CardTitle>Promoted Listings Manager</CardTitle>
						<CardDescription>
							Manual controls for promoted windows. Paid order fulfillment
							happens in Paid Orders Inbox.
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
							Active
						</p>
						<p className="mt-0.5 text-sm font-semibold tabular-nums">
							{activeCount}
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
						<h3 className="text-sm font-semibold">Plan a promoted listing</h3>
					</div>
					<div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,280px)]">
						<div className="space-y-2">
							<Label htmlFor="promoted-event-filter">Find event</Label>
							<Input
								id="promoted-event-filter"
								placeholder="Search by event name or key"
								value={eventQuery}
								onChange={(event) => setEventQuery(event.target.value)}
							/>
							<div className="space-y-1">
								{suggestedEvents.map((event) => (
									<button
										key={event.eventKey}
										type="button"
										className={`w-full rounded-md border px-3 py-2 text-left text-xs transition-colors ${
											event.eventKey === selectedEventKey
												? "border-foreground/40 bg-accent"
												: "border-border bg-background hover:bg-accent/60"
										}`}
										onClick={() => setSelectedEventKey(event.eventKey)}
									>
										<p className="font-medium">{event.name}</p>
										<p className="text-muted-foreground">{event.eventKey}</p>
									</button>
								))}
							</div>
						</div>
						<div className="space-y-3 rounded-md border bg-background/60 p-3">
							<div>
								<Label htmlFor="promoted-schedule-at">Schedule at</Label>
								<Input
									id="promoted-schedule-at"
									type="datetime-local"
									value={scheduleAt}
									onChange={(event) => setScheduleAt(event.target.value)}
								/>
							</div>
							<div>
								<Label htmlFor="promoted-duration-hours">
									Duration (hours)
								</Label>
								<Input
									id="promoted-duration-hours"
									type="number"
									min={1}
									max={168}
									value={durationHours}
									onChange={(event) => setDurationHours(event.target.value)}
								/>
							</div>
							<div className="flex flex-wrap gap-2">
								<Button
									type="button"
									size="sm"
									onClick={() => void handlePromoteNow()}
									disabled={isMutating || !selectedEventKey}
								>
									Promote now
								</Button>
								<Button
									type="button"
									size="sm"
									variant="outline"
									onClick={() => void handleSchedule()}
									disabled={isMutating || !selectedEventKey}
								>
									Schedule
								</Button>
							</div>
							{selectedEvent ? (
								<p className="text-xs text-muted-foreground">
									Selected: {selectedEvent.name}
								</p>
							) : null}
						</div>
					</div>
				</section>

				<div className="flex flex-wrap items-center justify-between gap-2">
					<div className="text-xs text-muted-foreground">
						History entries: {historyCount}
					</div>
					<div className="flex flex-wrap gap-2">
						<Button
							size="sm"
							variant="outline"
							onClick={() => void withMutation(() => clearPromotedQueue())}
							disabled={isMutating}
						>
							Clear Scheduled Queue
						</Button>
						<Button
							size="sm"
							variant="outline"
							onClick={() => void withMutation(() => clearPromotedHistory())}
							disabled={isMutating}
						>
							Clear History
						</Button>
					</div>
				</div>

				{statusMessage ? (
					<div className="rounded-md border border-emerald-300/70 bg-emerald-50/80 px-3 py-2 text-sm text-emerald-800">
						{statusMessage}
					</div>
				) : null}
				{errorMessage ? (
					<div className="rounded-md border border-rose-300/70 bg-rose-50/80 px-3 py-2 text-sm text-rose-800">
						{errorMessage}
					</div>
				) : null}

				<div className="overflow-x-auto rounded-md border">
					<table className="w-full min-w-[860px] text-left text-sm">
						<thead className="bg-background/70 text-xs uppercase tracking-[0.12em] text-muted-foreground">
							<tr>
								<th className="px-3 py-2">Event</th>
								<th className="px-3 py-2">State</th>
								<th className="px-3 py-2">Start (Paris)</th>
								<th className="px-3 py-2">End (Paris)</th>
								<th className="px-3 py-2">Duration</th>
								<th className="px-3 py-2">Actions</th>
							</tr>
						</thead>
						<tbody>
							{queueRows.length === 0 ? (
								<tr>
									<td
										colSpan={6}
										className="px-3 py-6 text-center text-sm text-muted-foreground"
									>
										No promoted schedule entries yet.
									</td>
								</tr>
							) : (
								queueRows.map((row) => (
									<tr key={row.id} className="border-t align-top">
										<td className="px-3 py-2">
											<p className="font-medium">{row.eventName}</p>
											<p className="text-xs text-muted-foreground">
												{row.eventKey}
											</p>
										</td>
										<td className="px-3 py-2">
											<Badge variant={stateBadgeVariant(row.state)}>
												{toStateLabel(row.state)}
											</Badge>
										</td>
										<td className="px-3 py-2 text-xs">
											{row.effectiveStartAtParis}
										</td>
										<td className="px-3 py-2 text-xs">
											{row.effectiveEndAtParis}
										</td>
										<td className="px-3 py-2 text-xs">{row.durationHours}h</td>
										<td className="px-3 py-2">
											<div className="flex flex-wrap gap-1.5">
												<Input
													type="datetime-local"
													className="h-8 w-[184px]"
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
												/>
												<Button
													size="sm"
													variant="outline"
													disabled={isMutating}
													onClick={() =>
														void withMutation(() =>
															reschedulePromotedEvent(
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
													size="sm"
													variant="outline"
													disabled={isMutating}
													onClick={() =>
														void withMutation(() =>
															cancelPromotedSchedule(row.id),
														)
													}
												>
													Cancel
												</Button>
											</div>
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			</CardContent>
		</Card>
	);
};
