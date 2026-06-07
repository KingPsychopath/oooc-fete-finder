"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
	type ComponentProps,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import { EventSheetEditorCard } from "../components/EventSheetEditorCard";
import { EventSubmissionsCard } from "../components/EventSubmissionsCard";
import { LocationReviewCard } from "../components/LocationReviewCard";
import { SearchChipSettingsCard } from "../components/SearchChipSettingsCard";
import { SlidingBannerSettingsCard } from "../components/SlidingBannerSettingsCard";
import { TicketExchangeModerationCard } from "../components/TicketExchangeModerationCard";

type ContentTab = "submissions" | "sheet" | "tickets" | "locations" | "site";

type EventSubmissionsPayload = ComponentProps<
	typeof EventSubmissionsCard
>["initialPayload"];
type EventSheetEditorData = ComponentProps<
	typeof EventSheetEditorCard
>["initialEditorData"];
type PendingEventReviews = ComponentProps<
	typeof EventSheetEditorCard
>["pendingEventReviews"];
type LocationReviewPayload = ComponentProps<
	typeof LocationReviewCard
>["initialPayload"];
type SlidingBannerSettings = ComponentProps<
	typeof SlidingBannerSettingsCard
>["initialSettings"];
type SearchChipSettings = ComponentProps<
	typeof SearchChipSettingsCard
>["initialSettings"];
type TicketExchangePayload = ComponentProps<
	typeof TicketExchangeModerationCard
>["initialPayload"];

type ContentDashboardClientProps = {
	initialDeploymentId: string;
	initialEditorData?: EventSheetEditorData;
	initialSubmissions?: EventSubmissionsPayload;
	initialLocationReview?: LocationReviewPayload;
	initialSlidingBannerSettings?: SlidingBannerSettings;
	initialSearchChipSettings?: SearchChipSettings;
	initialTicketExchangeModeration?: TicketExchangePayload;
	pendingEventReviews: PendingEventReviews;
	defaultTab: ContentTab;
};

const CONTENT_TABS: Array<{
	key: ContentTab;
	label: string;
	description: string;
	anchorId: string;
}> = [
	{
		key: "sheet",
		label: "Event Sheet",
		description: "Canonical event data and deployment state.",
		anchorId: "event-sheet-editor",
	},
	{
		key: "submissions",
		label: "Submissions",
		description: "Submitted events, updates, and flags.",
		anchorId: "event-submissions",
	},
	{
		key: "tickets",
		label: "Tickets",
		description: "Ticket Exchange reports, listings, unlocks.",
		anchorId: "ticket-exchange-moderation",
	},
	{
		key: "locations",
		label: "Locations",
		description: "Venue review and map data quality.",
		anchorId: "location-review",
	},
	{
		key: "site",
		label: "Site Content",
		description: "Banner copy and homepage search chips.",
		anchorId: "sliding-banner",
	},
];

const HASH_TO_TAB = new Map<string, ContentTab>(
	CONTENT_TABS.map((tab) => [tab.anchorId, tab.key]),
);
HASH_TO_TAB.set("site-content", "site");
HASH_TO_TAB.set("search-chips", "site");

const ANCHOR_SCROLL_TARGETS = new Map<string, string>([
	["site-content", "sliding-banner"],
]);

const getTabForAnchor = (anchorId: string): ContentTab | null => {
	const directTab = HASH_TO_TAB.get(anchorId);
	if (directTab) return directTab;
	if (anchorId.startsWith("submission-")) return "submissions";
	if (anchorId.startsWith("ticket-report-")) return "tickets";
	if (anchorId.startsWith("ticket-listing-")) return "tickets";
	if (anchorId.startsWith("location-review-")) return "locations";
	return null;
};

const getAnchorIdFromHash = (): string | null => {
	if (typeof window === "undefined") return null;
	const anchorId = window.location.hash.replace(/^#/, "").trim();
	return anchorId || null;
};

const getScrollAnchorId = (anchorId: string): string =>
	ANCHOR_SCROLL_TARGETS.get(anchorId) ?? anchorId;

const isVisibleAnchorTarget = (target: HTMLElement): boolean =>
	target.getClientRects().length > 0;

const scrollToContentAnchor = (anchorId: string): void => {
	if (typeof window === "undefined") return;
	let attempts = 0;
	const maxAttempts = 12;

	const scroll = () => {
		const target = document.getElementById(anchorId);
		if (target && isVisibleAnchorTarget(target)) {
			target.scrollIntoView({ behavior: "smooth", block: "start" });
			return;
		}
		if (attempts < maxAttempts) {
			attempts += 1;
			window.setTimeout(scroll, 80);
		}
	};

	window.setTimeout(scroll, 0);
};

const getLocationActionCount = (
	payload: LocationReviewPayload | undefined,
): number => {
	if (!payload?.success || !payload.items) return 0;
	return payload.items.filter((item) => {
		if (!item.isResolvable) return true;
		if (!item.resolution) return true;
		return item.resolution.source === "estimated_arrondissement";
	}).length;
};

export function ContentDashboardClient({
	initialDeploymentId,
	initialEditorData,
	initialSubmissions,
	initialLocationReview,
	initialSlidingBannerSettings,
	initialSearchChipSettings,
	initialTicketExchangeModeration,
	pendingEventReviews,
	defaultTab,
}: ContentDashboardClientProps) {
	const [activeTab, setActiveTab] = useState<ContentTab>(defaultTab);
	const [visitedTabs, setVisitedTabs] = useState<Set<ContentTab>>(
		() => new Set([defaultTab]),
	);
	const pendingSubmissionCount = initialSubmissions?.success
		? initialSubmissions.pending.length
		: 0;
	const pendingTicketReportCount =
		initialTicketExchangeModeration?.success &&
		initialTicketExchangeModeration.dashboard
			? initialTicketExchangeModeration.dashboard.pendingReportCount
			: 0;
	const locationActionCount = getLocationActionCount(initialLocationReview);

	const tabCounts = useMemo(
		() =>
			new Map<ContentTab, number>([
				["submissions", pendingSubmissionCount],
				["tickets", pendingTicketReportCount],
				["locations", locationActionCount],
			]),
		[pendingSubmissionCount, pendingTicketReportCount, locationActionCount],
	);

	const openTab = useCallback((tab: ContentTab, updateHash = true) => {
		setActiveTab(tab);
		setVisitedTabs((current) => new Set(current).add(tab));
		if (!updateHash || typeof window === "undefined") return;
		const anchorId =
			CONTENT_TABS.find((candidate) => candidate.key === tab)?.anchorId ??
			"event-submissions";
		window.history.replaceState(
			null,
			"",
			`${window.location.pathname}#${anchorId}`,
		);
		scrollToContentAnchor(anchorId);
	}, []);

	useEffect(() => {
		const syncHashToTab = () => {
			const anchorId = getAnchorIdFromHash();
			if (!anchorId) return;
			const hashTab = getTabForAnchor(anchorId);
			if (!hashTab) return;
			openTab(hashTab, false);
			scrollToContentAnchor(getScrollAnchorId(anchorId));
		};

		syncHashToTab();
		window.addEventListener("hashchange", syncHashToTab);
		return () => window.removeEventListener("hashchange", syncHashToTab);
	}, [openTab]);

	useEffect(() => {
		const anchorId = getAnchorIdFromHash();
		if (!anchorId) return;
		if (getTabForAnchor(anchorId) !== activeTab) return;
		scrollToContentAnchor(getScrollAnchorId(anchorId));
	}, [activeTab]);

	return (
		<div className="space-y-6">
			<div className="ooo-admin-card-soft rounded-md border p-3">
				<div className="flex gap-2 overflow-x-auto pb-1">
					{CONTENT_TABS.map((tab) => {
						const isActive = activeTab === tab.key;
						const count = tabCounts.get(tab.key) ?? 0;
						return (
							<button
								key={tab.key}
								type="button"
								onClick={() => openTab(tab.key)}
								className={cn(
									"min-w-44 shrink-0 rounded-md border px-3 py-2 text-left transition-colors",
									isActive
										? "border-foreground/35 bg-foreground text-background"
										: "bg-background/70 text-foreground hover:bg-accent",
								)}
							>
								<span className="flex items-center gap-2 text-xs font-semibold">
									{tab.label}
									{count > 0 ? (
										<Badge
											variant={isActive ? "secondary" : "destructive"}
											className="h-5 px-1.5 text-[10px]"
										>
											{count}
										</Badge>
									) : null}
								</span>
								<span
									className={cn(
										"mt-1 block text-[11px] leading-snug",
										isActive ? "text-background/75" : "text-muted-foreground",
									)}
								>
									{tab.description}
								</span>
							</button>
						);
					})}
				</div>
			</div>

			{visitedTabs.has("submissions") ? (
				<section
					id="event-submissions"
					className={cn(
						"scroll-mt-44",
						activeTab !== "submissions" && "hidden",
					)}
				>
					<EventSubmissionsCard initialPayload={initialSubmissions} />
				</section>
			) : null}

			{visitedTabs.has("sheet") ? (
				<section
					id="event-sheet-editor"
					className={cn("scroll-mt-44", activeTab !== "sheet" && "hidden")}
				>
					<EventSheetEditorCard
						isAuthenticated
						initialDeploymentId={initialDeploymentId}
						initialEditorData={initialEditorData}
						pendingEventReviews={pendingEventReviews}
					/>
				</section>
			) : null}

			{visitedTabs.has("tickets") ? (
				<section
					id="ticket-exchange-moderation"
					className={cn("scroll-mt-44", activeTab !== "tickets" && "hidden")}
				>
					<TicketExchangeModerationCard
						initialPayload={initialTicketExchangeModeration}
					/>
				</section>
			) : null}

			{visitedTabs.has("locations") ? (
				<section
					id="location-review"
					className={cn("scroll-mt-44", activeTab !== "locations" && "hidden")}
				>
					<LocationReviewCard initialPayload={initialLocationReview} />
				</section>
			) : null}

			{visitedTabs.has("site") ? (
				<section
					id="sliding-banner"
					className={cn(
						"space-y-6 scroll-mt-44",
						activeTab !== "site" && "hidden",
					)}
				>
					<SlidingBannerSettingsCard
						initialSettings={initialSlidingBannerSettings}
					/>
					<div id="search-chips" className="scroll-mt-44">
						<SearchChipSettingsCard
							initialSettings={initialSearchChipSettings}
						/>
					</div>
				</section>
			) : null}
		</div>
	);
}
