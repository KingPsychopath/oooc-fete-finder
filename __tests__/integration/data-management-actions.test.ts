import { beforeEach, describe, expect, it, vi } from "vitest";

const makeEvent = (id: string) => ({
	id,
	name: `Event ${id}`,
	day: "friday" as const,
	date: "2025-06-21",
	time: "18:00",
	endTime: "23:00",
	arrondissement: 11 as const,
	location: "Paris",
	link: "https://example.com",
	type: "Day Party" as const,
	genre: ["afrobeats" as const],
	venueTypes: ["indoor" as const],
	indoor: true,
	verified: true,
});

type Setup = {
	getLiveSiteEventsSnapshot: typeof import("@/features/data-management/actions").getLiveSiteEventsSnapshot;
	runtimeManagerGetEvents: ReturnType<typeof vi.fn>;
	dataManagerGetEventsData: ReturnType<typeof vi.fn>;
	validateAdminAccess: ReturnType<typeof vi.fn>;
};

const loadActions = async (): Promise<Setup> => {
	vi.resetModules();

	const runtimeManagerGetEvents = vi.fn();
	const dataManagerGetEventsData = vi.fn();
	const validateAdminAccess = vi.fn().mockResolvedValue(true);

	vi.doMock("@/lib/config/env", () => ({
		env: {
			ADMIN_KEY: "test",
			DATA_MODE: "remote",
			DATABASE_URL: "postgres://test",
			LOCAL_CSV_LAST_UPDATED: "2026-02-17",
			GOOGLE_SERVICE_ACCOUNT_KEY: "",
			GOOGLE_SERVICE_ACCOUNT_FILE: "",
			REMOTE_CSV_URL: "",
			GOOGLE_SHEET_ID: "",
			NODE_ENV: "test",
			NEXT_PUBLIC_BASE_PATH: "",
			NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
		},
	}));

	vi.doMock("@/features/auth/admin-validation", () => ({
		validateAdminAccessFromServerContext: validateAdminAccess,
	}));

	vi.doMock("@/lib/cache/cache-manager", () => ({
		EventsRuntimeManager: {
			getEvents: runtimeManagerGetEvents,
			forceRefresh: vi.fn(),
			getRuntimeDataStatus: vi.fn(),
			getRuntimeMetrics: vi.fn(),
			fullRevalidation: vi.fn(),
		},
	}));

	vi.doMock("@/features/data-management/data-manager", () => ({
		DataManager: {
			getEventsData: dataManagerGetEventsData,
			getDataConfigStatus: vi.fn(),
		},
	}));

	vi.doMock("@/features/data-management/local-event-store", () => ({
		LocalEventStore: {
			getStatus: vi.fn(),
			getCsv: vi.fn(),
			saveCsv: vi.fn(),
			clearCsv: vi.fn(),
			getPreview: vi.fn(),
		},
	}));

	const actions = await import("@/features/data-management/actions");
	return {
		getLiveSiteEventsSnapshot: actions.getLiveSiteEventsSnapshot,
		runtimeManagerGetEvents,
		dataManagerGetEventsData,
		validateAdminAccess,
	};
};

describe("getLiveSiteEventsSnapshot", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("uses runtime site payload path when forceRefresh=false", async () => {
		const {
			getLiveSiteEventsSnapshot,
			runtimeManagerGetEvents,
			dataManagerGetEventsData,
		} =
			await loadActions();
		runtimeManagerGetEvents.mockResolvedValue({
			success: true,
			data: [makeEvent("1")],
			count: 1,
			cached: false,
			source: "store",
			lastUpdate: "2026-02-17T00:00:00.000Z",
		});

		const result = await getLiveSiteEventsSnapshot("token", 50, {
			forceRefresh: false,
		});

		expect(result.success).toBe(true);
		expect(result.source).toBe("store");
		expect(result.totalCount).toBe(1);
		expect(runtimeManagerGetEvents).toHaveBeenCalledTimes(1);
		expect(dataManagerGetEventsData).not.toHaveBeenCalled();
	});

	it("uses fresh preview path when forceRefresh=true without mutating live cache", async () => {
		const {
			getLiveSiteEventsSnapshot,
			runtimeManagerGetEvents,
			dataManagerGetEventsData,
		} =
			await loadActions();
		dataManagerGetEventsData.mockResolvedValue({
			success: true,
			data: [makeEvent("2")],
			count: 1,
			source: "store",
			warnings: ["fresh preview"],
			lastUpdate: "2026-02-17T01:00:00.000Z",
		});

		const result = await getLiveSiteEventsSnapshot("token", 50, {
			forceRefresh: true,
		});

		expect(result.success).toBe(true);
		expect(result.source).toBe("store");
		expect(result.totalCount).toBe(1);
		expect(dataManagerGetEventsData).toHaveBeenCalledTimes(1);
		expect(runtimeManagerGetEvents).not.toHaveBeenCalled();
	});

	it("returns unauthorized when admin validation fails", async () => {
		const { getLiveSiteEventsSnapshot, validateAdminAccess } = await loadActions();
		validateAdminAccess.mockResolvedValue(false);

		const result = await getLiveSiteEventsSnapshot("bad-token", 50, {
			forceRefresh: true,
		});

		expect(result.success).toBe(false);
		expect(result.error).toBe("Unauthorized access");
	});
});
