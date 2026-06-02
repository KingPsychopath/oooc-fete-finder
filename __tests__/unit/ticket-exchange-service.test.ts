import { findTicketExchangeEventByKey } from "@/features/ticket-exchange/service";
import type { Event } from "@/features/events/types";
import { describe, expect, it } from "vitest";

const event = {
	eventKey: "evt_f034651cf465d832",
	slug: "la-wine-up-block-party",
	name: "La Wine Up Block Party",
} as Event;

describe("findTicketExchangeEventByKey", () => {
	it("resolves events by stable event key only", () => {
		expect(
			findTicketExchangeEventByKey([event], "evt_f034651cf465d832"),
		).toBe(event);

		expect(findTicketExchangeEventByKey([event], "la-wine-up-block-party")).toBe(
			null,
		);
	});
});
