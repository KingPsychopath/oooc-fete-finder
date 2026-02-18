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
	clearFeaturedQueueHistory,
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

	const handleClearQueueHistory = useCallback(async () => {
		const confirmed = window.confirm(
			"Clear all featured queue and history entries? This cannot be undone.",
		);
		if (!confirmed) return;
		await withMutation(() => clearFeaturedQueueHistory());
	}, [withMutation]);

	const activeCount = payload?.activeCount ?? 0;
	const maxConcurrent = payload?.slotConfig?.maxConcurrent ?? 3;
	const queueRows = payload?.queue ?? [];
	const scheduleTimezone = payload?.slotConfig?.timezone || "Europe/Paris";
	const formatCellWithTimezone = (value: string): string =>
		value === "—" ? value : `${value} (${scheduleTimezone})`;

	return (
		<Card className="ooo-admin-card-soft min-w-0 overflow-hidden">
			<CardHeader className="space-y-3">
				<CardTitle>Featured Events Manager</CardTitle>
				<CardDescription>
					Dedicated scheduler for featured slots. Legacy sheet `Featured` values
					are no longer used.
				</CardDescription>
				<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
					<Badge variant="outline">
						Slots: {activeCount}/{maxConcurrent} active
					</Badge>
					<Badge variant="outline">Timezone: {scheduleTimezone}</Badge>
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
			</CardHeader>
			<CardContent className="space-y-5">
				<section className="space-y-4 rounded-lg border border-border/60 bg-background/40 p-4">
					<div className="space-y-1">
						<h3 className="text-sm font-semibold">Plan a featured slot</h3>
						<p className="text-xs text-muted-foreground">
							Select an event, then feature immediately or schedule in{" "}
							{scheduleTimezone}.
						</p>
					</div>
					<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
						<div className="space-y-2 xl:col-span-2">
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
											className={`flex w-full items-center justify-between rounded-md border px-2 py-2 text-left text-xs ${
												event.eventKey === selectedEventKey
													? "border-foreground/40 bg-accent"
													: "border-border bg-background hover:bg-accent/50"
											}`}
											onClick={() => {
												setSelectedEventKey(event.eventKey);
												setEventQuery(event.name);
											}}
										>
											<span className="truncate pr-2">{event.name}</span>
											<span className="shrink-0 text-[10px] text-muted-foreground">
												{event.eventKey}
											</span>
										</button>
									))
								) : (
									<p className="text-[11px] text-muted-foreground">
										No matching events found.
									</p>
								)}
							</div>
							{selectedEvent ? (
								<div className="flex items-center gap-2">
									<Badge variant="outline" className="max-w-full truncate">
										Selected: {selectedEvent.name}
									</Badge>
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
						<div className="space-y-2">
							<Label htmlFor="featured-schedule-at">
								Schedule at ({scheduleTimezone})
							</Label>
							<Input
								id="featured-schedule-at"
								type="datetime-local"
								value={scheduleAt}
								onChange={(event) => setScheduleAt(event.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="featured-duration-hours">Duration (hours)</Label>
							<Input
								id="featured-duration-hours"
								type="number"
								min={1}
								max={168}
								value={durationHours}
								onChange={(event) => setDurationHours(event.target.value)}
							/>
						</div>
						<div className="flex flex-col justify-end gap-2">
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

				<section className="space-y-2">
					<div className="flex items-center justify-between">
						<h3 className="text-sm font-semibold">Queue and history</h3>
						<div className="flex items-center gap-2">
							<p className="text-xs text-muted-foreground">
								All timestamps shown in {scheduleTimezone}
							</p>
							<Button
								type="button"
								size="sm"
								variant="destructive"
								onClick={() => void handleClearQueueHistory()}
								disabled={isMutating || isLoading || queueRows.length === 0}
							>
								Clear queue/history
							</Button>
						</div>
					</div>
					<div className="max-w-full overflow-auto rounded-md border">
						<table className="w-full text-sm">
							<thead className="bg-muted/40">
								<tr>
									<th className="px-2 py-2 text-left font-medium">Event</th>
									<th className="px-2 py-2 text-left font-medium">State</th>
									<th className="px-2 py-2 text-left font-medium">Queue</th>
									<th className="px-2 py-2 text-left font-medium">
										Requested ({scheduleTimezone})
									</th>
									<th className="px-2 py-2 text-left font-medium">
										Effective ({scheduleTimezone})
									</th>
									<th className="px-2 py-2 text-left font-medium">
										Ends ({scheduleTimezone})
									</th>
									<th className="px-2 py-2 text-left font-medium">Actions</th>
								</tr>
							</thead>
							<tbody>
								{queueRows.length === 0 ? (
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
										<tr key={row.id} className="border-t align-top">
											<td className="px-2 py-3">
												<div className="font-medium">{row.eventName}</div>
												<div className="font-mono text-[11px] text-muted-foreground">
													{row.eventKey}
												</div>
											</td>
											<td className="px-2 py-3">
												<Badge variant={stateBadgeVariant(row.state)}>
													{toStateLabel(row.state)}
												</Badge>
											</td>
											<td className="px-2 py-3 font-mono">
												{row.queuePosition ? `#${row.queuePosition}` : "—"}
											</td>
											<td className="px-2 py-3">
												{formatCellWithTimezone(row.requestedStartAtParis)}
											</td>
											<td className="px-2 py-3">
												{formatCellWithTimezone(row.effectiveStartAtParis)}
											</td>
											<td className="px-2 py-3">
												{formatCellWithTimezone(row.effectiveEndAtParis)}
											</td>
											<td className="px-2 py-3">
												<div className="flex min-w-[220px] flex-col gap-2">
													<p className="text-[11px] text-muted-foreground">
														Reschedule ({scheduleTimezone})
													</p>
													<Input
														type="datetime-local"
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
													<div className="flex gap-2">
														<Button
															type="button"
															size="sm"
															variant="outline"
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
