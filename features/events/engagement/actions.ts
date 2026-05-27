"use server";

import { validateAdminAccessFromServerContext } from "@/features/auth/admin-validation";
import { UserCollectionStore } from "@/features/auth/user-collection-store";
import { getLiveEvents } from "@/features/data-management/runtime-service";
import {
	type SearchClusterMode,
	clusterTopSearchQueries,
} from "@/features/events/engagement/search-query-clustering";
import { MUSIC_GENRES, type MusicGenre } from "@/features/events/types";
import { getDiscoveryAnalyticsRepository } from "@/lib/platform/postgres/discovery-analytics-repository";
import { getEventEngagementRepository } from "@/lib/platform/postgres/event-engagement-repository";
import { getUserGenrePreferenceRepository } from "@/lib/platform/postgres/user-genre-preference-repository";

const assertAdmin = async () => {
	const authorized = await validateAdminAccessFromServerContext();
	if (!authorized) {
		throw new Error("Unauthorized access");
	}
};

const toPercent = (numerator: number, denominator: number): number => {
	if (denominator <= 0) return 0;
	return Math.round((numerator / denominator) * 1000) / 10;
};

const buildWindow = (
	windowDays: number,
): {
	safeWindowDays: number;
	startAt: string;
	endAt: string;
} => {
	const safeWindowDays = Math.max(1, Math.min(windowDays, 365));
	const endAt = new Date().toISOString();
	const startDate = new Date();
	startDate.setDate(startDate.getDate() - safeWindowDays);
	const startAt = startDate.toISOString();
	return { safeWindowDays, startAt, endAt };
};

const buildPreviousWindow = (startAt: string, windowDays: number) => {
	const endDate = new Date(startAt);
	const startDate = new Date(endDate);
	startDate.setDate(startDate.getDate() - windowDays);
	return {
		startAt: startDate.toISOString(),
		endAt: endDate.toISOString(),
	};
};

const toDeltaPercent = (current: number, previous: number): number | null => {
	if (previous <= 0) return null;
	return Math.round(((current - previous) / previous) * 1000) / 10;
};

const DISCOVERY_FILTER_GROUPS = [
	"date_range",
	"day_night",
	"arrondissement",
	"genre",
	"genre_include",
	"genre_exclude",
	"event_category",
	"nationality",
	"venue_type",
	"venue_setting",
	"oooc_pick",
	"price_range",
	"age_range",
] as const;

type DiscoveryFilterGroup = (typeof DISCOVERY_FILTER_GROUPS)[number];

const escapeCsvCell = (value: string | number): string => {
	const text = String(value ?? "");
	if (text.includes(",") || text.includes('"') || text.includes("\n")) {
		return `"${text.replace(/"/g, '""')}"`;
	}
	return text;
};

type SegmentCriterion = {
	key: string;
	label: string;
	matches: Map<string, { hitCount: number; lastSeenAt: string }>;
};

export async function getEventEngagementDashboard(
	windowDays = 7,
	searchClusterMode: SearchClusterMode = "conservative",
	options: {
		includeAuthenticatedOnly?: boolean;
	} = {},
): Promise<
	| {
			success: true;
			windowDays: number;
			range: {
				startAt: string;
				endAt: string;
			};
			summary: {
				pageViewCount: number;
				uniqueVisitorCount: number;
				engagedVisitRate: number;
				trafficDeltas: {
					pageViewCount: number | null;
					uniqueVisitorCount: number | null;
					engagedVisitRate: number | null;
				};
				clickCount: number;
				dedupedViewCount: number;
				outboundClickCount: number;
				calendarSyncCount: number;
				mapOpenCount: number;
				mapPreferenceChangeCount: number;
				uniqueSessionCount: number;
				uniqueViewSessionCount: number;
				uniqueOutboundSessionCount: number;
				uniqueCalendarSessionCount: number;
				uniqueMapSessionCount: number;
				outboundSessionRate: number;
				calendarSessionRate: number;
				mapSessionRate: number;
				outboundInteractionRate: number;
				calendarInteractionRate: number;
				mapInteractionRate: number;
			};
			dailySeries: Array<{
				day: string;
				pageViewCount: number;
				uniqueVisitorCount: number;
				engagedSessionCount: number;
				clickCount: number;
				outboundClickCount: number;
				calendarSyncCount: number;
				mapOpenCount: number;
			}>;
			rows: Array<{
				eventKey: string;
				eventName: string;
				eventSlug: string | null;
				isLiveEvent: boolean;
				clickCount: number;
				dedupedViewCount: number;
				outboundClickCount: number;
				calendarSyncCount: number;
				mapOpenCount: number;
				mapPreferenceChangeCount: number;
				uniqueSessionCount: number;
				uniqueViewSessionCount: number;
				uniqueOutboundSessionCount: number;
				uniqueCalendarSessionCount: number;
				uniqueMapSessionCount: number;
				outboundSessionRate: number;
				calendarSessionRate: number;
				mapSessionRate: number;
				outboundInteractionRate: number;
				calendarInteractionRate: number;
				mapInteractionRate: number;
			}>;
			mapProviders: Array<{
				provider: string;
				count: number;
				uniqueSessionCount: number;
			}>;
			traffic: {
				topPages: Array<{
					label: string;
					pageViewCount: number;
					uniqueVisitorCount: number;
				}>;
				topHostnames: Array<{
					label: string;
					pageViewCount: number;
					uniqueVisitorCount: number;
				}>;
				topReferrers: Array<{
					label: string;
					pageViewCount: number;
					uniqueVisitorCount: number;
				}>;
				topCountries: Array<{
					label: string;
					pageViewCount: number;
					uniqueVisitorCount: number;
				}>;
				topTimezones: Array<{
					label: string;
					pageViewCount: number;
					uniqueVisitorCount: number;
				}>;
				topLocales: Array<{
					label: string;
					pageViewCount: number;
					uniqueVisitorCount: number;
				}>;
				topDevices: Array<{
					label: string;
					pageViewCount: number;
					uniqueVisitorCount: number;
				}>;
				topPlatforms: Array<{
					label: string;
					pageViewCount: number;
					uniqueVisitorCount: number;
				}>;
				topBrowsers: Array<{
					label: string;
					pageViewCount: number;
					uniqueVisitorCount: number;
				}>;
				topUtmSources: Array<{
					label: string;
					pageViewCount: number;
					uniqueVisitorCount: number;
				}>;
				topUtmCampaigns: Array<{
					label: string;
					pageViewCount: number;
					uniqueVisitorCount: number;
				}>;
				topLandingPages: Array<{
					path: string;
					visitorCount: number;
					engagedSessionCount: number;
					eventOpenSessionCount: number;
					outboundSessionCount: number;
					calendarSessionCount: number;
					engagedVisitRate: number;
					outboundVisitRate: number;
				}>;
				topAttributionSources: Array<{
					source: string;
					medium: string;
					campaign: string;
					referrer: string;
					visitorCount: number;
					engagedSessionCount: number;
					eventOpenSessionCount: number;
					outboundSessionCount: number;
					calendarSessionCount: number;
					engagedVisitRate: number;
					outboundVisitRate: number;
					calendarVisitRate: number;
				}>;
			};
			discovery: {
				searchClusterMode: SearchClusterMode;
				searchCount: number;
				filterApplyCount: number;
				filterClearCount: number;
				mapInteractionCount: number;
				sortChangeCount: number;
				locationRequestCount: number;
				tourInteractionCount: number;
				navClickCount: number;
				uniqueSessionCount: number;
				topSearches: Array<{
					query: string;
					count: number;
					variantCount: number;
					variants: Array<{ query: string; count: number }>;
				}>;
				topFilters: Array<{
					filterGroup: string;
					filterValue: string;
					count: number;
				}>;
				topMapInteractions: Array<{
					group: string;
					value: string;
					count: number;
				}>;
				topSortChanges: Array<{
					group: string;
					value: string;
					count: number;
				}>;
				topLocationRequests: Array<{
					group: string;
					value: string;
					count: number;
				}>;
				topTourInteractions: Array<{
					group: string;
					value: string;
					count: number;
				}>;
				topNavigationClicks: Array<{
					group: string;
					value: string;
					count: number;
				}>;
			};
			topGenres: Array<{
				genre: MusicGenre;
				label: string;
				totalScore: number;
				uniqueUsers: number;
			}>;
	  }
	| {
			success: false;
			error: string;
	  }
> {
	try {
		await assertAdmin();
		const engagementRepository = getEventEngagementRepository();
		if (!engagementRepository) {
			return { success: false, error: "Postgres not configured" };
		}
		const discoveryRepository = getDiscoveryAnalyticsRepository();
		const preferenceRepository = getUserGenrePreferenceRepository();

		const { safeWindowDays, startAt, endAt } = buildWindow(windowDays);
		const previousWindow = buildPreviousWindow(startAt, safeWindowDays);
		const includeAuthenticatedOnly = options.includeAuthenticatedOnly ?? false;

		const [
			summary,
			dailySeries,
			topRows,
			eventsResult,
			discoverySummary,
			topSearchesRaw,
			topFilters,
			topMapInteractions,
			topSortChanges,
			topLocationRequests,
			topTourInteractions,
			topNavigationClicks,
			mapProviders,
			topGenresRaw,
			trafficSummary,
			dailyTrafficSeries,
			topPages,
			topHostnames,
			topReferrers,
			topCountries,
			topTimezones,
			topLocales,
			topDevices,
			topPlatforms,
			topBrowsers,
			topUtmSources,
			topUtmCampaigns,
			topLandingPagesRaw,
			topAttributionSourcesRaw,
			previousTrafficSummary,
		] = await Promise.all([
			engagementRepository.summarizeWindow({
				startAt,
				endAt,
				includeAuthenticatedOnly,
			}),
			engagementRepository.listDailySeries({
				startAt,
				endAt,
				includeAuthenticatedOnly,
			}),
			engagementRepository.listTopEvents({
				startAt,
				endAt,
				limit: 60,
				includeAuthenticatedOnly,
			}),
			getLiveEvents({
				includeFeaturedProjection: false,
				includeEngagementProjection: false,
			}),
			discoveryRepository
				? discoveryRepository.summarizeWindow({
						startAt,
						endAt,
						includeAuthenticatedOnly,
					})
				: Promise.resolve({
						searchCount: 0,
						filterApplyCount: 0,
						filterClearCount: 0,
						mapInteractionCount: 0,
						sortChangeCount: 0,
						locationRequestCount: 0,
						tourInteractionCount: 0,
						navClickCount: 0,
						uniqueSessionCount: 0,
					}),
			discoveryRepository
				? discoveryRepository.listTopSearches({
						startAt,
						endAt,
						limit: 250,
						includeAuthenticatedOnly,
					})
				: Promise.resolve([]),
			discoveryRepository
				? discoveryRepository.listTopFilters({
						startAt,
						endAt,
						limit: 30,
						includeAuthenticatedOnly,
					})
				: Promise.resolve([]),
			discoveryRepository
				? discoveryRepository.listTopDiscoveryActions({
						actionType: "map_interaction",
						startAt,
						endAt,
						limit: 20,
						includeAuthenticatedOnly,
					})
				: Promise.resolve([]),
			discoveryRepository
				? discoveryRepository.listTopDiscoveryActions({
						actionType: "sort_change",
						startAt,
						endAt,
						limit: 10,
						includeAuthenticatedOnly,
					})
				: Promise.resolve([]),
			discoveryRepository
				? discoveryRepository.listTopDiscoveryActions({
						actionType: "location_request",
						startAt,
						endAt,
						limit: 10,
						includeAuthenticatedOnly,
					})
				: Promise.resolve([]),
			discoveryRepository
				? discoveryRepository.listTopDiscoveryActions({
						actionType: "tour_interaction",
						startAt,
						endAt,
						limit: 20,
						includeAuthenticatedOnly,
					})
				: Promise.resolve([]),
			discoveryRepository
				? discoveryRepository.listTopDiscoveryActions({
						actionType: "nav_click",
						startAt,
						endAt,
						limit: 20,
						includeAuthenticatedOnly,
					})
				: Promise.resolve([]),
			engagementRepository.listMapProviderBreakdown({
				startAt,
				endAt,
				limit: 8,
				includeAuthenticatedOnly,
			}),
			preferenceRepository
				? preferenceRepository.listTopGenres({ limit: 10 })
				: Promise.resolve([]),
			discoveryRepository
				? discoveryRepository.summarizeTrafficWindow({
						startAt,
						endAt,
						includeAuthenticatedOnly,
					})
				: Promise.resolve({
						pageViewCount: 0,
						uniqueVisitorCount: 0,
						knownHostCount: 0,
						knownReferrerCount: 0,
						engagedSessionCount: 0,
					}),
			discoveryRepository
				? discoveryRepository.listDailyTrafficSeries({
						startAt,
						endAt,
						includeAuthenticatedOnly,
					})
				: Promise.resolve([]),
			discoveryRepository
				? discoveryRepository.listTopTrafficDimension({
						dimension: "path",
						startAt,
						endAt,
						limit: 30,
						includeAuthenticatedOnly,
					})
				: Promise.resolve([]),
			discoveryRepository
				? discoveryRepository.listTopTrafficDimension({
						dimension: "hostname",
						startAt,
						endAt,
						limit: 10,
						includeAuthenticatedOnly,
					})
				: Promise.resolve([]),
			discoveryRepository
				? discoveryRepository.listTopTrafficDimension({
						dimension: "referrer",
						startAt,
						endAt,
						limit: 20,
						includeAuthenticatedOnly,
					})
				: Promise.resolve([]),
			discoveryRepository
				? discoveryRepository.listTopTrafficDimension({
						dimension: "countryCode",
						startAt,
						endAt,
						limit: 20,
						includeAuthenticatedOnly,
					})
				: Promise.resolve([]),
			discoveryRepository
				? discoveryRepository.listTopTrafficDimension({
						dimension: "timezone",
						startAt,
						endAt,
						limit: 12,
						includeAuthenticatedOnly,
					})
				: Promise.resolve([]),
			discoveryRepository
				? discoveryRepository.listTopTrafficDimension({
						dimension: "locale",
						startAt,
						endAt,
						limit: 12,
						includeAuthenticatedOnly,
					})
				: Promise.resolve([]),
			discoveryRepository
				? discoveryRepository.listTopTrafficDimension({
						dimension: "deviceClass",
						startAt,
						endAt,
						limit: 8,
						includeAuthenticatedOnly,
					})
				: Promise.resolve([]),
			discoveryRepository
				? discoveryRepository.listTopTrafficDimension({
						dimension: "platform",
						startAt,
						endAt,
						limit: 8,
						includeAuthenticatedOnly,
					})
				: Promise.resolve([]),
			discoveryRepository
				? discoveryRepository.listTopTrafficDimension({
						dimension: "browserFamily",
						startAt,
						endAt,
						limit: 8,
						includeAuthenticatedOnly,
					})
				: Promise.resolve([]),
			discoveryRepository
				? discoveryRepository.listTopTrafficDimension({
						dimension: "utmSource",
						startAt,
						endAt,
						limit: 12,
						includeAuthenticatedOnly,
					})
				: Promise.resolve([]),
			discoveryRepository
				? discoveryRepository.listTopTrafficDimension({
						dimension: "utmCampaign",
						startAt,
						endAt,
						limit: 12,
						includeAuthenticatedOnly,
					})
				: Promise.resolve([]),
			discoveryRepository
				? discoveryRepository.listTopLandingPages({
						startAt,
						endAt,
						limit: 12,
						includeAuthenticatedOnly,
					})
				: Promise.resolve([]),
			discoveryRepository
				? discoveryRepository.listTopAttributionSources({
						startAt,
						endAt,
						limit: 12,
						includeAuthenticatedOnly,
					})
				: Promise.resolve([]),
			discoveryRepository
				? discoveryRepository.summarizeTrafficWindow({
						startAt: previousWindow.startAt,
						endAt: previousWindow.endAt,
						includeAuthenticatedOnly,
					})
				: Promise.resolve({
						pageViewCount: 0,
						uniqueVisitorCount: 0,
						knownHostCount: 0,
						knownReferrerCount: 0,
						engagedSessionCount: 0,
					}),
		]);

		const eventMetaByKey = new Map<string, { name: string; slug: string }>();
		if (eventsResult.success) {
			for (const event of eventsResult.data) {
				eventMetaByKey.set(event.eventKey, {
					name: event.name,
					slug: event.slug,
				});
			}
		}

		const genreLabelByKey = new Map<string, string>(
			MUSIC_GENRES.map((genre) => [genre.key, genre.label]),
		);

		const topSearches = clusterTopSearchQueries(
			topSearchesRaw,
			20,
			searchClusterMode,
		);
		const currentEngagedVisitRate = toPercent(
			trafficSummary.engagedSessionCount,
			trafficSummary.uniqueVisitorCount,
		);
		const previousEngagedVisitRate = toPercent(
			previousTrafficSummary.engagedSessionCount,
			previousTrafficSummary.uniqueVisitorCount,
		);

		return {
			success: true,
			windowDays: safeWindowDays,
			range: { startAt, endAt },
			summary: {
				pageViewCount: trafficSummary.pageViewCount,
				uniqueVisitorCount: trafficSummary.uniqueVisitorCount,
				engagedVisitRate: currentEngagedVisitRate,
				trafficDeltas: {
					pageViewCount: toDeltaPercent(
						trafficSummary.pageViewCount,
						previousTrafficSummary.pageViewCount,
					),
					uniqueVisitorCount: toDeltaPercent(
						trafficSummary.uniqueVisitorCount,
						previousTrafficSummary.uniqueVisitorCount,
					),
					engagedVisitRate: toDeltaPercent(
						currentEngagedVisitRate,
						previousEngagedVisitRate,
					),
				},
				clickCount: summary.clickCount,
				dedupedViewCount: summary.dedupedViewCount,
				outboundClickCount: summary.outboundClickCount,
				calendarSyncCount: summary.calendarSyncCount,
				mapOpenCount: summary.mapOpenCount,
				mapPreferenceChangeCount: summary.mapPreferenceChangeCount,
				uniqueSessionCount: summary.uniqueSessionCount,
				uniqueViewSessionCount: summary.uniqueViewSessionCount,
				uniqueOutboundSessionCount: summary.uniqueOutboundSessionCount,
				uniqueCalendarSessionCount: summary.uniqueCalendarSessionCount,
				uniqueMapSessionCount: summary.uniqueMapSessionCount,
				outboundSessionRate: toPercent(
					summary.uniqueOutboundSessionCount,
					summary.uniqueViewSessionCount,
				),
				calendarSessionRate: toPercent(
					summary.uniqueCalendarSessionCount,
					summary.uniqueViewSessionCount,
				),
				mapSessionRate: toPercent(
					summary.uniqueMapSessionCount,
					summary.uniqueViewSessionCount,
				),
				outboundInteractionRate: toPercent(
					summary.outboundClickCount,
					summary.clickCount,
				),
				calendarInteractionRate: toPercent(
					summary.calendarSyncCount,
					summary.clickCount,
				),
				mapInteractionRate: toPercent(summary.mapOpenCount, summary.clickCount),
			},
			dailySeries: dailyTrafficSeries.map((trafficRow) => {
				const engagementRow = dailySeries.find(
					(row) => row.day === trafficRow.day,
				);
				return {
					day: trafficRow.day,
					pageViewCount: trafficRow.pageViewCount,
					uniqueVisitorCount: trafficRow.uniqueVisitorCount,
					engagedSessionCount: trafficRow.engagedSessionCount,
					clickCount: engagementRow?.clickCount ?? 0,
					outboundClickCount: engagementRow?.outboundClickCount ?? 0,
					calendarSyncCount: engagementRow?.calendarSyncCount ?? 0,
					mapOpenCount: engagementRow?.mapOpenCount ?? 0,
				};
			}),
			rows: topRows.map((row) => {
				const eventMeta = eventMetaByKey.get(row.eventKey);
				return {
					eventKey: row.eventKey,
					eventName: eventMeta?.name ?? row.eventKey,
					eventSlug: eventMeta?.slug ?? null,
					isLiveEvent: Boolean(eventMeta),
					clickCount: row.clickCount,
					dedupedViewCount: row.dedupedViewCount,
					outboundClickCount: row.outboundClickCount,
					calendarSyncCount: row.calendarSyncCount,
					mapOpenCount: row.mapOpenCount,
					mapPreferenceChangeCount: row.mapPreferenceChangeCount,
					uniqueSessionCount: row.uniqueSessionCount,
					uniqueViewSessionCount: row.uniqueViewSessionCount,
					uniqueOutboundSessionCount: row.uniqueOutboundSessionCount,
					uniqueCalendarSessionCount: row.uniqueCalendarSessionCount,
					uniqueMapSessionCount: row.uniqueMapSessionCount,
					outboundSessionRate: toPercent(
						row.uniqueOutboundSessionCount,
						row.uniqueViewSessionCount,
					),
					calendarSessionRate: toPercent(
						row.uniqueCalendarSessionCount,
						row.uniqueViewSessionCount,
					),
					mapSessionRate: toPercent(
						row.uniqueMapSessionCount,
						row.uniqueViewSessionCount,
					),
					outboundInteractionRate: toPercent(
						row.outboundClickCount,
						row.clickCount,
					),
					calendarInteractionRate: toPercent(
						row.calendarSyncCount,
						row.clickCount,
					),
					mapInteractionRate: toPercent(row.mapOpenCount, row.clickCount),
				};
			}),
			mapProviders,
			traffic: {
				topPages,
				topHostnames,
				topReferrers,
				topCountries,
				topTimezones,
				topLocales,
				topDevices,
				topPlatforms,
				topBrowsers,
				topUtmSources,
				topUtmCampaigns,
				topLandingPages: topLandingPagesRaw.map((row) => ({
					...row,
					engagedVisitRate: toPercent(
						row.engagedSessionCount,
						row.visitorCount,
					),
					outboundVisitRate: toPercent(
						row.outboundSessionCount,
						row.visitorCount,
					),
				})),
				topAttributionSources: topAttributionSourcesRaw.map((row) => ({
					...row,
					engagedVisitRate: toPercent(
						row.engagedSessionCount,
						row.visitorCount,
					),
					outboundVisitRate: toPercent(
						row.outboundSessionCount,
						row.visitorCount,
					),
					calendarVisitRate: toPercent(
						row.calendarSessionCount,
						row.visitorCount,
					),
				})),
			},
			discovery: {
				searchClusterMode,
				searchCount: discoverySummary.searchCount,
				filterApplyCount: discoverySummary.filterApplyCount,
				filterClearCount: discoverySummary.filterClearCount,
				mapInteractionCount: discoverySummary.mapInteractionCount,
				sortChangeCount: discoverySummary.sortChangeCount,
				locationRequestCount: discoverySummary.locationRequestCount,
				tourInteractionCount: discoverySummary.tourInteractionCount,
				navClickCount: discoverySummary.navClickCount,
				uniqueSessionCount: discoverySummary.uniqueSessionCount,
				topSearches,
				topFilters,
				topMapInteractions,
				topSortChanges,
				topLocationRequests,
				topTourInteractions,
				topNavigationClicks,
			},
			topGenres: topGenresRaw.map((row) => ({
				genre: row.genre,
				label: genreLabelByKey.get(row.genre) || row.genre,
				totalScore: row.totalScore,
				uniqueUsers: row.uniqueUsers,
			})),
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error.message
					: "Unknown event engagement error",
		};
	}
}

export async function exportAudienceSegmentCsv(input: {
	windowDays?: number;
	minHitsPerRule?: number;
	limit?: number;
	ruleOperator?: "all" | "any";
	filterRules?: Array<{
		filterGroup: DiscoveryFilterGroup;
		filterValue: string;
	}>;
	searchContains?: string;
	genreRules?: Array<{
		genre: MusicGenre;
		minScore?: number;
	}>;
}): Promise<
	| { success: true; csv: string; filename: string; count: number }
	| { success: false; error: string }
> {
	try {
		await assertAdmin();
		const discoveryRepository = getDiscoveryAnalyticsRepository();
		const preferenceRepository = getUserGenrePreferenceRepository();
		const { startAt, endAt } = buildWindow(input.windowDays ?? 30);
		const minHitsPerRule = Math.max(
			1,
			Math.min(30, Math.floor(input.minHitsPerRule ?? 1)),
		);
		const safeLimit = Math.max(
			1,
			Math.min(10_000, Math.floor(input.limit ?? 5000)),
		);
		const ruleOperator = input.ruleOperator === "any" ? "any" : "all";
		const filterRules = (input.filterRules ?? [])
			.map((rule) => ({
				filterGroup: rule.filterGroup,
				filterValue: rule.filterValue.trim().toLowerCase(),
			}))
			.filter(
				(rule) =>
					DISCOVERY_FILTER_GROUPS.includes(rule.filterGroup) &&
					rule.filterValue.length > 0,
			);
		const genreRules = (input.genreRules ?? []).filter((rule) =>
			MUSIC_GENRES.some((genre) => genre.key === rule.genre),
		);
		const searchContains = (input.searchContains ?? "").trim().toLowerCase();

		const requiresDiscovery =
			filterRules.length > 0 || searchContains.length > 0;
		const requiresPreference = genreRules.length > 0;

		if (!requiresDiscovery && !requiresPreference) {
			return { success: false, error: "Add at least one audience rule" };
		}
		if (requiresDiscovery && !discoveryRepository) {
			return {
				success: false,
				error: "Discovery tracking database unavailable",
			};
		}
		if (requiresPreference && !preferenceRepository) {
			return {
				success: false,
				error: "Genre preference database unavailable",
			};
		}

		const criteria: SegmentCriterion[] = [];

		if (discoveryRepository) {
			for (const rule of filterRules) {
				const rows = await discoveryRepository.listUserFilterMatches({
					startAt,
					endAt,
					filterGroup: rule.filterGroup,
					filterValue: rule.filterValue,
					minHits: minHitsPerRule,
					limit: safeLimit,
				});
				criteria.push({
					key: `${rule.filterGroup}:${rule.filterValue}`,
					label: `${rule.filterGroup}=${rule.filterValue}`,
					matches: new Map(
						rows.map((row) => [
							row.email,
							{
								hitCount: row.hitCount,
								lastSeenAt: row.lastSeenAt,
							},
						]),
					),
				});
			}

			if (searchContains.length > 0) {
				const rows = await discoveryRepository.listUserSearchMatches({
					startAt,
					endAt,
					searchContains,
					minHits: minHitsPerRule,
					limit: safeLimit,
				});
				criteria.push({
					key: `search:${searchContains}`,
					label: `search~${searchContains}`,
					matches: new Map(
						rows.map((row) => [
							row.email,
							{
								hitCount: row.hitCount,
								lastSeenAt: row.lastSeenAt,
							},
						]),
					),
				});
			}
		}

		if (preferenceRepository) {
			for (const rule of genreRules) {
				const minScore = Math.max(
					1,
					Math.min(100, Math.floor(rule.minScore ?? 2)),
				);
				const rows = await preferenceRepository.listSegmentByGenre({
					genre: rule.genre,
					minScore,
					limit: safeLimit,
				});
				criteria.push({
					key: `pref:${rule.genre}:${minScore}`,
					label: `genre_pref=${rule.genre} (score>=${minScore})`,
					matches: new Map(
						rows.map((row) => [
							row.email,
							{
								hitCount: row.score,
								lastSeenAt: row.lastSeenAt,
							},
						]),
					),
				});
			}
		}

		if (criteria.length === 0) {
			return {
				success: false,
				error: "No users match the selected audience rules",
			};
		}

		const firstCriterion = criteria[0];
		let matchedEmails = new Set<string>(
			firstCriterion ? [...firstCriterion.matches.keys()] : [],
		);
		if (ruleOperator === "all") {
			for (const criterion of criteria.slice(1)) {
				matchedEmails = new Set(
					[...matchedEmails].filter((email) => criterion.matches.has(email)),
				);
			}
		} else {
			for (const criterion of criteria.slice(1)) {
				for (const email of criterion.matches.keys()) {
					matchedEmails.add(email);
				}
			}
		}

		const users = await UserCollectionStore.listAll();
		const userByEmail = new Map(
			users.map((user) => [user.email.toLowerCase(), user]),
		);
		const sortedRows = [...matchedEmails]
			.map((email) => {
				const matchedRules = criteria.map((criterion) => {
					const value = criterion.matches.get(email);
					return {
						label: criterion.label,
						hitCount: value?.hitCount ?? 0,
						lastSeenAt: value?.lastSeenAt ?? "",
					};
				});
				const totalHits = matchedRules.reduce(
					(total, rule) => total + rule.hitCount,
					0,
				);
				const lastMatchedAt = matchedRules
					.map((rule) => rule.lastSeenAt)
					.filter((value) => value.length > 0)
					.sort((left, right) => (left > right ? -1 : 1))[0];
				const user = userByEmail.get(email.toLowerCase());
				return {
					email,
					firstName: user?.firstName ?? "",
					lastName: user?.lastName ?? "",
					source: user?.source ?? "",
					lastSeenAt: user?.timestamp ?? lastMatchedAt ?? "",
					totalHits,
					matchedRules,
				};
			})
			.sort((left, right) => {
				if (right.totalHits !== left.totalHits) {
					return right.totalHits - left.totalHits;
				}
				return left.email.localeCompare(right.email);
			})
			.slice(0, safeLimit);

		const header = [
			"first_name",
			"last_name",
			"email",
			"source",
			"last_seen_at",
			"matched_rules",
			"total_rule_hits",
			"rule_hit_breakdown",
			"match_operator",
			"window_start_at",
			"window_end_at",
		];
		const lines = sortedRows.map((row) =>
			[
				row.firstName.trim(),
				row.lastName.trim(),
				row.email,
				row.source,
				row.lastSeenAt,
				row.matchedRules.length,
				row.totalHits,
				row.matchedRules
					.map((rule) => `${rule.label}(${rule.hitCount})`)
					.join(" | "),
				ruleOperator,
				startAt,
				endAt,
			]
				.map(escapeCsvCell)
				.join(","),
		);
		const csv = [header.join(","), ...lines].join("\n");
		const filename = `oooc-audience-segment-${new Date()
			.toISOString()
			.slice(0, 10)}.csv`;

		return {
			success: true,
			csv,
			filename,
			count: sortedRows.length,
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error.message
					: "Unknown audience export error",
		};
	}
}

export async function exportFirstPartyTrafficCsv(input: {
	windowDays?: number;
	includeAuthenticatedOnly?: boolean;
}): Promise<
	| { success: true; csv: string; filename: string; count: number }
	| { success: false; error: string }
> {
	try {
		await assertAdmin();
		const discoveryRepository = getDiscoveryAnalyticsRepository();
		if (!discoveryRepository) {
			return {
				success: false,
				error: "First-party analytics database unavailable",
			};
		}
		const { safeWindowDays, startAt, endAt } = buildWindow(
			input.windowDays ?? 7,
		);
		const includeAuthenticatedOnly = input.includeAuthenticatedOnly ?? false;
		const dimensions = [
			["pages", "path"],
			["hostnames", "hostname"],
			["referrers", "referrer"],
			["utm_sources", "utmSource"],
			["utm_mediums", "utmMedium"],
			["utm_campaigns", "utmCampaign"],
			["countries", "countryCode"],
			["browser_timezones", "timezone"],
			["browser_locales", "locale"],
			["devices", "deviceClass"],
			["operating_systems", "platform"],
			["browsers", "browserFamily"],
		] as const;
		const rows: Array<{
			panel: string;
			label: string;
			pageViewCount: number;
			uniqueVisitorCount: number;
			engagedSessionCount?: number;
			eventOpenSessionCount?: number;
			outboundSessionCount?: number;
			calendarSessionCount?: number;
		}> = [];
		for (const [panel, dimension] of dimensions) {
			const panelRows = await discoveryRepository.listTopTrafficDimension({
				dimension,
				startAt,
				endAt,
				limit: 100,
				includeAuthenticatedOnly,
			});
			for (const row of panelRows) {
				rows.push({ panel, ...row });
			}
		}
		const [landingPages, attributionSources] = await Promise.all([
			discoveryRepository.listTopLandingPages({
				startAt,
				endAt,
				limit: 100,
				includeAuthenticatedOnly,
			}),
			discoveryRepository.listTopAttributionSources({
				startAt,
				endAt,
				limit: 100,
				includeAuthenticatedOnly,
			}),
		]);
		for (const row of landingPages) {
			rows.push({
				panel: "landing_pages",
				label: row.path,
				pageViewCount: 0,
				uniqueVisitorCount: row.visitorCount,
				engagedSessionCount: row.engagedSessionCount,
				eventOpenSessionCount: row.eventOpenSessionCount,
				outboundSessionCount: row.outboundSessionCount,
				calendarSessionCount: row.calendarSessionCount,
			});
		}
		for (const row of attributionSources) {
			rows.push({
				panel: "source_conversion",
				label: `${row.source} / ${row.medium} / ${row.campaign} / ${row.referrer}`,
				pageViewCount: 0,
				uniqueVisitorCount: row.visitorCount,
				engagedSessionCount: row.engagedSessionCount,
				eventOpenSessionCount: row.eventOpenSessionCount,
				outboundSessionCount: row.outboundSessionCount,
				calendarSessionCount: row.calendarSessionCount,
			});
		}
		const csv = [
			[
				"panel",
				"label",
				"page_views",
				"visitors",
				"engaged_sessions",
				"event_open_sessions",
				"outbound_sessions",
				"calendar_sessions",
			]
				.map(escapeCsvCell)
				.join(","),
			...rows.map((row) =>
				[
					row.panel,
					row.label,
					row.pageViewCount,
					row.uniqueVisitorCount,
					row.engagedSessionCount ?? "",
					row.eventOpenSessionCount ?? "",
					row.outboundSessionCount ?? "",
					row.calendarSessionCount ?? "",
				]
					.map(escapeCsvCell)
					.join(","),
			),
		].join("\n");
		return {
			success: true,
			csv,
			filename: `first-party-traffic-${safeWindowDays}d.csv`,
			count: rows.length,
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error.message
					: "Unknown first-party traffic export error",
		};
	}
}

export async function exportGenreSegmentCsv(input: {
	genre: MusicGenre;
	minScore?: number;
}): Promise<
	| { success: true; csv: string; filename: string; count: number }
	| { success: false; error: string }
> {
	return exportAudienceSegmentCsv({
		genreRules: [
			{
				genre: input.genre,
				minScore: input.minScore,
			},
		],
	});
}
