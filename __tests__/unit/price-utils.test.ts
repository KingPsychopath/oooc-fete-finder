import {
	formatPrice,
	isPriceInRange,
	parsePrice,
} from "@/features/events/types";
import { describe, expect, it } from "vitest";

describe("parsePrice", () => {
	it("parses comma decimals", () => {
		expect(parsePrice("€12,50")).toBe(12.5);
	});

	it("parses locale thousands and decimal separators", () => {
		expect(parsePrice("1.200,50 €")).toBe(1200.5);
		expect(parsePrice("1,200.50 €")).toBe(1200.5);
	});

	it("uses lower bound for ranges", () => {
		expect(parsePrice("€10-€15")).toBe(10);
		expect(parsePrice("from 8 to 12")).toBe(8);
		expect(parsePrice("€28.00 - €35.84")).toBe(28);
	});

	it("converts GBP values", () => {
		expect(parsePrice("£10")).toBeCloseTo(11.7, 5);
		expect(parsePrice("£15")).toBeCloseTo(17.55, 5);
		expect(parsePrice("GBP 12")).toBeCloseTo(14.04, 5);
	});

	it("recognizes free-like values", () => {
		expect(parsePrice("Free entry before 1am")).toBe(0);
		expect(parsePrice("gratuit")).toBe(0);
	});

	it("uses normalized euro-equivalent value for range filtering", () => {
		expect(isPriceInRange("GBP 12", [14, 15])).toBe(true);
		expect(isPriceInRange("GBP 12", [0, 13])).toBe(false);
	});

	it("filters ranges by starting price", () => {
		expect(isPriceInRange("€28.00 - €35.84", [28, 30])).toBe(true);
		expect(isPriceInRange("€28.00 - €35.84", [0, 27])).toBe(false);
	});

	it("keeps range copy visible when formatting prices", () => {
		expect(formatPrice("€28.00 - €35.84")).toBe("€28.00 - €35.84");
		expect(formatPrice("28 - 35.84")).toBe("€28 - €35.84");
	});
});
