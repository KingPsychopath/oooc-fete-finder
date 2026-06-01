import { EventEngagementRepository } from "@/lib/platform/postgres/event-engagement-repository";
import type { Sql } from "postgres";
import { describe, expect, it, vi } from "vitest";

describe("EventEngagementRepository", () => {
	it("projects public save counts with session dedupe inside the configured window", async () => {
		const calls: Array<{ query: string; values: unknown[] }> = [];
		const sql = vi.fn(
			async (strings: TemplateStringsArray, ...values: unknown[]) => {
				const query = strings.join("?");
				calls.push({ query, values });
				if (
					query.includes('event_key AS "eventKey"') &&
					query.includes("COUNT(DISTINCT COALESCE")
				) {
					return [{ eventKey: "event-a", count: 2 }];
				}
				return [];
			},
		);
		const repository = new EventEngagementRepository(sql as unknown as Sql);

		const counts = await repository.getSocialProofSaveCounts({
			eventKeys: [" event-a ", "event-a", "event-b"],
			windowDays: 7,
		});

		expect(counts.get("event-a")).toBe(2);
		const projectionCall = calls.find((call) =>
			call.query.includes("COUNT(DISTINCT COALESCE"),
		);
		expect(projectionCall?.query).toContain(
			"action_type IN ('calendar_sync', 'saved_toggle')",
		);
		expect(projectionCall?.query).toContain(
			"NOT (action_type = 'saved_toggle' AND COALESCE(source, '') ILIKE '%unsave%')",
		);
		expect(projectionCall?.query).toContain(
			"recorded_at >= NOW() - (? * INTERVAL '1 day')",
		);
		expect(projectionCall?.values).toContainEqual(["event-a", "event-b"]);
		expect(projectionCall?.values).toContain(7);
	});

	it("returns map preference change totals in global summary", async () => {
		const calls: Array<{ query: string; values: unknown[] }> = [];
		const sql = vi.fn(
			async (strings: TemplateStringsArray, ...values: unknown[]) => {
				const query = strings.join("?");
				calls.push({ query, values });
				if (
					query.includes(
						"COUNT(*) FILTER (WHERE action_type = 'map_preference_change')",
					)
				) {
					return [
						{
							clickCount: 10,
							dedupedViewCount: 9,
							outboundClickCount: 2,
							calendarSyncCount: 1,
							mapOpenCount: 4,
							mapPreferenceChangeCount: 3,
							uniqueSessionCount: 7,
							uniqueViewSessionCount: 6,
							uniqueOutboundSessionCount: 5,
							uniqueCalendarSessionCount: 3,
							uniqueMapSessionCount: 4,
						},
					];
				}
				return [];
			},
		);
		const repository = new EventEngagementRepository(sql as unknown as Sql);

		const summary = await repository.summarizeWindow({
			startAt: "2026-05-01T00:00:00.000Z",
			endAt: "2026-05-10T23:59:59.999Z",
		});

		const summaryQuery = calls.find(
			(call) =>
				call.query.includes("annotated") &&
				call.query.includes(
					"COUNT(*) FILTER (WHERE action_type = 'map_preference_change')",
				),
		);

		expect(summary.mapPreferenceChangeCount).toBe(3);
		expect(summaryQuery?.query).toContain(
			"COUNT(*) FILTER (WHERE action_type = 'map_preference_change')::int AS \"mapPreferenceChangeCount\"",
		);
	});
});
