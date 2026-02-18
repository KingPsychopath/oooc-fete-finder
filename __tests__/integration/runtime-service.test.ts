import { beforeEach, describe, expect, it, vi } from "vitest";

type Setup = {
	getLiveEvents: typeof import("@/features/data-management/runtime-service").getLiveEvents;
	forceRefreshEventsData: typeof import("@/features/data-management/runtime-service").forceRefreshEventsData;
	getRuntimeDataStatusFromSource: typeof import("@/features/data-management/runtime-service").getRuntimeDataStatusFromSource;
	dataManagerGetEventsData: ReturnType<typeof vi.fn>;
	dataManagerGetDataConfigStatus: ReturnType<typeof vi.fn>;
	applyFeaturedProjectionToEvents: ReturnType<typeof vi.fn>;
	revalidatePath: ReturnType<typeof vi.fn>;
	revalidateTag: ReturnType<typeof vi.fn>;
};

const makeEvent = (id: string) =>
	({ id: `evt_${id}` } as unknown as import("@/features/events/types").Event);

const loadRuntimeService = async (): Promise<Setup> => {
	vi.resetModules();

	const dataManagerGetEventsData = vi.fn();
	const dataManagerGetDataConfigStatus = vi.fn();
	const isValidEventsData = vi.fn(() => true);
	const applyFeaturedProjectionToEvents = vi.fn((events) =>
		Promise.resolve(events),
	);
	const revalidatePath = vi.fn();
	const revalidateTag = vi.fn();

	vi.doMock("@/features/data-management/data-manager", () => ({
		DataManager: {
			getEventsData: dataManagerGetEventsData,
			getDataConfigStatus: dataManagerGetDataConfigStatus,
		},
	}));

	vi.doMock("@/features/data-management/data-processor", () => ({
		isValidEventsData,
	}));

	vi.doMock("@/features/events/featured/service", () => ({
		applyFeaturedProjectionToEvents,
	}));

	vi.doMock("next/cache", () => ({
		revalidatePath,
		revalidateTag,
	}));

	const service = await import("@/features/data-management/runtime-service");
	return {
		getLiveEvents: service.getLiveEvents,
		forceRefreshEventsData: service.forceRefreshEventsData,
		getRuntimeDataStatusFromSource: service.getRuntimeDataStatusFromSource,
		dataManagerGetEventsData,
		dataManagerGetDataConfigStatus,
		applyFeaturedProjectionToEvents,
		revalidatePath,
		revalidateTag,
	};
};

describe("runtime-service", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("reads directly from DataManager on each getLiveEvents call", async () => {
		const { getLiveEvents, dataManagerGetEventsData } = await loadRuntimeService();
		dataManagerGetEventsData
			.mockResolvedValueOnce({
				success: true,
				data: [makeEvent("1")],
				count: 1,
				source: "store",
				warnings: [],
				lastUpdate: "2026-02-18T00:00:00.000Z",
			})
			.mockResolvedValueOnce({
				success: true,
				data: [makeEvent("2")],
				count: 1,
				source: "store",
				warnings: [],
				lastUpdate: "2026-02-18T00:00:01.000Z",
			});

		await getLiveEvents();
		await getLiveEvents();

		expect(dataManagerGetEventsData).toHaveBeenCalledTimes(2);
	});

	it("applies featured projection overlay to runtime events", async () => {
		const { getLiveEvents, dataManagerGetEventsData, applyFeaturedProjectionToEvents } =
			await loadRuntimeService();
		dataManagerGetEventsData.mockResolvedValue({
			success: true,
			data: [makeEvent("1")],
			count: 1,
			source: "store",
			warnings: [],
			lastUpdate: "2026-02-18T00:00:00.000Z",
		});

		await getLiveEvents();

		expect(applyFeaturedProjectionToEvents).toHaveBeenCalledTimes(1);
	});

	it("returns failed events result when source read fails", async () => {
		const { getLiveEvents, dataManagerGetEventsData } = await loadRuntimeService();
		dataManagerGetEventsData.mockRejectedValue(new Error("store unavailable"));

		const result = await getLiveEvents();

		expect(result.success).toBe(false);
		expect(result.error).toContain("store unavailable");
	});

	it("returns runtime status from direct source reads", async () => {
		const {
			getRuntimeDataStatusFromSource,
			dataManagerGetDataConfigStatus,
			dataManagerGetEventsData,
		} = await loadRuntimeService();
		dataManagerGetDataConfigStatus.mockResolvedValue({
			dataSource: "remote",
			remoteConfigured: true,
			hasServiceAccount: false,
			hasDynamicOverride: false,
			hasLocalStoreData: true,
			storeProvider: "postgres",
			storeProviderLocation: "db",
			storeRowCount: 81,
			storeUpdatedAt: null,
			storeKeyCount: 81,
		});
		dataManagerGetEventsData.mockResolvedValue({
			success: true,
			data: [makeEvent("1")],
			count: 81,
			source: "store",
			warnings: [],
			lastUpdate: "2026-02-18T00:00:00.000Z",
		});

		const status = await getRuntimeDataStatusFromSource();

		expect(status.dataSource).toBe("store");
		expect(status.configuredDataSource).toBe("remote");
		expect(status.eventCount).toBe(81);
		expect(dataManagerGetEventsData).toHaveBeenCalledWith({
			populateCoordinates: false,
		});
	});

	it("revalidates paths and tags via Next built-ins on force refresh", async () => {
		const {
			forceRefreshEventsData,
			dataManagerGetEventsData,
			revalidatePath,
			revalidateTag,
		} = await loadRuntimeService();
		dataManagerGetEventsData.mockResolvedValue({
			success: true,
			data: [makeEvent("1")],
			count: 1,
			source: "store",
			warnings: [],
			lastUpdate: "2026-02-18T00:00:00.000Z",
		});

		const result = await forceRefreshEventsData();

		expect(result.success).toBe(true);
		expect(revalidatePath).toHaveBeenCalled();
		expect(revalidateTag).toHaveBeenCalledWith("events", "max");
		expect(revalidateTag).toHaveBeenCalledWith("events-data", "max");
	});
});
