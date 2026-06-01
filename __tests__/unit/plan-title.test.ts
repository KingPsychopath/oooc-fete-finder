import {
	formatPublicPlanTitle,
	validatePlanTitle,
} from "@/features/plans/plan-title";
import { describe, expect, it } from "vitest";

describe("plan title policy", () => {
	it("normalizes safe private route labels", () => {
		expect(validatePlanTitle("  Friday   crew route  ")).toEqual({
			success: true,
			title: "Friday crew route",
		});
	});

	it("rejects public-abuse patterns", () => {
		expect(validatePlanTitle("https://spam.example")).toMatchObject({
			success: false,
		});
		expect(validatePlanTitle("Official OOOC afters")).toMatchObject({
			success: false,
		});
		expect(validatePlanTitle("+44 7700 900123")).toMatchObject({
			success: false,
		});
	});

	it("uses canonical public titles from route date", () => {
		expect(formatPublicPlanTitle("2026-06-19")).toBe("Route for Fri 19 Jun");
	});
});
