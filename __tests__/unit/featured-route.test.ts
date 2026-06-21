import {
	FEATURED_FETE_ROUTE,
	getFeaturedFeteRouteHref,
	isFeaturedFeteRouteShareToken,
} from "@/features/plans/featured-route";
import { describe, expect, it } from "vitest";

describe("featured route config", () => {
	it("keeps the public route URL separate from the backing share token", () => {
		expect(getFeaturedFeteRouteHref()).toBe("/route");
		expect(getFeaturedFeteRouteHref()).not.toContain(
			FEATURED_FETE_ROUTE.shareToken,
		);
		expect(isFeaturedFeteRouteShareToken(FEATURED_FETE_ROUTE.shareToken)).toBe(
			true,
		);
	});

	it("uses human-facing copy for the route prompt", () => {
		expect(FEATURED_FETE_ROUTE.crossSellHeadline).toBe(
			"Need a ready-made route for today?",
		);
		expect(FEATURED_FETE_ROUTE.crossSellSummary).toBe(
			"Follow our handmade route for Fête.",
		);
	});
});
