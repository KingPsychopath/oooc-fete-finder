import type { Coordinates } from "@/features/events/types";

export interface SavedClientLocation {
	accuracy: number | null;
	coordinates: Coordinates;
	expiresAt: string;
	source: "current" | "last-known";
	savedAt: string;
}

export type ClientLocationResult =
	| {
			location: SavedClientLocation;
			status: "current" | "last-known";
	  }
	| {
			error: string;
			location: null;
			status: "unavailable";
	  };

const LAST_KNOWN_LOCATION_STORAGE_KEY = "oooc_last_known_location_v1";
const GEOLOCATION_TIMEOUT_MS = 6000;
const MAXIMUM_CACHED_LOCATION_AGE_MS = 10 * 60 * 1000;
const LAST_KNOWN_LOCATION_TTL_MS = 24 * 60 * 60 * 1000;
const COORDINATE_DECIMAL_PLACES = 4;
const PARIS_TEST_LOCATION: Pick<
	SavedClientLocation,
	"accuracy" | "coordinates"
> = {
	accuracy: 25,
	coordinates: { lat: 48.8566, lng: 2.3522 },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
	typeof value === "number" && Number.isFinite(value);

const roundCoordinate = (value: number) =>
	Number(value.toFixed(COORDINATE_DECIMAL_PLACES));

const normalizeSavedLocation = (value: unknown): SavedClientLocation | null => {
	if (!isRecord(value)) return null;
	if (!isRecord(value.coordinates)) return null;
	if (!isFiniteNumber(value.coordinates.lat)) return null;
	if (!isFiniteNumber(value.coordinates.lng)) return null;
	if (typeof value.savedAt !== "string") return null;
	if (Number.isNaN(new Date(value.savedAt).getTime())) return null;
	if (typeof value.expiresAt !== "string") return null;
	if (Number.isNaN(new Date(value.expiresAt).getTime())) return null;
	if (new Date(value.expiresAt).getTime() <= Date.now()) return null;
	if (
		value.accuracy !== null &&
		value.accuracy !== undefined &&
		!isFiniteNumber(value.accuracy)
	) {
		return null;
	}

	return {
		accuracy: isFiniteNumber(value.accuracy) ? value.accuracy : null,
		coordinates: {
			lat: roundCoordinate(value.coordinates.lat),
			lng: roundCoordinate(value.coordinates.lng),
		},
		expiresAt: value.expiresAt,
		source: value.source === "last-known" ? "last-known" : "current",
		savedAt: value.savedAt,
	};
};

export const readLastKnownClientLocation = (): SavedClientLocation | null => {
	if (typeof window === "undefined") return null;
	try {
		const parsed = JSON.parse(
			window.localStorage.getItem(LAST_KNOWN_LOCATION_STORAGE_KEY) ?? "null",
		);
		const location = normalizeSavedLocation(parsed);
		if (!location) {
			window.localStorage.removeItem(LAST_KNOWN_LOCATION_STORAGE_KEY);
		}
		return location ? { ...location, source: "last-known" } : null;
	} catch {
		return null;
	}
};

export const writeLastKnownClientLocation = (
	location: Pick<SavedClientLocation, "accuracy" | "coordinates">,
): SavedClientLocation | null => {
	if (typeof window === "undefined") return null;
	const savedLocation: SavedClientLocation = {
		accuracy: location.accuracy,
		coordinates: {
			lat: roundCoordinate(location.coordinates.lat),
			lng: roundCoordinate(location.coordinates.lng),
		},
		expiresAt: new Date(Date.now() + LAST_KNOWN_LOCATION_TTL_MS).toISOString(),
		source: "current",
		savedAt: new Date().toISOString(),
	};
	window.localStorage.setItem(
		LAST_KNOWN_LOCATION_STORAGE_KEY,
		JSON.stringify(savedLocation),
	);
	return savedLocation;
};

export const isClientLocationDevToolsEnabled = (): boolean =>
	process.env.NODE_ENV === "development";

export const getParisTestClientLocation = (): SavedClientLocation => ({
	accuracy: PARIS_TEST_LOCATION.accuracy,
	coordinates: {
		lat: roundCoordinate(PARIS_TEST_LOCATION.coordinates.lat),
		lng: roundCoordinate(PARIS_TEST_LOCATION.coordinates.lng),
	},
	expiresAt: new Date(Date.now() + LAST_KNOWN_LOCATION_TTL_MS).toISOString(),
	source: "current",
	savedAt: new Date().toISOString(),
});

const getCurrentClientLocation = (): Promise<SavedClientLocation> =>
	new Promise((resolve, reject) => {
		if (typeof navigator === "undefined" || !navigator.geolocation) {
			reject(new Error("Location is not available in this browser."));
			return;
		}

		navigator.geolocation.getCurrentPosition(
			(position) => {
				const savedLocation = writeLastKnownClientLocation({
					accuracy: position.coords.accuracy,
					coordinates: {
						lat: position.coords.latitude,
						lng: position.coords.longitude,
					},
				});
				if (!savedLocation) {
					reject(new Error("Unable to save current location."));
					return;
				}
				resolve(savedLocation);
			},
			(error) => {
				reject(new Error(error.message || "Unable to get current location."));
			},
			{
				enableHighAccuracy: false,
				maximumAge: MAXIMUM_CACHED_LOCATION_AGE_MS,
				timeout: GEOLOCATION_TIMEOUT_MS,
			},
		);
	});

export const requestClientLocation =
	async (): Promise<ClientLocationResult> => {
		try {
			return {
				location: await getCurrentClientLocation(),
				status: "current",
			};
		} catch (error) {
			const fallbackLocation = readLastKnownClientLocation();
			if (fallbackLocation) {
				return {
					location: fallbackLocation,
					status: "last-known",
				};
			}

			return {
				error: error instanceof Error ? error.message : "Location unavailable.",
				location: null,
				status: "unavailable",
			};
		}
	};
