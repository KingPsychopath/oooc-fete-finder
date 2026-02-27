"use server";

import { validateAdminAccessFromServerContext } from "@/features/auth/admin-validation";
import { UserCollectionStore } from "@/features/auth/user-collection-store";
import { getLiveEvents } from "@/features/data-management/runtime-service";
import { clusterTopSearchQueries } from "@/features/events/engagement/search-query-clustering";
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

const DISCOVERY_FILTER_GROUPS = [
	"date_range",
	"day_night",
	"arrondissement",
	"genre",
	"nationality",
	"venue_type",
	"venue_setting",
	"oooc_pick",
	"price_range",
	"age_range",
] as const;

type DiscoveryFilterGroup = (typeof DISCOVERY_FILTER_GROUPS)[number];

const knownDiscoveryFilterGroups = new Set<string>(DISCOVERY_FILTER_GROUPS);

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

export async function getEventEngagementDashboard(windowDays = 30): Promise<
	| {
			success: true;
			windowDays: number;
			range: {
				startAt: string;
				endAt: string;
			};
			summary: {
				clickCount: number;
				outboundClickCount: number;
				calendarSyncCount: number;
				uniqueSessionCount: number;
				uniqueViewSessionCount: number;
				uniqueOutboundSessionCount: number;
				uniqueCalendarSessionCount: number;
				outboundSessionRate: number;
				calendarSessionRate: number;
				outboundInteractionRate: number;
				calendarInteractionRate: number;
			};
			dailySeries: Array<{
				day: string;
				clickCount: number;
				outboundClickCount: number;
				calendarSyncCount: number;
			}>;
			rows: Array<{
				eventKey: string;
				eventName: string;
				clickCount: number;
				outboundClickCount: number;
				calendarSyncCount: number;
				uniqueSessionCount: number;
				uniqueViewSessionCount: number;
				uniqueOutboundSessionCount: number;
				uniqueCalendarSessionCount: number;
				outboundSessionRate: number;
				calendarSessionRate: number;
				outboundInteractionRate: number;
				calendarInteractionRate: number;
			}>;
			discovery: {
				searchCount: number;
				filterApplyCount: number;
				filterClearCount: number;
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

		const [
			summary,
			dailySeries,
			topRows,
			eventsResult,
			discoverySummary,
			topSearchesRaw,
			topFilters,
			topGenresRaw,
		] = await Promise.all([
			engagementRepository.summarizeWindow({ startAt, endAt }),
			engagementRepository.listDailySeries({ startAt, endAt }),
			engagementRepository.listTopEvents({ startAt, endAt, limit: 60 }),
			getLiveEvents({
				includeFeaturedProjection: false,
				includeEngagementProjection: false,
			}),
			discoveryRepository
				? discoveryRepository.summarizeWindow({ startAt, endAt })
				: Promise.resolve({
						searchCount: 0,
						filterApplyCount: 0,
						filterClearCount: 0,
						uniqueSessionCount: 0,
					}),
			discoveryRepository
				? discoveryRepository.listTopSearches({ startAt, endAt, limit: 250 })
				: Promise.resolve([]),
			discoveryRepository
				? discoveryRepository.listTopFilters({ startAt, endAt, limit: 30 })
				: Promise.resolve([]),
			preferenceRepository
				? preferenceRepository.listTopGenres({ limit: 10 })
				: Promise.resolve([]),
		]);

		const eventNameByKey = new Map<string, string>();
		if (eventsResult.success) {
			for (const event of eventsResult.data) {
				eventNameByKey.set(event.eventKey, event.name);
			}
		}

		const genreLabelByKey = new Map(
			MUSIC_GENRES.map((genre) => [genre.key, genre.label]),
		);

		const topSearches = clusterTopSearchQueries(topSearchesRaw, 20);

		return {
			success: true,
			windowDays: safeWindowDays,
			range: { startAt, endAt },
			summary: {
				clickCount: summary.clickCount,
				outboundClickCount: summary.outboundClickCount,
				calendarSyncCount: summary.calendarSyncCount,
				uniqueSessionCount: summary.uniqueSessionCount,
				uniqueViewSessionCount: summary.uniqueViewSessionCount,
				uniqueOutboundSessionCount: summary.uniqueOutboundSessionCount,
				uniqueCalendarSessionCount: summary.uniqueCalendarSessionCount,
				outboundSessionRate: toPercent(
					summary.uniqueOutboundSessionCount,
					summary.uniqueViewSessionCount,
				),
				calendarSessionRate: toPercent(
					summary.uniqueCalendarSessionCount,
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
			},
			dailySeries,
			rows: topRows.map((row) => ({
				eventKey: row.eventKey,
				eventName: eventNameByKey.get(row.eventKey) || row.eventKey,
				clickCount: row.clickCount,
				outboundClickCount: row.outboundClickCount,
				calendarSyncCount: row.calendarSyncCount,
				uniqueSessionCount: row.uniqueSessionCount,
				uniqueViewSessionCount: row.uniqueViewSessionCount,
				uniqueOutboundSessionCount: row.uniqueOutboundSessionCount,
				uniqueCalendarSessionCount: row.uniqueCalendarSessionCount,
				outboundSessionRate: toPercent(
					row.uniqueOutboundSessionCount,
					row.uniqueViewSessionCount,
				),
				calendarSessionRate: toPercent(
					row.uniqueCalendarSessionCount,
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
			})),
			discovery: {
				searchCount: discoverySummary.searchCount,
				filterApplyCount: discoverySummary.filterApplyCount,
				filterClearCount: discoverySummary.filterClearCount,
				uniqueSessionCount: discoverySummary.uniqueSessionCount,
				topSearches,
				topFilters,
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
					knownDiscoveryFilterGroups.has(rule.filterGroup) &&
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
