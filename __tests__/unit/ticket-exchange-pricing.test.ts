import {
	buildTicketExchangePricingSuggestion,
	getTicketExchangeFairPriceContext,
	parseTicketExchangePriceLabel,
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

	it("keeps OOOC event pricing as guidance rather than enforcement", () => {
		const suggestion = buildTicketExchangePricingSuggestion({
			event,
			listingType: "selling",
			listings: [listing("selling", 5000, "GBP")],
		});

		expect(suggestion.eventSuggestedLabel).toBe("£42.50");
		expect(suggestion.helperText).toContain("Sell for what you paid or less");
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
		expect(suggestion.helperText).toContain("No markup");
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
