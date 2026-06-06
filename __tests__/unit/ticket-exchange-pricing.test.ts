import {
	buildTicketExchangePricingSuggestion,
	getTicketExchangeFairPriceContext,
	parseTicketExchangePriceLabel,
	validateTicketExchangeFairPricePolicy,
} from "@/features/ticket-exchange/pricing";
import type { TicketExchangeListingType } from "@/features/ticket-exchange/types";
import { describe, expect, it } from "vitest";

const event = { price: "£35 - £42.50" };

describe("ticket exchange pricing", () => {
	it("parses clear resale price labels into structured fields", () => {
		expect(parseTicketExchangePriceLabel("£35 each")).toEqual({
			amountMinor: 3500,
			currency: "GBP",
			basis: "per_ticket",
			isFaceValue: false,
		});
		expect(parseTicketExchangePriceLabel("€70 total")).toEqual({
			amountMinor: 7000,
			currency: "EUR",
			basis: "total",
			isFaceValue: false,
		});
		expect(parseTicketExchangePriceLabel("face value")).toEqual({
			amountMinor: null,
			currency: null,
			basis: "unknown",
			isFaceValue: true,
		});
	});

	it("uses the listed event max as the fair-price cap", () => {
		expect(getTicketExchangeFairPriceContext(event)).toEqual({
			eventPriceLabel: "£35 - £42.50",
			eventMaxAmountMinor: 4250,
			eventCurrency: "GBP",
		});
	});

	it("blocks clear selling markup above the listed event price", () => {
		expect(() =>
			validateTicketExchangeFairPricePolicy({
				event,
				listingType: "selling",
				priceLabel: "£43",
			}),
		).toThrow("face value or less");

		expect(() =>
			validateTicketExchangeFairPricePolicy({
				event,
				listingType: "selling",
				priceLabel: "£42.50 including fees",
			}),
		).not.toThrow();
	});

	it("does not block looking budgets or ambiguous face-value labels", () => {
		expect(() =>
			validateTicketExchangeFairPricePolicy({
				event,
				listingType: "looking",
				priceLabel: "£100",
			}),
		).not.toThrow();
		expect(() =>
			validateTicketExchangeFairPricePolicy({
				event,
				listingType: "selling",
				priceLabel: "FV",
			}),
		).not.toThrow();
	});

	it("builds subtle event and community guidance from clean same-currency listings", () => {
		const suggestion = buildTicketExchangePricingSuggestion({
			event,
			listingType: "selling",
			listings: [
				listing("selling", 3500, "GBP"),
				listing("selling", 4000, "GBP"),
				listing("selling", 4250, "GBP"),
				listing("looking", 9000, "GBP"),
				listing("selling", 5000, "EUR"),
			],
		});

		expect(suggestion.eventSuggestedLabel).toBe("£42.50");
		expect(suggestion.communityRangeLabel).toBe(
			"Recent listings: usually £35-£42.50",
		);
		expect(suggestion.helperText).toContain("no markup");
	});
});

const listing = (
	listingType: TicketExchangeListingType,
	priceAmountMinor: number,
	priceCurrency: "GBP" | "EUR" | "USD",
) => ({
	listingType,
	priceAmountMinor,
	priceCurrency,
	effectiveStatus: "active",
});
