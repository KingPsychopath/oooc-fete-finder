import type { Event } from "@/features/events/types";
import { formatPrice, getPriceMeta } from "@/features/events/types";
import type { TicketExchangeListingType } from "./types";

export type TicketExchangePriceCurrency = "GBP" | "EUR" | "USD";
export type TicketExchangePriceBasis = "per_ticket" | "total" | "unknown";
export type TicketExchangePriceSource =
	| "user"
	| "suggested_event_price"
	| "face_value";

export interface TicketExchangeParsedPrice {
	amountMinor: number | null;
	currency: TicketExchangePriceCurrency | null;
	basis: TicketExchangePriceBasis;
	isFaceValue: boolean;
}

export interface TicketExchangeFairPriceContext {
	eventPriceLabel: string | null;
	eventMaxAmountMinor: number | null;
	eventCurrency: TicketExchangePriceCurrency | null;
}

export interface TicketExchangePricingSuggestion {
	eventPriceLabel: string | null;
	eventSuggestedLabel: string | null;
	communityRangeLabel: string | null;
	helperText: string;
}

const FACE_VALUE_PRICE_PATTERN = /\b(?:fv|face\s*value)\b/iu;
const NUMERIC_PRICE_PATTERN =
	/(?:[$£€]\s*\d+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?\s*(?:[$£€]|\b(?:gbp|eur|usd|pounds?|euros?|dollars?)\b)|\b(?:gbp|eur|usd|pounds?|euros?|dollars?)\s*\d+(?:[.,]\d{1,2})?|\b\d+(?:[.,]\d{1,2})?\b)/iu;

const PRICE_NUMBER_PATTERN = /\d[\d\s.,]*/gu;

const normalizeNumericToken = (raw: string): string => {
	const token = raw.replace(/\s+/g, "");
	const hasComma = token.includes(",");
	const hasDot = token.includes(".");

	if (hasComma && hasDot) {
		const lastComma = token.lastIndexOf(",");
		const lastDot = token.lastIndexOf(".");
		return lastComma > lastDot
			? token.replace(/\./g, "").replace(/,/g, ".")
			: token.replace(/,/g, "");
	}

	if (hasComma) {
		return /,\d{1,2}$/.test(token)
			? token.replace(/,/g, ".")
			: token.replace(/,/g, "");
	}

	if (hasDot && !/\.\d{1,2}$/.test(token)) {
		return token.replace(/\./g, "");
	}

	return token;
};

const getPriceCurrency = (
	value: string,
	fallbackCurrency: TicketExchangePriceCurrency | null = null,
): TicketExchangePriceCurrency | null => {
	const normalized = value.toLowerCase();
	if (normalized.includes("£") || /\b(?:gbp|pounds?)\b/u.test(normalized)) {
		return "GBP";
	}
	if (normalized.includes("€") || /\b(?:eur|euros?)\b/u.test(normalized)) {
		return "EUR";
	}
	if (normalized.includes("$") || /\b(?:usd|dollars?)\b/u.test(normalized)) {
		return "USD";
	}
	return fallbackCurrency;
};

const getPriceBasis = (value: string): TicketExchangePriceBasis => {
	const normalized = value.toLowerCase();
	if (/\b(?:each|ea|per\s*ticket|pp|per\s*person)\b/u.test(normalized)) {
		return "per_ticket";
	}
	if (/\b(?:total|altogether|all\s*in|for\s*both|for\s*all)\b/u.test(normalized)) {
		return "total";
	}
	return "unknown";
};

const toMinorUnits = (amount: number): number => Math.round(amount * 100);

const formatMinorAmount = (
	amountMinor: number,
	currency: TicketExchangePriceCurrency,
): string => {
	const symbol = currency === "GBP" ? "£" : currency === "EUR" ? "€" : "$";
	const amount = amountMinor / 100;
	return Number.isInteger(amount) ? `${symbol}${amount}` : `${symbol}${amount.toFixed(2)}`;
};

export const parseTicketExchangePriceLabel = (
	value: string,
	options?: { fallbackCurrency?: TicketExchangePriceCurrency | null },
): TicketExchangeParsedPrice => {
	const priceLabel = value.trim();
	const isFaceValue = FACE_VALUE_PRICE_PATTERN.test(priceLabel);
	const currency = getPriceCurrency(priceLabel, options?.fallbackCurrency ?? null);
	const matches = [...priceLabel.matchAll(PRICE_NUMBER_PATTERN)];
	const amounts = matches
		.map((match) => Number.parseFloat(normalizeNumericToken(match[0])))
		.filter((amount) => Number.isFinite(amount) && amount >= 0);

	return {
		amountMinor: amounts.length > 0 ? toMinorUnits(Math.max(...amounts)) : null,
		currency,
		basis: getPriceBasis(priceLabel),
		isFaceValue,
	};
};

export const isTicketExchangePriceLabelShapeValid = (value: string): boolean =>
	FACE_VALUE_PRICE_PATTERN.test(value) || NUMERIC_PRICE_PATTERN.test(value);

export const getTicketExchangeFairPriceContext = (
	event: Pick<Event, "price">,
): TicketExchangeFairPriceContext => {
	const priceMeta = getPriceMeta(event.price);
	const label = event.price ? formatPrice(event.price) : null;
	const parsed = parseTicketExchangePriceLabel(event.price ?? "");
	if (priceMeta.kind === "free") {
		return {
			eventPriceLabel: label,
			eventMaxAmountMinor: 0,
			eventCurrency: parsed.currency ?? "EUR",
		};
	}
	if (priceMeta.kind === "unknown" || parsed.amountMinor === null) {
		return {
			eventPriceLabel: label,
			eventMaxAmountMinor: null,
			eventCurrency: null,
		};
	}

	return {
		eventPriceLabel: label,
		eventMaxAmountMinor: parsed.amountMinor,
		eventCurrency: parsed.currency ?? "EUR",
	};
};

const getMedian = (values: number[]): number | null => {
	if (values.length === 0) return null;
	const sorted = [...values].sort((left, right) => left - right);
	const middle = Math.floor(sorted.length / 2);
	if (sorted.length % 2 === 1) return sorted[middle] ?? null;
	const left = sorted[middle - 1];
	const right = sorted[middle];
	return left === undefined || right === undefined ? null : (left + right) / 2;
};

export const buildTicketExchangePricingSuggestion = (input: {
	event: Pick<Event, "price"> | null;
	listings: Array<{
		listingType: TicketExchangeListingType;
		priceAmountMinor: number | null;
		priceCurrency: TicketExchangePriceCurrency | null;
		effectiveStatus: string;
	}>;
	listingType: TicketExchangeListingType;
}): TicketExchangePricingSuggestion => {
	const context = input.event
		? getTicketExchangeFairPriceContext(input.event)
		: {
				eventPriceLabel: null,
				eventMaxAmountMinor: null,
				eventCurrency: null,
			};
	const eventSuggestedLabel =
		context.eventMaxAmountMinor !== null && context.eventCurrency
			? formatMinorAmount(context.eventMaxAmountMinor, context.eventCurrency)
			: null;

	const communityPrices = input.listings
		.filter(
			(listing) =>
				listing.listingType === input.listingType &&
				(listing.effectiveStatus === "active" ||
					listing.effectiveStatus === "resolved") &&
				listing.priceAmountMinor !== null &&
				listing.priceCurrency &&
				listing.priceCurrency === context.eventCurrency,
		)
		.map((listing) => listing.priceAmountMinor as number);

	const median = getMedian(communityPrices);
	const min = communityPrices.length >= 3 ? Math.min(...communityPrices) : null;
	const max = communityPrices.length >= 3 ? Math.max(...communityPrices) : null;
	const communityRangeLabel =
		min !== null && max !== null && context.eventCurrency
			? min === max
				? `Recent listings: usually ${formatMinorAmount(min, context.eventCurrency)}`
				: `Recent listings: usually ${formatMinorAmount(min, context.eventCurrency)}-${formatMinorAmount(max, context.eventCurrency)}`
			: median !== null && context.eventCurrency && communityPrices.length >= 3
				? `Recent listings: around ${formatMinorAmount(median, context.eventCurrency)}`
				: null;

	const helperText =
		input.listingType === "selling"
			? context.eventPriceLabel
				? `OOOC has this as ${context.eventPriceLabel}. Sell for what you paid or less, including original fees. No markup.`
				: "Sell for what you paid or less, including original fees. No markup."
			: context.eventPriceLabel
				? `OOOC has this as ${context.eventPriceLabel}. Use it as a fair budget guide.`
				: "Use the original ticket price as your budget guide where you can.";

	return {
		eventPriceLabel: context.eventPriceLabel,
		eventSuggestedLabel,
		communityRangeLabel,
		helperText,
	};
};

export const formatTicketExchangeSuggestedPrice = (
	amountMinor: number,
	currency: TicketExchangePriceCurrency,
): string => formatMinorAmount(amountMinor, currency);
