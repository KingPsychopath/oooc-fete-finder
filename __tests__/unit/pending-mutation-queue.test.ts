import {
	discardPendingMutations,
	enqueueRoutePlanDeleteMutation,
	enqueueRoutePlanMutation,
	enqueueSavedEventMutation,
	flushPendingMutations,
	getPendingMutationCount,
	getPendingRoutePlanDeleteMutations,
	getPendingRoutePlanMutations,
	getPendingSavedEventMutations,
} from "@/features/offline-mutations/pending-mutation-queue";
import { beforeEach, describe, expect, it, vi } from "vitest";

const STORAGE_KEY = "oooc:pending-mutations:v1";

const storage = new Map<string, string>();

describe("pending mutation queue", () => {
	beforeEach(() => {
		storage.clear();
		let uuidCounter = 0;
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
			randomUUID: () => {
				uuidCounter += 1;
				return `mutation-id-${uuidCounter}`;
			},
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

	it("lists pending saved-event mutations for one owner", () => {
		enqueueSavedEventMutation({
			ownerKey: "user:a@example.com",
			eventKey: "EVT_1",
			isSaved: true,
			source: "modal_save",
		});
		enqueueSavedEventMutation({
			ownerKey: "user:b@example.com",
			eventKey: "evt_2",
			isSaved: false,
			source: "modal_unsave",
		});

		expect(getPendingSavedEventMutations("user:a@example.com")).toMatchObject([
			{
				ownerKey: "user:a@example.com",
				payload: {
					eventKey: "evt_1",
					isSaved: true,
				},
			},
		]);
	});

	it("discards pending mutations by owner", () => {
		enqueueSavedEventMutation({
			ownerKey: "anon",
			eventKey: "evt_1",
			isSaved: true,
			source: "modal_save",
		});
		enqueueSavedEventMutation({
			ownerKey: "user:a@example.com",
			eventKey: "evt_2",
			isSaved: true,
			source: "modal_save",
		});

		expect(discardPendingMutations("anon")).toBe(1);
		expect(getPendingMutationCount("anon")).toBe(0);
		expect(getPendingMutationCount("user:a@example.com")).toBe(1);
	});

	it("ignores stale pending mutations", () => {
		const staleDate = new Date("2026-05-01T12:00:00.000Z").toISOString();
		storage.set(
			STORAGE_KEY,
			JSON.stringify([
				{
					id: "stale-mutation",
					type: "saved_event",
					ownerKey: "user:a@example.com",
					payload: {
						eventKey: "evt_1",
						isSaved: true,
						source: "modal_save",
					},
					createdAt: staleDate,
					updatedAt: staleDate,
					attempts: 1,
					nextAttemptAt: null,
					idempotencyKey: "saved_event:user:a@example.com:evt_1",
				},
			]),
		);
		vi.setSystemTime(new Date("2026-05-10T12:00:00.000Z"));

		expect(getPendingMutationCount("user:a@example.com")).toBe(0);
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

	it("compacts route plan mutations by owner and plan", () => {
		enqueueRoutePlanMutation({
			ownerKey: "user:a@example.com",
			planId: "plan-1",
			plan: { id: "plan-1", title: "First" },
			source: "plans_page",
		});
		enqueueRoutePlanMutation({
			ownerKey: "user:a@example.com",
			planId: "plan-1",
			plan: { id: "plan-1", title: "Updated" },
			source: "plans_page_reorder",
		});

		expect(getPendingMutationCount("user:a@example.com")).toBe(1);
		expect(getPendingRoutePlanMutations("user:a@example.com")).toMatchObject([
			{
				type: "route_plan",
				payload: {
					planId: "plan-1",
					plan: { id: "plan-1", title: "Updated" },
					source: "plans_page_reorder",
				},
			},
		]);
	});

	it("flushes route plan mutations with their own handler", async () => {
		enqueueRoutePlanMutation({
			ownerKey: "user:a@example.com",
			planId: "plan-1",
			plan: { id: "plan-1", title: "Route" },
			source: "plans_page",
		});

		const result = await flushPendingMutations({
			ownerKey: "user:a@example.com",
			savedEvent: async () => true,
			routePlan: async ({ mutation }) => {
				expect(mutation.payload.planId).toBe("plan-1");
				return true;
			},
		});

		expect(result).toMatchObject({ attempted: 1, succeeded: 1, remaining: 0 });
	});

	it("compacts route plan deletes against pending route plan upserts", async () => {
		enqueueRoutePlanMutation({
			ownerKey: "user:a@example.com",
			planId: "plan-1",
			plan: { id: "plan-1", title: "Route" },
			source: "plans_page",
		});
		enqueueRoutePlanDeleteMutation({
			ownerKey: "user:a@example.com",
			planId: "plan-1",
			source: "plans_page_delete",
		});

		expect(getPendingMutationCount("user:a@example.com")).toBe(1);
		expect(getPendingRoutePlanMutations("user:a@example.com")).toHaveLength(0);
		expect(
			getPendingRoutePlanDeleteMutations("user:a@example.com"),
		).toMatchObject([
			{
				type: "route_plan_delete",
				payload: {
					planId: "plan-1",
					source: "plans_page_delete",
				},
			},
		]);
	});

	it("flushes route plan delete mutations with their own handler", async () => {
		enqueueRoutePlanDeleteMutation({
			ownerKey: "user:a@example.com",
			planId: "plan-1",
			source: "plans_page_delete",
		});

		const result = await flushPendingMutations({
			ownerKey: "user:a@example.com",
			routePlanDelete: async ({ mutation }) => {
				expect(mutation.payload.planId).toBe("plan-1");
				return true;
			},
		});

		expect(result).toMatchObject({ attempted: 1, succeeded: 1, remaining: 0 });
	});

	it("does not flush saved-event mutations when only route-plan handler is provided", async () => {
		enqueueSavedEventMutation({
			ownerKey: "user:a@example.com",
			eventKey: "evt_1",
			isSaved: true,
			source: "modal_save",
		});
		enqueueRoutePlanMutation({
			ownerKey: "user:a@example.com",
			planId: "plan-1",
			plan: { id: "plan-1", title: "Route" },
			source: "plans_page",
		});

		const result = await flushPendingMutations({
			ownerKey: "user:a@example.com",
			routePlan: async () => true,
		});

		expect(result).toMatchObject({ attempted: 1, succeeded: 1, remaining: 1 });
		expect(getPendingSavedEventMutations("user:a@example.com")).toHaveLength(1);
	});

	it("does not fail route-plan mutations when only saved-event handler is provided", async () => {
		enqueueRoutePlanMutation({
			ownerKey: "user:a@example.com",
			planId: "plan-1",
			plan: { id: "plan-1", title: "Route" },
			source: "plans_page",
		});

		const result = await flushPendingMutations({
			ownerKey: "user:a@example.com",
			savedEvent: async () => true,
		});

		expect(result).toMatchObject({ attempted: 0, succeeded: 0, remaining: 1 });
		expect(getPendingRoutePlanMutations("user:a@example.com")).toHaveLength(1);
	});
});
