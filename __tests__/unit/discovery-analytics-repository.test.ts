import { DiscoveryAnalyticsRepository } from "@/lib/platform/postgres/discovery-analytics-repository";
import type { Sql } from "postgres";
import { describe, expect, it, vi } from "vitest";

describe("DiscoveryAnalyticsRepository", () => {
	it("can exclude popular chip searches from public search chip signals", async () => {
		const calls: Array<{ query: string; values: unknown[] }> = [];
		const sql = vi.fn(
			async (strings: TemplateStringsArray, ...values: unknown[]) => {
				const query = strings.join("?");
				calls.push({ query, values });
				if (query.includes("COUNT(*) FILTER")) {
					return [
						{
							query: "amapiano",
							count: 3,
							recentCount: 1,
							lastSeenAt: "2026-05-14T12:00:00.000Z",
						},
					];
				}
				return [];
			},
		);
		const repository = new DiscoveryAnalyticsRepository(sql as unknown as Sql);

		const rows = await repository.listTopSearchSignals({
			startAt: "2026-05-07T00:00:00.000Z",
			endAt: "2026-05-14T00:00:00.000Z",
			recentStartAt: "2026-05-12T00:00:00.000Z",
			limit: 250,
			excludeSearchSource: "popular_chip",
		});

		expect(rows).toEqual([
			{
				query: "amapiano",
				count: 3,
				recentCount: 1,
				lastSeenAt: "2026-05-14T12:00:00.000Z",
			},
		]);
		const signalCall = calls.find((call) =>
			call.query.includes("COUNT(*) FILTER"),
		);
		expect(signalCall?.query).toContain(
			"AND recorded_at < ?\n\t\t\t\t?\n\t\t\tGROUP BY search_query",
		);
	});
});
