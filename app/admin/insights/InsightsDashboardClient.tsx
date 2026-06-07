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
	exportCollectedEmailsCsv,
	getCollectedEmails,
} from "@/features/auth/actions";
import { Download, ExternalLink, UsersRound } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EventEngagementStatsCard } from "../components/EventEngagementStatsCard";
import { withAdminBasePath } from "../config";
import type {
	AdminInsightsInitialData,
	EmailRecord,
	UserCollectionAnalytics,
} from "../types";

type InsightsTab =
	| "traffic"
	| "discovery"
	| "planning"
	| "exchange"
	| "events"
	| "audience"
	| "advanced";

const INSIGHTS_TABS: Array<{
	key: InsightsTab;
	label: string;
	description: string;
}> = [
	{
		key: "audience",
		label: "Audience",
		description: "Cohorts, context, user bridges.",
	},
	{
		key: "traffic",
		label: "Traffic",
		description: "Visitors, sources, campaigns, landing pages.",
	},
	{
		key: "discovery",
		label: "Discovery",
		description: "Search, filters, map, sort, location, tour.",
	},
	{
		key: "planning",
		label: "Planning",
		description: "Routes, shares, exports, shared-plan intent.",
	},
	{
		key: "exchange",
		label: "Exchange",
		description: "Ticket traffic, listings, unlocks, reports.",
	},
	{
		key: "events",
		label: "Events",
		description: "Event attention, intent, funnel, quality.",
	},
	{
		key: "advanced",
		label: "Advanced",
		description: "Diagnostics, raw dimensions, full table.",
	},
];

type AudienceSignal =
	| "has-activity"
	| "recently-active"
	| "searches"
	| "filters"
	| "plan-actions"
	| "event-actions"
	| "genre-prefs"
	| "returned-no-activity"
	| "has-context"
	| "missing-context";

const RETURNED_AFTER_ACTION_THRESHOLD_MS = 30 * 60 * 1000;

const AUDIENCE_SEGMENTS: Array<{
	label: string;
	value: AudienceSignal;
	description: string;
}> = [
	{
		label: "Any linked activity",
		value: "has-activity",
		description: "Users with search, filter, route, event, or genre signals.",
	},
	{
		label: "Active last 7d",
		value: "recently-active",
		description: "Users with a recent linked audience signal.",
	},
	{
		label: "Searchers",
		value: "searches",
		description: "Users who searched the event catalogue.",
	},
	{
		label: "Filter users",
		value: "filters",
		description: "Users who applied discovery filters.",
	},
	{
		label: "Plan users",
		value: "plan-actions",
		description: "Users with route planning activity.",
	},
	{
		label: "Event action users",
		value: "event-actions",
		description: "Users who opened, saved, mapped, or clicked events.",
	},
	{
		label: "Genre preference users",
		value: "genre-prefs",
		description: "Users with captured genre preference signals.",
	},
	{
		label: "Returned after activity",
		value: "returned-no-activity",
		description: "Users seen later than their latest linked action.",
	},
	{
		label: "Context available",
		value: "has-context",
		description: "Users with device, platform, browser, timezone, or locale.",
	},
	{
		label: "Context missing",
		value: "missing-context",
		description: "Users with sparse first-party context.",
	},
];

const getTime = (value: string | null | undefined): number => {
	if (!value) return 0;
	const parsed = new Date(value).getTime();
	return Number.isFinite(parsed) ? parsed : 0;
};

const getUserLastSeenAt = (user: EmailRecord): string =>
	user.lastSeenAt ??
	user.lastAuthenticatedAt ??
	user.lastVerifiedAt ??
	user.timestamp;

const getActivityCount = (user: EmailRecord): number =>
	user.linkedSignalCount ?? 0;

const hasUsefulContext = (user: EmailRecord): boolean =>
	Boolean(
		user.deviceClass ||
			user.platform ||
			user.browserFamily ||
			user.timezone ||
			user.locale,
	);

const hasReturnedWithoutNewActivity = (user: EmailRecord): boolean => {
	const capturedAt = getTime(getUserLastSeenAt(user));
	const lastActiveAt = getTime(user.lastSignalAt);
	return (
		capturedAt > 0 &&
		lastActiveAt > 0 &&
		capturedAt - lastActiveAt >= RETURNED_AFTER_ACTION_THRESHOLD_MS
	);
};

const matchesAudienceSignal = (
	user: EmailRecord,
	signal: AudienceSignal,
): boolean => {
	const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
	switch (signal) {
		case "has-activity":
			return getActivityCount(user) > 0;
		case "recently-active":
			return getTime(user.lastSignalAt) >= sevenDaysAgo;
		case "searches":
			return (user.searchSignalCount ?? 0) > 0;
		case "filters":
			return (user.filterSignalCount ?? 0) > 0;
		case "plan-actions":
			return (user.planActionSignalCount ?? 0) > 0;
		case "event-actions":
			return (user.eventActionSignalCount ?? 0) > 0;
		case "genre-prefs":
			return (user.genrePreferenceSignalCount ?? 0) > 0;
		case "returned-no-activity":
			return hasReturnedWithoutNewActivity(user);
		case "has-context":
			return hasUsefulContext(user);
		case "missing-context":
			return !hasUsefulContext(user);
	}
};

const userSegmentHref = (signal: AudienceSignal): string =>
	withAdminBasePath(
		`/admin/users?audienceSignal=${encodeURIComponent(signal)}#user-search`,
	);

const INSIGHTS_TAB_BY_HASH = new Map<string, InsightsTab>([
	["collected-users", "audience"],
	["audience", "audience"],
	["insights-audience", "audience"],
	["event-engagement-stats", "events"],
	["traffic", "traffic"],
	["insights-traffic", "traffic"],
	["discovery", "discovery"],
	["insights-discovery", "discovery"],
	["planning", "planning"],
	["insights-planning", "planning"],
	["exchange", "exchange"],
	["insights-exchange", "exchange"],
	["events", "events"],
	["insights-events", "events"],
	["advanced", "advanced"],
	["insights-advanced", "advanced"],
]);

const getInsightsHash = (): string | null => {
	if (typeof window === "undefined") return null;
	const hash = window.location.hash.replace(/^#/, "").trim();
	return hash || null;
};

const getInsightsTabForHash = (hash: string | null): InsightsTab | null => {
	if (!hash) return null;
	return INSIGHTS_TAB_BY_HASH.get(hash) ?? null;
};

const getInsightsTabHash = (tab: InsightsTab): string =>
	tab === "audience" ? "collected-users" : `insights-${tab}`;

const getInsightsScrollTarget = (tab: InsightsTab): string =>
	tab === "audience" ? "collected-users" : "event-engagement-stats";

const audienceStatLinkClass =
	"block rounded-md border bg-background/60 px-3 py-2 transition-colors hover:border-foreground/30 hover:bg-muted/35";

const AudienceOverviewCard = ({
	emails,
	analytics,
	onExportCSV,
}: {
	emails: EmailRecord[];
	analytics: UserCollectionAnalytics | null;
	onExportCSV: () => void;
}) => {
	const segmentCounts = new Map(
		AUDIENCE_SEGMENTS.map((segment) => [
			segment.value,
			emails.filter((user) => matchesAudienceSignal(user, segment.value))
				.length,
		]),
	);
	const totalUsers = analytics?.totalUsers ?? emails.length;
	const linkedBehaviorUsers = analytics?.linkedBehaviorUsers ?? 0;
	const submissionsLast24Hours = analytics?.submissionsLast24Hours ?? 0;
	const submissionsLast7Days = analytics?.submissionsLast7Days ?? 0;

	return (
		<Card className="ooo-admin-card min-w-0 overflow-hidden">
			<CardHeader className="border-b">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<CardTitle>Audience Overview</CardTitle>
						<CardDescription>
							Cohort-level audience health. Open a segment in Users when you
							need person-level context, cleanup, notices, or restrictions.
						</CardDescription>
					</div>
					<div className="flex flex-wrap gap-2">
						<Link href={withAdminBasePath("/admin/users#user-search")}>
							<Button type="button" variant="outline" size="sm">
								<UsersRound />
								Open Users
							</Button>
						</Link>
						<Button
							type="button"
							size="sm"
							onClick={onExportCSV}
							disabled={emails.length === 0}
							title={
								emails.length === 0
									? "No audience records to export"
									: "Export all audience records as CSV"
							}
						>
							<Download />
							Export CSV
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent className="space-y-4 pt-4">
				<div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
					<Link
						href={withAdminBasePath("/admin/users#user-search")}
						className={audienceStatLinkClass}
					>
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Unique Users
						</p>
						<p className="mt-1 text-sm font-medium">{totalUsers}</p>
						<p className="mt-0.5 text-[11px] text-muted-foreground">
							Open user list
						</p>
					</Link>
					<Link
						href={userSegmentHref("has-activity")}
						className={audienceStatLinkClass}
					>
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Linked Activity
						</p>
						<p className="mt-1 text-sm font-medium">
							{linkedBehaviorUsers}/{totalUsers}
						</p>
						<p className="mt-0.5 text-[11px] text-muted-foreground">
							Open users with activity
						</p>
					</Link>
					<Link
						href={withAdminBasePath("/admin/users#user-search")}
						className={audienceStatLinkClass}
					>
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Recently Seen
						</p>
						<p className="mt-1 text-sm font-medium tabular-nums">
							{submissionsLast24Hours} / {submissionsLast7Days}
						</p>
						<p className="mt-0.5 text-[11px] text-muted-foreground">24h / 7d</p>
						<p className="mt-0.5 text-[11px] text-muted-foreground">
							Open user list
						</p>
					</Link>
					<div className="rounded-md border bg-background/60 px-3 py-2">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Top Device
						</p>
						<p className="mt-1 truncate text-sm font-medium">
							{analytics?.topDeviceClasses?.[0]?.label ?? "Unknown"}
						</p>
					</div>
					<div className="rounded-md border bg-background/60 px-3 py-2">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Top Timezone
						</p>
						<p className="mt-1 truncate text-sm font-medium">
							{analytics?.topTimezones?.[0]?.label ?? "Unknown"}
						</p>
					</div>
				</div>
				<div className="rounded-md border bg-background/60 p-3">
					<div className="flex flex-wrap items-start justify-between gap-2">
						<div>
							<p className="text-sm font-medium">Audience Cohorts</p>
							<p className="mt-1 text-xs text-muted-foreground">
								Counts stay analytical here. Follow a cohort to Users for
								person-level review and actions.
							</p>
						</div>
						<Link href={withAdminBasePath("/admin/users#user-search")}>
							<Button type="button" variant="outline" size="sm">
								<ExternalLink />
								Open Users
							</Button>
						</Link>
					</div>
					<div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
						{AUDIENCE_SEGMENTS.map((segment) => (
							<Link
								key={segment.value}
								href={userSegmentHref(segment.value)}
								className="rounded-md border bg-background/70 p-3 transition-colors hover:bg-muted"
							>
								<span className="flex items-start justify-between gap-2">
									<span>
										<span className="block text-sm font-medium">
											{segment.label}
										</span>
										<span className="mt-1 block text-xs text-muted-foreground">
											{segment.description}
										</span>
									</span>
									<Badge variant="outline">
										{segmentCounts.get(segment.value) ?? 0}
									</Badge>
								</span>
							</Link>
						))}
					</div>
				</div>
			</CardContent>
		</Card>
	);
};

type InsightsDashboardClientProps = {
	initialData: AdminInsightsInitialData;
};

export function InsightsDashboardClient({
	initialData,
}: InsightsDashboardClientProps) {
	const initialEmailsResult = initialData.emailsResult;
	const [emails, setEmails] = useState<EmailRecord[]>(
		initialEmailsResult?.success ? (initialEmailsResult.emails ?? []) : [],
	);
	const [emailAnalytics, setEmailAnalytics] =
		useState<UserCollectionAnalytics | null>(
			initialEmailsResult?.success
				? (initialEmailsResult.analytics ?? null)
				: null,
		);
	const [activeTab, setActiveTab] = useState<InsightsTab>("audience");

	const loadEmails = useCallback(async () => {
		const result = await getCollectedEmails();
		if (result.success) {
			setEmails(result.emails ?? []);
			setEmailAnalytics(result.analytics ?? null);
		}
	}, []);

	useEffect(() => {
		if (initialEmailsResult?.success) {
			return;
		}
		void loadEmails();
	}, [initialEmailsResult?.success, loadEmails]);

	const exportAsCSV = useCallback(async () => {
		const result = await exportCollectedEmailsCsv();
		if (!result.success || !result.csv) return;
		const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download =
			result.filename ??
			`fete-finder-users-${new Date().toISOString().split("T")[0]}.csv`;
		document.body.appendChild(anchor);
		anchor.click();
		document.body.removeChild(anchor);
		URL.revokeObjectURL(url);
	}, []);

	useEffect(() => {
		const syncHashToTab = () => {
			const tab = getInsightsTabForHash(getInsightsHash());
			if (!tab) return;
			setActiveTab(tab);
			window.setTimeout(() => {
				document
					.getElementById(getInsightsScrollTarget(tab))
					?.scrollIntoView({ behavior: "smooth", block: "start" });
			}, 0);
		};

		syncHashToTab();
		window.addEventListener("hashchange", syncHashToTab);
		return () => window.removeEventListener("hashchange", syncHashToTab);
	}, []);

	const openInsightsTab = (tab: InsightsTab) => {
		setActiveTab(tab);
		if (typeof window === "undefined") return;
		const hash = getInsightsTabHash(tab);
		window.history.replaceState(
			null,
			"",
			`${window.location.pathname}#${hash}`,
		);
		window.setTimeout(() => {
			document
				.getElementById(getInsightsScrollTarget(tab))
				?.scrollIntoView({ behavior: "smooth", block: "start" });
		}, 0);
	};

	const emailCollectionSection =
		activeTab === "audience" ? (
			<section id="collected-users" className="scroll-mt-44">
				<AudienceOverviewCard
					emails={emails}
					analytics={emailAnalytics}
					onExportCSV={() => void exportAsCSV()}
				/>
			</section>
		) : null;

	return (
		<div className="space-y-6">
			<div className="ooo-admin-card-soft rounded-md border p-3">
				<div className="flex flex-wrap gap-2">
					{INSIGHTS_TABS.map((tab) => (
						<button
							key={tab.key}
							type="button"
							onClick={() => openInsightsTab(tab.key)}
							aria-pressed={activeTab === tab.key}
							title={`Show ${tab.label.toLowerCase()} insight view`}
							className={`rounded-md border px-3 py-2 text-left transition-colors ${
								activeTab === tab.key
									? "border-foreground/35 bg-foreground text-background"
									: "bg-background/70 text-foreground hover:bg-accent"
							}`}
						>
							<span className="block text-xs font-semibold">{tab.label}</span>
							<span
								className={`block text-[11px] ${
									activeTab === tab.key
										? "text-background/75"
										: "text-muted-foreground"
								}`}
							>
								{tab.description}
							</span>
						</button>
					))}
				</div>
			</div>
			{emailCollectionSection}
			<section id="event-engagement-stats" className="scroll-mt-44">
				<EventEngagementStatsCard
					initialPayload={initialData.eventEngagementDashboard}
					activeTab={activeTab}
				/>
			</section>
		</div>
	);
}
