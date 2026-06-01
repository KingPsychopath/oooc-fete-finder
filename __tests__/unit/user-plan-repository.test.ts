import { UserPlanRepository } from "@/lib/platform/postgres/user-plan-repository";
import type { Sql } from "postgres";
import { describe, expect, it, vi } from "vitest";

describe("UserPlanRepository", () => {
	it("loads only unlisted plans by share token with owner display name", async () => {
		const sql = vi.fn(async (strings: TemplateStringsArray) => {
			const query = strings.join("?");
			if (
				query.includes("WHERE p.share_token") &&
				query.includes("p.visibility = 'unlisted'")
			) {
				return [
					{
						id: "plan_1",
						user_id: "019b0000-0000-7000-8000-000000000001",
						owner_key: "user:019b0000-0000-7000-8000-000000000001",
						plan_date: "2026-06-21",
						title: "Friday route",
						visibility: "unlisted",
						share_token: "share-token",
						share_owner_name_visible: true,
						created_at: "2026-06-01T12:00:00.000Z",
						updated_at: "2026-06-01T12:00:00.000Z",
						owner_display_name: "Ada",
						stops: [
							{
								id: "stop_1",
								event_key: "event_1",
								stop_order: 1,
								locked: false,
								arrival_time: "18:00",
								departure_time: null,
								travel_minutes_from_previous: null,
								created_at: "2026-06-01T12:00:00.000Z",
								updated_at: "2026-06-01T12:00:00.000Z",
							},
						],
					},
				];
			}
			return [];
		});
		Object.assign(sql, { begin: vi.fn() });

		const repository = new UserPlanRepository(sql as unknown as Sql);
		const plan = await repository.findSharedPlan({ shareToken: "share-token" });

		expect(plan).toMatchObject({
			id: "plan_1",
			title: "Friday route",
			visibility: "unlisted",
			shareToken: "share-token",
			shareOwnerNameVisible: true,
			ownerDisplayName: "Ada",
			stops: [{ eventKey: "event_1", stopOrder: 1 }],
		});
	});

	it("hides the owner name when a shared plan opts out", async () => {
		const sql = vi.fn(async (strings: TemplateStringsArray) => {
			const query = strings.join("?");
			if (
				query.includes("WHERE p.share_token") &&
				query.includes("p.visibility = 'unlisted'")
			) {
				return [
					{
						id: "plan_1",
						user_id: "019b0000-0000-7000-8000-000000000001",
						owner_key: "user:019b0000-0000-7000-8000-000000000001",
						plan_date: "2026-06-21",
						title: "Friday route",
						visibility: "unlisted",
						share_token: "share-token",
						share_owner_name_visible: false,
						created_at: "2026-06-01T12:00:00.000Z",
						updated_at: "2026-06-01T12:00:00.000Z",
						owner_display_name: "Ada",
						stops: [],
					},
				];
			}
			return [];
		});
		Object.assign(sql, { begin: vi.fn() });

		const repository = new UserPlanRepository(sql as unknown as Sql);
		const plan = await repository.findSharedPlan({ shareToken: "share-token" });

		expect(plan).toMatchObject({
			shareOwnerNameVisible: false,
			ownerDisplayName: "A shared plan",
		});
	});

	it("rejects updates when a client-controlled plan id belongs to another owner", async () => {
		const begin = vi.fn();
		const sql = vi.fn(async (strings: TemplateStringsArray) => {
			const query = strings.join("?");
			if (
				query.includes("SELECT owner_key") &&
				query.includes("FROM app_user_plans")
			) {
				return [{ owner_key: "user:owner-a" }];
			}
			return [];
		});
		Object.assign(sql, { begin });

		const repository = new UserPlanRepository(sql as unknown as Sql);

		await expect(
			repository.upsertPlan({
				ownerKey: "user:owner-b",
				userId: "019b0000-0000-7000-8000-000000000002",
				plan: {
					id: "shared-plan-id",
					planDate: "2026-06-21",
					title: "Route",
					visibility: "private",
					stops: [
						{
							eventKey: "evt_1",
							stopOrder: 1,
						},
					],
				},
			}),
		).rejects.toThrow("different owner");
		expect(begin).not.toHaveBeenCalled();
	});
});
