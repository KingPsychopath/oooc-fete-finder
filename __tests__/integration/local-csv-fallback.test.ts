import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("local CSV fallback", () => {
	it("parses the bundled fallback CSV into live events", async () => {
		process.env.AUTH_SECRET ??=
			"test-auth-secret-0123456789-abcdefghijklmnopqrstuvwxyz";
		const [{ processCSVData }, csvContent] = await Promise.all([
			import("@/features/data-management/data-processor"),
			readFile("data/events.csv", "utf-8"),
		]);

		const result = await processCSVData(csvContent, "local", false, {
			populateCoordinates: false,
			referenceDate: new Date("2026-04-29T00:00:00.000Z"),
		});

		expect(result.errors).toEqual([]);
		expect(result.count).toBeGreaterThan(0);
		expect(result.events[0]).toMatchObject({
			name: expect.any(String),
			genre: expect.any(Array),
		});
	});
});
