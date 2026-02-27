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
import {
	exportGenreSegmentCsv,
	getEventEngagementDashboard,
} from "@/features/events/engagement/actions";
import { MUSIC_GENRES, type MusicGenre } from "@/features/events/types";
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
	const [eventSearchTerm, setEventSearchTerm] = useState("");
	const [selectedGenre, setSelectedGenre] = useState<MusicGenre>("house");
	const [genreMinScore, setGenreMinScore] = useState("2");

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
		const needle = eventSearchTerm.trim().toLowerCase();
		if (!needle) return payload.rows;
		return payload.rows.filter((row) => {
			return (
				row.eventName.toLowerCase().includes(needle) ||
				row.eventKey.toLowerCase().includes(needle)
			);
		});
	}, [payload, eventSearchTerm]);

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

	const discovery = payload?.success
		? payload.discovery
		: {
				searchCount: 0,
				filterApplyCount: 0,
				filterClearCount: 0,
				uniqueSessionCount: 0,
				topSearches: [],
				topFilters: [],
			};

	const chartRows = useMemo(() => rows.slice(0, 8), [rows]);
	const maxChartClicks = Math.max(1, ...chartRows.map((row) => row.clickCount));

	const handleExportGenreCsv = useCallback(async () => {
		const minScore = Number.parseInt(genreMinScore, 10);
		const result = await exportGenreSegmentCsv({
			genre: selectedGenre,
			minScore: Number.isFinite(minScore) ? minScore : 2,
		});
		if (!result.success) {
			setErrorMessage(result.error);
			return;
		}
		const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download = result.filename;
		document.body.appendChild(anchor);
		anchor.click();
		document.body.removeChild(anchor);
		URL.revokeObjectURL(url);
	}, [genreMinScore, selectedGenre]);

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
							Event ROI, discovery behavior, and genre audience segmentation in
							one panel.
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
							Searches
						</p>
						<p className="mt-0.5 text-sm font-semibold tabular-nums">
							{discovery.searchCount}
						</p>
					</div>
					<div className="rounded-md border bg-background/60 px-2.5 py-2">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Filter Applies
						</p>
						<p className="mt-0.5 text-sm font-semibold tabular-nums">
							{discovery.filterApplyCount}
						</p>
					</div>
					<div className="rounded-md border bg-background/60 px-2.5 py-2">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Unique Discovery Sessions
						</p>
						<p className="mt-0.5 text-sm font-semibold tabular-nums">
							{discovery.uniqueSessionCount}
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

			<CardContent className="space-y-6">
				<section className="grid gap-4 xl:grid-cols-2">
					<div className="space-y-2 rounded-md border bg-background/55 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Event Trend Graph
						</p>
						{chartRows.length === 0 ? (
							<p className="text-xs text-muted-foreground">
								No event view data yet.
							</p>
						) : (
							<div className="space-y-2">
								{chartRows.map((row) => (
									<div key={row.eventKey}>
										<div className="mb-1 flex items-center justify-between gap-2">
											<p className="truncate text-xs font-medium">
												{row.eventName}
											</p>
											<p className="text-xs tabular-nums">{row.clickCount}</p>
										</div>
										<div className="h-2 w-full rounded-full bg-muted/70">
											<div
												className="h-2 rounded-full bg-amber-600/85"
												style={{
													width: `${Math.max(
														6,
														Math.round((row.clickCount / maxChartClicks) * 100),
													)}%`,
												}}
											/>
										</div>
									</div>
								))}
							</div>
						)}
					</div>

					<div className="space-y-3 rounded-md border bg-background/55 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Segmented CSV Export
						</p>
						<div className="grid gap-2 sm:grid-cols-3">
							<select
								className="h-9 rounded-md border border-border bg-background px-2 text-xs"
								value={selectedGenre}
								onChange={(event) =>
									setSelectedGenre(event.target.value as MusicGenre)
								}
							>
								{MUSIC_GENRES.map((genre) => (
									<option key={genre.key} value={genre.key}>
										{genre.label}
									</option>
								))}
							</select>
							<input
								type="number"
								min={1}
								max={100}
								className="h-9 rounded-md border border-border bg-background px-2 text-xs"
								value={genreMinScore}
								onChange={(event) => setGenreMinScore(event.target.value)}
								placeholder="Min score"
							/>
							<Button
								type="button"
								size="sm"
								onClick={() => void handleExportGenreCsv()}
							>
								Export Genre CSV
							</Button>
						</div>
						<p className="text-xs text-muted-foreground">
							Exports tracked users with genre preference scores.
						</p>
						<div className="flex flex-wrap gap-2">
							{payload?.success && payload.topGenres.length > 0 ? (
								payload.topGenres.map((genre) => (
									<Badge key={genre.genre} variant="outline">
										{genre.label}: {genre.uniqueUsers} users
									</Badge>
								))
							) : (
								<p className="text-xs text-muted-foreground">
									No genre preference data yet.
								</p>
							)}
						</div>
					</div>
				</section>

				<section className="grid gap-4 xl:grid-cols-2">
					<div className="space-y-2 rounded-md border bg-background/55 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Top Search Queries
						</p>
						<div className="space-y-1 text-xs">
							{payload?.success && payload.discovery.topSearches.length > 0 ? (
								payload.discovery.topSearches.map((row) => (
									<div
										key={row.query}
										className="flex items-center justify-between rounded border bg-background/70 px-2 py-1"
									>
										<span className="truncate">{row.query}</span>
										<span className="tabular-nums">{row.count}</span>
									</div>
								))
							) : (
								<p className="text-muted-foreground">No search data yet.</p>
							)}
						</div>
					</div>
					<div className="space-y-2 rounded-md border bg-background/55 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Top Filter Uses
						</p>
						<div className="space-y-1 text-xs">
							{payload?.success && payload.discovery.topFilters.length > 0 ? (
								payload.discovery.topFilters.map((row) => (
									<div
										key={`${row.filterGroup}-${row.filterValue}`}
										className="flex items-center justify-between rounded border bg-background/70 px-2 py-1"
									>
										<span className="truncate">
											{row.filterGroup}: {row.filterValue}
										</span>
										<span className="tabular-nums">{row.count}</span>
									</div>
								))
							) : (
								<p className="text-muted-foreground">No filter data yet.</p>
							)}
						</div>
					</div>
				</section>

				<section>
					<div className="mb-2 flex flex-wrap items-center justify-between gap-2">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Event Performance Table
						</p>
						<input
							type="text"
							placeholder="Search event name or key"
							value={eventSearchTerm}
							onChange={(event) => setEventSearchTerm(event.target.value)}
							className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs sm:max-w-[280px]"
						/>
					</div>
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
											<td className="px-3 py-2.5 font-medium">
												{row.eventName}
											</td>
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
				</section>
			</CardContent>
		</Card>
	);
};
