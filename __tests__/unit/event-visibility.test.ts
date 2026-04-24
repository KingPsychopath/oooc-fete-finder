import { describe, expect, it } from "vitest";
import { getVisibleEventCount } from "@/features/events/event-visibility";

describe("getVisibleEventCount", () => {
	it("returns the full count when auth is unresolved", () => {
		expect(
			getVisibleEventCount(9, {
				isAuthenticated: false,
				isAuthResolved: false,
			}),
		).toBe(9);
	});

	it("returns the full count for authenticated users", () => {
		expect(
			getVisibleEventCount(9, {
				isAuthenticated: true,
				isAuthResolved: true,
			}),
		).toBe(9);
	});

	it("returns only the visible half for signed-out users", () => {
		expect(
			getVisibleEventCount(9, {
				isAuthenticated: false,
				isAuthResolved: true,
			}),
		).toBe(5);
	});
});
