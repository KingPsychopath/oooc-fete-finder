import {
	OFFICIAL_FETE_PLAN,
	getOfficialFetePlanHref,
	isDeprecatedOfficialFeteSourceToken,
} from "@/features/plans/official-plan-config";
import { describe, expect, it } from "vitest";

describe("official plan config", () => {
	it("uses /plans/fete as the canonical official route", () => {
		expect(getOfficialFetePlanHref()).toBe("/plans/fete");
		expect(getOfficialFetePlanHref()).not.toContain(
			OFFICIAL_FETE_PLAN.sourceShareToken,
		);
		expect(
			isDeprecatedOfficialFeteSourceToken(OFFICIAL_FETE_PLAN.sourceShareToken),
		).toBe(true);
	});

	it("uses human-facing copy for the route prompt", () => {
		expect(OFFICIAL_FETE_PLAN.crossSellHeadline).toBe(
			"Need a ready-made route for today?",
		);
		expect(OFFICIAL_FETE_PLAN.crossSellSummary).toBe(
			"Follow our handmade route for Fête.",
		);
	});
});
