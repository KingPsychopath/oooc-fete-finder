import {
	buildLocationSearchQuery,
	buildMapLink,
} from "@/features/locations/map-link-builder";
import type { LocationResolution } from "@/features/locations/types";
import type { ParisArrondissement } from "@/features/events/types";
import type { MapProvider } from "../types";

/**
 * Parses location input to determine if it's a URL or plain text
 */
const parseLocationInput = (
	input: string,
): { isUrl: boolean; value: string } => {
	if (!input || input === "TBA") {
		return { isUrl: false, value: input };
	}

	const trimmedInput = input.trim();
	const urlPatterns = [/^https?:\/\//i, /^maps:\/\//i, /^geo:/i, /^www\./i];

	const hasUrlPattern = urlPatterns.some((pattern) =>
		pattern.test(trimmedInput),
	);

	if (hasUrlPattern) {
		try {
			const urlToTest = trimmedInput.startsWith("www.")
				? `https://${trimmedInput}`
				: trimmedInput;
			new URL(urlToTest);
			return { isUrl: true, value: urlToTest };
		} catch {
			return { isUrl: false, value: trimmedInput };
		}
	}

	if (
		trimmedInput.includes("google.com/maps") ||
		trimmedInput.includes("maps.google.com")
	) {
		try {
			const urlToTest = trimmedInput.startsWith("http")
				? trimmedInput
				: `https://${trimmedInput}`;
			new URL(urlToTest);
			return { isUrl: true, value: urlToTest };
		} catch {
			return { isUrl: false, value: trimmedInput };
		}
	}

	return { isUrl: false, value: trimmedInput };
};

/**
 * Opens location in Google Maps
 */
const openInGoogleMaps = (
	locationInput: string,
	arrondissement?: ParisArrondissement,
	resolution?: LocationResolution | null,
): void => {
	const isAndroid = /Android/.test(navigator.userAgent);
	const provider = isAndroid ? "geo" : "google";
	const url = buildMapLink({
		locationInput,
		arrondissement,
		resolution,
		provider,
	});

	if (isAndroid) {
		// Try native Google Maps app first on Android
		try {
			window.open(url, "_blank", "noopener,noreferrer");
		} catch {
			// Fallback to web version
			window.open(
				buildMapLink({
					locationInput,
					arrondissement,
					resolution,
					provider: "google",
				}),
				"_blank",
				"noopener,noreferrer",
			);
		}
	} else {
		// Use web version for all other platforms
		window.open(url, "_blank", "noopener,noreferrer");
	}
};

/**
 * Opens location in Apple Maps (iOS/Mac only)
 */
const openInAppleMaps = (
	locationInput: string,
	arrondissement?: ParisArrondissement,
	resolution?: LocationResolution | null,
): Promise<boolean> => {
	const appleMapsUrl = buildMapLink({
		locationInput,
		arrondissement,
		resolution,
		provider: "apple",
	});
	return new Promise((resolve) => {
		let appleMapsOpened = false;

		const handleVisibilityChange = () => {
			if (document.hidden) {
				appleMapsOpened = true;
			}
		};

		const handleBlur = () => {
			appleMapsOpened = true;
		};

		document.addEventListener("visibilitychange", handleVisibilityChange);
		window.addEventListener("blur", handleBlur);

		try {
			window.location.href = appleMapsUrl;
		} catch {
			const link = document.createElement("a");
			link.href = appleMapsUrl;
			link.style.display = "none";
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		}

		setTimeout(() => {
			document.removeEventListener("visibilitychange", handleVisibilityChange);
			window.removeEventListener("blur", handleBlur);
			resolve(appleMapsOpened);
		}, 2000);
	});
};

/**
 * Opens location using system default (platform-based detection)
 */
const openWithSystemDefault = async (
	locationInput: string,
	arrondissement?: ParisArrondissement,
	resolution?: LocationResolution | null,
): Promise<void> => {
	const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
	const isMac = /Macintosh|Mac OS X/.test(navigator.userAgent);

	if (isIOS || isMac) {
		const appleMapsOpened = await openInAppleMaps(
			locationInput,
			arrondissement,
			resolution,
		);
		if (!appleMapsOpened) {
			openInGoogleMaps(locationInput, arrondissement, resolution);
		}
	} else {
		openInGoogleMaps(locationInput, arrondissement, resolution);
	}
};

/**
 * Opens location in maps based on user preference
 * YES - This includes ordinal formatting and arrondissement enhancement
 *
 * @param locationInput - The location string (venue name, address, or URL)
 * @param arrondissement - Optional arrondissement to enhance search accuracy
 * @param preference - User's preferred map provider
 * @param onAskForPreference - Callback to handle "ask" preference
 */
export const openLocationInMaps = async (
	locationInput: string,
	arrondissement?: ParisArrondissement,
	preference: MapProvider = "system",
	onAskForPreference?: () => Promise<MapProvider>,
	resolution?: LocationResolution | null,
): Promise<void> => {
	const { isUrl, value } = parseLocationInput(locationInput);

	if (!value || value === "TBA") return;

	// If it's already a URL, open it directly
	if (isUrl) {
		window.open(value, "_blank", "noopener,noreferrer");
		return;
	}

	const searchQuery = buildLocationSearchQuery(value, arrondissement);

	// Handle preference
	let actualPreference = preference;
	if (preference === "ask" && onAskForPreference) {
		actualPreference = await onAskForPreference();
	}

	// Open based on preference
	switch (actualPreference) {
		case "google":
			openInGoogleMaps(searchQuery, undefined, resolution);
			break;
		case "apple":
			const success = await openInAppleMaps(searchQuery, undefined, resolution);
			if (!success) {
				// Apple Maps failed, fallback to Google Maps
				openInGoogleMaps(searchQuery, undefined, resolution);
			}
			break;
		case "system":
		default:
			await openWithSystemDefault(searchQuery, undefined, resolution);
			break;
	}
};
