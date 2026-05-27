import {
	getParisTestClientLocation,
	readLastKnownClientLocation,
	requestClientLocation,
	writeLastKnownClientLocation,
} from "@/features/locations/client-location";
import { afterEach, describe, expect, it, vi } from "vitest";

const storage = new Map<string, string>();

const installBrowserStorage = () => {
	vi.stubGlobal("window", {
		localStorage: {
			getItem: (key: string) => storage.get(key) ?? null,
			removeItem: (key: string) => {
				storage.delete(key);
			},
			setItem: (key: string, value: string) => {
				storage.set(key, value);
			},
		},
	});
};

describe("client location storage", () => {
	afterEach(() => {
		storage.clear();
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	it("stores a rounded, expiring browser-only last known location", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-05-09T12:00:00.000Z"));
		installBrowserStorage();

		const saved = writeLastKnownClientLocation({
			accuracy: 12.4,
			coordinates: { lat: 48.856614, lng: 2.352222 },
		});

		expect(saved).toMatchObject({
			accuracy: 12.4,
			coordinates: { lat: 48.8566, lng: 2.3522 },
			source: "current",
			savedAt: "2026-05-09T12:00:00.000Z",
			expiresAt: "2026-05-10T12:00:00.000Z",
		});
		expect(readLastKnownClientLocation()).toMatchObject({
			coordinates: { lat: 48.8566, lng: 2.3522 },
			source: "last-known",
		});
	});

	it("drops expired stored locations", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-05-09T12:00:00.000Z"));
		installBrowserStorage();
		writeLastKnownClientLocation({
			accuracy: null,
			coordinates: { lat: 48.8566, lng: 2.3522 },
		});

		vi.setSystemTime(new Date("2026-05-10T12:00:01.000Z"));

		expect(readLastKnownClientLocation()).toBeNull();
	});

	it("falls back to last known location when current geolocation fails", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-05-09T12:00:00.000Z"));
		installBrowserStorage();
		writeLastKnownClientLocation({
			accuracy: 24,
			coordinates: { lat: 48.8566, lng: 2.3522 },
		});
		vi.stubGlobal("navigator", {
			geolocation: {
				getCurrentPosition: (
					_success: PositionCallback,
					error: PositionErrorCallback,
				) => {
					error({ message: "denied" } as GeolocationPositionError);
				},
			},
		});

		await expect(requestClientLocation()).resolves.toMatchObject({
			location: {
				coordinates: { lat: 48.8566, lng: 2.3522 },
				source: "last-known",
			},
			status: "last-known",
		});
	});

	it("creates a stable Paris test location for development QA", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-05-09T12:00:00.000Z"));

		expect(getParisTestClientLocation()).toMatchObject({
			accuracy: 25,
			coordinates: { lat: 48.8566, lng: 2.3522 },
			source: "current",
			savedAt: "2026-05-09T12:00:00.000Z",
			expiresAt: "2026-05-10T12:00:00.000Z",
		});
	});
});
