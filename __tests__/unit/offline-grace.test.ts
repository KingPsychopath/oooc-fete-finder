import {
	OFFLINE_GRACE_WINDOW_MS,
	createOfflineGraceState,
	isOfflineGraceActive,
	parseOfflineGraceState,
} from "@/features/auth/offline-grace";
import { describe, expect, it } from "vitest";

describe("offline grace helpers", () => {
	it("creates a normalized grace state with a 72-hour window", () => {
		const now = 1_700_000_000_000;
		const state = createOfflineGraceState("  OWEN@EXAMPLE.COM  ", now);

		expect(state).toEqual({
			email: "owen@example.com",
			expiresAt: now + OFFLINE_GRACE_WINDOW_MS,
		});
	});

	it("parses valid stored grace state and normalizes email", () => {
		const parsed = parseOfflineGraceState(
			JSON.stringify({
				email: "  OWEN@EXAMPLE.COM ",
				expiresAt: 1_700_000_000_000,
			}),
		);

		expect(parsed).toEqual({
			email: "owen@example.com",
			expiresAt: 1_700_000_000_000,
		});
	});

	it("rejects malformed or incomplete stored state", () => {
		expect(parseOfflineGraceState(null)).toBeNull();
		expect(parseOfflineGraceState("not-json")).toBeNull();
		expect(
			parseOfflineGraceState(JSON.stringify({ email: "", expiresAt: 123 })),
		).toBeNull();
		expect(
			parseOfflineGraceState(
				JSON.stringify({ email: "owen@example.com", expiresAt: "bad" }),
			),
		).toBeNull();
	});

	it("treats grace window as active only before the expiry instant", () => {
		const state = {
			email: "owen@example.com",
			expiresAt: 1_700_000_000_000,
		};

		expect(isOfflineGraceActive(state, 1_699_999_999_999)).toBe(true);
		expect(isOfflineGraceActive(state, 1_700_000_000_000)).toBe(false);
		expect(isOfflineGraceActive(state, 1_700_000_000_001)).toBe(false);
	});
});
