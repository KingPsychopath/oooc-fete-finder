import { validateEvent } from "@/features/data-management/validation/event-validation";
import { performEventQualityChecks } from "@/features/data-management/validation/quality-checks";
import type { Event } from "@/features/events/types";
import { describe, expect, it } from "vitest";

const baseEvent = {
	eventKey: "evt_quality_test",
	slug: "quality-test",
	id: "evt_quality_test",
	name: "Quality Test",
	day: "friday",
	date: "2026-06-19",
	time: "20:00",
	arrondissement: 10,
	location: "Test Venue",
	link: "https://example.com",
	type: "Pre-Fete",
	genre: ["house"],
	venueTypes: ["indoor"],
	indoor: true,
} satisfies Event;

describe("performEventQualityChecks", () => {
	it("does not treat missing notes/description as a data-quality issue", () => {
		const result = performEventQualityChecks([baseEvent]);

		expect(result.qualityScore).toBe(100);
		expect(result.issues).toEqual([]);
		expect(result.issueCounts).toEqual({
			missingLocation: 0,
			missingTime: 0,
			genericName: 0,
		});
	});

	it("does not warn when only notes/description are absent", () => {
		const result = validateEvent(baseEvent);

		expect(result.warnings).toEqual([]);
	});
});
