import {
	formatTourSignal,
	getTourProgressLabel,
	parseTourInteraction,
	serializeTourInteraction,
} from "@/features/events/engagement/tour-analytics";
import { describe, expect, it } from "vitest";

describe("tour analytics", () => {
	it("keeps empty step slots so source-only actions parse correctly", () => {
		const encoded = serializeTourInteraction({
			action: "prompt_dismissed",
			source: "skip_button",
		});

		expect(encoded).toBe("prompt_dismissed::skip_button");
		expect(parseTourInteraction(encoded)).toEqual({
			action: "prompt_dismissed",
			stepId: null,
			source: "skip_button",
		});
	});

	it("parses source-only records without treating the source as a step", () => {
		expect(parseTourInteraction("auth_required:manual")).toEqual({
			action: "auth_required",
			stepId: null,
			source: "manual",
		});
		expect(parseTourInteraction("prompt_shown:auto")).toEqual({
			action: "prompt_shown",
			stepId: null,
			source: "auto",
		});
	});

	it("distinguishes prompt dismissal from tour skip labels", () => {
		expect(
			getTourProgressLabel([
				{ action: "prompt_dismissed", stepId: null, source: "skip_button" },
			]),
		).toBe("Tour prompt dismissed (skip button)");

		expect(
			getTourProgressLabel([
				{ action: "skip", stepId: "picks", source: "close_button" },
			]),
		).toBe("Tour skipped (Curated picks, step 1 of 5) via close button");
	});

	it("formats aggregate tour signals for the admin dashboard", () => {
		expect(formatTourSignal("prompt_dismissed::skip_button")).toEqual({
			label: "Prompt dismissed",
			meta: "skip button",
		});
		expect(formatTourSignal("prompt_dismissed::backdrop")).toEqual({
			label: "Prompt dismissed",
			meta: "backdrop",
		});
		expect(formatTourSignal("skip:picks:close_button")).toEqual({
			label: "Skipped at Curated picks",
			meta: "via close button",
		});
	});
});
