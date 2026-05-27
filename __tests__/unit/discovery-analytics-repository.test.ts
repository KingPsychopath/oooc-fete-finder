import { DiscoveryAnalyticsRepository } from "@/lib/platform/postgres/discovery-analytics-repository";
import type { Sql } from "postgres";
import { describe, expect, it, vi } from "vitest";

describe("DiscoveryAnalyticsRepository", () => {
	it("creates the first-party page-view columns and action contract", async () => {
		const calls: Array<{ query: string; values: unknown[] }> = [];
		const sql = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
			const query = strings.join("?");
			calls.push({ query, values });
			return [];
		});

		const repository = new DiscoveryAnalyticsRepository(sql as unknown as Sql);
		await repository.summarizeTrafficWindow({
			startAt: "2026-05-20T00:00:00.000Z",
			endAt: "2026-05-27T00:00:00.000Z",
		});

		const queries = calls.map((call) => call.query).join("\n");
		expect(queries).toContain("action_type IN ('page_view'");
		expect(queries).toContain("ADD COLUMN IF NOT EXISTS hostname TEXT");
		expect(queries).toContain("ADD COLUMN IF NOT EXISTS referrer TEXT");
		expect(queries).toContain("ADD COLUMN IF NOT EXISTS utm_source TEXT");
		expect(queries).toContain("ADD COLUMN IF NOT EXISTS utm_campaign TEXT");
		expect(queries).toContain("ADD COLUMN IF NOT EXISTS country_code TEXT");
	});

	it("lists first-party traffic panels from page-view rows only", async () => {
		const calls: Array<{ query: string; values: unknown[] }> = [];
		const sql = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
			const query = strings.join("?");
			calls.push({ query, values });
			if (query.includes("AS label")) {
				return [
					{
						label: "/event/evt_123",
						pageViewCount: 4,
						uniqueVisitorCount: 2,
					},
				];
			}
			return [];
		});
		const repository = new DiscoveryAnalyticsRepository(sql as unknown as Sql);

		const rows = await repository.listTopTrafficDimension({
			dimension: "path",
			startAt: "2026-05-20T00:00:00.000Z",
			endAt: "2026-05-27T00:00:00.000Z",
			limit: 10,
		});

		expect(rows).toEqual([
			{
				label: "/event/evt_123",
				pageViewCount: 4,
				uniqueVisitorCount: 2,
			},
		]);
		const trafficCall = calls.find((call) => call.query.includes("AS label"));
		expect(trafficCall?.query).toContain("WHERE action_type = 'page_view'");
	});

	it("can exclude popular chip searches from public search chip signals", async () => {
		const calls: Array<{ query: string; values: unknown[] }> = [];
		const sql = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
			const query = strings.join("?");
			calls.push({ query, values });
			if (query.includes("COALESCE(filter_group")) {
				return { query, values };
			}
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
		});
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
		expect(JSON.stringify(signalCall?.values)).toContain("COALESCE");
		expect(JSON.stringify(signalCall?.values)).toContain("popular_chip");
	});
});
