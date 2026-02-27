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
import { getEventEngagementDashboard } from "@/features/events/engagement/actions";
import { useCallback, useEffect, useMemo, useState } from "react";

type EventEngagementPayload = Awaited<
	ReturnType<typeof getEventEngagementDashboard>
>;

const WINDOW_OPTIONS = [7, 30, 90] as const;

const formatPercent = (value: number): string => `${value.toFixed(1)}%`;

export const EventEngagementStatsCard = ({
	initialPayload,
}: {
	initialPayload?: EventEngagementPayload;
}) => {
	const [windowDays, setWindowDays] = useState<number>(
		initialPayload && initialPayload.success ? initialPayload.windowDays : 30,
	);
	const [payload, setPayload] = useState<EventEngagementPayload | null>(
		initialPayload ?? null,
	);
	const [isLoading, setIsLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState("");

	const loadStats = useCallback(async (days: number) => {
		setIsLoading(true);
		setErrorMessage("");
		try {
			const result = await getEventEngagementDashboard(days);
			setPayload(result);
			if (!result.success) {
				setErrorMessage(
					result.error || "Failed to load event engagement stats",
				);
			}
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		if (initialPayload?.success) {
			return;
		}
		void loadStats(windowDays);
	}, [initialPayload?.success, loadStats, windowDays]);

	const rows = useMemo(() => {
		if (!payload?.success) return [];
		return payload.rows;
	}, [payload]);

	const summary = payload?.success
		? payload.summary
		: {
				clickCount: 0,
				outboundClickCount: 0,
				calendarSyncCount: 0,
				uniqueSessionCount: 0,
				outboundRate: 0,
				calendarRate: 0,
			};

	return (
		<Card className="ooo-admin-card-soft min-w-0 overflow-hidden">
			<CardHeader className="space-y-4">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="space-y-1">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Data + Proof
						</p>
						<CardTitle>Event Engagement Stats</CardTitle>
						<CardDescription>
							First-party click, outbound, and calendar-sync tracking to support
							partner ROI reporting.
						</CardDescription>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						{WINDOW_OPTIONS.map((days) => (
							<Button
								key={days}
								type="button"
								size="sm"
								variant={windowDays === days ? "default" : "outline"}
								onClick={() => {
									setWindowDays(days);
									void loadStats(days);
								}}
								disabled={isLoading}
							>
								{days}d
							</Button>
						))}
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={() => void loadStats(windowDays)}
							disabled={isLoading}
						>
							{isLoading ? "Refreshing..." : "Refresh"}
						</Button>
					</div>
				</div>
				<div className="grid grid-cols-2 gap-2 lg:grid-cols-6">
					<div className="rounded-md border bg-background/60 px-2.5 py-2">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Views
						</p>
						<p className="mt-0.5 text-sm font-semibold tabular-nums">
							{summary.clickCount}
						</p>
					</div>
					<div className="rounded-md border bg-background/60 px-2.5 py-2">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Outbound
						</p>
						<p className="mt-0.5 text-sm font-semibold tabular-nums">
							{summary.outboundClickCount}
						</p>
					</div>
					<div className="rounded-md border bg-background/60 px-2.5 py-2">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Calendar
						</p>
						<p className="mt-0.5 text-sm font-semibold tabular-nums">
							{summary.calendarSyncCount}
						</p>
					</div>
					<div className="rounded-md border bg-background/60 px-2.5 py-2">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Unique Sessions
						</p>
						<p className="mt-0.5 text-sm font-semibold tabular-nums">
							{summary.uniqueSessionCount}
						</p>
					</div>
					<div className="rounded-md border bg-background/60 px-2.5 py-2">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Outbound Rate
						</p>
						<p className="mt-0.5 text-sm font-semibold tabular-nums">
							{formatPercent(summary.outboundRate)}
						</p>
					</div>
					<div className="rounded-md border bg-background/60 px-2.5 py-2">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Calendar Rate
						</p>
						<p className="mt-0.5 text-sm font-semibold tabular-nums">
							{formatPercent(summary.calendarRate)}
						</p>
					</div>
				</div>
				{payload?.success ? (
					<div className="text-xs text-muted-foreground">
						Window:{" "}
						<Badge variant="outline" className="ml-1">
							{new Date(payload.range.startAt).toLocaleString()} -{" "}
							{new Date(payload.range.endAt).toLocaleString()}
						</Badge>
					</div>
				) : null}
				{errorMessage ? (
					<div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
						{errorMessage}
					</div>
				) : null}
			</CardHeader>
			<CardContent>
				<div className="max-w-full overflow-auto rounded-md border">
					<table className="min-w-[920px] w-full text-xs">
						<thead className="bg-muted/40">
							<tr>
								<th className="px-3 py-2 text-left font-medium">Event</th>
								<th className="px-3 py-2 text-left font-medium">Event Key</th>
								<th className="px-3 py-2 text-left font-medium">Views</th>
								<th className="px-3 py-2 text-left font-medium">Outbound</th>
								<th className="px-3 py-2 text-left font-medium">Calendar</th>
								<th className="px-3 py-2 text-left font-medium">
									Unique Sessions
								</th>
								<th className="px-3 py-2 text-left font-medium">
									Outbound Rate
								</th>
								<th className="px-3 py-2 text-left font-medium">
									Calendar Rate
								</th>
							</tr>
						</thead>
						<tbody>
							{rows.length === 0 ? (
								<tr>
									<td
										colSpan={8}
										className="px-3 py-6 text-center text-muted-foreground"
									>
										No tracked engagement events in this window.
									</td>
								</tr>
							) : (
								rows.map((row) => (
									<tr key={row.eventKey} className="border-t">
										<td className="px-3 py-2.5 font-medium">{row.eventName}</td>
										<td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground">
											{row.eventKey}
										</td>
										<td className="px-3 py-2.5 tabular-nums">
											{row.clickCount}
										</td>
										<td className="px-3 py-2.5 tabular-nums">
											{row.outboundClickCount}
										</td>
										<td className="px-3 py-2.5 tabular-nums">
											{row.calendarSyncCount}
										</td>
										<td className="px-3 py-2.5 tabular-nums">
											{row.uniqueSessionCount}
										</td>
										<td className="px-3 py-2.5 tabular-nums">
											{formatPercent(row.outboundRate)}
										</td>
										<td className="px-3 py-2.5 tabular-nums">
											{formatPercent(row.calendarRate)}
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
