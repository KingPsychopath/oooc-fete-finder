"use server";

import { validateAdminAccessFromServerContext } from "@/features/auth/admin-validation";
import { getLiveEvents } from "@/features/data-management/runtime-service";
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
				outboundRate: number;
				calendarRate: number;
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
				outboundRate: number;
				calendarRate: number;
			}>;
			discovery: {
				searchCount: number;
				filterApplyCount: number;
				filterClearCount: number;
				uniqueSessionCount: number;
				topSearches: Array<{ query: string; count: number }>;
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
			topSearches,
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
				? discoveryRepository.listTopSearches({ startAt, endAt, limit: 20 })
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

		return {
			success: true,
			windowDays: safeWindowDays,
			range: { startAt, endAt },
			summary: {
				clickCount: summary.clickCount,
				outboundClickCount: summary.outboundClickCount,
				calendarSyncCount: summary.calendarSyncCount,
				uniqueSessionCount: summary.uniqueSessionCount,
				outboundRate: toPercent(summary.outboundClickCount, summary.clickCount),
				calendarRate: toPercent(summary.calendarSyncCount, summary.clickCount),
			},
			dailySeries,
			rows: topRows.map((row) => ({
				eventKey: row.eventKey,
				eventName: eventNameByKey.get(row.eventKey) || row.eventKey,
				clickCount: row.clickCount,
				outboundClickCount: row.outboundClickCount,
				calendarSyncCount: row.calendarSyncCount,
				uniqueSessionCount: row.uniqueSessionCount,
				outboundRate: toPercent(row.outboundClickCount, row.clickCount),
				calendarRate: toPercent(row.calendarSyncCount, row.clickCount),
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

export async function exportGenreSegmentCsv(input: {
	genre: MusicGenre;
	minScore?: number;
}): Promise<
	| { success: true; csv: string; filename: string; count: number }
	| { success: false; error: string }
> {
	try {
		await assertAdmin();
		const repository = getUserGenrePreferenceRepository();
		if (!repository) {
			return { success: false, error: "Postgres not configured" };
		}

		const knownGenre = MUSIC_GENRES.some((genre) => genre.key === input.genre);
		if (!knownGenre) {
			return { success: false, error: "Unknown genre segment" };
		}

		const minScore = Math.max(
			1,
			Math.min(100, Math.floor(input.minScore ?? 2)),
		);
		const rows = await repository.listSegmentByGenre({
			genre: input.genre,
			minScore,
			limit: 5000,
		});

		const header = [
			"first_name",
			"last_name",
			"email",
			"genre",
			"score",
			"last_seen_at",
		];
		const escapeCell = (value: string | number): string => {
			const text = String(value ?? "");
			if (text.includes(",") || text.includes('"') || text.includes("\n")) {
				return `"${text.replace(/"/g, '""')}"`;
			}
			return text;
		};
		const lines = rows.map((row) =>
			[
				row.firstName,
				row.lastName,
				row.email,
				input.genre,
				row.score,
				row.lastSeenAt,
			]
				.map(escapeCell)
				.join(","),
		);
		const csv = [header.join(","), ...lines].join("\n");
		const filename = `oooc-genre-segment-${input.genre}-${new Date()
			.toISOString()
			.slice(0, 10)}.csv`;

		return {
			success: true,
			csv,
			filename,
			count: rows.length,
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error ? error.message : "Unknown genre export error",
		};
	}
}
