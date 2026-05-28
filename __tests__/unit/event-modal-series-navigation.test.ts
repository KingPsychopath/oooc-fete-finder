import {
	getSeriesKeyboardNavigationTarget,
	isEventModalTextEntryKeyTarget,
} from "@/features/events/components/event-modal-series-navigation";
import type { Event } from "@/features/events/types";
import { describe, expect, it } from "vitest";

const eventStub = (eventKey: string, date: string, seriesKey = "ser_weekend") =>
	({
		eventKey,
		id: eventKey,
		slug: eventKey,
		name: eventKey,
		date,
		day: "friday",
		seriesKey,
		arrondissement: 1,
		link: "#",
		type: "party",
		genre: [],
		venueTypes: [],
		indoor: true,
	}) as unknown as Event;

describe("event modal series navigation", () => {
	it("maps left and right arrow keys to adjacent series dates", () => {
		const previous = eventStub("evt_previous", "2026-06-19");
		const current = eventStub("evt_current", "2026-06-20");
		const next = eventStub("evt_next", "2026-06-21");
		const unrelated = eventStub("evt_unrelated", "2026-06-20", "ser_other");
		const seriesEvents = [next, unrelated, current, previous];

		expect(
			getSeriesKeyboardNavigationTarget({
				currentEvent: current,
				seriesEvents,
				key: "ArrowLeft",
			}),
		).toBe(previous);
		expect(
			getSeriesKeyboardNavigationTarget({
				currentEvent: current,
				seriesEvents,
				key: "ArrowRight",
			}),
		).toBe(next);
	});

	it("does not add up/down navigation or wrap beyond the series bounds", () => {
		const first = eventStub("evt_first", "2026-06-19");
		const second = eventStub("evt_second", "2026-06-20");
		const seriesEvents = [first, second];

		expect(
			getSeriesKeyboardNavigationTarget({
				currentEvent: first,
				seriesEvents,
				key: "ArrowUp",
			}),
		).toBeUndefined();
		expect(
			getSeriesKeyboardNavigationTarget({
				currentEvent: first,
				seriesEvents,
				key: "ArrowLeft",
			}),
		).toBeUndefined();
		expect(
			getSeriesKeyboardNavigationTarget({
				currentEvent: second,
				seriesEvents,
				key: "ArrowRight",
			}),
		).toBeUndefined();
	});

	it("treats text entry controls as reserved keyboard targets", () => {
		expect(isEventModalTextEntryKeyTarget({ tagName: "INPUT" })).toBe(true);
		expect(isEventModalTextEntryKeyTarget({ tagName: "textarea" })).toBe(true);
		expect(isEventModalTextEntryKeyTarget({ tagName: "select" })).toBe(true);
		expect(isEventModalTextEntryKeyTarget({ isContentEditable: true })).toBe(
			true,
		);
		expect(
			isEventModalTextEntryKeyTarget({
				getAttribute: (name) => (name === "role" ? "textbox" : null),
			}),
		).toBe(true);
		expect(isEventModalTextEntryKeyTarget({ tagName: "BUTTON" })).toBe(false);
	});
});
