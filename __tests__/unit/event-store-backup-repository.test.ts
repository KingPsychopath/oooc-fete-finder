import { afterEach, describe, expect, it, vi } from "vitest";

const resetBackupRepositorySingleton = () => {
	delete (globalThis as Record<string, unknown>)
		.__ooocFeteFinderEventStoreBackupRepository;
};

describe("event-store-backup-repository singleton", () => {
	afterEach(() => {
		resetBackupRepositorySingleton();
		vi.clearAllMocks();
		vi.resetModules();
	});

	it("returns null when Postgres client is unavailable", async () => {
		vi.doMock("@/lib/platform/postgres/postgres-client", () => ({
			getPostgresClient: () => null,
		}));

		const { getEventStoreBackupRepository } = await import(
			"@/lib/platform/postgres/event-store-backup-repository"
		);

		expect(getEventStoreBackupRepository()).toBeNull();
	});

	it("recreates stale cached singleton when repository version is missing", async () => {
		const sql = vi.fn(async () => []);
		vi.doMock("@/lib/platform/postgres/postgres-client", () => ({
			getPostgresClient: () => sql,
		}));

		const staleRepository = {
			createBackup: vi.fn(),
			getLatestBackup: vi.fn(),
			getBackupById: vi.fn(),
			listBackups: vi.fn(),
			pruneOldBackups: vi.fn(),
			getBackupStatus: vi.fn(async () => ({
				backupCount: 0,
				latestBackup: null,
			})),
		};
		(globalThis as Record<string, unknown>)
			.__ooocFeteFinderEventStoreBackupRepository = staleRepository;

		const { getEventStoreBackupRepository } = await import(
			"@/lib/platform/postgres/event-store-backup-repository"
		);

		const repository = getEventStoreBackupRepository();
		expect(repository).not.toBeNull();
		expect(repository).not.toBe(staleRepository);
		expect(repository?.repositoryVersion).toBe(1);
		expect(typeof repository?.listBackups).toBe("function");
	});
});
