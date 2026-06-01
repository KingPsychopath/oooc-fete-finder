import { UserPlanRepository } from "@/lib/platform/postgres/user-plan-repository";
import type { Sql } from "postgres";
import { describe, expect, it, vi } from "vitest";

describe("UserPlanRepository", () => {
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
