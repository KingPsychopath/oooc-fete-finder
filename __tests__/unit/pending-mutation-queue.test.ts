import {
	enqueueSavedEventMutation,
	flushPendingMutations,
	getPendingMutationCount,
} from "@/features/offline-mutations/pending-mutation-queue";
import { beforeEach, describe, expect, it, vi } from "vitest";

const STORAGE_KEY = "oooc:pending-mutations:v1";

const storage = new Map<string, string>();

describe("pending mutation queue", () => {
	beforeEach(() => {
		storage.clear();
		vi.stubGlobal("window", {
			localStorage: {
				getItem: (key: string) => storage.get(key) ?? null,
				setItem: (key: string, value: string) => {
					storage.set(key, value);
				},
				removeItem: (key: string) => {
					storage.delete(key);
				},
				clear: () => {
					storage.clear();
				},
			},
		});
		vi.stubGlobal("crypto", {
			randomUUID: () => "mutation-id",
		});
		vi.useRealTimers();
	});

	it("compacts saved event mutations by owner and event", () => {
		enqueueSavedEventMutation({
			ownerKey: "user:a@example.com",
			eventKey: "EVT_1",
			isSaved: true,
			source: "modal_save",
		});
		enqueueSavedEventMutation({
			ownerKey: "user:a@example.com",
			eventKey: "evt_1",
			isSaved: false,
			source: "modal_unsave",
		});

		expect(getPendingMutationCount("user:a@example.com")).toBe(1);
		const raw = storage.get(STORAGE_KEY);
		expect(raw).toBeTruthy();
		const queue = JSON.parse(raw ?? "[]") as Array<{
			payload: { eventKey: string; isSaved: boolean; source: string };
		}>;
		expect(queue).toHaveLength(1);
		expect(queue[0].payload).toMatchObject({
			eventKey: "evt_1",
			isSaved: false,
			source: "modal_unsave",
		});
	});

	it("keeps owner queues separate", () => {
		enqueueSavedEventMutation({
			ownerKey: "user:a@example.com",
			eventKey: "evt_1",
			isSaved: true,
			source: "modal_save",
		});
		enqueueSavedEventMutation({
			ownerKey: "user:b@example.com",
			eventKey: "evt_1",
			isSaved: true,
			source: "modal_save",
		});

		expect(getPendingMutationCount()).toBe(2);
		expect(getPendingMutationCount("user:a@example.com")).toBe(1);
		expect(getPendingMutationCount("user:b@example.com")).toBe(1);
	});

	it("removes successful mutations after flush", async () => {
		enqueueSavedEventMutation({
			ownerKey: "user:a@example.com",
			eventKey: "evt_1",
			isSaved: true,
			source: "modal_save",
		});

		const result = await flushPendingMutations({
			ownerKey: "user:a@example.com",
			savedEvent: async () => true,
		});

		expect(result).toMatchObject({ attempted: 1, succeeded: 1, remaining: 0 });
		expect(getPendingMutationCount()).toBe(0);
	});

	it("retains failed mutations for retry", async () => {
		vi.setSystemTime(new Date("2026-05-09T12:00:00.000Z"));
		enqueueSavedEventMutation({
			ownerKey: "user:a@example.com",
			eventKey: "evt_1",
			isSaved: true,
			source: "modal_save",
		});

		const result = await flushPendingMutations({
			ownerKey: "user:a@example.com",
			savedEvent: async () => false,
		});

		expect(result).toMatchObject({ attempted: 1, succeeded: 0, remaining: 1 });
		const raw = storage.get(STORAGE_KEY);
		const queue = JSON.parse(raw ?? "[]") as Array<{
			attempts: number;
			nextAttemptAt: string | null;
		}>;
		expect(queue[0].attempts).toBe(1);
		expect(queue[0].nextAttemptAt).toBe("2026-05-09T12:00:01.000Z");
	});
});
