import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Setup = {
	GET: typeof import("@/app/api/cron/backup-event-store/route").GET;
	createBackup: ReturnType<typeof vi.fn>;
};

const loadRoute = async (): Promise<Setup> => {
	vi.resetModules();
	const createBackup = vi.fn().mockResolvedValue({
		success: true,
		message: "Backup created (81 rows)",
		backup: {
			id: "bkp_1",
			createdAt: "2026-02-18T12:00:00.000Z",
			createdBy: "cron",
			trigger: "cron",
			rowCount: 81,
			storeUpdatedAt: "2026-02-18T11:00:00.000Z",
			storeChecksum: "abc123",
		},
		prunedCount: 2,
	});

	vi.doMock("@/features/data-management/event-store-backup-service", () => ({
		EventStoreBackupService: {
			createBackup,
		},
	}));

	const route = await import("@/app/api/cron/backup-event-store/route");
	return {
		GET: route.GET,
		createBackup,
	};
};

describe("/api/cron/backup-event-store route", () => {
	const originalCronSecret = process.env.CRON_SECRET;

	beforeEach(() => {
		vi.clearAllMocks();
		process.env.CRON_SECRET = "test-cron-secret";
	});

	afterEach(() => {
		process.env.CRON_SECRET = originalCronSecret;
	});

	it("returns 401 for unauthorized requests", async () => {
		const { GET, createBackup } = await loadRoute();

		const response = await GET(
			new NextRequest("https://example.com/api/cron/backup-event-store"),
		);
		const payload = (await response.json()) as { error: string };

		expect(response.status).toBe(401);
		expect(payload.error).toBe("Unauthorized");
		expect(response.headers.get("cache-control")).toContain("no-store");
		expect(createBackup).not.toHaveBeenCalled();
	});

	it("creates periodic backup for authorized cron calls", async () => {
		const { GET, createBackup } = await loadRoute();

		const response = await GET(
			new NextRequest("https://example.com/api/cron/backup-event-store", {
				headers: {
					authorization: "Bearer test-cron-secret",
				},
			}),
		);
		const payload = (await response.json()) as {
			ok: boolean;
			message: string;
			prunedCount: number;
		};

		expect(response.status).toBe(200);
		expect(payload.ok).toBe(true);
		expect(payload.message).toContain("Backup created");
		expect(payload.prunedCount).toBe(2);
		expect(response.headers.get("cache-control")).toContain("no-store");
		expect(createBackup).toHaveBeenCalledWith({
			createdBy: "cron",
			trigger: "cron",
		});
	});
});
