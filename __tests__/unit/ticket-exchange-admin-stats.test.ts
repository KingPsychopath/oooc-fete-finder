import { TicketExchangeRepository } from "@/features/ticket-exchange/repository";
import type { Sql } from "postgres";
import { describe, expect, it, vi } from "vitest";

describe("TicketExchangeRepository admin stats", () => {
	it("counts contact unlocks once and resolves events by resolution window", async () => {
		const calls: Array<{ query: string; values: unknown[] }> = [];
		const sql = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
			const query = strings.join("?");
			calls.push({ query, values });
			if (query.includes("listing_create_count")) {
				return [
					{
						listing_create_count: 0,
						selling_listing_create_count: 0,
						looking_listing_create_count: 0,
						unique_listing_owner_count: 0,
						interest_create_count: 0,
						unique_interested_user_count: 0,
						report_create_count: 0,
						unique_reported_listing_count: 0,
						resolved_listing_count: 1,
						removed_listing_count: 0,
						active_selling_count: 0,
						active_looking_count: 0,
						pending_report_count: 0,
						bot_pending_count: 0,
						bot_announced_count: 0,
						contact_unlock_count: 1,
					},
				];
			}
			return [];
		});
		const repository = new TicketExchangeRepository(sql as unknown as Sql);

		const stats = await repository.getAdminStatsWindow({
			startAt: "2026-06-01T00:00:00.000Z",
			endAt: "2026-06-02T00:00:00.000Z",
		});
		await repository.listAdminEventStatsWindow({
			startAt: "2026-06-01T00:00:00.000Z",
			endAt: "2026-06-02T00:00:00.000Z",
		});

		expect(stats.contactUnlockCount).toBe(1);
		const queries = calls.map((call) => call.query).join("\n");
		expect(queries).toContain("reason = 'interest_owner_reveal'");
		expect(queries).toContain("resolved_counts AS");
		expect(queries).toContain("COALESCE(resolved_at, updated_at)");
	});
});
