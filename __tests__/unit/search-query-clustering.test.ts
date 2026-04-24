import { describe, expect, it } from "vitest";
import { clusterTopSearchQueries } from "@/features/events/engagement/search-query-clustering";

describe("clusterTopSearchQueries", () => {
	it("clusters genre aliases into the same canonical search family", () => {
		const clusters = clusterTopSearchQueries(
			[
				{ query: "rnb", count: 3 },
				{ query: "R&B", count: 2 },
				{ query: "afrohouse", count: 4 },
				{ query: "afro house", count: 1 },
			],
			10,
		);

		expect(clusters).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					count: 5,
					variantCount: 2,
					variants: expect.arrayContaining([
						expect.objectContaining({ query: "rnb", count: 3 }),
						expect.objectContaining({ query: "R&B", count: 2 }),
					]),
				}),
				expect.objectContaining({
					count: 5,
					variantCount: 2,
					variants: expect.arrayContaining([
						expect.objectContaining({ query: "afrohouse", count: 4 }),
						expect.objectContaining({ query: "afro house", count: 1 }),
					]),
				}),
			]),
		);
	});
});
