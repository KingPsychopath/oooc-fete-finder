import {
	buildMeaningfulEventRowHash,
	isCompatibleMeaningfulEventRowHash,
} from "@/lib/platform/postgres/event-sheet-store-repository";
import { describe, expect, it } from "vitest";

describe("event row metadata", () => {
	it("ignores whitespace-only edits in meaningful public fields", () => {
		const base = buildMeaningfulEventRowHash({
			eventKey: "evt_1",
			title: "  Fete Party  ",
			price: "€20",
			notes: "Final release",
		});
		const normalized = buildMeaningfulEventRowHash({
			eventKey: "evt_1",
			title: "Fete   Party",
			price: "€20",
			notes: "Final release",
		});

		expect(normalized).toBe(base);
	});

	it("changes when public event details change", () => {
		const base = buildMeaningfulEventRowHash({
			eventKey: "evt_1",
			title: "Fete Party",
			price: "€20",
			notes: "Final release",
		});
		const updated = buildMeaningfulEventRowHash({
			eventKey: "evt_1",
			title: "Fete Party",
			price: "€25",
			notes: "Final release",
		});

		expect(updated).not.toBe(base);
	});

	it("does not treat event key changes as public content edits", () => {
		const base = buildMeaningfulEventRowHash({
			eventKey: "evt_1",
			title: "Fete Party",
			price: "€20",
		});
		const updated = buildMeaningfulEventRowHash({
			eventKey: "evt_2",
			title: "Fete Party",
			price: "€20",
		});

		expect(updated).toBe(base);
	});

	it("does not treat series key changes as public content edits", () => {
		const base = buildMeaningfulEventRowHash({
			eventKey: "evt_1",
			seriesKey: "ser_first",
			title: "Fete Party",
			price: "€20",
		});
		const updated = buildMeaningfulEventRowHash({
			eventKey: "evt_1",
			seriesKey: "ser_second",
			title: "Fete Party",
			price: "€20",
		});

		expect(updated).toBe(base);
	});

	it("does not treat classification-only edits as public event detail updates", () => {
		const base = buildMeaningfulEventRowHash({
			eventKey: "evt_1",
			title: "Fete Party",
			price: "€20",
			eventCategory: "Party",
			tags: "afrobeats",
			curated: "",
			sourceConfirmed: "",
			detailsQualityOverride: "",
		});
		const updated = buildMeaningfulEventRowHash({
			eventKey: "evt_1",
			title: "Fete Party",
			price: "€20",
			eventCategory: "Culture",
			tags: "afrobeats, amapiano",
			curated: "🌟",
			sourceConfirmed: "yes",
			detailsQualityOverride: "complete",
		});

		expect(updated).toBe(base);
	});

	it("accepts old public-content hash versions as compatible", () => {
		expect(
			isCompatibleMeaningfulEventRowHash("3eaf96f3b347c3d3", {
				eventKey: "evt_1",
				seriesKey: "ser_first",
				eventCategory: "Party",
				title: "Fete Party",
				price: "€20",
			}),
		).toBe(false);

		const hashFromVersionThatIncludedSeriesKey = "e10f30c0d7f1a9a6";
		expect(
			isCompatibleMeaningfulEventRowHash(hashFromVersionThatIncludedSeriesKey, {
				eventKey: "evt_1",
				seriesKey: "ser_first",
				eventCategory: "Party",
				title: "Fete Party",
				price: "€20",
			}),
		).toBe(true);

		const hashFromVersionBeforeDateToWasTracked = "957c4b3da1c85d26";
		expect(
			isCompatibleMeaningfulEventRowHash(hashFromVersionBeforeDateToWasTracked, {
				eventKey: "evt_1",
				eventCategory: "Party",
				title: "Fete Party",
				price: "€20",
				dateTo: "2026-06-22",
			}),
		).toBe(true);
	});

	it("detects unchanged public content with the current hash", () => {
		const before = buildMeaningfulEventRowHash({
			eventKey: "evt_1",
			title: "Fete Party",
			location: "Venue A",
			seriesKey: "",
		});
		const after = buildMeaningfulEventRowHash({
			eventKey: "evt_1",
			title: "Fete Party",
			location: "Venue A",
			seriesKey: "ser_new",
		});

		expect(after).toBe(before);
	});
});
