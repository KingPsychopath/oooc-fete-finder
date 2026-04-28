import type { Sql } from "postgres";
import { describe, expect, it, vi } from "vitest";
import { EventEngagementRepository } from "@/lib/platform/postgres/event-engagement-repository";

describe("EventEngagementRepository", () => {
	it("projects public save counts with session dedupe", async () => {
		const calls: Array<{ query: string; values: unknown[] }> = [];
		const sql = vi.fn(
			async (strings: TemplateStringsArray, ...values: unknown[]) => {
				const query = strings.join("?");
				calls.push({ query, values });
				if (
					query.includes('event_key AS "eventKey"') &&
					query.includes("COUNT(DISTINCT session_id)")
				) {
					return [{ eventKey: "event-a", count: 2 }];
				}
				return [];
			},
		);
		const repository = new EventEngagementRepository(sql as unknown as Sql);

		const counts = await repository.getSocialProofSaveCounts([
			" event-a ",
			"event-a",
			"event-b",
		]);

		expect(counts.get("event-a")).toBe(2);
		const projectionCall = calls.find((call) =>
			call.query.includes("COUNT(DISTINCT session_id)"),
		);
		expect(projectionCall?.query).toContain(
			"COUNT(*) FILTER (WHERE session_id IS NULL)",
		);
		expect(projectionCall?.values).toContainEqual(["event-a", "event-b"]);
	});
});
