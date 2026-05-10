import {
	applyPendingSavedEventMutations,
	getSavedEventsOwnerKey,
} from "@/features/events/components/saved-events-provider";
import { describe, expect, it } from "vitest";

describe("saved events provider helpers", () => {
	it("keeps authenticated offline-grace users on their account storage key", () => {
		expect(getSavedEventsOwnerKey("USER@Example.com", true)).toBe(
			"user:user@example.com",
		);
		expect(getSavedEventsOwnerKey("user@example.com", false)).toBe("anon");
		expect(getSavedEventsOwnerKey(null, true)).toBe("anon");
		expect(getSavedEventsOwnerKey(" ", true)).toBe("anon");
	});

	it("overlays pending saved-event mutations on loaded local or remote keys", () => {
		const eventKeys = applyPendingSavedEventMutations(["evt_1", "evt_2"], [
			{
				payload: {
					eventKey: "EVT_2",
					isSaved: false,
				},
			},
			{
				payload: {
					eventKey: "EVT_3",
					isSaved: true,
				},
			},
		]);

		expect(Array.from(eventKeys).sort()).toEqual(["evt_1", "evt_3"]);
	});
});
