import {
	isMyTicketExchangeActivityVisible,
	isPublicTicketExchangeListingVisible,
} from "@/features/ticket-exchange/listing-visibility";
import type { TicketExchangeListingView } from "@/features/ticket-exchange/types";
import { describe, expect, it } from "vitest";

const NOW_MS = new Date("2026-06-02T12:00:00.000Z").getTime();

const listing = (
	overrides: Partial<TicketExchangeListingView> = {},
): TicketExchangeListingView => ({
	id: "listing_1",
	eventKey: "event_1",
	eventSlug: "event-one",
	eventName: "Event One",
	listingType: "selling",
	quantityLabel: "1 ticket",
	priceLabel: "£40",
	note: "",
	status: "active",
	effectiveStatus: "active",
	ownerUserId: "owner_1",
	ownerEmail: "owner@example.com",
	contactMethods: ["email"],
	expiresAt: "2026-06-02T15:00:00.000Z",
	createdAt: "2026-06-02T10:00:00.000Z",
	updatedAt: "2026-06-02T10:00:00.000Z",
	resolvedAt: null,
	interestCount: 0,
	isOwner: false,
	myInterest: null,
	interests: [],
	...overrides,
});

describe("ticket exchange listing visibility", () => {
	it("shows active listings publicly when they match the marketplace tab", () => {
		expect(
			isPublicTicketExchangeListingVisible(listing(), "selling", NOW_MS),
		).toBe(true);
		expect(
			isPublicTicketExchangeListingVisible(listing(), "looking", NOW_MS),
		).toBe(false);
	});

	it("shows recent resolved listings publicly as a short tombstone", () => {
		expect(
			isPublicTicketExchangeListingVisible(
				listing({
					status: "resolved",
					effectiveStatus: "resolved",
					resolvedAt: "2026-06-02T11:30:00.000Z",
					updatedAt: "2026-06-02T11:30:00.000Z",
				}),
				"all",
				NOW_MS,
			),
		).toBe(true);
	});

	it("hides stale resolved, removed, expired, and paused listings publicly", () => {
		expect(
			isPublicTicketExchangeListingVisible(
				listing({
					status: "resolved",
					effectiveStatus: "resolved",
					resolvedAt: "2026-06-02T10:30:00.000Z",
					updatedAt: "2026-06-02T10:30:00.000Z",
				}),
				"all",
				NOW_MS,
			),
		).toBe(false);
		expect(
			isPublicTicketExchangeListingVisible(
				listing({ status: "removed", effectiveStatus: "removed" }),
				"all",
				NOW_MS,
			),
		).toBe(false);
		expect(
			isPublicTicketExchangeListingVisible(
				listing({ effectiveStatus: "expired" }),
				"all",
				NOW_MS,
			),
		).toBe(false);
		expect(
			isPublicTicketExchangeListingVisible(
				listing({ status: "paused", effectiveStatus: "paused" }),
				"all",
				NOW_MS,
			),
		).toBe(false);
	});

	it("keeps owner and contacted listings in My activity", () => {
		expect(isMyTicketExchangeActivityVisible(listing({ isOwner: true }))).toBe(
			true,
		);
		expect(
			isMyTicketExchangeActivityVisible(
				listing({
					myInterest: {
						id: "interest_1",
						listingId: "listing_1",
						actorUserId: "user_1",
						actorEmail: "user@example.com",
						contactMethods: ["email"],
						contactSnapshot: {
							displayName: "",
							email: "user@example.com",
							whatsapp: "",
							instagram: "",
							x: "",
						},
						createdAt: "2026-06-02T11:00:00.000Z",
					},
				}),
			),
		).toBe(true);
		expect(isMyTicketExchangeActivityVisible(listing())).toBe(false);
	});
});
