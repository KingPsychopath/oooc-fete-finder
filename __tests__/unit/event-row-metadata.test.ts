import { buildMeaningfulEventRowHash } from "@/lib/platform/postgres/event-sheet-store-repository";
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
});
