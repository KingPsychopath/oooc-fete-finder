import { resolveArchivePublishedPlanAlias } from "@/features/plans/archive-published-plan-store";
import {
	getRuntimeDataMode,
	isArchiveModeEnabled,
	isFirstPartyAnalyticsEnabled,
	parseBooleanFlag,
} from "@/lib/archive-mode";
import { getArchiveLocationPayload } from "@/lib/archive-static-data";
import { afterEach, describe, expect, it } from "vitest";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
	process.env = { ...ORIGINAL_ENV };
});

describe("archive mode flags", () => {
	it("parses common boolean environment values", () => {
		expect(parseBooleanFlag("true")).toBe(true);
		expect(parseBooleanFlag("1")).toBe(true);
		expect(parseBooleanFlag("yes")).toBe(true);
		expect(parseBooleanFlag("false")).toBe(false);
		expect(parseBooleanFlag("0")).toBe(false);
		expect(parseBooleanFlag(undefined)).toBe(false);
	});

	it("enables archive mode from server or public flags", () => {
		process.env.ARCHIVE_MODE = "false";
		process.env.NEXT_PUBLIC_ARCHIVE_MODE = "true";
		expect(isArchiveModeEnabled()).toBe(true);
	});

	it("forces local data reads while preserving test mode", () => {
		process.env.ARCHIVE_MODE = "true";
		expect(getRuntimeDataMode("remote")).toBe("local");
		expect(getRuntimeDataMode("local")).toBe("local");
		expect(getRuntimeDataMode("test")).toBe("test");
	});

	it("disables first-party analytics in archive mode or explicit opt-out", () => {
		process.env.ARCHIVE_MODE = "true";
		expect(isFirstPartyAnalyticsEnabled()).toBe(false);

		process.env.ARCHIVE_MODE = "false";
		process.env.NEXT_PUBLIC_ARCHIVE_MODE = "false";
		process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = "false";
		expect(isFirstPartyAnalyticsEnabled()).toBe(false);
	});

	it("bundles static locations and the official published route", () => {
		const locations = getArchiveLocationPayload();
		expect(Object.keys(locations.locations).length).toBeGreaterThan(0);

		const resolution = resolveArchivePublishedPlanAlias("fete");
		expect(resolution.kind).toBe("published");
		if (resolution.kind === "published") {
			expect(resolution.value.version.stops.length).toBeGreaterThan(0);
		}
	});
});
