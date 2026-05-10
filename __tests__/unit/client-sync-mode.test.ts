import {
	canSyncAccountData,
	getClientSyncMode,
	getPendingSyncStatus,
} from "@/features/sync/client-sync-mode";
import { describe, expect, it } from "vitest";

describe("client sync mode", () => {
	it("allows account sync only for live authenticated online sessions", () => {
		expect(
			getClientSyncMode({
				isAuthenticated: true,
				authMode: "live",
				isOnline: true,
			}),
		).toBe("live-sync");
		expect(
			canSyncAccountData(
				getClientSyncMode({
					isAuthenticated: true,
					authMode: "live",
					isOnline: true,
				}),
			),
		).toBe(true);
	});

	it("keeps offline-grace sessions out of account sync", () => {
		const syncMode = getClientSyncMode({
			isAuthenticated: true,
			authMode: "offline-grace",
			isOnline: false,
		});

		expect(syncMode).toBe("offline-grace");
		expect(canSyncAccountData(syncMode)).toBe(false);
	});

	it("treats signed-out or offline live sessions as local-only", () => {
		expect(
			getClientSyncMode({
				isAuthenticated: false,
				authMode: "signed-out",
				isOnline: true,
			}),
		).toBe("local-only");
		expect(
			getClientSyncMode({
				isAuthenticated: true,
				authMode: "live",
				isOnline: false,
			}),
		).toBe("local-only");
	});

	it("derives pending sync status from count and online state", () => {
		expect(getPendingSyncStatus(0, false)).toBe("idle");
		expect(getPendingSyncStatus(1, false)).toBe("offline");
		expect(getPendingSyncStatus(1, true)).toBe("retrying");
	});
});
