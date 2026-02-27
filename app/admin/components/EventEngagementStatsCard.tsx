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
import {
	parseEventFilterStateFromSearchParams,
	readStoredEventFilterState,
} from "@/features/events/filter-state-persistence";
import { PRICE_RANGE_CONFIG } from "@/features/events/types";
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
const EXPORT_WINDOW_OPTIONS = [7, 14, 30, 60, 90] as const;
const TABLE_ROW_LIMIT_OPTIONS = [10, 25, 50, 100] as const;
const SEARCH_CLUSTER_MODE_OPTIONS = ["conservative", "aggressive"] as const;

const METRIC_COLUMN_HELP: Array<{ label: string; description: string }> = [
	{
		label: "Event Key",
		description: "Stable internal ID used for event URLs and tracking joins.",
	},
	{
		label: "Views",
		description: "Total event detail opens.",
	},
	{
		label: "Outbound",
		description: "Total clicks on ticket/external partner links.",
	},
	{
		label: "Calendar",
		description: "Total calendar sync clicks.",
	},
	{
		label: "Unique Sessions",
		description: "Distinct sessions with any engagement for this event.",
	},
	{
		label: "View Sessions",
		description: "Distinct sessions that opened the event.",
	},
	{
		label: "Outbound Sessions",
		description: "Distinct sessions with at least one outbound click.",
	},
	{
		label: "Calendar Sessions",
		description: "Distinct sessions with at least one calendar sync.",
	},
	{
		label: "Outbound CVR",
		description: "Outbound Sessions divided by View Sessions.",
	},
	{
		label: "Calendar CVR",
		description: "Calendar Sessions divided by View Sessions.",
	},
	{
		label: "Outbound Interaction",
		description: "Outbound clicks divided by total views.",
	},
	{
		label: "Calendar Interaction",
		description: "Calendar syncs divided by total views.",
	},
];

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
	const [tableRowLimit, setTableRowLimit] = useState<number>(25);
	const [isPerformanceTableExpanded, setIsPerformanceTableExpanded] =
		useState(false);
	const [isEventColumnFrozen, setIsEventColumnFrozen] = useState(true);
	const [searchClusterMode, setSearchClusterMode] = useState<
		"conservative" | "aggressive"
	>(
		initialPayload && initialPayload.success
			? initialPayload.discovery.searchClusterMode
			: "conservative",
	);

	const [ruleGroup, setRuleGroup] = useState<DiscoveryFilterGroup>("genre");
	const [ruleValue, setRuleValue] = useState("");
	const [ruleOperator, setRuleOperator] = useState<"all" | "any">("all");
	const [filterRules, setFilterRules] = useState<SegmentFilterRule[]>([]);

	const [genreRuleGenre, setGenreRuleGenre] = useState<MusicGenre>("house");
	const [genreRuleMinScore, setGenreRuleMinScore] = useState("2");
	const [genreRules, setGenreRules] = useState<SegmentGenreRule[]>([]);

	const [segmentWindowDays, setSegmentWindowDays] = useState<number>(
		initialPayload && initialPayload.success ? initialPayload.windowDays : 30,
	);
	const [searchInput, setSearchInput] = useState("");
	const [searchRule, setSearchRule] = useState("");
	const [filterUrlInput, setFilterUrlInput] = useState("");
	const [segmentMinHits, setSegmentMinHits] = useState("1");
	const [segmentLimit, setSegmentLimit] = useState("5000");

	const loadStats = useCallback(
		async (days: number, clusterMode: "conservative" | "aggressive") => {
			setIsLoading(true);
			setErrorMessage("");
			try {
				const result = await getEventEngagementDashboard(days, clusterMode);
				setPayload(result);
				if (!result.success) {
					setErrorMessage(
						result.error || "Failed to load event engagement stats",
					);
				}
			} finally {
				setIsLoading(false);
			}
		},
		[],
	);

	useEffect(() => {
		if (initialPayload?.success) {
			return;
		}
		void loadStats(windowDays, searchClusterMode);
	}, [initialPayload?.success, loadStats, searchClusterMode, windowDays]);

	const filteredRows = useMemo(() => {
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

	const rows = useMemo(
		() => filteredRows.slice(0, tableRowLimit),
		[filteredRows, tableRowLimit],
	);
	const shouldClampPerformanceTable = rows.length > 8;

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
				searchClusterMode,
				searchCount: 0,
				filterApplyCount: 0,
				filterClearCount: 0,
				uniqueSessionCount: 0,
				topSearches: [],
				topFilters: [],
			};

	const chartRows = useMemo(() => filteredRows.slice(0, 8), [filteredRows]);
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

	const addSearchRule = useCallback(() => {
		const normalized = searchInput.trim().toLowerCase();
		if (normalized.length < 2) {
			setErrorMessage("Search rule should be at least 2 characters");
			return;
		}
		setErrorMessage("");
		setSearchRule(normalized);
		setSearchInput("");
	}, [searchInput]);

	const clearSearchRule = useCallback(() => {
		setSearchRule("");
		setSearchInput("");
	}, []);

	const applyFilterStateToSegmentBuilder = useCallback(
		(filterState: {
			selectedDateRange: { from: string | null; to: string | null };
			selectedDayNightPeriods: Array<"day" | "night">;
			selectedArrondissements: Array<number | "unknown">;
			selectedGenres: MusicGenre[];
			selectedNationalities: string[];
			selectedVenueTypes: Array<"indoor" | "outdoor">;
			selectedIndoorPreference: boolean | null;
			selectedPriceRange: [number, number];
			selectedAgeRange: [number, number] | null;
			selectedOOOCPicks: boolean;
			searchQuery: string;
		}) => {
			const importedRules: SegmentFilterRule[] = [];
			if (
				filterState.selectedDateRange.from != null ||
				filterState.selectedDateRange.to != null
			) {
				importedRules.push({
					filterGroup: "date_range",
					filterValue: `${filterState.selectedDateRange.from ?? "any"}:${filterState.selectedDateRange.to ?? "any"}`,
				});
			}
			for (const period of filterState.selectedDayNightPeriods) {
				importedRules.push({
					filterGroup: "day_night",
					filterValue: period,
				});
			}
			for (const arrondissement of filterState.selectedArrondissements) {
				importedRules.push({
					filterGroup: "arrondissement",
					filterValue: String(arrondissement),
				});
			}
			for (const genre of filterState.selectedGenres) {
				importedRules.push({
					filterGroup: "genre",
					filterValue: genre,
				});
			}
			for (const nationality of filterState.selectedNationalities) {
				importedRules.push({
					filterGroup: "nationality",
					filterValue: nationality.toLowerCase(),
				});
			}
			for (const venueType of filterState.selectedVenueTypes) {
				importedRules.push({
					filterGroup: "venue_type",
					filterValue: venueType,
				});
			}
			if (filterState.selectedIndoorPreference != null) {
				importedRules.push({
					filterGroup: "venue_setting",
					filterValue: filterState.selectedIndoorPreference
						? "indoor"
						: "outdoor",
				});
			}
			const isDefaultPriceRange =
				filterState.selectedPriceRange[0] === PRICE_RANGE_CONFIG.min &&
				filterState.selectedPriceRange[1] === PRICE_RANGE_CONFIG.max;
			if (!isDefaultPriceRange) {
				importedRules.push({
					filterGroup: "price_range",
					filterValue: `${filterState.selectedPriceRange[0]}:${filterState.selectedPriceRange[1]}`,
				});
			}
			if (filterState.selectedAgeRange) {
				importedRules.push({
					filterGroup: "age_range",
					filterValue: `${filterState.selectedAgeRange[0]}:${filterState.selectedAgeRange[1]}`,
				});
			}
			if (filterState.selectedOOOCPicks) {
				importedRules.push({
					filterGroup: "oooc_pick",
					filterValue: "yes",
				});
			}

			setFilterRules(importedRules);
			setSearchRule(filterState.searchQuery.trim().toLowerCase());
			setErrorMessage("");
			setSegmentMessage(
				`Loaded ${importedRules.length} filter rule${importedRules.length === 1 ? "" : "s"} from app filters`,
			);
		},
		[],
	);

	const loadSegmentRulesFromUrl = useCallback(() => {
		const raw = filterUrlInput.trim();
		if (!raw) {
			setErrorMessage("Paste an app URL first");
			return;
		}
		let params: URLSearchParams;
		try {
			if (raw.startsWith("?")) {
				params = new URLSearchParams(raw);
			} else {
				params = new URL(raw).searchParams;
			}
		} catch {
			setErrorMessage("Invalid URL format");
			return;
		}
		const parsed = parseEventFilterStateFromSearchParams(params);
		if (!parsed) {
			setErrorMessage("No active filters found in this URL");
			return;
		}
		applyFilterStateToSegmentBuilder(parsed);
	}, [applyFilterStateToSegmentBuilder, filterUrlInput]);

	const loadSegmentRulesFromSavedFilters = useCallback(() => {
		const parsed = readStoredEventFilterState();
		if (!parsed) {
			setErrorMessage("No saved app filters found in this browser");
			return;
		}
		applyFilterStateToSegmentBuilder(parsed);
	}, [applyFilterStateToSegmentBuilder]);

	const handleExportSegmentCsv = useCallback(async () => {
		setIsExporting(true);
		setErrorMessage("");
		setSegmentMessage("");
		try {
			const minHits = Number.parseInt(segmentMinHits, 10);
			const limit = Number.parseInt(segmentLimit, 10);
			const result = await exportAudienceSegmentCsv({
				windowDays: segmentWindowDays,
				minHitsPerRule: Number.isFinite(minHits) ? minHits : 1,
				limit: Number.isFinite(limit) ? limit : 5000,
				ruleOperator,
				filterRules,
				searchContains: searchRule,
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
		searchRule,
		segmentWindowDays,
		segmentLimit,
		segmentMinHits,
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
									void loadStats(days, searchClusterMode);
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
							onClick={() => void loadStats(windowDays, searchClusterMode)}
							disabled={isLoading}
						>
							{isLoading ? "Refreshing..." : "Refresh"}
						</Button>
						<div className="inline-flex items-center rounded-md border p-0.5">
							{SEARCH_CLUSTER_MODE_OPTIONS.map((mode) => (
								<Button
									key={mode}
									type="button"
									size="sm"
									variant={searchClusterMode === mode ? "default" : "ghost"}
									onClick={() => {
										setSearchClusterMode(mode);
										void loadStats(windowDays, mode);
									}}
									disabled={isLoading}
								>
									{mode === "conservative"
										? "Cluster: Conservative"
										: "Aggressive"}
								</Button>
							))}
						</div>
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
						<p className="text-xs text-muted-foreground">
							Build a partner audience by combining behavior rules, then export
							one clean CSV.
						</p>
						<div className="space-y-1">
							<p className="text-xs font-medium text-foreground">Date window</p>
							<div className="flex flex-wrap items-center gap-1.5">
								{EXPORT_WINDOW_OPTIONS.map((days) => (
									<Button
										key={days}
										type="button"
										size="sm"
										variant={segmentWindowDays === days ? "default" : "outline"}
										onClick={() => setSegmentWindowDays(days)}
									>
										{days}d
									</Button>
								))}
							</div>
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<p className="text-xs font-medium text-foreground">Rule mode</p>
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
						<div className="space-y-1">
							<p className="text-xs font-medium text-foreground">
								Add filter rule
							</p>
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
						</div>
						<div className="space-y-1">
							<p className="text-xs font-medium text-foreground">
								Load from app filters
							</p>
							<div className="grid gap-2 sm:grid-cols-[1fr_auto]">
								<input
									type="text"
									className="h-9 rounded-md border border-border bg-background px-2 text-xs"
									value={filterUrlInput}
									onChange={(event) => setFilterUrlInput(event.target.value)}
									placeholder="Paste events page URL with filters"
								/>
								<Button
									type="button"
									size="sm"
									variant="outline"
									onClick={loadSegmentRulesFromUrl}
								>
									Load From URL
								</Button>
							</div>
							<Button
								type="button"
								size="sm"
								variant="outline"
								onClick={loadSegmentRulesFromSavedFilters}
							>
								Load Saved Filters (Same Browser)
							</Button>
						</div>
						<div className="space-y-1">
							<p className="text-xs font-medium text-foreground">
								Add search rule (optional)
							</p>
							<div className="grid gap-2 sm:grid-cols-[1fr_auto]">
								<input
									type="text"
									className="h-9 rounded-md border border-border bg-background px-2 text-xs"
									value={searchInput}
									onChange={(event) => setSearchInput(event.target.value)}
									placeholder="e.g. techno, rooftop, 11e"
								/>
								<Button
									type="button"
									size="sm"
									variant="outline"
									onClick={addSearchRule}
								>
									Add Search Rule
								</Button>
							</div>
							<div className="flex flex-wrap gap-1.5">
								{payload?.success
									? payload.discovery.topSearches.slice(0, 6).map((row) => (
											<button
												key={row.query}
												type="button"
												onClick={() => setSearchRule(row.query)}
												className="rounded-full border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent"
												title={
													row.variantCount > 1
														? `Clustered from: ${row.variants
																.slice(0, 5)
																.map((variant) => variant.query)
																.join(", ")}`
														: undefined
												}
											>
												+ search:{row.query}
												{row.variantCount > 1
													? ` (${row.variantCount} variants)`
													: ""}
											</button>
										))
									: null}
							</div>
						</div>
						<div className="grid gap-2 sm:grid-cols-2">
							<div className="space-y-1">
								<p className="text-xs font-medium text-foreground">
									Min hits per rule
								</p>
								<input
									type="number"
									min={1}
									max={30}
									className="h-9 w-full rounded-md border border-border bg-background px-2 text-xs"
									value={segmentMinHits}
									onChange={(event) => setSegmentMinHits(event.target.value)}
								/>
							</div>
							<div className="space-y-1">
								<p className="text-xs font-medium text-foreground">Max rows</p>
								<input
									type="number"
									min={1}
									max={10000}
									className="h-9 w-full rounded-md border border-border bg-background px-2 text-xs"
									value={segmentLimit}
									onChange={(event) => setSegmentLimit(event.target.value)}
								/>
							</div>
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
							{searchRule ? (
								<Badge variant="outline" className="gap-1">
									search contains: {searchRule}
									<button
										type="button"
										onClick={clearSearchRule}
										className="ml-1 text-[10px]"
									>
										x
									</button>
								</Badge>
							) : (
								<p className="text-xs text-muted-foreground">
									No search rule added.
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
								disabled={
									isExporting ||
									(filterRules.length === 0 &&
										genreRules.length === 0 &&
										!searchRule)
								}
							>
								{isExporting ? "Exporting..." : "Export Custom Segment CSV"}
							</Button>
						</div>
						<p className="text-xs text-muted-foreground">
							{ruleOperator === "all"
								? "AND mode: users must match every selected rule."
								: "OR mode: users can match any selected rule."}
						</p>
						<p className="text-xs text-muted-foreground">
							Date filtering uses the selected export window above. Use filter
							rules for genre, arrondissement, day/night, price, age, and other
							behavior dimensions.
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
							Top Search Queries (Clustered)
						</p>
						<p className="text-xs text-muted-foreground">
							Typos and near-duplicates are grouped into one query cluster (
							{discovery.searchClusterMode} mode).
						</p>
						<div className="space-y-1 text-xs">
							{payload?.success && payload.discovery.topSearches.length > 0 ? (
								payload.discovery.topSearches.map((row) => (
									<div
										key={row.query}
										className="flex items-center justify-between rounded border bg-background/70 px-2 py-1"
									>
										<div className="min-w-0">
											<p className="truncate">{row.query}</p>
											{row.variantCount > 1 ? (
												<p className="truncate text-[11px] text-muted-foreground">
													from:{" "}
													{row.variants
														.slice(0, 3)
														.map((variant) => variant.query)
														.join(", ")}
													{row.variantCount > 3 ? "..." : ""}
												</p>
											) : null}
										</div>
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
					<div className="mb-2 space-y-2">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<div className="flex items-center gap-2">
								<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
									Event Performance Table
								</p>
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger
											render={
												<button
													type="button"
													className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-accent"
													aria-label="Column definitions"
												/>
											}
										>
											<CircleHelp className="h-3.5 w-3.5" />
										</TooltipTrigger>
										<TooltipContent>
											<div className="max-w-[320px] space-y-1.5 text-xs">
												{METRIC_COLUMN_HELP.map((item) => (
													<p key={item.label}>
														<span className="font-semibold">{item.label}:</span>{" "}
														{item.description}
													</p>
												))}
											</div>
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
							</div>
							<div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
								<label
									htmlFor="event-table-row-limit"
									className="text-xs text-muted-foreground"
								>
									Rows
								</label>
								<select
									id="event-table-row-limit"
									className="h-8 rounded-md border border-border bg-background px-2 text-xs"
									value={tableRowLimit}
									onChange={(event) =>
										setTableRowLimit(Number.parseInt(event.target.value, 10))
									}
								>
									{TABLE_ROW_LIMIT_OPTIONS.map((limit) => (
										<option key={limit} value={limit}>
											{limit}
										</option>
									))}
								</select>
								{shouldClampPerformanceTable ? (
									<Button
										type="button"
										size="sm"
										variant="outline"
										onClick={() =>
											setIsPerformanceTableExpanded((current) => !current)
										}
									>
										{isPerformanceTableExpanded ? "Collapse" : "Expand"}
									</Button>
								) : null}
								<Button
									type="button"
									size="sm"
									variant="outline"
									onClick={() => setIsEventColumnFrozen((current) => !current)}
								>
									{isEventColumnFrozen ? "Unfreeze Column" : "Freeze Column"}
								</Button>
								<input
									type="text"
									placeholder="Search event name or key"
									value={eventSearchTerm}
									onChange={(event) => setEventSearchTerm(event.target.value)}
									className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs sm:w-[280px]"
								/>
							</div>
						</div>
						<p className="text-xs text-muted-foreground">
							Showing {rows.length} of {filteredRows.length} matching events
							{payload?.success
								? ` (${payload.rows.length} tracked total)`
								: ""}
							.
						</p>
					</div>
					<div
						className={`max-w-full overflow-auto rounded-md border ${
							shouldClampPerformanceTable && !isPerformanceTableExpanded
								? "max-h-[32rem]"
								: ""
						}`}
					>
						<table className="min-w-[1280px] w-full text-xs">
							<thead className="sticky top-0 z-10 bg-muted/85 backdrop-blur">
								<tr>
									<th
										className={`px-3 py-2 text-left font-medium ${
											isEventColumnFrozen
												? "sticky left-0 z-20 border-r bg-muted/95"
												: ""
										}`}
									>
										Event
									</th>
									<th
										className="px-3 py-2 text-left font-medium"
										title="Stable internal ID used for event URLs and tracking joins."
									>
										Event Key
									</th>
									<th
										className="px-3 py-2 text-left font-medium"
										title="Total event detail opens."
									>
										Views
									</th>
									<th
										className="px-3 py-2 text-left font-medium"
										title="Total clicks on ticket/external partner links."
									>
										Outbound
									</th>
									<th
										className="px-3 py-2 text-left font-medium"
										title="Total calendar sync clicks."
									>
										Calendar
									</th>
									<th
										className="px-3 py-2 text-left font-medium"
										title="Distinct sessions with any engagement for this event."
									>
										Unique Sessions
									</th>
									<th
										className="px-3 py-2 text-left font-medium"
										title="Distinct sessions that opened the event."
									>
										View Sessions
									</th>
									<th
										className="px-3 py-2 text-left font-medium"
										title="Distinct sessions with at least one outbound click."
									>
										Outbound Sessions
									</th>
									<th
										className="px-3 py-2 text-left font-medium"
										title="Distinct sessions with at least one calendar sync."
									>
										Calendar Sessions
									</th>
									<th
										className="px-3 py-2 text-left font-medium"
										title="Outbound Sessions divided by View Sessions."
									>
										Outbound CVR
									</th>
									<th
										className="px-3 py-2 text-left font-medium"
										title="Calendar Sessions divided by View Sessions."
									>
										Calendar CVR
									</th>
									<th
										className="px-3 py-2 text-left font-medium"
										title="Outbound clicks divided by total views."
									>
										Outbound Interaction
									</th>
									<th
										className="px-3 py-2 text-left font-medium"
										title="Calendar syncs divided by total views."
									>
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
											<td
												className={`px-3 py-2.5 font-medium ${
													isEventColumnFrozen
														? "sticky left-0 z-10 border-r bg-background"
														: ""
												}`}
											>
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
