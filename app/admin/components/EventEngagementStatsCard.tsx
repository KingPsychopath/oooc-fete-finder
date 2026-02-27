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
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	exportAudienceSegmentCsv,
	getEventEngagementDashboard,
} from "@/features/events/engagement/actions";
import { MUSIC_GENRES, type MusicGenre } from "@/features/events/types";
import { CircleHelp } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type EventEngagementPayload = Awaited<
	ReturnType<typeof getEventEngagementDashboard>
>;

type DiscoveryFilterGroup =
	| "date_range"
	| "day_night"
	| "arrondissement"
	| "genre"
	| "nationality"
	| "venue_type"
	| "venue_setting"
	| "oooc_pick"
	| "price_range"
	| "age_range";

type SegmentFilterRule = {
	filterGroup: DiscoveryFilterGroup;
	filterValue: string;
};

type SegmentGenreRule = {
	genre: MusicGenre;
	minScore: number;
};

const WINDOW_OPTIONS = [7, 30, 90] as const;

const FILTER_GROUP_OPTIONS: Array<{
	value: DiscoveryFilterGroup;
	label: string;
}> = [
	{ value: "genre", label: "Genre" },
	{ value: "arrondissement", label: "Arrondissement" },
	{ value: "day_night", label: "Day / Night" },
	{ value: "nationality", label: "Nationality" },
	{ value: "venue_type", label: "Venue Type" },
	{ value: "venue_setting", label: "Venue Setting" },
	{ value: "oooc_pick", label: "OOOC Pick" },
	{ value: "price_range", label: "Price Range" },
	{ value: "age_range", label: "Age Range" },
	{ value: "date_range", label: "Date Range" },
];

const FILTER_VALUE_PLACEHOLDER: Record<DiscoveryFilterGroup, string> = {
	date_range: "2026-06-21:2026-06-21",
	day_night: "day or night",
	arrondissement: "11",
	genre: "house",
	nationality: "FR",
	venue_type: "indoor or outdoor",
	venue_setting: "indoor or outdoor",
	oooc_pick: "yes or no",
	price_range: "0:40",
	age_range: "21:25",
};

const formatPercent = (value: number): string => `${value.toFixed(1)}%`;

const normalizeRuleKey = (rule: SegmentFilterRule): string =>
	`${rule.filterGroup}:${rule.filterValue.trim().toLowerCase()}`;

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
	const [isExporting, setIsExporting] = useState(false);
	const [errorMessage, setErrorMessage] = useState("");
	const [segmentMessage, setSegmentMessage] = useState("");
	const [eventSearchTerm, setEventSearchTerm] = useState("");

	const [ruleGroup, setRuleGroup] = useState<DiscoveryFilterGroup>("genre");
	const [ruleValue, setRuleValue] = useState("");
	const [ruleOperator, setRuleOperator] = useState<"all" | "any">("all");
	const [filterRules, setFilterRules] = useState<SegmentFilterRule[]>([]);

	const [genreRuleGenre, setGenreRuleGenre] = useState<MusicGenre>("house");
	const [genreRuleMinScore, setGenreRuleMinScore] = useState("2");
	const [genreRules, setGenreRules] = useState<SegmentGenreRule[]>([]);

	const [searchContains, setSearchContains] = useState("");
	const [segmentMinHits, setSegmentMinHits] = useState("1");
	const [segmentLimit, setSegmentLimit] = useState("5000");

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
				uniqueViewSessionCount: 0,
				uniqueOutboundSessionCount: 0,
				uniqueCalendarSessionCount: 0,
				outboundSessionRate: 0,
				calendarSessionRate: 0,
				outboundInteractionRate: 0,
				calendarInteractionRate: 0,
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

	const addFilterRule = useCallback(() => {
		const value = ruleValue.trim().toLowerCase();
		if (!value) {
			setErrorMessage("Add a filter value before creating the rule");
			return;
		}
		setErrorMessage("");
		setFilterRules((current) => {
			const nextRule: SegmentFilterRule = {
				filterGroup: ruleGroup,
				filterValue: value,
			};
			const nextKey = normalizeRuleKey(nextRule);
			if (current.some((rule) => normalizeRuleKey(rule) === nextKey)) {
				return current;
			}
			return [...current, nextRule];
		});
		setRuleValue("");
	}, [ruleGroup, ruleValue]);

	const addTopFilterRule = useCallback((rule: SegmentFilterRule) => {
		setFilterRules((current) => {
			const nextKey = normalizeRuleKey(rule);
			if (current.some((item) => normalizeRuleKey(item) === nextKey)) {
				return current;
			}
			return [...current, rule];
		});
	}, []);

	const removeFilterRule = useCallback((ruleToRemove: SegmentFilterRule) => {
		setFilterRules((current) =>
			current.filter(
				(rule) => normalizeRuleKey(rule) !== normalizeRuleKey(ruleToRemove),
			),
		);
	}, []);

	const addGenreRule = useCallback(() => {
		const parsedMinScore = Number.parseInt(genreRuleMinScore, 10);
		const minScore = Number.isFinite(parsedMinScore) ? parsedMinScore : 2;
		setGenreRules((current) => {
			const existing = current.some((rule) => rule.genre === genreRuleGenre);
			if (existing) {
				return current.map((rule) =>
					rule.genre === genreRuleGenre
						? {
								genre: genreRuleGenre,
								minScore: Math.max(1, Math.min(100, minScore)),
							}
						: rule,
				);
			}
			return [
				...current,
				{
					genre: genreRuleGenre,
					minScore: Math.max(1, Math.min(100, minScore)),
				},
			];
		});
	}, [genreRuleGenre, genreRuleMinScore]);

	const removeGenreRule = useCallback((genre: MusicGenre) => {
		setGenreRules((current) => current.filter((rule) => rule.genre !== genre));
	}, []);

	const handleExportSegmentCsv = useCallback(async () => {
		setIsExporting(true);
		setErrorMessage("");
		setSegmentMessage("");
		try {
			const minHits = Number.parseInt(segmentMinHits, 10);
			const limit = Number.parseInt(segmentLimit, 10);
			const result = await exportAudienceSegmentCsv({
				windowDays,
				minHitsPerRule: Number.isFinite(minHits) ? minHits : 1,
				limit: Number.isFinite(limit) ? limit : 5000,
				ruleOperator,
				filterRules,
				searchContains,
				genreRules,
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
			setSegmentMessage(`Exported ${result.count} audience rows`);
		} finally {
			setIsExporting(false);
		}
	}, [
		filterRules,
		genreRules,
		ruleOperator,
		searchContains,
		segmentLimit,
		segmentMinHits,
		windowDays,
	]);

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
							Event ROI, discovery behavior, and audience segmentation in one
							panel.
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
				<div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
					<div className="rounded-md border bg-background/60 px-2.5 py-2">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Outbound CVR
						</p>
						<p className="mt-0.5 text-sm font-semibold tabular-nums">
							{formatPercent(summary.outboundSessionRate)}
						</p>
					</div>
					<div className="rounded-md border bg-background/60 px-2.5 py-2">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Calendar CVR
						</p>
						<p className="mt-0.5 text-sm font-semibold tabular-nums">
							{formatPercent(summary.calendarSessionRate)}
						</p>
					</div>
					<div className="rounded-md border bg-background/60 px-2.5 py-2">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Outbound Interaction
						</p>
						<p className="mt-0.5 text-sm font-semibold tabular-nums">
							{formatPercent(summary.outboundInteractionRate)}
						</p>
					</div>
					<div className="rounded-md border bg-background/60 px-2.5 py-2">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Calendar Interaction
						</p>
						<p className="mt-0.5 text-sm font-semibold tabular-nums">
							{formatPercent(summary.calendarInteractionRate)}
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
				{segmentMessage ? (
					<div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
						{segmentMessage}
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
						<div className="flex flex-wrap items-center gap-2">
							<p className="text-xs text-muted-foreground">Rule mode</p>
							<Button
								type="button"
								size="sm"
								variant={ruleOperator === "all" ? "default" : "outline"}
								onClick={() => setRuleOperator("all")}
							>
								AND
							</Button>
							<Button
								type="button"
								size="sm"
								variant={ruleOperator === "any" ? "default" : "outline"}
								onClick={() => setRuleOperator("any")}
							>
								OR
							</Button>
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger
										render={
											<button
												type="button"
												className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-accent"
												aria-label="Rule mode help"
											/>
										}
									>
										<CircleHelp className="h-3.5 w-3.5" />
									</TooltipTrigger>
									<TooltipContent>
										<p className="max-w-[220px] text-xs">
											Use AND to require every rule. Use OR to include users who
											matched at least one rule.
										</p>
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						</div>
						<div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
							<select
								className="h-9 rounded-md border border-border bg-background px-2 text-xs"
								value={ruleGroup}
								onChange={(event) =>
									setRuleGroup(event.target.value as DiscoveryFilterGroup)
								}
							>
								{FILTER_GROUP_OPTIONS.map((option) => (
									<option key={option.value} value={option.value}>
										{option.label}
									</option>
								))}
							</select>
							<input
								type="text"
								className="h-9 rounded-md border border-border bg-background px-2 text-xs"
								value={ruleValue}
								onChange={(event) => setRuleValue(event.target.value)}
								placeholder={FILTER_VALUE_PLACEHOLDER[ruleGroup]}
							/>
							<Button type="button" size="sm" onClick={addFilterRule}>
								Add Rule
							</Button>
						</div>
						<div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
							<input
								type="text"
								className="h-9 rounded-md border border-border bg-background px-2 text-xs"
								value={searchContains}
								onChange={(event) => setSearchContains(event.target.value)}
								placeholder="Search contains (optional)"
							/>
							<input
								type="number"
								min={1}
								max={30}
								className="h-9 rounded-md border border-border bg-background px-2 text-xs"
								value={segmentMinHits}
								onChange={(event) => setSegmentMinHits(event.target.value)}
								placeholder="Min hits"
							/>
							<input
								type="number"
								min={1}
								max={10000}
								className="h-9 rounded-md border border-border bg-background px-2 text-xs"
								value={segmentLimit}
								onChange={(event) => setSegmentLimit(event.target.value)}
								placeholder="Limit"
							/>
						</div>

						<div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
							<select
								className="h-9 rounded-md border border-border bg-background px-2 text-xs"
								value={genreRuleGenre}
								onChange={(event) =>
									setGenreRuleGenre(event.target.value as MusicGenre)
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
								value={genreRuleMinScore}
								onChange={(event) => setGenreRuleMinScore(event.target.value)}
								placeholder="Genre score >="
							/>
							<Button
								type="button"
								size="sm"
								variant="outline"
								onClick={addGenreRule}
							>
								Add Genre Rule
							</Button>
						</div>

						<div className="flex flex-wrap gap-1.5">
							{filterRules.length > 0 ? (
								filterRules.map((rule) => (
									<Badge
										key={normalizeRuleKey(rule)}
										variant="outline"
										className="gap-1"
									>
										{rule.filterGroup}: {rule.filterValue}
										<button
											type="button"
											onClick={() => removeFilterRule(rule)}
											className="ml-1 text-[10px]"
										>
											x
										</button>
									</Badge>
								))
							) : (
								<p className="text-xs text-muted-foreground">
									No filter rules added yet.
								</p>
							)}
						</div>
						<div className="flex flex-wrap gap-1.5">
							{genreRules.length > 0
								? genreRules.map((rule) => (
										<Badge key={rule.genre} variant="outline" className="gap-1">
											Genre pref: {rule.genre} (score {"\u003e="}{" "}
											{rule.minScore})
											<button
												type="button"
												onClick={() => removeGenreRule(rule.genre)}
												className="ml-1 text-[10px]"
											>
												x
											</button>
										</Badge>
									))
								: null}
						</div>

						<div className="flex flex-wrap gap-2">
							<Button
								type="button"
								size="sm"
								onClick={() => void handleExportSegmentCsv()}
								disabled={isExporting}
							>
								{isExporting ? "Exporting..." : "Export Custom Segment CSV"}
							</Button>
						</div>
						<p className="text-xs text-muted-foreground">
							{ruleOperator === "all"
								? "AND mode: users must match every selected rule."
								: "OR mode: users can match any selected rule."}
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

						{payload?.success && payload.discovery.topFilters.length > 0 ? (
							<div className="space-y-1">
								<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
									Quick Add From Top Filters
								</p>
								<div className="flex flex-wrap gap-1.5">
									{payload.discovery.topFilters.slice(0, 8).map((rule) => {
										const isKnownGroup = FILTER_GROUP_OPTIONS.some(
											(option) => option.value === rule.filterGroup,
										);
										if (!isKnownGroup) return null;
										return (
											<button
												key={`${rule.filterGroup}-${rule.filterValue}`}
												type="button"
												onClick={() =>
													addTopFilterRule({
														filterGroup:
															rule.filterGroup as DiscoveryFilterGroup,
														filterValue: rule.filterValue,
													})
												}
												className="rounded-full border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent"
											>
												+ {rule.filterGroup}:{rule.filterValue}
											</button>
										);
									})}
								</div>
							</div>
						) : null}
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
						<table className="min-w-[1280px] w-full text-xs">
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
										View Sessions
									</th>
									<th className="px-3 py-2 text-left font-medium">
										Outbound Sessions
									</th>
									<th className="px-3 py-2 text-left font-medium">
										Calendar Sessions
									</th>
									<th className="px-3 py-2 text-left font-medium">
										Outbound CVR
									</th>
									<th className="px-3 py-2 text-left font-medium">
										Calendar CVR
									</th>
									<th className="px-3 py-2 text-left font-medium">
										Outbound Interaction
									</th>
									<th className="px-3 py-2 text-left font-medium">
										Calendar Interaction
									</th>
								</tr>
							</thead>
							<tbody>
								{rows.length === 0 ? (
									<tr>
										<td
											colSpan={13}
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
												{row.uniqueViewSessionCount}
											</td>
											<td className="px-3 py-2.5 tabular-nums">
												{row.uniqueOutboundSessionCount}
											</td>
											<td className="px-3 py-2.5 tabular-nums">
												{row.uniqueCalendarSessionCount}
											</td>
											<td className="px-3 py-2.5 tabular-nums">
												{formatPercent(row.outboundSessionRate)}
											</td>
											<td className="px-3 py-2.5 tabular-nums">
												{formatPercent(row.calendarSessionRate)}
											</td>
											<td className="px-3 py-2.5 tabular-nums">
												{formatPercent(row.outboundInteractionRate)}
											</td>
											<td className="px-3 py-2.5 tabular-nums">
												{formatPercent(row.calendarInteractionRate)}
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
