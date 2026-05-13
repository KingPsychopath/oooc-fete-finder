import {
	DEFAULT_LOCAL_APP_SETTINGS,
	normalizeLocalAppSettings,
} from "@/lib/user-app-settings";
import { describe, expect, it } from "vitest";

describe("normalizeLocalAppSettings", () => {
	it("defaults map loading to idle preload", () => {
		expect(normalizeLocalAppSettings({}).mapLoadStrategy).toBe("idle");
		expect(DEFAULT_LOCAL_APP_SETTINGS.mapLoadStrategy).toBe("idle");
	});

	it("accepts saved map loading strategies", () => {
		expect(
			normalizeLocalAppSettings({ mapLoadStrategy: "expand" }).mapLoadStrategy,
		).toBe("expand");
		expect(
			normalizeLocalAppSettings({ mapLoadStrategy: "idle" }).mapLoadStrategy,
		).toBe("idle");
	});

	it("rejects unsupported map loading values", () => {
		expect(
			normalizeLocalAppSettings({
				mapLoadStrategy: "immediate",
			} as unknown as Parameters<typeof normalizeLocalAppSettings>[0])
				.mapLoadStrategy,
		).toBe("idle");
	});
});
