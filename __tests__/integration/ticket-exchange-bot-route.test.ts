import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockedGetRecentListingsForBot = vi.fn();

const loadRoute = async () => {
	vi.resetModules();

	vi.doMock("@/features/ticket-exchange/bot-auth", () => ({
		isAuthorizedTicketExchangeBotRequest: () => true,
		parseTicketExchangeBotLimit: () => 10,
	}));

	vi.doMock("@/features/ticket-exchange/repository", () => ({
		getTicketExchangeRepository: () => ({
			getRecentListingsForBot: mockedGetRecentListingsForBot,
		}),
	}));
	vi.doMock("@/features/ticket-exchange/service", () => ({
		findTicketExchangeEventByKey: (
			events: Array<{ eventKey: string }>,
			eventKey: string,
		) => events.find((event) => event.eventKey === eventKey) ?? null,
		getTicketExchangeEvents: () =>
			Promise.resolve([
				{
					eventKey: "evt_f034651cf465d832",
					day: "sunday",
					date: "2026-06-21",
					time: "18:00",
				},
			]),
	}));

	return import("@/app/api/ticket-exchange/bot/recent-listings/route");
};

describe("/api/ticket-exchange/bot/recent-listings", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns stable event-key ticket URLs for bot announcements", async () => {
		mockedGetRecentListingsForBot.mockResolvedValue([
			{
				id: "listing_1",
				eventKey: "evt_f034651cf465d832",
				eventSlug: "la-wine-up-block-party",
				eventName: "La Wine Up Block Party",
				listingType: "selling",
				quantityLabel: "2",
				priceLabel: "Free",
				note: "",
				expiresAt: "2026-06-21T23:00:00.000Z",
				createdAt: "2026-06-02T01:00:00.000Z",
			},
		]);

		const { GET } = await loadRoute();
		const response = await GET(
			new NextRequest(
				"https://fete.outofofficecollective.co.uk/api/ticket-exchange/bot/recent-listings",
			),
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.listings[0].url).toBe("/tickets/evt_f034651cf465d832");
		expect(body.listings[0].url).not.toContain("la-wine-up-block-party");
		expect(body.listings[0].eventDateLabel).toBe("Sunday 21st · 18:00");
	});
});
