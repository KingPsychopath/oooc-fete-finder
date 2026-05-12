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
import { InfoPopover } from "@/components/ui/info-popover";
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
import { formatTourSignal } from "@/features/events/engagement/tour-analytics";
import { parseEventFilterStateFromSearchParams } from "@/features/events/filter-state-persistence";
import { PRICE_RANGE_CONFIG } from "@/features/events/types";
import { MUSIC_GENRES, type MusicGenre } from "@/features/events/types";
import { formatAdminDateTime } from "@/lib/ui/admin-date-format";
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
	| "genre_include"
	| "genre_exclude"
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

type SegmentSuggestion = {
	key: string;
	title: string;
	description: string;
	filterRules: SegmentFilterRule[];
	genreRules: SegmentGenreRule[];
	searchRule?: string;
};

const WINDOW_OPTIONS = [7, 14, 30, 90] as const;
const EXPORT_WINDOW_OPTIONS = [7, 14, 30, 60, 90] as const;
const TABLE_ROW_LIMIT_OPTIONS = [10, 25, 50, 100] as const;
const SEARCH_CLUSTER_MODE_OPTIONS = ["conservative", "aggressive"] as const;
const ANALYTICS_SCOPE_OPTIONS = ["all", "authenticatedOnly"] as const;
const DEFAULT_WINDOW_DAYS = 7;

type AnalyticsScope = (typeof ANALYTICS_SCOPE_OPTIONS)[number];

const SUMMARY_METRICS = [
	{
		key: "clickCount",
		label: "Event Opens",
		description: "Total event detail opens in the selected window.",
	},
	{
		key: "dedupedViewCount",
		label: "Unique Opens",
		description:
			"Event opens after per-session dedupe, capped at one open per event every 10 minutes.",
	},
	{
		key: "outboundClickCount",
		label: "Ticket & Info Clicks",
		description:
			"Clicks on the event modal's primary or secondary external links.",
	},
	{
		key: "calendarSyncCount",
		label: "Calendar Adds",
		description: "Clicks to add or sync an event to a calendar.",
	},
	{
		key: "mapOpenCount",
		label: "Event Map Opens",
		description:
			"Clicks on an event modal's location button that open a map app. This is not arrondissement/map exploration.",
	},
] as const;

const DISCOVERY_SUMMARY_METRICS = [
	{
		key: "searchCount",
		label: "Searches",
		description: "Search queries entered by users in discovery.",
	},
	{
		key: "filterApplyCount",
		label: "Filter Uses",
		description:
			"User-initiated filter changes only. The page’s automatic current-year default date window is not counted on load.",
	},
	{
		key: "mapInteractionCount",
		label: "Map Interactions",
		description:
			"Paris map exploration actions, including arrondissement clicks, cluster zooms, and fullscreen toggles.",
	},
	{
		key: "sortChangeCount",
		label: "Sort Changes",
		description:
			"All Events sort changes, including Upcoming, Fresh, and Near Me.",
	},
	{
		key: "locationRequestCount",
		label: "Location Requests",
		description:
			"Near Me and map-locate requests. These track attempts and outcomes, not precise coordinates.",
	},
	{
		key: "tourInteractionCount",
		label: "Tour Activity",
		description:
			"Tour prompt views and dismissals, starts, completions, skips, and auth handoffs.",
	},
	{
		key: "navClickCount",
		label: "Nav Clicks",
		description:
			"Homepage navigation clicks to key internal pages and essential external resources.",
	},
	{
		key: "uniqueSessionCount",
		label: "Discovery Sessions",
		description:
			"Distinct browser sessions with search, filter, map, sort, or location activity.",
	},
] as const;

const RATE_SUMMARY_METRICS = [
	{
		key: "outboundSessionRate",
		label: "External Link Session Index",
		description:
			"External-link sessions divided by event-open sessions. This can exceed 100% if a link click is tracked without an event-open record in the same window.",
		format: (value: number) => `${value.toFixed(1)}%`,
	},
	{
		key: "calendarSessionRate",
		label: "Calendar Session Index",
		description:
			"Calendar-add sessions divided by event-open sessions. This can exceed 100% if a calendar action is tracked without an event-open record in the same window.",
		format: (value: number) => `${value.toFixed(1)}%`,
	},
	{
		key: "mapSessionRate",
		label: "Map Session Index",
		description:
			"Map-open sessions divided by event-open sessions. This shows whether modal visitors use location intent, not just ticket intent.",
		format: (value: number) => `${value.toFixed(1)}%`,
	},
	{
		key: "outboundInteractionRate",
		label: "External Links / Open",
		description: "External link clicks divided by total event opens.",
		format: (value: number) => `${value.toFixed(1)}%`,
	},
	{
		key: "calendarInteractionRate",
		label: "Calendar Adds / Open",
		description: "Calendar adds divided by total event opens.",
		format: (value: number) => `${value.toFixed(1)}%`,
	},
	{
		key: "mapInteractionRate",
		label: "Map Opens / Open",
		description: "Map opens divided by total event opens.",
		format: (value: number) => `${value.toFixed(1)}%`,
	},
] as const;

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
		label: "Deduped Views",
		description:
			"View opens after per-session dedupe (max 1 view per event every 10 minutes).",
	},
	{
		label: "External Links",
		description: "Total clicks on the modal's ticket or info links.",
	},
	{
		label: "Calendar",
		description: "Total calendar sync clicks.",
	},
	{
		label: "Map",
		description:
			"Total event-modal location map opens. Arrondissement map exploration is counted under Discovery Behavior.",
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
		label: "External Link Sessions",
		description: "Distinct sessions with at least one external link click.",
	},
	{
		label: "Calendar Sessions",
		description: "Distinct sessions with at least one calendar sync.",
	},
	{
		label: "Map Sessions",
		description:
			"Distinct sessions with at least one event-modal location map open.",
	},
	{
		label: "External Link CVR",
		description: "External Link Sessions divided by View Sessions.",
	},
	{
		label: "Calendar CVR",
		description: "Calendar Sessions divided by View Sessions.",
	},
	{
		label: "Map CVR",
		description: "Map Sessions divided by View Sessions.",
	},
	{
		label: "External Link Interaction",
		description: "External link clicks divided by total views.",
	},
	{
		label: "Calendar Interaction",
		description: "Calendar syncs divided by total views.",
	},
	{
		label: "Map Interaction",
		description: "Event-modal location map opens divided by total views.",
	},
];

const FILTER_GROUP_OPTIONS: Array<{
	value: DiscoveryFilterGroup;
	label: string;
}> = [
	{ value: "genre", label: "Genre" },
	{ value: "genre_include", label: "Genre Include" },
	{ value: "genre_exclude", label: "Genre Exclude" },
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
	genre_include: "house",
	genre_exclude: "amapiano",
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

const getFilterGroupLabel = (group: string): string =>
	FILTER_GROUP_OPTIONS.find((option) => option.value === group)?.label ?? group;

const getGenreLabel = (genre: MusicGenre | string): string =>
	MUSIC_GENRES.find((option) => option.key === genre)?.label ?? genre;

const formatContextLabel = (value: string): string =>
	value
		.split(/[-_\s:]+/)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");

const getOrdinalSuffix = (value: number): string => {
	const mod100 = value % 100;
	if (mod100 >= 11 && mod100 <= 13) return "th";
	switch (value % 10) {
		case 1:
			return "st";
		case 2:
			return "nd";
		case 3:
			return "rd";
		default:
			return "th";
	}
};

const formatMapInteractionSignal = ({
	group,
	value,
}: {
	group: string;
	value: string;
}): { label: string; meta: string } => {
	if (group === "map_control") {
		const controlLabels: Record<string, string> = {
			fullscreen_close: "Exited fullscreen map",
			fullscreen_open: "Opened fullscreen map",
		};
		return {
			label: controlLabels[value] ?? formatContextLabel(value),
			meta: "Map control",
		};
	}

	if (group === "map_arrondissement") {
		const [arrondissementRaw, eventCountRaw] = value.split(":");
		const arrondissement = Number.parseInt(arrondissementRaw ?? "", 10);
		const eventCount = Number.parseInt(eventCountRaw ?? "", 10);
		const hasArrondissement =
			Number.isFinite(arrondissement) &&
			arrondissement >= 1 &&
			arrondissement <= 20;
		const hasEventCount = Number.isFinite(eventCount);

		return {
			label: hasArrondissement
				? `${arrondissement}${getOrdinalSuffix(arrondissement)} arrondissement`
				: "Unknown arrondissement",
			meta: hasEventCount
				? `${eventCount} event${eventCount === 1 ? "" : "s"} shown there at click time`
				: "Arrondissement click",
		};
	}

	if (group === "map_cluster") {
		const clusterCount = Number.parseInt(value, 10);
		return {
			label: Number.isFinite(clusterCount)
				? `Expanded ${clusterCount}-event cluster`
				: "Expanded event cluster",
			meta: "Map cluster",
		};
	}

	return {
		label: formatContextLabel(value),
		meta: formatContextLabel(group),
	};
};

const formatSortSignal = (value: string): { label: string; meta: string } => {
	const sortLabels: Record<string, string> = {
		"fresh-activity": "Fresh activity sort",
		nearby: "Near Me sort",
		upcoming: "Upcoming sort",
	};
	return {
		label: sortLabels[value] ?? `${formatContextLabel(value)} sort`,
		meta: "User-selected sort change",
	};
};

const formatLocationRequestSignal = (
	value: string,
): { label: string; meta: string } => {
	const locationLabels: Record<string, { label: string; meta: string }> = {
		all_events_request: {
			label: "Near Me requested",
			meta: "User tapped Near Me in All Events",
		},
		all_events_current: {
			label: "Near Me used current location",
			meta: "Browser returned a fresh location",
		},
		all_events_last_known: {
			label: "Near Me used saved location",
			meta: "Browser returned a last-known location",
		},
		all_events_unavailable: {
			label: "Near Me location unavailable",
			meta: "Permission, timeout, or browser location failure",
		},
		map_locate_notice: {
			label: "Map locate notice shown",
			meta: "User tapped locate on the map",
		},
	};
	return (
		locationLabels[value] ?? {
			label: formatContextLabel(value),
			meta: "Location request",
		}
	);
};

const getMedian = (values: number[]): number => {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((left, right) => left - right);
	return sorted[Math.floor(sorted.length / 2)] ?? 0;
};

const SummaryMetric = ({
	label,
	value,
	description,
}: {
	label: string;
	value: string | number;
	description: string;
}) => (
	<div className="rounded-md border bg-background/60 px-2.5 py-2">
		<div className="flex items-start justify-between gap-2">
			<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
				{label}
			</p>
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger
						render={
							<button
								type="button"
								className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
								aria-label={`${label} help`}
							/>
						}
					>
						<CircleHelp className="h-3.5 w-3.5" />
					</TooltipTrigger>
					<TooltipContent>
						<p className="max-w-[240px] text-xs">{description}</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		</div>
		<p className="mt-0.5 text-sm font-semibold tabular-nums">{value}</p>
	</div>
);

export const EventEngagementStatsCard = ({
	initialPayload,
}: {
	initialPayload?: EventEngagementPayload;
}) => {
	const [windowDays, setWindowDays] = useState<number>(
		initialPayload && initialPayload.success
			? initialPayload.windowDays
			: DEFAULT_WINDOW_DAYS,
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
	const [analyticsScope, setAnalyticsScope] = useState<AnalyticsScope>("all");

	const [ruleGroup, setRuleGroup] = useState<DiscoveryFilterGroup>("genre");
	const [ruleValue, setRuleValue] = useState("");
	const [ruleOperator, setRuleOperator] = useState<"all" | "any">("all");
	const [filterRules, setFilterRules] = useState<SegmentFilterRule[]>([]);

	const [genreRuleGenre, setGenreRuleGenre] = useState<MusicGenre>("house");
	const [genreRuleMinScore, setGenreRuleMinScore] = useState("2");
	const [genreRules, setGenreRules] = useState<SegmentGenreRule[]>([]);

	const [segmentWindowDays, setSegmentWindowDays] = useState<number>(
		initialPayload && initialPayload.success
			? initialPayload.windowDays
			: DEFAULT_WINDOW_DAYS,
	);
	const [expandedDecisionBucket, setExpandedDecisionBucket] = useState<
		string | null
	>(null);
	const [searchInput, setSearchInput] = useState("");
	const [searchRule, setSearchRule] = useState("");
	const [filterUrlInput, setFilterUrlInput] = useState("");
	const [segmentMinHits, setSegmentMinHits] = useState("1");
	const [segmentLimit, setSegmentLimit] = useState("5000");

	const loadStats = useCallback(
		async (
			days: number,
			clusterMode: "conservative" | "aggressive",
			scope: AnalyticsScope,
		) => {
			setIsLoading(true);
			setErrorMessage("");
			try {
				const result = await getEventEngagementDashboard(days, clusterMode, {
					includeAuthenticatedOnly: scope === "authenticatedOnly",
				});
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
		void loadStats(windowDays, searchClusterMode, analyticsScope);
	}, [
		analyticsScope,
		initialPayload?.success,
		loadStats,
		searchClusterMode,
		windowDays,
	]);

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
				dedupedViewCount: 0,
				outboundClickCount: 0,
				calendarSyncCount: 0,
				mapOpenCount: 0,
				mapPreferenceChangeCount: 0,
				uniqueSessionCount: 0,
				uniqueViewSessionCount: 0,
				uniqueOutboundSessionCount: 0,
				uniqueCalendarSessionCount: 0,
				uniqueMapSessionCount: 0,
				outboundSessionRate: 0,
				calendarSessionRate: 0,
				mapSessionRate: 0,
				outboundInteractionRate: 0,
				calendarInteractionRate: 0,
				mapInteractionRate: 0,
			};

	const discovery = payload?.success
		? payload.discovery
		: {
				searchClusterMode,
				searchCount: 0,
				filterApplyCount: 0,
				filterClearCount: 0,
				mapInteractionCount: 0,
				sortChangeCount: 0,
				locationRequestCount: 0,
				tourInteractionCount: 0,
				navClickCount: 0,
				uniqueSessionCount: 0,
				topSearches: [],
				topFilters: [],
				topMapInteractions: [],
				topSortChanges: [],
				topLocationRequests: [],
				topTourInteractions: [],
				topNavigationClicks: [],
			};

	const chartRows = useMemo(() => filteredRows.slice(0, 8), [filteredRows]);
	const maxChartClicks = Math.max(1, ...chartRows.map((row) => row.clickCount));
	const maxChartAction = Math.max(
		1,
		...chartRows.map((row) =>
			Math.max(row.outboundClickCount, row.calendarSyncCount, row.mapOpenCount),
		),
	);
	const topSearchRows = payload?.success
		? payload.discovery.topSearches.slice(0, 6)
		: [];
	const topGenreRows = payload?.success ? payload.topGenres.slice(0, 8) : [];
	const topFilterRows = payload?.success
		? payload.discovery.topFilters.slice(0, 8)
		: [];
	const topMapInteractionRows = payload?.success
		? payload.discovery.topMapInteractions.slice(0, 8)
		: [];
	const topSortRows = payload?.success
		? payload.discovery.topSortChanges.slice(0, 6)
		: [];
	const topLocationRequestRows = payload?.success
		? payload.discovery.topLocationRequests.slice(0, 6)
		: [];
	const topTourRows = payload?.success
		? payload.discovery.topTourInteractions.slice(0, 6)
		: [];
	const topNavigationRows = payload?.success
		? payload.discovery.topNavigationClicks.slice(0, 8)
		: [];
	const maxDiscoverySignal = Math.max(
		1,
		...topSearchRows.map((row) => row.count),
		...topGenreRows.map((row) => row.uniqueUsers),
		...topFilterRows.map((row) => row.count),
		...topMapInteractionRows.map((row) => row.count),
		...topSortRows.map((row) => row.count),
		...topLocationRequestRows.map((row) => row.count),
		...topTourRows.map((row) => row.count),
		...topNavigationRows.map((row) => row.count),
	);
	const dailyRows = payload?.success
		? payload.dailySeries.slice(-Math.min(windowDays, 30))
		: [];
	const hasDailyActivity = dailyRows.some(
		(row) =>
			row.clickCount > 0 ||
			row.outboundClickCount > 0 ||
			row.calendarSyncCount > 0 ||
			row.mapOpenCount > 0,
	);
	const maxDailyValue = Math.max(
		1,
		...dailyRows.map((row) =>
			Math.max(
				row.clickCount,
				row.outboundClickCount,
				row.calendarSyncCount,
				row.mapOpenCount,
			),
		),
	);
	const selectedRuleCount =
		filterRules.length + genreRules.length + (searchRule ? 1 : 0);
	const attentionThreshold = getMedian(chartRows.map((row) => row.clickCount));
	const intentThreshold = Math.max(
		1,
		getMedian(chartRows.map((row) => row.outboundSessionRate)),
	);
	const decisionBuckets = [
		{
			key: "high-attention-high-intent",
			label: "Prioritize",
			description: "High attention, high external-link intent",
			rows: chartRows.filter(
				(row) =>
					row.clickCount >= attentionThreshold &&
					row.outboundSessionRate >= intentThreshold,
			),
		},
		{
			key: "high-attention-low-intent",
			label: "Improve Event Data",
			description: "People open these, then hesitate",
			rows: chartRows.filter(
				(row) =>
					row.clickCount >= attentionThreshold &&
					row.outboundSessionRate < intentThreshold,
			),
		},
		{
			key: "low-attention-high-intent",
			label: "Niche Intent",
			description: "Smaller audience, stronger action",
			rows: chartRows.filter(
				(row) =>
					row.clickCount < attentionThreshold &&
					row.outboundSessionRate >= intentThreshold,
			),
		},
		{
			key: "low-attention-low-intent",
			label: "Low Priority",
			description: "Low attention, low action",
			rows: chartRows.filter(
				(row) =>
					row.clickCount < attentionThreshold &&
					row.outboundSessionRate < intentThreshold,
			),
		},
	];
	const actionQueue = [
		{
			key: "feature-candidates",
			label: "Consider Featuring",
			description: "High attention and high external-link intent.",
			rows: decisionBuckets[0]?.rows ?? [],
		},
		{
			key: "fix-details",
			label: "Fix Event Links / Details",
			description: "High opens but weaker external-link intent.",
			rows: decisionBuckets[1]?.rows ?? [],
		},
		{
			key: "niche-picks",
			label: "Niche But Strong",
			description: "Lower attention, stronger action rate.",
			rows: decisionBuckets[2]?.rows ?? [],
		},
	];
	const dataQualityFlags = [
		{
			key: "high-opens-low-intent",
			label: "Check Proof, Price, Link",
			description: "People open these, then do not click out.",
			rows: chartRows.filter(
				(row) =>
					row.clickCount >= attentionThreshold &&
					row.outboundSessionRate < intentThreshold,
			),
		},
		{
			key: "calendar-without-partner",
			label: "Calendar Interest, Low Link Action",
			description: "These may need clearer booking/ticket instructions.",
			rows: chartRows.filter(
				(row) =>
					row.calendarSyncCount > 0 &&
					row.outboundClickCount <= row.calendarSyncCount,
			),
		},
		{
			key: "promote-low-open-high-intent",
			label: "Promote Niche Intent",
			description: "Small audience, but the people who find it act.",
			rows: decisionBuckets[2]?.rows ?? [],
		},
	];
	const knownTopFilters = topFilterRows.filter((rule) =>
		FILTER_GROUP_OPTIONS.some((option) => option.value === rule.filterGroup),
	);
	const topDayNightFilter = knownTopFilters.find(
		(rule) => rule.filterGroup === "day_night",
	);
	const topOoocPickFilter = knownTopFilters.find(
		(rule) => rule.filterGroup === "oooc_pick",
	);
	const topAreaFilter = knownTopFilters.find(
		(rule) => rule.filterGroup === "arrondissement",
	);
	const topBehaviorFilter = knownTopFilters.find(
		(rule) => rule.filterGroup !== "date_range",
	);
	const possibleSegmentSuggestions: Array<SegmentSuggestion | null> = [
		topGenreRows[0] && topDayNightFilter
			? {
					key: "top-genre-day-night",
					title: `${topGenreRows[0].label} + ${topDayNightFilter.filterValue}`,
					description: "Top genre preference with a top day/night behavior.",
					genreRules: [{ genre: topGenreRows[0].genre, minScore: 2 }],
					filterRules: [
						{
							filterGroup: "day_night",
							filterValue: topDayNightFilter.filterValue,
						},
					],
				}
			: null,
		topGenreRows[1] && topOoocPickFilter
			? {
					key: "second-genre-oooc-pick",
					title: `${topGenreRows[1].label} + OOOC ${topOoocPickFilter.filterValue}`,
					description: "Pairs a strong genre preference with curation intent.",
					genreRules: [{ genre: topGenreRows[1].genre, minScore: 2 }],
					filterRules: [
						{
							filterGroup: "oooc_pick",
							filterValue: topOoocPickFilter.filterValue,
						},
					],
				}
			: null,
		topAreaFilter && topDayNightFilter
			? {
					key: "area-day-night",
					title: `${getFilterGroupLabel(topAreaFilter.filterGroup)} ${topAreaFilter.filterValue} + ${topDayNightFilter.filterValue}`,
					description: "Useful for location-led partner exports.",
					genreRules: [],
					filterRules: [
						{
							filterGroup: "arrondissement",
							filterValue: topAreaFilter.filterValue,
						},
						{
							filterGroup: "day_night",
							filterValue: topDayNightFilter.filterValue,
						},
					],
				}
			: null,
		topGenreRows[0] && topAreaFilter
			? {
					key: "top-genre-area",
					title: `${topGenreRows[0].label} + ${topAreaFilter.filterValue}`,
					description: "Best when a partner wants a local genre-led audience.",
					genreRules: [{ genre: topGenreRows[0].genre, minScore: 2 }],
					filterRules: [
						{
							filterGroup: "arrondissement",
							filterValue: topAreaFilter.filterValue,
						},
					],
				}
			: null,
		topSearchRows[0] && topGenreRows[0]
			? {
					key: "search-genre",
					title: `${topSearchRows[0].query} + ${topGenreRows[0].label}`,
					description:
						"Turns the strongest search intent into a genre-qualified export.",
					searchRule: topSearchRows[0].query.toLowerCase(),
					genreRules: [{ genre: topGenreRows[0].genre, minScore: 2 }],
					filterRules: [],
				}
			: null,
		topSearchRows[0] && topBehaviorFilter
			? {
					key: "search-behavior",
					title: `${topSearchRows[0].query} + ${getFilterGroupLabel(topBehaviorFilter.filterGroup)}`,
					description:
						"Combines the top search cluster with a live filter signal.",
					searchRule: topSearchRows[0].query.toLowerCase(),
					genreRules: [],
					filterRules: [
						{
							filterGroup:
								topBehaviorFilter.filterGroup as DiscoveryFilterGroup,
							filterValue: topBehaviorFilter.filterValue,
						},
					],
				}
			: null,
	];
	const segmentSuggestions = possibleSegmentSuggestions.filter(
		(suggestion): suggestion is SegmentSuggestion => suggestion !== null,
	);

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

	const addTopGenreRule = useCallback((genre: MusicGenre) => {
		setGenreRules((current) => {
			if (current.some((rule) => rule.genre === genre)) {
				return current;
			}
			return [...current, { genre, minScore: 2 }];
		});
	}, []);

	const applySegmentSuggestion = useCallback(
		(suggestion: SegmentSuggestion) => {
			setFilterRules((current) => {
				const next = [...current];
				for (const rule of suggestion.filterRules) {
					const key = normalizeRuleKey(rule);
					if (!next.some((item) => normalizeRuleKey(item) === key)) {
						next.push(rule);
					}
				}
				return next;
			});
			setGenreRules((current) => {
				const next = [...current];
				for (const rule of suggestion.genreRules) {
					if (!next.some((item) => item.genre === rule.genre)) {
						next.push(rule);
					}
				}
				return next;
			});
			if (suggestion.searchRule) {
				setSearchRule(suggestion.searchRule);
			}
			setErrorMessage("");
			setSegmentMessage(`Loaded segment suggestion: ${suggestion.title}`);
		},
		[],
	);

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
			selectedArrondissements: Array<
				number | "greater-paris" | "outside-paris" | "unknown"
			>;
			selectedGenres: MusicGenre[];
			excludedGenres?: MusicGenre[];
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
					filterGroup: "genre_include",
					filterValue: genre,
				});
			}
			for (const genre of filterState.excludedGenres ?? []) {
				importedRules.push({
					filterGroup: "genre_exclude",
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
				<div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
					<div className="space-y-1">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Audience + Performance
						</p>
						<CardTitle>Discovery & Event Performance</CardTitle>
						<CardDescription>
							Event opens, discovery behavior, external link actions, and
							audience export in one panel.
						</CardDescription>
					</div>
					<div className="flex max-w-full flex-col items-end gap-2 lg:justify-self-end">
						<div className="flex flex-wrap items-center justify-end gap-2">
							{WINDOW_OPTIONS.map((days) => (
								<Button
									key={days}
									type="button"
									size="sm"
									variant={windowDays === days ? "default" : "outline"}
									onClick={() => {
										setWindowDays(days);
										if (initialPayload?.success) {
											void loadStats(days, searchClusterMode, analyticsScope);
										}
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
								onClick={() =>
									void loadStats(windowDays, searchClusterMode, analyticsScope)
								}
								disabled={isLoading}
							>
								{isLoading ? "Refreshing..." : "Refresh"}
							</Button>
							<div className="inline-flex items-center rounded-md border p-0.5">
								{ANALYTICS_SCOPE_OPTIONS.map((scope) => (
									<Button
										key={scope}
										type="button"
										size="sm"
										variant={analyticsScope === scope ? "default" : "ghost"}
										onClick={() => {
											setAnalyticsScope(scope);
											if (initialPayload?.success) {
												void loadStats(windowDays, searchClusterMode, scope);
											}
										}}
										disabled={isLoading}
									>
										{scope === "all" ? "All activity" : "Authenticated"}
									</Button>
								))}
							</div>
							<div className="inline-flex items-center rounded-md border p-0.5">
								{SEARCH_CLUSTER_MODE_OPTIONS.map((mode) => (
									<Button
										key={mode}
										type="button"
										size="sm"
										variant={searchClusterMode === mode ? "default" : "ghost"}
										onClick={() => {
											setSearchClusterMode(mode);
											if (initialPayload?.success) {
												void loadStats(windowDays, mode, analyticsScope);
											}
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
						{payload?.success ? (
							<p className="text-right text-xs text-muted-foreground">
								Last {payload.windowDays} days · updated{" "}
								{formatAdminDateTime(payload.range.endAt)}
							</p>
						) : null}
					</div>
				</div>

				<div className="space-y-2">
					<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
						Event Performance
					</p>
					<div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
						{SUMMARY_METRICS.map((metric) => (
							<SummaryMetric
								key={metric.key}
								label={metric.label}
								value={summary[metric.key]}
								description={metric.description}
							/>
						))}
					</div>
				</div>
				<div className="space-y-2">
					<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
						Discovery Behavior
					</p>
					<div className="grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-4">
						{DISCOVERY_SUMMARY_METRICS.map((metric) => (
							<SummaryMetric
								key={metric.key}
								label={metric.label}
								value={discovery[metric.key]}
								description={metric.description}
							/>
						))}
					</div>
				</div>
				<div className="space-y-2">
					<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
						External Link Action Rates
					</p>
					<div className="grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-6">
						{RATE_SUMMARY_METRICS.map((metric) => (
							<SummaryMetric
								key={metric.key}
								label={metric.label}
								value={metric.format(summary[metric.key])}
								description={metric.description}
							/>
						))}
					</div>
				</div>

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
							Top Events By Attention
						</p>
						<p className="text-xs text-muted-foreground">
							Opens show attention; external link clicks and calendar adds show
							intent.
						</p>
						{chartRows.length === 0 ? (
							<p className="text-xs text-muted-foreground">
								No event view data yet.
							</p>
						) : (
							<div className="space-y-3">
								{chartRows.map((row) => (
									<div key={row.eventKey} className="space-y-1.5">
										<div className="mb-1 flex items-center justify-between gap-2">
											<p className="truncate text-xs font-medium">
												{row.eventName}
											</p>
											<p className="text-xs tabular-nums">
												{row.clickCount} opens
											</p>
										</div>
										<div className="h-2.5 w-full overflow-hidden rounded-full bg-muted/70">
											<div
												className="h-full rounded-full bg-amber-600/85"
												style={{
													width: `${Math.max(
														6,
														Math.round((row.clickCount / maxChartClicks) * 100),
													)}%`,
												}}
											/>
										</div>
										<div className="grid grid-cols-3 gap-1.5 text-[10px] text-muted-foreground">
											<div className="space-y-1">
												<div className="flex justify-between gap-2">
													<span>Links</span>
													<span>{row.outboundClickCount}</span>
												</div>
												<div className="h-1.5 rounded-full bg-muted/70">
													<div
														className="h-1.5 rounded-full bg-emerald-700/80"
														style={{
															width: `${Math.max(
																row.outboundClickCount > 0 ? 6 : 0,
																Math.round(
																	(row.outboundClickCount / maxChartAction) *
																		100,
																),
															)}%`,
														}}
													/>
												</div>
											</div>
											<div className="space-y-1">
												<div className="flex justify-between gap-2">
													<span>Calendar</span>
													<span>{row.calendarSyncCount}</span>
												</div>
												<div className="h-1.5 rounded-full bg-muted/70">
													<div
														className="h-1.5 rounded-full bg-sky-700/80"
														style={{
															width: `${Math.max(
																row.calendarSyncCount > 0 ? 6 : 0,
																Math.round(
																	(row.calendarSyncCount / maxChartAction) *
																		100,
																),
															)}%`,
														}}
													/>
												</div>
											</div>
											<div className="space-y-1">
												<div className="flex justify-between gap-2">
													<span>Map</span>
													<span>{row.mapOpenCount}</span>
												</div>
												<div className="h-1.5 rounded-full bg-muted/70">
													<div
														className="h-1.5 rounded-full bg-violet-700/80"
														style={{
															width: `${Math.max(
																row.mapOpenCount > 0 ? 6 : 0,
																Math.round(
																	(row.mapOpenCount / maxChartAction) * 100,
																),
															)}%`,
														}}
													/>
												</div>
											</div>
										</div>
									</div>
								))}
							</div>
						)}
					</div>

					<div className="space-y-2 rounded-md border bg-background/55 p-3">
						<div className="flex items-center">
							<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
								Event Decision Matrix
							</p>
							<InfoPopover
								aria-label="Explain event decision matrix"
								side="top"
							>
								Events are grouped by opens and external-link intent using
								thresholds from the current top events. Click a quadrant to see
								every event inside it.
							</InfoPopover>
						</div>
						<p className="text-xs text-muted-foreground">
							Use this to decide what to feature, what to fix, and what can
							wait.
						</p>
						{chartRows.length === 0 ? (
							<p className="text-xs text-muted-foreground">
								No event view data yet.
							</p>
						) : (
							<div className="grid gap-2 sm:grid-cols-2">
								{decisionBuckets.map((bucket) => (
									<button
										key={bucket.key}
										type="button"
										onClick={() =>
											setExpandedDecisionBucket((current) =>
												current === bucket.key ? null : bucket.key,
											)
										}
										className={`min-h-32 rounded-md border bg-background/70 p-2 text-left transition-colors hover:bg-accent/45 ${
											expandedDecisionBucket === bucket.key
												? "border-foreground/35 bg-accent/35"
												: ""
										}`}
									>
										<div className="mb-2 flex items-start justify-between gap-2">
											<div className="min-w-0 flex-1">
												<p className="text-xs font-semibold text-foreground">
													{bucket.label}
												</p>
												<p className="text-[11px] text-muted-foreground">
													{bucket.description}
												</p>
											</div>
											<span className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-border bg-background px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
												{bucket.rows.length} events
											</span>
										</div>
										{bucket.rows.length === 0 ? (
											<p className="text-[11px] text-muted-foreground">
												No events in this group.
											</p>
										) : (
											<div className="space-y-1">
												{bucket.rows.slice(0, 3).map((row) => (
													<div
														key={row.eventKey}
														className="rounded border border-border/70 bg-background px-2 py-1"
													>
														<p className="truncate text-xs font-medium">
															{row.eventName}
														</p>
														<p className="text-[11px] text-muted-foreground">
															{row.clickCount} opens ·{" "}
															{formatPercent(row.outboundSessionRate)} link
															intent
														</p>
													</div>
												))}
											</div>
										)}
									</button>
								))}
								{expandedDecisionBucket ? (
									<div className="space-y-2 rounded-md border bg-background/70 p-2 sm:col-span-2">
										{decisionBuckets
											.find((bucket) => bucket.key === expandedDecisionBucket)
											?.rows.map((row) => (
												<div
													key={row.eventKey}
													className="grid gap-2 rounded border border-border/70 bg-background px-2 py-1.5 sm:grid-cols-[minmax(0,1fr)_auto]"
												>
													<div className="min-w-0">
														<p className="truncate text-xs font-medium">
															{row.eventName}
														</p>
														<p className="truncate text-[11px] text-muted-foreground">
															{row.eventKey}
														</p>
													</div>
													<p className="text-[11px] text-muted-foreground sm:text-right">
														{row.clickCount} opens · {row.outboundClickCount}{" "}
														links · {row.calendarSyncCount} calendar ·{" "}
														{formatPercent(row.outboundSessionRate)} intent
													</p>
												</div>
											))}
									</div>
								) : null}
								<p className="text-[11px] text-muted-foreground sm:col-span-2">
									Thresholds are based on the current top events:{" "}
									{attentionThreshold} opens and{" "}
									{formatPercent(intentThreshold)} external-link intent.
								</p>
							</div>
						)}
					</div>
				</section>

				<section className="grid gap-4 xl:grid-cols-3">
					<div className="space-y-2 rounded-md border bg-background/55 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Action Queue
						</p>
						<div className="space-y-2">
							{actionQueue.map((item) => (
								<div
									key={item.key}
									className="rounded-md border bg-background/70 p-2"
								>
									<div className="mb-1 flex items-start justify-between gap-2">
										<div className="min-w-0 flex-1">
											<p className="text-xs font-semibold text-foreground">
												{item.label}
											</p>
											<p className="text-[11px] text-muted-foreground">
												{item.description}
											</p>
										</div>
										<span className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-border bg-background px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
											{item.rows.length} events
										</span>
									</div>
									{item.rows.length === 0 ? (
										<p className="text-[11px] text-muted-foreground">
											No events right now.
										</p>
									) : (
										<div className="space-y-1">
											{item.rows.slice(0, 2).map((row) => (
												<p
													key={row.eventKey}
													className="truncate text-[11px] text-muted-foreground"
												>
													{row.eventName}
												</p>
											))}
										</div>
									)}
								</div>
							))}
						</div>
					</div>

					<div className="space-y-2 rounded-md border bg-background/55 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Data Quality Flags
						</p>
						<div className="space-y-2">
							{dataQualityFlags.map((flag) => (
								<div
									key={flag.key}
									className="rounded-md border bg-background/70 p-2"
								>
									<div className="mb-1 flex items-start justify-between gap-2">
										<div className="min-w-0 flex-1">
											<p className="text-xs font-semibold text-foreground">
												{flag.label}
											</p>
											<p className="text-[11px] text-muted-foreground">
												{flag.description}
											</p>
										</div>
										<span className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-border bg-background px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
											{flag.rows.length} events
										</span>
									</div>
									{flag.rows.length === 0 ? (
										<p className="text-[11px] text-muted-foreground">
											No flags right now.
										</p>
									) : (
										<div className="space-y-1">
											{flag.rows.slice(0, 2).map((row) => (
												<p
													key={row.eventKey}
													className="truncate text-[11px] text-muted-foreground"
												>
													{row.eventName}
												</p>
											))}
										</div>
									)}
								</div>
							))}
						</div>
					</div>

					<div className="space-y-2 rounded-md border bg-background/55 p-3">
						<div className="flex items-center">
							<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
								Segment Suggestions
							</p>
							<InfoPopover aria-label="Explain segment suggestions" side="top">
								These are generated from the current top searches, genres, and
								filters. Changing the date window or cluster mode can change the
								suggestions.
							</InfoPopover>
						</div>
						{segmentSuggestions.length === 0 ? (
							<p className="text-xs text-muted-foreground">
								Not enough live signal overlap for suggestions yet.
							</p>
						) : (
							<div className="space-y-2">
								{segmentSuggestions.map((suggestion) => (
									<button
										key={suggestion.key}
										type="button"
										onClick={() => applySegmentSuggestion(suggestion)}
										className="w-full rounded-md border bg-background/70 p-2 text-left transition-colors hover:bg-accent/45"
									>
										<p className="text-xs font-semibold text-foreground">
											{suggestion.title}
										</p>
										<p className="text-[11px] text-muted-foreground">
											{suggestion.description}
										</p>
									</button>
								))}
							</div>
						)}
					</div>
				</section>

				<section className="grid gap-4 xl:grid-cols-2">
					<div className="space-y-2 rounded-md border bg-background/55 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Engagement Funnel
						</p>
						<div className="space-y-2">
							{[
								{ label: "Event opens", value: summary.clickCount },
								{ label: "Unique opens", value: summary.dedupedViewCount },
								{
									label: "External link clicks",
									value: summary.outboundClickCount,
								},
								{ label: "Event map opens", value: summary.mapOpenCount },
								{ label: "Calendar adds", value: summary.calendarSyncCount },
							].map((step) => (
								<div key={step.label} className="space-y-1">
									<div className="flex justify-between gap-2 text-xs">
										<span className="font-medium">{step.label}</span>
										<span className="tabular-nums">{step.value}</span>
									</div>
									<div className="h-2.5 overflow-hidden rounded-full bg-muted/70">
										<div
											className="h-full rounded-full bg-foreground/75"
											style={{
												width: `${Math.max(
													step.value > 0 ? 5 : 0,
													Math.round(
														(step.value / Math.max(1, summary.clickCount)) *
															100,
													),
												)}%`,
											}}
										/>
									</div>
								</div>
							))}
						</div>
					</div>

					<div className="space-y-2 rounded-md border bg-background/55 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Daily Pulse
						</p>
						<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
							<span>Last {dailyRows.length} days</span>
							<span className="inline-flex items-center gap-1">
								<span className="h-1.5 w-5 rounded-full bg-amber-600/80" />
								Opens
							</span>
							<span className="inline-flex items-center gap-1">
								<span className="h-1.5 w-5 rounded-full bg-emerald-700/80" />
								Links
							</span>
							<span className="inline-flex items-center gap-1">
								<span className="h-1.5 w-5 rounded-full bg-violet-700/80" />
								Event map
							</span>
							<span className="inline-flex items-center gap-1">
								<span className="h-1.5 w-5 rounded-full bg-sky-700/80" />
								Calendar
							</span>
						</div>
						{dailyRows.length === 0 || !hasDailyActivity ? (
							<p className="text-xs text-muted-foreground">
								No daily activity in this window yet.
							</p>
						) : (
							<div className="space-y-2 rounded-md border bg-background/70 p-3">
								{dailyRows.map((row) => (
									<div
										key={row.day}
										className="grid grid-cols-[4.5rem_1fr] items-center gap-2"
										title={`${row.day}: ${row.clickCount} opens, ${row.outboundClickCount} external links, ${row.mapOpenCount} event map opens, ${row.calendarSyncCount} calendar`}
									>
										<p className="truncate text-[11px] text-muted-foreground">
											{row.day.slice(5)}
										</p>
										<div className="space-y-1">
											<div className="flex items-center gap-1.5">
												<div className="h-1.5 flex-1 rounded-full bg-muted/70">
													<div
														className="h-1.5 rounded-full bg-amber-600/80"
														style={{
															width: `${Math.max(
																row.clickCount > 0 ? 5 : 0,
																(row.clickCount / maxDailyValue) * 100,
															)}%`,
														}}
													/>
												</div>
												<span className="w-6 text-right text-[10px] tabular-nums">
													{row.clickCount}
												</span>
											</div>
											<div className="flex items-center gap-1.5">
												<div className="h-1.5 flex-1 rounded-full bg-muted/70">
													<div
														className="h-1.5 rounded-full bg-emerald-700/80"
														style={{
															width: `${Math.max(
																row.outboundClickCount > 0 ? 5 : 0,
																(row.outboundClickCount / maxDailyValue) * 100,
															)}%`,
														}}
													/>
												</div>
												<span className="w-6 text-right text-[10px] tabular-nums">
													{row.outboundClickCount}
												</span>
											</div>
											<div className="flex items-center gap-1.5">
												<div className="h-1.5 flex-1 rounded-full bg-muted/70">
													<div
														className="h-1.5 rounded-full bg-violet-700/80"
														style={{
															width: `${Math.max(
																row.mapOpenCount > 0 ? 5 : 0,
																(row.mapOpenCount / maxDailyValue) * 100,
															)}%`,
														}}
													/>
												</div>
												<span className="w-6 text-right text-[10px] tabular-nums">
													{row.mapOpenCount}
												</span>
											</div>
											<div className="flex items-center gap-1.5">
												<div className="h-1.5 flex-1 rounded-full bg-muted/70">
													<div
														className="h-1.5 rounded-full bg-sky-700/80"
														style={{
															width: `${Math.max(
																row.calendarSyncCount > 0 ? 5 : 0,
																(row.calendarSyncCount / maxDailyValue) * 100,
															)}%`,
														}}
													/>
												</div>
												<span className="w-6 text-right text-[10px] tabular-nums">
													{row.calendarSyncCount}
												</span>
											</div>
										</div>
									</div>
								))}
							</div>
						)}
					</div>
				</section>

				<section className="space-y-2 rounded-md border bg-background/55 p-3">
					<div className="flex items-center">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Map App Preference
						</p>
						<InfoPopover aria-label="Explain map app analytics" side="top">
							Event map opens are tracked from the event modal location button.
							Arrondissement clicks and other on-page map exploration live under
							Discovery Behavior. Map preference changes are tracked only when
							someone changes the saved provider in event modal settings, app
							settings, or the map picker.
						</InfoPopover>
					</div>
					<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
						<div className="rounded-md border bg-background/70 p-3">
							<p className="text-xs font-medium text-foreground">
								Preference Changes
							</p>
							<p className="mt-1 text-2xl font-semibold tabular-nums">
								{summary.mapPreferenceChangeCount}
							</p>
							<p className="mt-1 text-[11px] text-muted-foreground">
								Only real value changes are counted. Fast sequential provider
								switches are not collapsed by the short-window dedupe.
							</p>
						</div>
						<div className="space-y-2">
							<p className="text-xs font-medium text-foreground">
								Map opens by selected provider
							</p>
							{payload?.success && payload.mapProviders.length > 0 ? (
								<div className="space-y-1.5">
									{payload.mapProviders.map((row) => (
										<div key={row.provider} className="space-y-1">
											<div className="flex justify-between gap-2 text-xs">
												<span className="capitalize">{row.provider}</span>
												<span className="tabular-nums">
													{row.count} opens · {row.uniqueSessionCount} sessions
												</span>
											</div>
											<div className="h-2 rounded-full bg-muted/70">
												<div
													className="h-2 rounded-full bg-violet-700/80"
													style={{
														width: `${Math.max(
															row.count > 0 ? 6 : 0,
															Math.round(
																(row.count /
																	Math.max(1, summary.mapOpenCount)) *
																	100,
															),
														)}%`,
													}}
												/>
											</div>
										</div>
									))}
								</div>
							) : (
								<p className="text-xs text-muted-foreground">
									No map-open data yet.
								</p>
							)}
						</div>
					</div>
				</section>

				<section className="space-y-2 rounded-md border bg-background/55 p-3">
					<div className="flex items-center">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Live Signal Bars
						</p>
						<InfoPopover aria-label="Explain live signal bars" side="top">
							These are explicit user actions in the selected window. Default
							settings that apply automatically, like the saved default event
							sort, are not counted as user sort changes.
						</InfoPopover>
					</div>
					<p className="text-xs text-muted-foreground">
						Searches use the current {discovery.searchClusterMode} clustering
						mode; other rows are grouped from direct user interaction events.
					</p>
					<div className="grid gap-4 lg:grid-cols-3">
						{[
							{
								label: "Searches",
								help: "",
								rows: topSearchRows.map((row) => ({
									key: row.query,
									label: row.query,
									value: row.count,
									meta:
										row.variantCount > 1
											? `${row.variantCount} variants: ${row.variants
													.slice(0, 3)
													.map((variant) => variant.query)
													.join(", ")}${row.variantCount > 3 ? "..." : ""}`
											: "",
								})),
								empty: "No search data yet.",
							},
							{
								label: "Genres",
								help: "",
								rows: topGenreRows.map((row) => ({
									key: row.genre,
									label: row.label,
									value: row.uniqueUsers,
									meta: "",
								})),
								empty: "No genre data yet.",
							},
							{
								label: "Filters",
								help: "",
								rows: topFilterRows.map((row) => ({
									key: `${row.filterGroup}-${row.filterValue}`,
									label: `${getFilterGroupLabel(row.filterGroup)}: ${row.filterValue}`,
									value: row.count,
									meta: "",
								})),
								empty: "No filter data yet.",
							},
							{
								label: "Map",
								help: "On-page map interactions: fullscreen controls, arrondissement clicks, and event-cluster expansion. Event-modal map app launches are counted separately as Event Map Opens.",
								rows: topMapInteractionRows.map((row) => {
									const formatted = formatMapInteractionSignal(row);
									return {
										key: `${row.group}-${row.value}`,
										label: formatted.label,
										value: row.count,
										meta: formatted.meta,
									};
								}),
								empty: "No map interaction data yet.",
							},
							{
								label: "Sort changes",
								help: "Only explicit user sort changes are counted. The saved default sort applies silently and is not counted here.",
								rows: topSortRows.map((row) => {
									const formatted = formatSortSignal(row.value);
									return {
										key: `${row.group}-${row.value}`,
										label: formatted.label,
										value: row.count,
										meta: formatted.meta,
									};
								}),
								empty: "No sort-change data yet.",
							},
							{
								label: "Near Me location",
								help: "Location requests cover Near Me sorting on All Events plus the map locate button. They track attempts and outcomes, never precise coordinates.",
								rows: topLocationRequestRows.map((row) => {
									const formatted = formatLocationRequestSignal(row.value);
									return {
										key: `${row.group}-${row.value}`,
										label: formatted.label,
										value: row.count,
										meta: formatted.meta,
									};
								}),
								empty: "No location request data yet.",
							},
							{
								label: "Tour",
								help: "Tour activity separates prompt exposure and dismissal from actual guided-tour starts, skips, completions, and auth handoffs.",
								rows: topTourRows.map((row) => {
									const formatted = formatTourSignal(row.value);
									return {
										key: `${row.group}-${row.value}`,
										label: formatted.label,
										value: row.count,
										meta: formatted.meta,
									};
								}),
								empty: "No tour data yet.",
							},
							{
								label: "Navigation",
								help: "",
								rows: topNavigationRows.map((row) => ({
									key: `${row.group}-${row.value}`,
									label: `${formatContextLabel(row.group)}: ${formatContextLabel(row.value)}`,
									value: row.count,
									meta: "",
								})),
								empty: "No navigation data yet.",
							},
						].map((group) => (
							<div key={group.label} className="space-y-2">
								<div className="flex items-center">
									<p className="text-xs font-medium text-foreground">
										{group.label}
									</p>
									{group.help ? (
										<InfoPopover
											aria-label={`Explain ${group.label}`}
											side="top"
										>
											{group.help}
										</InfoPopover>
									) : null}
								</div>
								{group.rows.length === 0 ? (
									<p className="text-xs text-muted-foreground">{group.empty}</p>
								) : (
									<div className="space-y-1.5">
										{group.rows.map((row) => (
											<div key={row.key} className="space-y-1">
												<div className="flex justify-between gap-2 text-xs">
													<span className="min-w-0">
														<span className="block truncate">{row.label}</span>
														{row.meta ? (
															<span className="block truncate text-[10px] text-muted-foreground">
																{row.meta}
															</span>
														) : null}
													</span>
													<span className="tabular-nums">{row.value}</span>
												</div>
												<div className="h-2 rounded-full bg-muted/70">
													<div
														className="h-2 rounded-full bg-amber-600/80"
														style={{
															width: `${Math.max(
																row.value > 0 ? 6 : 0,
																Math.round(
																	(row.value / maxDiscoverySignal) * 100,
																),
															)}%`,
														}}
													/>
												</div>
											</div>
										))}
									</div>
								)}
							</div>
						))}
					</div>
				</section>

				<section className="space-y-3 rounded-md border bg-background/55 p-3">
					<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
						Audience Segment Export
					</p>
					<p className="text-xs text-muted-foreground">
						Build a partner audience by combining behavior rules, then export
						one clean CSV.
					</p>
					<div className="space-y-3 rounded-md border border-border/70 bg-background/45 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Start From Live Signals
						</p>
						<div className="space-y-1">
							<p className="text-xs font-medium text-foreground">Searches</p>
							<div className="flex flex-wrap gap-1.5">
								{payload?.success &&
								payload.discovery.topSearches.length > 0 ? (
									payload.discovery.topSearches.slice(0, 6).map((row) => (
										<button
											key={row.query}
											type="button"
											onClick={() => setSearchRule(row.query.toLowerCase())}
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
											+ search:{row.query} ({row.count}
											{row.variantCount > 1
												? `, ${row.variantCount} variants`
												: ""}
											)
										</button>
									))
								) : (
									<p className="text-xs text-muted-foreground">
										No search data yet.
									</p>
								)}
							</div>
						</div>
						<div className="space-y-1">
							<p className="text-xs font-medium text-foreground">Genres</p>
							<div className="flex flex-wrap gap-1.5">
								{payload?.success && payload.topGenres.length > 0 ? (
									payload.topGenres.map((genre) => (
										<button
											key={genre.genre}
											type="button"
											onClick={() => addTopGenreRule(genre.genre)}
											className="rounded-full border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent"
										>
											+ {genre.label}: {genre.uniqueUsers} users
										</button>
									))
								) : (
									<p className="text-xs text-muted-foreground">
										No genre preference data yet.
									</p>
								)}
							</div>
						</div>
						{payload?.success && payload.discovery.topFilters.length > 0 ? (
							<div className="space-y-1">
								<p className="text-xs font-medium text-foreground">Filters</p>
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
												+ {getFilterGroupLabel(rule.filterGroup)}:
												{rule.filterValue} ({rule.count})
											</button>
										);
									})}
								</div>
							</div>
						) : null}
						<div className="space-y-1">
							<div className="flex items-center">
								<p className="text-xs font-medium text-foreground">
									App filters
								</p>
								<InfoPopover
									aria-label="Explain loading app filters"
									side="top"
								>
									Apply filters on the public events page, then copy that URL
									from the address bar and paste it here.
								</InfoPopover>
							</div>
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
						</div>
					</div>
					<div className="space-y-3 rounded-md border border-border/70 bg-background/45 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Segment Settings
						</p>
						<div className="space-y-1">
							<p className="text-xs font-medium text-foreground">
								Export window
							</p>
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
							<p className="text-[11px] text-muted-foreground">
								Date filters use this export window. Add filter rules for genre,
								arrondissement, day/night, price, age, and other behavior
								dimensions.
							</p>
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
							<InfoPopover aria-label="Explain rule mode" side="top">
								Use AND to require every selected rule. Use OR to include users
								who matched at least one selected rule.
							</InfoPopover>
						</div>
						<div className="grid gap-2 sm:grid-cols-2">
							<div className="space-y-1">
								<div className="flex items-center">
									<p className="text-xs font-medium text-foreground">
										Min hits per rule
									</p>
									<InfoPopover
										aria-label="Explain minimum hits per rule"
										side="top"
									>
										The user must match each selected rule at least this many
										times in the export window. Keep it at 1 for broad exports;
										raise it for stronger intent.
									</InfoPopover>
								</div>
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
					</div>
					<div className="space-y-3 rounded-md border border-border/70 bg-background/45 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Manual Rules
						</p>
						<div className="space-y-1">
							<p className="text-xs font-medium text-foreground">
								Filter behavior
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
									Add Filter
								</Button>
							</div>
						</div>
						<div className="space-y-1">
							<p className="text-xs font-medium text-foreground">
								Search contains
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
									Add Search
								</Button>
							</div>
						</div>
						<div className="space-y-1">
							<p className="text-xs font-medium text-foreground">
								Genre preference
							</p>
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
									Add Genre
								</Button>
							</div>
						</div>
					</div>
					<div className="space-y-2 rounded-md border border-border/70 bg-background/45 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Selected Segment
						</p>
						<div className="flex flex-wrap gap-1.5">
							{filterRules.length === 0 &&
							genreRules.length === 0 &&
							!searchRule ? (
								<p className="text-xs text-muted-foreground">
									No rules selected yet.
								</p>
							) : null}
							{filterRules.map((rule) => (
								<Badge
									key={normalizeRuleKey(rule)}
									variant="outline"
									className="gap-1"
								>
									{getFilterGroupLabel(rule.filterGroup)}: {rule.filterValue}
									<button
										type="button"
										onClick={() => removeFilterRule(rule)}
										className="ml-1 text-[10px]"
									>
										x
									</button>
								</Badge>
							))}
							{searchRule ? (
								<Badge variant="outline" className="gap-1">
									Search contains: {searchRule}
									<button
										type="button"
										onClick={clearSearchRule}
										className="ml-1 text-[10px]"
									>
										x
									</button>
								</Badge>
							) : null}
							{genreRules.map((rule) => (
								<Badge key={rule.genre} variant="outline" className="gap-1">
									Genre preference: {getGenreLabel(rule.genre)} (score{" "}
									{"\u003e="} {rule.minScore})
									<button
										type="button"
										onClick={() => removeGenreRule(rule.genre)}
										className="ml-1 text-[10px]"
									>
										x
									</button>
								</Badge>
							))}
						</div>
					</div>
					<div className="space-y-2">
						<p className="text-xs text-muted-foreground">
							{selectedRuleCount} rule{selectedRuleCount === 1 ? "" : "s"}{" "}
							selected · {ruleOperator.toUpperCase()} mode · {segmentWindowDays}
							d window
						</p>
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
							{isExporting ? "Exporting..." : "Export Audience Segment CSV"}
						</Button>
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
						<table className="min-w-[1560px] w-full text-xs">
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
										title="View opens after per-session dedupe (max 1 view per event every 10 minutes)."
									>
										Deduped Views
									</th>
									<th
										className="px-3 py-2 text-left font-medium"
										title="Total clicks on the modal's ticket or info links."
									>
										External Links
									</th>
									<th
										className="px-3 py-2 text-left font-medium"
										title="Total calendar sync clicks."
									>
										Calendar
									</th>
									<th
										className="px-3 py-2 text-left font-medium"
										title="Total event-modal location map opens."
									>
										Map
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
										title="Distinct sessions with at least one external link click."
									>
										External Link Sessions
									</th>
									<th
										className="px-3 py-2 text-left font-medium"
										title="Distinct sessions with at least one calendar sync."
									>
										Calendar Sessions
									</th>
									<th
										className="px-3 py-2 text-left font-medium"
										title="Distinct sessions with at least one event-modal location map open."
									>
										Map Sessions
									</th>
									<th
										className="px-3 py-2 text-left font-medium"
										title="External Link Sessions divided by View Sessions."
									>
										External Link CVR
									</th>
									<th
										className="px-3 py-2 text-left font-medium"
										title="Calendar Sessions divided by View Sessions."
									>
										Calendar CVR
									</th>
									<th
										className="px-3 py-2 text-left font-medium"
										title="Map Sessions divided by View Sessions."
									>
										Map CVR
									</th>
									<th
										className="px-3 py-2 text-left font-medium"
										title="External link clicks divided by total views."
									>
										External Link Interaction
									</th>
									<th
										className="px-3 py-2 text-left font-medium"
										title="Calendar syncs divided by total views."
									>
										Calendar Interaction
									</th>
									<th
										className="px-3 py-2 text-left font-medium"
										title="Event-modal location map opens divided by total views."
									>
										Map Interaction
									</th>
								</tr>
							</thead>
							<tbody>
								{rows.length === 0 ? (
									<tr>
										<td
											colSpan={18}
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
												{row.dedupedViewCount}
											</td>
											<td className="px-3 py-2.5 tabular-nums">
												{row.outboundClickCount}
											</td>
											<td className="px-3 py-2.5 tabular-nums">
												{row.calendarSyncCount}
											</td>
											<td className="px-3 py-2.5 tabular-nums">
												{row.mapOpenCount}
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
												{row.uniqueMapSessionCount}
											</td>
											<td className="px-3 py-2.5 tabular-nums">
												{formatPercent(row.outboundSessionRate)}
											</td>
											<td className="px-3 py-2.5 tabular-nums">
												{formatPercent(row.calendarSessionRate)}
											</td>
											<td className="px-3 py-2.5 tabular-nums">
												{formatPercent(row.mapSessionRate)}
											</td>
											<td className="px-3 py-2.5 tabular-nums">
												{formatPercent(row.outboundInteractionRate)}
											</td>
											<td className="px-3 py-2.5 tabular-nums">
												{formatPercent(row.calendarInteractionRate)}
											</td>
											<td className="px-3 py-2.5 tabular-nums">
												{formatPercent(row.mapInteractionRate)}
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
