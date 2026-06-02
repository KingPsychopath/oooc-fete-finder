import { buildTicketExchangeEventPath } from "@/features/ticket-exchange/urls";
import { describe, expect, it } from "vitest";

describe("buildTicketExchangeEventPath", () => {
	it("uses the stable event key instead of the display slug", () => {
		const path = buildTicketExchangeEventPath({
			eventKey: "evt_f034651cf465d832",
		});

		expect(path).toBe("/tickets/evt_f034651cf465d832");
		expect(path).not.toContain("la-wine-up-block-party");
	});
});
