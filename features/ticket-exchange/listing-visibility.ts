import { TICKET_EXCHANGE_PUBLIC_RESOLVED_TOMBSTONE_MINUTES } from "./constants";
import type {
	TicketExchangeListingType,
	TicketExchangeListingView,
} from "./types";

export type TicketExchangeMarketplaceTab = "all" | TicketExchangeListingType;

const minutesToMs = (minutes: number): number => minutes * 60 * 1000;

const parseIsoMs = (value: string | null | undefined): number | null => {
	if (!value) return null;
	const ms = new Date(value).getTime();
	return Number.isFinite(ms) ? ms : null;
};

export const matchesTicketExchangeMarketplaceTab = (
	listing: Pick<TicketExchangeListingView, "listingType">,
	tab: TicketExchangeMarketplaceTab,
): boolean => tab === "all" || listing.listingType === tab;

export const isRecentResolvedTicketExchangeListing = (
	listing: Pick<
		TicketExchangeListingView,
		"effectiveStatus" | "resolvedAt" | "updatedAt"
	>,
	nowMs = Date.now(),
	windowMinutes = TICKET_EXCHANGE_PUBLIC_RESOLVED_TOMBSTONE_MINUTES,
): boolean => {
	if (listing.effectiveStatus !== "resolved") return false;
	const resolvedMs =
		parseIsoMs(listing.resolvedAt) ?? parseIsoMs(listing.updatedAt);
	if (resolvedMs === null) return false;
	const ageMs = nowMs - resolvedMs;
	return ageMs >= 0 && ageMs <= minutesToMs(windowMinutes);
};

export const isPublicTicketExchangeListingVisible = (
	listing: Pick<
		TicketExchangeListingView,
		"effectiveStatus" | "listingType" | "resolvedAt" | "updatedAt"
	>,
	tab: TicketExchangeMarketplaceTab,
	nowMs = Date.now(),
): boolean => {
	if (!matchesTicketExchangeMarketplaceTab(listing, tab)) return false;
	if (listing.effectiveStatus === "active") return true;
	return isRecentResolvedTicketExchangeListing(listing, nowMs);
};

export const isMyTicketExchangeActivityVisible = (
	listing: Pick<TicketExchangeListingView, "isOwner" | "myInterest">,
): boolean => listing.isOwner || Boolean(listing.myInterest);
