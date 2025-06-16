import type { MapProvider } from "../types/map-preferences";

/**
 * Gets ordinal suffix for numbers (1st, 2nd, 3rd, etc.)
 */
const getOrdinal = (num: number): string => {
	const lastDigit = num % 10;
	const lastTwoDigits = num % 100;

	if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
		return `${num}th`;
	}

	switch (lastDigit) {
		case 1:
			return `${num}st`;
		case 2:
			return `${num}nd`;
		case 3:
			return `${num}rd`;
		default:
			return `${num}th`;
	}
};

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
const openInGoogleMaps = (searchQuery: string): void => {
	const query = encodeURIComponent(searchQuery);
	const isAndroid = /Android/.test(navigator.userAgent);

	if (isAndroid) {
		// Try native Google Maps app first on Android
		try {
			window.open(`geo:0,0?q=${query}`, "_blank", "noopener,noreferrer");
		} catch {
			// Fallback to web version
			window.open(
				`https://www.google.com/maps/search/?api=1&query=${query}`,
				"_blank",
				"noopener,noreferrer",
			);
		}
	} else {
		// Use web version for all other platforms
		window.open(
			`https://www.google.com/maps/search/?api=1&query=${query}`,
			"_blank",
			"noopener,noreferrer",
		);
	}
};

/**
 * Opens location in Apple Maps (iOS/Mac only)
 */
const openInAppleMaps = (searchQuery: string): Promise<boolean> => {
	const query = encodeURIComponent(searchQuery);
	const appleMapsUrl = `maps://?q=${query}`;

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
const openWithSystemDefault = async (searchQuery: string): Promise<void> => {
	const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
	const isMac = /Macintosh|Mac OS X/.test(navigator.userAgent);

	if (isIOS || isMac) {
		const appleMapsOpened = await openInAppleMaps(searchQuery);
		if (!appleMapsOpened) {
			openInGoogleMaps(searchQuery);
		}
	} else {
		openInGoogleMaps(searchQuery);
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
	arrondissement?: number | "unknown",
	preference: MapProvider = "system",
	onAskForPreference?: () => Promise<MapProvider>,
): Promise<void> => {
	const { isUrl, value } = parseLocationInput(locationInput);

	if (!value || value === "TBA") return;

	// If it's already a URL, open it directly
	if (isUrl) {
		window.open(value, "_blank", "noopener,noreferrer");
		return;
	}

	// Build search query with arrondissement context for better accuracy
	let searchQuery = value;
	if (
		arrondissement &&
		arrondissement !== "unknown" &&
		typeof arrondissement === "number"
	) {
		const ordinalArrondissement = getOrdinal(arrondissement);
		searchQuery = `${value} ${ordinalArrondissement} arrondissement`;
	}

	// Handle preference
	let actualPreference = preference;
	if (preference === "ask" && onAskForPreference) {
		actualPreference = await onAskForPreference();
	}

	// Open based on preference
	switch (actualPreference) {
		case "google":
			openInGoogleMaps(searchQuery);
			break;
		case "apple":
			const success = await openInAppleMaps(searchQuery);
			if (!success) {
				// Apple Maps failed, fallback to Google Maps
				openInGoogleMaps(searchQuery);
			}
			break;
		case "system":
		default:
			await openWithSystemDefault(searchQuery);
			break;
	}
};
