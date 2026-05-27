import { beforeEach, describe, expect, it, vi } from "vitest";

type Setup = {
	getEventEngagementDashboard: typeof import("@/features/events/engagement/actions").getEventEngagementDashboard;
	validateAdminAccess: ReturnType<typeof vi.fn>;
	getEngagementRepository: {
		summarizeWindow: ReturnType<typeof vi.fn>;
		listDailySeries: ReturnType<typeof vi.fn>;
		listTopEvents: ReturnType<typeof vi.fn>;
		listMapProviderBreakdown: ReturnType<typeof vi.fn>;
	};
	getDiscoveryRepository: {
		summarizeWindow: ReturnType<typeof vi.fn>;
		summarizeTrafficWindow: ReturnType<typeof vi.fn>;
		listDailyTrafficSeries: ReturnType<typeof vi.fn>;
		listTopTrafficDimension: ReturnType<typeof vi.fn>;
		listTopSearches: ReturnType<typeof vi.fn>;
		listTopFilters: ReturnType<typeof vi.fn>;
		listTopDiscoveryActions: ReturnType<typeof vi.fn>;
	};
	getPreferenceRepository: {
		listTopGenres: ReturnType<typeof vi.fn>;
	};
	getLiveEvents: ReturnType<typeof vi.fn>;
	clusterTopSearchQueries: ReturnType<typeof vi.fn>;
};

const loadActions = async (): Promise<Setup> => {
	vi.resetModules();

	const validateAdminAccess = vi.fn().mockResolvedValue(true);
	const getLiveEvents = vi.fn().mockResolvedValue({
		success: true,
		data: [],
		count: 0,
		cached: false,
		source: "store",
	});

	const getEngagementRepository = {
		summarizeWindow: vi.fn().mockResolvedValue({
			clickCount: 0,
			dedupedViewCount: 0,
			outboundClickCount: 0,
			calendarSyncCount: 0,
			mapOpenCount: 0,
			mapPreferenceChangeCount: 4,
			uniqueSessionCount: 0,
			uniqueViewSessionCount: 0,
			uniqueOutboundSessionCount: 0,
			uniqueCalendarSessionCount: 0,
			uniqueMapSessionCount: 0,
		}),
		listDailySeries: vi.fn().mockResolvedValue([]),
		listTopEvents: vi.fn().mockResolvedValue([]),
		listMapProviderBreakdown: vi.fn().mockResolvedValue([]),
	};

	const getDiscoveryRepository = {
		summarizeWindow: vi.fn().mockResolvedValue({
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
		summarizeTrafficWindow: vi.fn().mockResolvedValue({
			pageViewCount: 12,
			uniqueVisitorCount: 5,
			knownHostCount: 1,
			knownReferrerCount: 2,
			engagedSessionCount: 3,
		}),
		listDailyTrafficSeries: vi.fn().mockResolvedValue([
			{
				day: "2026-05-27",
				pageViewCount: 12,
				uniqueVisitorCount: 5,
				engagedSessionCount: 3,
			},
		]),
		listTopTrafficDimension: vi.fn().mockResolvedValue([]),
		listTopSearches: vi.fn().mockResolvedValue([]),
		listTopFilters: vi.fn().mockResolvedValue([]),
		listTopDiscoveryActions: vi.fn().mockResolvedValue([]),
	};

	const getPreferenceRepository = {
		listTopGenres: vi.fn().mockResolvedValue([]),
	};

	const clusterTopSearchQueries = vi.fn().mockReturnValue([]);

	vi.doMock("@/features/auth/admin-validation", () => ({
		validateAdminAccessFromServerContext: validateAdminAccess,
	}));
	vi.doMock("@/features/data-management/runtime-service", () => ({
		getLiveEvents,
	}));
	vi.doMock("@/lib/platform/postgres/event-engagement-repository", () => ({
		getEventEngagementRepository: () => getEngagementRepository,
	}));
	vi.doMock("@/lib/platform/postgres/discovery-analytics-repository", () => ({
		getDiscoveryAnalyticsRepository: () => getDiscoveryRepository,
	}));
	vi.doMock("@/lib/platform/postgres/user-genre-preference-repository", () => ({
		getUserGenrePreferenceRepository: () => getPreferenceRepository,
	}));
	vi.doMock("@/features/events/engagement/search-query-clustering", () => ({
		clusterTopSearchQueries,
	}));
	vi.doMock("@/features/events/types", () => ({
		MUSIC_GENRES: [
			{ key: "afro", label: "Afro" },
			{ key: "house", label: "House" },
		],
	}));

	const actions = await import("@/features/events/engagement/actions");

	return {
		getEventEngagementDashboard: actions.getEventEngagementDashboard,
		validateAdminAccess,
		getEngagementRepository,
		getDiscoveryRepository,
		getPreferenceRepository,
		getLiveEvents,
		clusterTopSearchQueries,
	};
};

describe("getEventEngagementDashboard", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("surfaces map preference changes as the global total for map app preferences", async () => {
		const { getEventEngagementDashboard } = await loadActions();
		const result = await getEventEngagementDashboard(7);

		expect(result.success).toBe(true);
		if (result.success !== true) {
			throw new Error("Expected dashboard query to succeed");
		}
		expect(result.summary.mapPreferenceChangeCount).toBe(4);
	});

	it("surfaces first-party traffic summary and daily page views", async () => {
		const { getEventEngagementDashboard, getDiscoveryRepository } =
			await loadActions();
		const result = await getEventEngagementDashboard(7);

		expect(result.success).toBe(true);
		if (result.success !== true) {
			throw new Error("Expected dashboard query to succeed");
		}
		expect(result.summary.pageViewCount).toBe(12);
		expect(result.summary.uniqueVisitorCount).toBe(5);
		expect(result.summary.engagedVisitRate).toBe(60);
		expect(result.dailySeries[0]).toMatchObject({
			day: "2026-05-27",
			pageViewCount: 12,
			uniqueVisitorCount: 5,
		});
		expect(getDiscoveryRepository.listTopTrafficDimension).toHaveBeenCalledWith(
			expect.objectContaining({ dimension: "referrer" }),
		);
	});
});
