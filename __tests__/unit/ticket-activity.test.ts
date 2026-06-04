import {
	CARD_TICKET_ACTIVITY_MAX_VISIBLE,
	formatTicketActivityLabel,
	getTicketActivityDisplayModes,
	isTicketActivityFresh,
	shouldShowTicketActivityBadge,
} from "@/features/events/ticket-activity";
import { describe, expect, it } from "vitest";

describe("ticket activity", () => {
	it("shows fresh ticket activity for active listings created in the freshness window", () => {
		const now = new Date("2026-06-20T18:00:00.000Z");
		const modes = getTicketActivityDisplayModes(
			[
				{
					eventKey: "fresh",
					name: "Fresh",
					ticketExchangeSellingCount: 1,
					ticketExchangeLatestListingAt: "2026-06-20T14:00:00.000Z",
				},
				{
					eventKey: "older",
					name: "Older",
					ticketExchangeLookingCount: 2,
					ticketExchangeLatestListingAt: "2026-06-20T08:00:00.000Z",
				},
				{
					eventKey: "empty",
					name: "Empty",
					ticketExchangeSellingCount: 0,
					ticketExchangeLookingCount: 0,
					ticketExchangeLatestListingAt: "2026-06-20T17:00:00.000Z",
				},
			],
			now,
		);

		expect(modes.get("fresh")).toBe("fresh");
		expect(modes.get("older")).toBe("active");
		expect(modes.has("empty")).toBe(false);
	});

	it("limits visible ticket activity to the most recent active events", () => {
		const modes = getTicketActivityDisplayModes(
			Array.from({ length: 12 }, (_, index) => ({
				eventKey: `event-${index}`,
				name: `Event ${index}`,
				ticketExchangeSellingCount: 1,
				ticketExchangeLatestListingAt: new Date(
					Date.UTC(2026, 5, 20, index),
				).toISOString(),
			})),
			new Date("2026-06-20T12:00:00.000Z"),
		);

		expect(modes.size).toBe(CARD_TICKET_ACTIVITY_MAX_VISIBLE);
		expect(modes.has("event-11")).toBe(true);
		expect(modes.has("event-3")).toBe(true);
		expect(modes.has("event-2")).toBe(false);
	});

	it("formats compact card labels by listing mix", () => {
		expect(formatTicketActivityLabel(1, 0)).toBe("Ticket available");
		expect(formatTicketActivityLabel(2, 0)).toBe("2 tickets available");
		expect(formatTicketActivityLabel(0, 1)).toBe("Someone wants tickets");
		expect(formatTicketActivityLabel(0, 3)).toBe("3 people want tickets");
		expect(formatTicketActivityLabel(2, 3)).toBe("2 selling · 3 wanted");
	});

	it("requires both a display mode and active ticket activity", () => {
		expect(shouldShowTicketActivityBadge("fresh", 1, 0)).toBe(true);
		expect(shouldShowTicketActivityBadge("active", 0, 1)).toBe(true);
		expect(shouldShowTicketActivityBadge(undefined, 1, 0)).toBe(false);
		expect(shouldShowTicketActivityBadge("fresh", 0, 0)).toBe(false);
	});

	it("treats invalid or missing listing timestamps as not fresh", () => {
		const now = new Date("2026-06-20T18:00:00.000Z");
		expect(isTicketActivityFresh(null, now)).toBe(false);
		expect(isTicketActivityFresh("nope", now)).toBe(false);
	});
});
