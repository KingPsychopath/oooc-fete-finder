import type { Event } from "@/features/events/types";
import type {
	TicketExchangePriceBasis,
	TicketExchangePriceCurrency,
	TicketExchangePriceSource,
} from "./pricing";

export type TicketExchangeListingType = "selling" | "looking";
export type TicketExchangeListingStatus =
	| "active"
	| "paused"
	| "resolved"
	| "expired"
	| "removed";
export type TicketExchangeContactMethod =
	| "email"
	| "whatsapp"
	| "instagram"
	| "x";
export type TicketExchangeReportReason =
	| "scam"
	| "wrong_event"
	| "misleading_price"
	| "abusive_contact"
	| "spam"
	| "other";

export interface TicketExchangeContactProfile {
	userId: string;
	accountEmail: string;
	displayName: string;
	alternateEmail: string;
	whatsappNumber: string;
	instagramHandle: string;
	xHandle: string;
	rulesAcceptedAt: string | null;
	rulesVersion: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface TicketExchangeContactSnapshot {
	displayName: string;
	email: string;
	whatsapp: string;
	instagram: string;
	x: string;
}

export interface TicketExchangeInterestView {
	id: string;
	listingId: string;
	actorUserId: string;
	actorEmail: string;
	contactMethods: TicketExchangeContactMethod[];
	contactSnapshot: TicketExchangeContactSnapshot;
	createdAt: string;
}

export interface TicketExchangeListingView {
	id: string;
	eventKey: string;
	eventSlug: string;
	eventName: string;
	listingType: TicketExchangeListingType;
	quantityLabel: string;
	priceLabel: string;
	priceAmountMinor: number | null;
	priceCurrency: TicketExchangePriceCurrency | null;
	priceBasis: TicketExchangePriceBasis;
	priceSource: TicketExchangePriceSource;
	note: string;
	status: TicketExchangeListingStatus;
	effectiveStatus: TicketExchangeListingStatus;
	ownerUserId: string;
	ownerEmail: string;
	contactMethods: TicketExchangeContactMethod[];
	contactSnapshot?: TicketExchangeContactSnapshot;
	expiresAt: string;
	createdAt: string;
	updatedAt: string;
	resolvedAt: string | null;
	interestCount: number;
	isOwner: boolean;
	myInterest: TicketExchangeInterestView | null;
	interests: TicketExchangeInterestView[];
}

export interface TicketExchangeSummary {
	eventKey: string;
	sellingCount: number;
	lookingCount: number;
	latestListingAt: string | null;
}

export interface TicketExchangeAdminListing {
	id: string;
	eventKey: string;
	eventSlug: string;
	eventName: string;
	listingType: TicketExchangeListingType;
	quantityLabel: string;
	priceLabel: string;
	priceAmountMinor: number | null;
	priceCurrency: TicketExchangePriceCurrency | null;
	priceBasis: TicketExchangePriceBasis;
	priceSource: TicketExchangePriceSource;
	note: string;
	status: TicketExchangeListingStatus;
	effectiveStatus: TicketExchangeListingStatus;
	ownerUserId: string;
	ownerEmail: string;
	contactMethods: TicketExchangeContactMethod[];
	expiresAt: string;
	createdAt: string;
	updatedAt: string;
	resolvedAt: string | null;
	interestCount: number;
	reportCount: number;
	botAnnouncedAt: string | null;
}

export interface TicketExchangeAdminReport {
	id: string;
	listingId: string;
	reporterUserId: string;
	reporter: {
		userId: string;
		email: string | null;
		firstName: string | null;
		lastName: string | null;
	};
	reason: TicketExchangeReportReason;
	details: string;
	createdAt: string;
	reviewedAt: string | null;
	reviewedBy: string | null;
	reviewNote: string;
	listing: Pick<
		TicketExchangeAdminListing,
		| "id"
		| "eventKey"
		| "eventSlug"
		| "eventName"
		| "listingType"
		| "quantityLabel"
		| "priceLabel"
		| "status"
		| "effectiveStatus"
		| "ownerUserId"
		| "ownerEmail"
	> & {
		owner: {
			userId: string;
			email: string | null;
			firstName: string | null;
			lastName: string | null;
		};
	};
}

export interface TicketExchangeAdminUnlockWatch {
	actorUserId: string;
	actorEmail: string;
	activeOrLockedCount: number;
	dailyUnlockCount: number;
	latestUnlockAt: string;
}

export interface TicketExchangeAdminDashboard {
	activeSellingCount: number;
	activeLookingCount: number;
	pendingReportCount: number;
	botPendingCount: number;
	botAnnouncedCount: number;
	contactUnlockCount: number;
	unlockWatch: TicketExchangeAdminUnlockWatch[];
	recentListings: TicketExchangeAdminListing[];
	recentReports: TicketExchangeAdminReport[];
}

export interface TicketExchangeAdminStatsWindow {
	listingCreateCount: number;
	sellingListingCreateCount: number;
	lookingListingCreateCount: number;
	uniqueListingOwnerCount: number;
	interestCreateCount: number;
	uniqueInterestedUserCount: number;
	reportCreateCount: number;
	uniqueReportedListingCount: number;
	resolvedListingCount: number;
	removedListingCount: number;
	activeSellingCount: number;
	activeLookingCount: number;
	pendingReportCount: number;
	botPendingCount: number;
	botAnnouncedCount: number;
	contactUnlockCount: number;
}

export interface TicketExchangeAdminEventStats {
	eventKey: string;
	eventName: string;
	listingCreateCount: number;
	sellingListingCreateCount: number;
	lookingListingCreateCount: number;
	interestCreateCount: number;
	reportCreateCount: number;
	resolvedListingCount: number;
}

export interface TicketExchangePageData {
	events: Event[];
	selectedEventKey: string | null;
	profile: TicketExchangeContactProfile | null;
	listings: TicketExchangeListingView[];
	summaries: TicketExchangeSummary[];
	isAuthenticated: boolean;
	userEmail: string | null;
	userId: string | null;
	supported: boolean;
	emailEnabled: boolean;
}

export interface TicketExchangeActionResult {
	success: boolean;
	error?: string;
	data?: TicketExchangePageData;
}
