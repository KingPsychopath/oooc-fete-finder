import type { EventStoreBackupService as EventStoreBackupServiceType } from "@/features/data-management/event-store-backup-service";
import type { FeaturedScheduleEntry } from "@/features/events/featured/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sampleFeaturedEntry = (
	overrides?: Partial<FeaturedScheduleEntry>,
): FeaturedScheduleEntry => ({
	id: "f_1",
	eventKey: "evt_1",
	requestedStartAt: "2026-06-21T10:00:00.000Z",
	effectiveStartAt: "2026-06-21T10:00:00.000Z",
	effectiveEndAt: "2026-06-23T10:00:00.000Z",
	durationHours: 48,
	status: "scheduled",
	createdBy: "admin",
	createdAt: "2026-02-18T09:00:00.000Z",
	updatedAt: "2026-02-18T09:00:00.000Z",
	...overrides,
});

type Setup = {
	EventStoreBackupService: typeof EventStoreBackupServiceType;
	backupRepository: {
		createBackup: ReturnType<typeof vi.fn>;
		getLatestBackup: ReturnType<typeof vi.fn>;
		getBackupById: ReturnType<typeof vi.fn>;
		pruneOldBackups: ReturnType<typeof vi.fn>;
		getBackupStatus: ReturnType<typeof vi.fn>;
		listBackups: ReturnType<typeof vi.fn>;
	};
	eventStoreRepository: {
		getMeta: ReturnType<typeof vi.fn>;
	};
	featuredRepository: {
		withScheduleLock: ReturnType<typeof vi.fn>;
		session: {
			listEntries: ReturnType<typeof vi.fn>;
			replaceAllEntries: ReturnType<typeof vi.fn>;
		};
	};
	localEventStore: {
		getCsv: ReturnType<typeof vi.fn>;
		saveCsv: ReturnType<typeof vi.fn>;
		clearCsv: ReturnType<typeof vi.fn>;
	};
	userCollectionStore: {
		listAll: ReturnType<typeof vi.fn>;
		clearAll: ReturnType<typeof vi.fn>;
		addOrUpdate: ReturnType<typeof vi.fn>;
	};
	promotedRepository: {
		withScheduleLock: ReturnType<typeof vi.fn>;
		replaceAllEntries: ReturnType<typeof vi.fn>;
		session: { listEntries: ReturnType<typeof vi.fn> };
	};
	partnerRepository: {
		listAll: ReturnType<typeof vi.fn>;
		replaceAll: ReturnType<typeof vi.fn>;
	};
	eventSubmissionsStore: {
		listAllEventSubmissions: ReturnType<typeof vi.fn>;
		replaceAllEventSubmissions: ReturnType<typeof vi.fn>;
	};
	settingsStores: {
		slidingBannerGet: ReturnType<typeof vi.fn>;
		slidingBannerReplace: ReturnType<typeof vi.fn>;
		eventSubmissionGet: ReturnType<typeof vi.fn>;
		eventSubmissionReplace: ReturnType<typeof vi.fn>;
	};
};

const loadService = async (): Promise<Setup> => {
	vi.resetModules();

	const backupRepository = {
		createBackup: vi.fn(),
		getLatestBackup: vi.fn(),
		getBackupById: vi.fn(),
		pruneOldBackups: vi.fn().mockResolvedValue(0),
		getBackupStatus: vi.fn().mockResolvedValue({
			backupCount: 0,
			latestBackup: null,
		}),
		listBackups: vi.fn().mockResolvedValue([]),
	};
	const eventStoreRepository = {
		getMeta: vi.fn().mockResolvedValue({
			rowCount: 50,
			updatedAt: "2026-02-18T09:00:00.000Z",
			updatedBy: "admin-panel",
			origin: "manual",
			checksum: "abc123",
		}),
	};
	const session = {
		listEntries: vi.fn().mockResolvedValue([sampleFeaturedEntry()]),
		replaceAllEntries: vi.fn().mockResolvedValue(undefined),
	};
	const featuredRepository = {
		session,
		withScheduleLock: vi.fn(
			async (operation: (sessionArg: typeof session) => unknown) =>
				operation(session),
		),
	};
	const localEventStore = {
		getCsv: vi.fn().mockResolvedValue("Title,Date\nEvent,2026-06-21"),
		saveCsv: vi.fn().mockResolvedValue({
			rowCount: 50,
			updatedAt: "2026-02-18T12:00:00.000Z",
			updatedBy: "admin-panel-restore",
			origin: "manual",
			checksum: "abc123",
		}),
		clearCsv: vi.fn().mockResolvedValue(undefined),
	};
	const userCollectionStore = {
		listAll: vi.fn().mockResolvedValue([
			{
				firstName: "Real",
				lastName: "User",
				email: "real@example.com",
				consent: true,
				source: "fete-finder-auth",
				timestamp: "2026-02-18T09:30:00.000Z",
			},
		]),
		clearAll: vi.fn().mockResolvedValue(undefined),
		addOrUpdate: vi.fn().mockResolvedValue({ alreadyExisted: false }),
	};
	const promotedSession = {
		listEntries: vi.fn().mockResolvedValue([
			{
				id: "p_1",
				eventKey: "evt_promoted",
				requestedStartAt: "2026-06-21T10:00:00.000Z",
				effectiveStartAt: "2026-06-21T10:00:00.000Z",
				effectiveEndAt: "2026-06-22T10:00:00.000Z",
				durationHours: 24,
				status: "scheduled",
				createdBy: "admin",
				createdAt: "2026-02-18T09:00:00.000Z",
				updatedAt: "2026-02-18T09:00:00.000Z",
			},
		]),
	};
	const promotedRepository = {
		session: promotedSession,
		withScheduleLock: vi.fn(
			async (operation: (sessionArg: typeof promotedSession) => unknown) =>
				operation(promotedSession),
		),
		replaceAllEntries: vi.fn().mockResolvedValue(undefined),
	};
	const partnerRepository = {
		listAll: vi.fn().mockResolvedValue([
			{
				id: "pa_1",
				source: "stripe",
				sourceEventId: "evt_stripe",
				status: "pending",
				packageKey: "spotlight",
				paymentLinkId: null,
				stripeSessionId: "cs_test",
				customerEmail: "partner@example.com",
				customerName: "Partner",
				eventName: "Partner Event",
				eventUrl: null,
				amountTotalCents: 5000,
				currency: "gbp",
				notes: null,
				metadata: {},
				rawPayload: {},
				fulfilledEventKey: null,
				fulfilledTier: null,
				fulfilledStartAt: null,
				fulfilledEndAt: null,
				partnerStatsToken: null,
				partnerStatsRevokedAt: null,
				createdAt: "2026-02-18T09:00:00.000Z",
				updatedAt: "2026-02-18T09:00:00.000Z",
				activatedAt: null,
			},
		]),
		replaceAll: vi.fn().mockResolvedValue(undefined),
	};
	const eventSubmissionsStore = {
		listAllEventSubmissions: vi.fn().mockResolvedValue([]),
		replaceAllEventSubmissions: vi.fn().mockResolvedValue(undefined),
	};
	const settingsStores = {
		slidingBannerGet: vi.fn().mockResolvedValue({
			version: 1,
			enabled: true,
			messages: ["Saved"],
			messageDurationMs: 4200,
			desktopMessageCount: 2,
			updatedAt: "2026-02-18T09:00:00.000Z",
			updatedBy: "admin",
		}),
		slidingBannerReplace: vi.fn().mockResolvedValue(undefined),
		eventSubmissionGet: vi.fn().mockResolvedValue({
			version: 1,
			enabled: true,
			updatedAt: "2026-02-18T09:00:00.000Z",
			updatedBy: "admin",
		}),
		eventSubmissionReplace: vi.fn().mockResolvedValue(undefined),
	};

	vi.doMock("@/lib/platform/postgres/event-store-backup-repository", () => ({
		getEventStoreBackupRepository: () => backupRepository,
	}));
	vi.doMock("@/lib/platform/postgres/event-sheet-store-repository", () => ({
		getEventSheetStoreRepository: () => eventStoreRepository,
	}));
	vi.doMock("@/lib/platform/postgres/featured-event-repository", () => ({
		getFeaturedEventRepository: () => featuredRepository,
	}));
	vi.doMock("@/features/data-management/local-event-store", () => ({
		LocalEventStore: localEventStore,
	}));
	vi.doMock("@/features/auth/user-collection-store", () => ({
		UserCollectionStore: userCollectionStore,
	}));
	vi.doMock("@/lib/platform/postgres/promoted-event-repository", () => ({
		getPromotedEventRepository: () => promotedRepository,
	}));
	vi.doMock("@/lib/platform/postgres/partner-activation-repository", () => ({
		getPartnerActivationRepository: () => partnerRepository,
	}));
	vi.doMock("@/features/events/submissions/store", () => eventSubmissionsStore);
	vi.doMock("@/features/site-settings/sliding-banner-store", () => ({
		SlidingBannerStore: {
			getSettings: settingsStores.slidingBannerGet,
			replaceSettings: settingsStores.slidingBannerReplace,
		},
	}));
	vi.doMock("@/features/events/submissions/settings-store", () => ({
		EventSubmissionSettingsStore: {
			getSettings: settingsStores.eventSubmissionGet,
			replaceSettings: settingsStores.eventSubmissionReplace,
		},
	}));

	const { EventStoreBackupService } = await import(
		"@/features/data-management/event-store-backup-service"
	);

	return {
		EventStoreBackupService,
		backupRepository,
		eventStoreRepository,
		featuredRepository,
		localEventStore,
		userCollectionStore,
		promotedRepository,
		partnerRepository,
		eventSubmissionsStore,
		settingsStores,
	};
};

describe("EventStoreBackupService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("creates backup and prunes old snapshots", async () => {
		const { EventStoreBackupService, backupRepository } = await loadService();
		backupRepository.createBackup.mockResolvedValue({
			id: "bkp_1",
			createdAt: "2026-02-18T10:00:00.000Z",
			createdBy: "admin-panel",
			trigger: "manual",
			rowCount: 50,
			featuredEntryCount: 1,
			userCollectionCount: 1,
			storeUpdatedAt: "2026-02-18T09:00:00.000Z",
			storeChecksum: "abc123",
		});
		backupRepository.pruneOldBackups.mockResolvedValueOnce(3);

		const result = await EventStoreBackupService.createBackup({
			createdBy: "admin-panel",
			trigger: "manual",
		});

		expect(result.success).toBe(true);
		expect(result.prunedCount).toBe(3);
		expect(result.message).toContain("1 featured entries");
		expect(result.message).toContain("1 emails");
		expect(backupRepository.createBackup).toHaveBeenCalledWith(
			expect.objectContaining({
				featuredEntryCount: 1,
				userCollectionCount: 1,
				userCollectionJson: expect.stringContaining("real@example.com"),
				operationalStateJson: expect.stringContaining("partner@example.com"),
			}),
		);
		expect(backupRepository.pruneOldBackups).toHaveBeenCalledWith(30);
		expect(
			backupRepository.createBackup.mock.invocationCallOrder[0],
		).toBeLessThan(
			backupRepository.pruneOldBackups.mock.invocationCallOrder[0],
		);
	});

	it("returns no-data response when store csv and featured schedule are empty", async () => {
		const {
			EventStoreBackupService,
			localEventStore,
			featuredRepository,
			userCollectionStore,
			promotedRepository,
			partnerRepository,
			settingsStores,
			backupRepository,
		} = await loadService();
		localEventStore.getCsv.mockResolvedValueOnce("");
		featuredRepository.session.listEntries.mockResolvedValueOnce([]);
		userCollectionStore.listAll.mockResolvedValueOnce([]);
		promotedRepository.session.listEntries.mockResolvedValueOnce([]);
		partnerRepository.listAll.mockResolvedValueOnce([]);
		settingsStores.slidingBannerGet.mockResolvedValueOnce({
			version: 1,
			enabled: true,
			messages: [],
			messageDurationMs: 4200,
			desktopMessageCount: 2,
			updatedAt: new Date(0).toISOString(),
			updatedBy: "system-default",
		});
		settingsStores.eventSubmissionGet.mockResolvedValueOnce({
			version: 1,
			enabled: true,
			updatedAt: new Date(0).toISOString(),
			updatedBy: "system-default",
		});

		const result = await EventStoreBackupService.createBackup({
			createdBy: "admin-panel",
			trigger: "manual",
		});

		expect(result.success).toBe(false);
		expect(result.noData).toBe(true);
		expect(backupRepository.createBackup).not.toHaveBeenCalled();
	});

	it("returns clear error when latest backup is missing", async () => {
		const { EventStoreBackupService, backupRepository } = await loadService();
		backupRepository.getLatestBackup.mockResolvedValueOnce(null);

		const result = await EventStoreBackupService.restoreLatestBackup({
			createdBy: "admin-panel-restore",
		});

		expect(result.success).toBe(false);
		expect(result.message).toContain("No matching event store backup exists");
	});

	it("creates pre-restore backup and restores selected snapshot payload", async () => {
		const {
			EventStoreBackupService,
			backupRepository,
			localEventStore,
			featuredRepository,
			userCollectionStore,
			promotedRepository,
			partnerRepository,
			settingsStores,
		} = await loadService();

		backupRepository.getBackupById.mockResolvedValueOnce({
			id: "bkp_target",
			createdAt: "2026-02-18T08:00:00.000Z",
			createdBy: "cron",
			trigger: "cron",
			rowCount: 48,
			featuredEntryCount: 1,
			userCollectionCount: 1,
			storeUpdatedAt: "2026-02-18T07:45:00.000Z",
			storeChecksum: "latest123",
			csvContent: "Title,Date\nRestored Event,2026-06-22",
			featuredEntriesJson: JSON.stringify([
				sampleFeaturedEntry({
					id: "f_target",
					eventKey: "evt_target",
				}),
			]),
			userCollectionJson: JSON.stringify([
				{
					firstName: "Restored",
					lastName: "User",
					email: "restored@example.com",
					consent: true,
					source: "backup",
					timestamp: "2026-02-18T07:00:00.000Z",
				},
			]),
			operationalStateJson: JSON.stringify({
				version: 1,
				promotedEntries: [
					{
						id: "p_target",
						eventKey: "evt_promoted_restored",
						requestedStartAt: "2026-06-21T10:00:00.000Z",
						effectiveStartAt: "2026-06-21T10:00:00.000Z",
						effectiveEndAt: "2026-06-22T10:00:00.000Z",
						durationHours: 24,
						status: "scheduled",
						createdBy: "admin",
						createdAt: "2026-02-18T09:00:00.000Z",
						updatedAt: "2026-02-18T09:00:00.000Z",
					},
				],
				eventSubmissions: [],
				partnerActivations: [
					{
						id: "pa_target",
						source: "stripe",
						sourceEventId: "evt_stripe_target",
						status: "pending",
						packageKey: "promoted",
						paymentLinkId: null,
						stripeSessionId: "cs_target",
						customerEmail: "target-partner@example.com",
						customerName: "Target Partner",
						eventName: "Target Partner Event",
						eventUrl: null,
						amountTotalCents: 3000,
						currency: "gbp",
						notes: null,
						metadata: {},
						rawPayload: {},
						fulfilledEventKey: null,
						fulfilledTier: null,
						fulfilledStartAt: null,
						fulfilledEndAt: null,
						partnerStatsToken: null,
						partnerStatsRevokedAt: null,
						createdAt: "2026-02-18T09:00:00.000Z",
						updatedAt: "2026-02-18T09:00:00.000Z",
						activatedAt: null,
					},
				],
				settings: {
					slidingBanner: {
						version: 1,
						enabled: false,
						messages: ["Restored"],
						messageDurationMs: 4200,
						desktopMessageCount: 1,
						updatedAt: "2026-02-18T08:00:00.000Z",
						updatedBy: "backup",
					},
					eventSubmissions: {
						version: 1,
						enabled: false,
						updatedAt: "2026-02-18T08:00:00.000Z",
						updatedBy: "backup",
					},
				},
			}),
		});
		backupRepository.createBackup.mockResolvedValueOnce({
			id: "bkp_pre",
			createdAt: "2026-02-18T11:59:00.000Z",
			createdBy: "admin-panel-restore",
			trigger: "pre-restore",
			rowCount: 50,
			featuredEntryCount: 1,
			userCollectionCount: 1,
			storeUpdatedAt: "2026-02-18T11:58:00.000Z",
			storeChecksum: "pre123",
		});
		backupRepository.pruneOldBackups.mockResolvedValueOnce(1);

		const result = await EventStoreBackupService.restoreBackup({
			createdBy: "admin-panel-restore",
			backupId: "bkp_target",
		});

		expect(result.success).toBe(true);
		expect(result.preRestoreBackup?.id).toBe("bkp_pre");
		expect(localEventStore.saveCsv).toHaveBeenCalledTimes(1);
		expect(featuredRepository.session.replaceAllEntries).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({ id: "f_target", eventKey: "evt_target" }),
			]),
		);
		expect(result.restoredUserCollectionCount).toBe(1);
		expect(backupRepository.createBackup).toHaveBeenCalledWith(
			expect.objectContaining({
				userCollectionCount: 1,
				userCollectionJson: expect.stringContaining("real@example.com"),
			}),
		);
		expect(userCollectionStore.clearAll).toHaveBeenCalledTimes(1);
		expect(userCollectionStore.addOrUpdate).toHaveBeenCalledWith(
			expect.objectContaining({ email: "restored@example.com" }),
		);
		expect(promotedRepository.replaceAllEntries).toHaveBeenCalledWith(
			expect.arrayContaining([expect.objectContaining({ id: "p_target" })]),
		);
		expect(partnerRepository.replaceAll).toHaveBeenCalledWith(
			expect.arrayContaining([expect.objectContaining({ id: "pa_target" })]),
		);
		expect(settingsStores.slidingBannerReplace).toHaveBeenCalledWith(
			expect.objectContaining({ enabled: false }),
		);
		expect(settingsStores.eventSubmissionReplace).toHaveBeenCalledWith(
			expect.objectContaining({ enabled: false }),
		);
		expect(
			backupRepository.createBackup.mock.invocationCallOrder[0],
		).toBeLessThan(localEventStore.saveCsv.mock.invocationCallOrder[0]);
		expect(
			backupRepository.pruneOldBackups.mock.invocationCallOrder[0],
		).toBeGreaterThan(
			backupRepository.createBackup.mock.invocationCallOrder[0],
		);
	});
});
