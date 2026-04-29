import {
	buildGenreFrequency,
	getGenrePreview,
} from "@/features/events/genre-preview";
import { type Event, getEventTypeForDate } from "@/features/events/types";
import { describe, expect, it } from "vitest";

const makeEvent = (genre: Event["genre"], suffix: string): Event => ({
	eventKey: `evt_preview_${suffix}`,
	slug: `preview-event-${suffix}`,
	id: `evt_preview_${suffix}`,
	name: `Preview Event ${suffix}`,
	day: "friday",
	date: "2026-06-21",
	arrondissement: 11,
	link: "https://example.com",
	type: getEventTypeForDate("2026-06-21"),
	genre,
	venueTypes: ["indoor"],
	indoor: true,
	verified: true,
});

describe("genre preview", () => {
	it("prioritizes less common genres for event cards", () => {
		const frequency = buildGenreFrequency([
			makeEvent(["afrobeats", "amapiano", "dancehall", "soca"], "one"),
			makeEvent(["afrobeats", "amapiano"], "two"),
			makeEvent(["afrobeats", "amapiano"], "three"),
		]);

		expect(
			getGenrePreview(
				["afrobeats", "amapiano", "dancehall", "soca"],
				frequency,
			),
		).toEqual({
			visibleGenres: ["dancehall", "soca", "afrobeats"],
			hiddenGenreCount: 1,
		});
	});

	it("adapts when a different genre becomes common", () => {
		const frequency = buildGenreFrequency([
			makeEvent(["dancehall", "soca", "kompa"], "one"),
			makeEvent(["dancehall", "soca"], "two"),
			makeEvent(["dancehall", "soca"], "three"),
		]);

		expect(getGenrePreview(["dancehall", "soca", "kompa"], frequency)).toEqual({
			visibleGenres: ["kompa", "dancehall", "soca"],
			hiddenGenreCount: 0,
		});
	});

	it("keeps the original order when there is no frequency signal", () => {
		expect(getGenrePreview(["afrobeats", "amapiano", "soca"], {})).toEqual({
			visibleGenres: ["afrobeats", "amapiano", "soca"],
			hiddenGenreCount: 0,
		});
	});
});
