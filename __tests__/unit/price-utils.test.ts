import { isPriceInRange, parsePrice } from "@/features/events/types";
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
});
