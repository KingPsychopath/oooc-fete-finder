import {
	formatPrice,
	getPriceMeta,
	isPriceInRange,
	parsePrice,
} from "@/features/events/types";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
	vi.unstubAllEnvs();
});

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
		expect(parsePrice("£10")).toBeCloseTo(11.54, 5);
		expect(parsePrice("£15")).toBeCloseTo(17.31, 5);
		expect(parsePrice("GBP 12")).toBeCloseTo(13.848, 5);
		expect(parsePrice("12 pounds")).toBeCloseTo(13.848, 5);
	});

	it("converts USD values", () => {
		expect(parsePrice("$10")).toBeCloseTo(8.54, 5);
		expect(parsePrice("USD 20")).toBeCloseTo(17.08, 5);
		expect(parsePrice("20 dollars")).toBeCloseTo(17.08, 5);
	});

	it("uses configured currency conversion rates", () => {
		vi.stubEnv("NEXT_PUBLIC_PRICE_RATE_GBP_TO_EUR", "1.2");
		vi.stubEnv("NEXT_PUBLIC_PRICE_RATE_USD_TO_EUR", "0.9");

		expect(parsePrice("£10")).toBeCloseTo(12, 5);
		expect(parsePrice("$10")).toBeCloseTo(9, 5);
	});

	it("recognizes free-like values", () => {
		expect(parsePrice("Free entry before 1am")).toBe(0);
		expect(parsePrice("gratuit")).toBe(0);
	});

	it("distinguishes truly free prices from conditional free options", () => {
		expect(getPriceMeta("Free").kind).toBe("free");
		expect(getPriceMeta("No ticket needed").kind).toBe("free");
		expect(getPriceMeta("Free - £10").kind).toBe("free_option");
		expect(getPriceMeta("Free entry before 1am").kind).toBe("free_option");
		expect(formatPrice("Free - 10")).toBe("Free - 10");
	});

	it("uses normalized euro-equivalent value for range filtering", () => {
		expect(isPriceInRange("GBP 12", [13, 14])).toBe(true);
		expect(isPriceInRange("GBP 12", [0, 13])).toBe(false);
	});

	it("filters ranges by starting price", () => {
		expect(isPriceInRange("€28.00 - €35.84", [28, 30])).toBe(true);
		expect(isPriceInRange("€28.00 - €35.84", [0, 27])).toBe(false);
	});

	it("keeps free-only filtering strict unless free options are included", () => {
		expect(isPriceInRange("Free", [0, 0])).toBe(true);
		expect(isPriceInRange("Free - £10", [0, 0])).toBe(false);
		expect(
			isPriceInRange("Free - £10", [0, 0], { includeFreeOptions: true }),
		).toBe(true);
	});

	it("keeps range copy visible when formatting prices", () => {
		expect(formatPrice("€28.00 - €35.84")).toBe("€28.00 - €35.84");
		expect(formatPrice("28 - 35.84")).toBe("€28 - €35.84");
	});

	it("keeps explicit currency copy visible when formatting prices", () => {
		expect(formatPrice("$20")).toBe("$20");
		expect(formatPrice("USD 20")).toBe("USD 20");
		expect(formatPrice("GBP 20")).toBe("GBP 20");
		expect(formatPrice("20 euros")).toBe("20 euros");
	});
});
