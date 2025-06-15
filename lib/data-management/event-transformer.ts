/**
 * Event Data Transformer
 * 
 * Handles all business logic for converting CSV data to Event objects.
 * Contains domain-specific mappings, validation, and transformation logic.
 */

import type {
	Event,
	EventDay,
	MusicGenre,
	EventType,
	ParisArrondissement,
	Nationality,
	VenueType,
} from "@/types/events";
import type { CSVEventRow } from "@/utils/csv-parser";

// Warning collection system for date format issues
export type DateFormatWarning = {
	originalValue: string;
	eventName?: string;
	columnType: "featured" | "date" | "startTime" | "endTime";
	warningType: "ambiguous" | "future_featured" | "invalid" | "unparseable";
	potentialFormats: {
		us: { date: string; description: string };
		uk: { date: string; description: string };
		iso: string;
	};
	detectedFormat: string;
	recommendedAction: string;
	rowIndex: number;
};

// Global warnings collector
let dateFormatWarnings: DateFormatWarning[] = [];

// Functions to manage warnings
export const clearDateFormatWarnings = (): void => {
	dateFormatWarnings = [];
};

export const getDateFormatWarnings = (): DateFormatWarning[] => {
	return [...dateFormatWarnings];
};

const addDateFormatWarning = (warning: DateFormatWarning): void => {
	dateFormatWarnings.push(warning);
};

/**
 * Convert date string to EventDay using actual date calculation
 */
const convertToEventDay = (dateStr: string): EventDay => {
	if (!dateStr) return "tbc";

	const lowerDate = dateStr.toLowerCase().trim();

	// Handle explicit day names first
	const explicitDayMapping = {
		monday: "monday" as const,
		tuesday: "tuesday" as const,
		wednesday: "wednesday" as const,
		thursday: "thursday" as const,
		friday: "friday" as const,
		saturday: "saturday" as const,
		sunday: "sunday" as const,
		mon: "monday" as const,
		tue: "tuesday" as const,
		wed: "wednesday" as const,
		thu: "thursday" as const,
		fri: "friday" as const,
		sat: "saturday" as const,
		sun: "sunday" as const,
	};

	// Check for explicit day names in the string
	for (const [key, value] of Object.entries(explicitDayMapping)) {
		if (lowerDate.includes(key)) {
			return value;
		}
	}

	// Extract date numbers and calculate actual day of week
	const dateMatch = dateStr.match(
		/(\d{1,2})\s*june|june\s*(\d{1,2})|(\d{1,2})\/06|(\d{1,2})-06/i,
	);
	if (dateMatch) {
		// Get the day number from whichever capture group matched
		const dayNumber = parseInt(
			dateMatch[1] || dateMatch[2] || dateMatch[3] || dateMatch[4],
		);

		if (dayNumber >= 1 && dayNumber <= 31) {
			// Create a Date object for the date (assuming 2025 based on the event context)
			const eventDate = new Date(2025, 5, dayNumber); // Month is 0-indexed, so 5 = June
			const dayOfWeek = eventDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

			// Map JavaScript day of week to our EventDay type
			const dayMapping = {
				0: "sunday" as const, // Sunday
				1: "monday" as const, // Monday
				2: "tuesday" as const, // Tuesday
				3: "wednesday" as const, // Wednesday
				4: "thursday" as const, // Thursday
				5: "friday" as const, // Friday
				6: "saturday" as const, // Saturday
			};

			return dayMapping[dayOfWeek as keyof typeof dayMapping];
		}
	}

	return "tbc";
};

/**
 * Convert host country flag/text to Nationality type array
 *
 * To add a new country:
 * 1. Add the country code to the Nationality type in types/events.ts (e.g., "US" | "DE")
 * 2. Add the country to the NATIONALITIES constant in types/events.ts with flag and shortCode
 * 3. Add the country mapping here with all possible indicators (flag, code, name variations)
 *
 * Example for adding USA:
 * ```
 * US: {
 *   indicators: ["🇺🇸", "us", "usa", "united states", "america", "american"],
 *   key: "US" as const,
 * },
 * ```
 */
const convertToNationality = (
	nationalityStr: string,
): Nationality[] | undefined => {
	if (!nationalityStr) return undefined;

	const cleaned = nationalityStr.trim().toLowerCase();
	const nationalities: Nationality[] = [];

	// Define country mappings for easy expansion
	const countryMappings = {
		UK: {
			indicators: ["🇬🇧", "gb", "uk", "united kingdom", "britain", "british"],
			key: "UK" as const,
		},
		FR: {
			indicators: ["🇫🇷", "fr", "france", "french"],
			key: "FR" as const,
		},
		CA: {
			indicators: ["🇨🇦", "ca", "canada", "canadian"],
			key: "CA" as const,
		},
	};

	// Check for each country's indicators
	for (const [, { indicators, key }] of Object.entries(countryMappings)) {
		if (indicators.some((indicator) => cleaned.includes(indicator))) {
			if (!nationalities.includes(key)) {
				nationalities.push(key);
			}
		}
	}

	// Handle combined formats like "GB/FR", "UK/CA", etc.
	if (cleaned.includes("/") || cleaned.includes("&") || cleaned.includes("+")) {
		const parts = cleaned.split(/[\/&+]/).map((part) => part.trim());
		for (const part of parts) {
			// Check each part against all country mappings
			for (const [, { indicators, key }] of Object.entries(countryMappings)) {
				if (
					indicators.some(
						(indicator) => part === indicator || part.includes(indicator),
					)
				) {
					if (!nationalities.includes(key)) {
						nationalities.push(key);
					}
				}
			}
		}
	}

	return nationalities.length > 0 ? nationalities : undefined;
};

/**
 * Convert arrondissement string to ParisArrondissement
 */
const convertToArrondissement = (
	arrStr: string,
	location: string,
): ParisArrondissement => {
	if (!arrStr || arrStr.trim() === "") {
		// Fall back to location-based estimation if arrondissement is empty
		return estimateArrondissement(location);
	}

	// Clean the string and extract number
	const cleaned = arrStr.trim().toLowerCase();
	const arrMatch = cleaned.match(/(\d+)/);

	if (arrMatch) {
		const arrNumber = parseInt(arrMatch[1]);

		// Validate arrondissement is between 1-20
		if (arrNumber >= 1 && arrNumber <= 20) {
			return arrNumber as ParisArrondissement;
		}
	}

	return "unknown";
};

/**
 * Convert genre string to MusicGenre array
 */
const convertToMusicGenres = (genreStr: string): MusicGenre[] => {
	if (!genreStr) return ["afrobeats"]; // Default fallback

	const genreMap = {
		afrobeats: "afrobeats",
		"afro beats": "afrobeats",
		afro: "afro",
		amapiano: "amapiano",
		piano: "amapiano",
		"hip hop": "hip hop",
		hiphop: "hip hop",
		"hip-hop": "hip hop",
		"r&b": "r&b",
		rnb: "r&b",
		"r and b": "r&b",
		shatta: "shatta",
		dancehall: "dancehall",
		"dance hall": "dancehall",
		reggaeton: "reggaeton",
		reggaetón: "reggaeton",
		"baile funk": "baile funk",
		house: "house",
		disco: "disco",
		"afro house": "afro house",
		afrohouse: "afro house",
		electro: "electro",
		electronic: "electro",
		funk: "funk",
		rap: "rap",
		trap: "trap",
		"uk drill": "uk drill",
		drill: "uk drill",
		"uk garage": "uk garage",
		garage: "uk garage",
		bouyon: "bouyon",
		zouk: "zouk",
		bashment: "bashment",
		soca: "soca",
		pop: "pop",
		"coupé-décalé": "coupé-décalé",
		"coupe decale": "coupé-décalé",
		"urban fr": "urban fr",
		"urban french": "urban fr",
		kompa: "kompa",
		gqom: "gqom",
	} as const;

	const genres = genreStr
		.toLowerCase()
		.split(/[,;\/&+]/) // Split on various separators
		.map((g) => g.trim())
		.filter((g) => g.length > 0);

	const mappedGenres = genres
		.map((genre) => genreMap[genre as keyof typeof genreMap])
		.filter((genre): genre is MusicGenre => Boolean(genre))
		.filter((genre, index, arr) => arr.indexOf(genre) === index); // Remove duplicates

	return mappedGenres.length > 0 ? mappedGenres : ["afrobeats"]; // Default fallback
};

/**
 * Convert time string to 24-hour format
 */
const convertToTime = (timeStr: string): string => {
	if (
		!timeStr ||
		timeStr.toLowerCase().includes("tbc") ||
		timeStr.toLowerCase().includes("tba")
	) {
		return "TBC";
	}

	const cleaned = timeStr.trim();

	// Handle various time formats
	const timeFormats = [
		/(\d{1,2}):(\d{2})\s*(am|pm)/i, // 2:00 pm, 11:00 am
		/(\d{1,2})\s*(am|pm)/i, // 2 pm, 11 am
		/(\d{1,2}):(\d{2})/, // 14:00, 02:30
		/(\d{1,2})h(\d{2})/i, // 14h00, 2h30
		/(\d{1,2})h/i, // 14h, 2h
	];

	for (const format of timeFormats) {
		const match = cleaned.match(format);
		if (match) {
			let hours = parseInt(match[1]);
			const minutes = match[2] ? parseInt(match[2]) : 0;
			const period = match[3]?.toLowerCase();

			// Convert 12-hour to 24-hour
			if (period) {
				if (period === "am" && hours === 12) hours = 0;
				if (period === "pm" && hours !== 12) hours += 12;
			}

			return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
		}
	}

	return cleaned; // Return as-is if no format matches
};

/**
 * Estimate arrondissement from location string
 */
const estimateArrondissement = (location: string): ParisArrondissement => {
	if (!location) return "unknown";

	const locationLower = location.toLowerCase();

	const locationMap = {
		temple: 3,
		montparnasse: 14,
		bellevilloise: 20,
		wanderlust: 12,
		belleville: 20,
		marais: 4,
		bastille: 11,
		république: 11,
		republic: 11,
		châtelet: 1,
		chatelet: 1,
		louvre: 1,
		pigalle: 18,
		"moulin rouge": 18,
		canal: 10,
		"notre dame": 4,
		richerand: 10,
		"quai françois mauriac": 13,
		"champs élysées": 8,
		"champs elysees": 8,
		montmartre: 18,
		oberkampf: 11,
		ménilmontant: 20,
		menilmontant: 20,
		"père lachaise": 20,
		"pere lachaise": 20,
		panthéon: 5,
		pantheon: 5,
		opéra: 9,
		opera: 9,
		"gare du nord": 10,
		"gare de l'est": 10,
		"gare de lyon": 12,
		bercy: 12,
		invalides: 7,
		"tour eiffel": 7,
		eiffel: 7,
		trocadéro: 16,
		trocadero: 16,
		"arc de triomphe": 8,
		"grands boulevards": 9,
		"grands magasins": 9,
	} as const;

	// Find matching arrondissement
	for (const [key, value] of Object.entries(locationMap)) {
		if (locationLower.includes(key)) {
			return value as ParisArrondissement;
		}
	}

	return "unknown";
};

/**
 * Determine if event is after party based on name and time
 */
const isAfterParty = (name: string, startTime: string): boolean => {
	const nameLower = name.toLowerCase();
	const time = convertToTime(startTime);

	const hasAfterPartyInName =
		nameLower.includes("after") ||
		nameLower.includes("afterparty") ||
		nameLower.includes("after-party");

	const isLateNight = (() => {
		if (time === "TBC") return false;
		const hourMatch = time.match(/(\d{1,2})/);
		if (!hourMatch) return false;
		const hours = parseInt(hourMatch[1]);
		// Align with day/night boundaries: Night starts at 10:00 PM (22:00)
		return hours >= 22 || hours <= 5;
	})();

	return hasAfterPartyInName || isLateNight;
};

/**
 * Convert date string to ISO date format (YYYY-MM-DD)
 */
const convertToISODate = (dateStr: string): string => {
	if (!dateStr) return "2025-06-21"; // Default to Saturday, June 21st, 2025

	// Extract day number from various date formats
	const dateMatch = dateStr.match(
		/(\d{1,2})\s*june|june\s*(\d{1,2})|(\d{1,2})\/06|(\d{1,2})-06/i,
	);
	if (dateMatch) {
		const dayNumber = parseInt(
			dateMatch[1] || dateMatch[2] || dateMatch[3] || dateMatch[4],
		);
		if (dayNumber >= 1 && dayNumber <= 31) {
			const day = dayNumber.toString().padStart(2, "0");
			return `2025-06-${day}`;
		}
	}

	// If no specific date found, try to extract just a number
	const simpleMatch = dateStr.match(/(\d{1,2})/);
	if (simpleMatch) {
		const dayNumber = parseInt(simpleMatch[1]);
		if (dayNumber >= 1 && dayNumber <= 31) {
			const day = dayNumber.toString().padStart(2, "0");
			return `2025-06-${day}`;
		}
	}

	return "2025-06-21"; // Default to Saturday, June 21st, 2025
};

/**
 * Process the unified featured column that can contain either a timestamp or any other string
 * @param featuredStr - The featured column value
 * @param eventName - The event name for warning context
 * @param rowIndex - The row index for warning context
 * @returns Object with isFeatured and featuredAt properties
 */
const processFeaturedColumn = (
	featuredStr: string,
	eventName: string = "Unknown Event",
	rowIndex: number = 0,
): { isFeatured: boolean; featuredAt?: string } => {
	// Handle null, undefined, or non-string values
	if (featuredStr == null || typeof featuredStr !== "string") {
		return { isFeatured: false };
	}

	const cleaned = featuredStr.trim();

	// Empty string or explicit false values should be false
	const falseValues = [
		"",
		"no",
		"false",
		"0",
		"n",
		"none",
		"null",
		"undefined",
	];
	if (falseValues.includes(cleaned.toLowerCase())) {
		return { isFeatured: false };
	}

	// Try to parse as timestamp first
	const parsedTimestamp = parseFeaturedAt(cleaned, eventName, rowIndex);
	if (parsedTimestamp) {
		const parsedDate = new Date(parsedTimestamp);
		const now = new Date();

		// If the timestamp is in the future, treat it as "start featuring now"
		if (parsedDate.getTime() > now.getTime()) {
			console.log(
				`📅 Future date detected in featured column: "${featuredStr}"`,
			);
			console.log(`   Parsed as: ${parsedDate.toISOString()}`);
			console.log(
				`   Since this is a future date, starting featuring NOW instead`,
			);
			console.log(
				`   💡 Tip: For future event dates, use the event date column, not featured column`,
			);

			// Use current time as start of featuring
			return {
				isFeatured: true,
				featuredAt: now.toISOString(),
			};
		}

		// Valid timestamp in past/present - use as-is
		return {
			isFeatured: true,
			featuredAt: parsedTimestamp,
		};
	}

	// Not a valid timestamp but non-empty - set only isFeatured
	return { isFeatured: true };
};

/**
 * Convert indoor/outdoor string to VenueType array
 */
const convertToVenueTypes = (indoorOutdoorStr: string): VenueType[] => {
	if (!indoorOutdoorStr) {
		// Default to indoor if no information available
		return ["indoor"];
	}

	const cleaned = indoorOutdoorStr.toLowerCase().trim();
	const venueTypes: VenueType[] = [];

	// Split on newlines to handle multiline entries like "Indoor\nOutdoor"
	const lines = cleaned.split(/\n/).map((line) => line.trim());

	// Check each line for venue type indicators
	for (const line of lines) {
		// Check for indoor indicators
		if (line.includes("indoor")) {
			if (!venueTypes.includes("indoor")) {
				venueTypes.push("indoor");
			}
		}

		// Check for outdoor indicators
		if (
			line.includes("outdoor") ||
			line.includes("open air") ||
			line.includes("plein air") ||
			line.includes("outside")
		) {
			if (!venueTypes.includes("outdoor")) {
				venueTypes.push("outdoor");
			}
		}
	}

	// If no specific venue type found, try to infer from context
	if (venueTypes.length === 0) {
		// Default to indoor if no clear indication
		venueTypes.push("indoor");
	}

	return venueTypes;
};

/**
 * Parse featured timestamp from various formats with improved UK/US date handling
 */
const parseFeaturedAt = (
	featuredAtStr: string,
	eventName: string = "Unknown Event",
	rowIndex: number = 0,
): string | undefined => {
	if (!featuredAtStr || featuredAtStr.trim() === "") {
		return undefined;
	}

	try {
		// Try parsing as ISO string first (recommended format)
		if (featuredAtStr.includes("T") || featuredAtStr.includes("Z")) {
			const date = new Date(featuredAtStr);
			if (!isNaN(date.getTime())) {
				console.log(
					`✅ Parsed ISO timestamp: "${featuredAtStr}" → ${date.toISOString()}`,
				);
				return date.toISOString();
			}
		}

		// Try unambiguous formats first (month names, etc.)
		const unambiguousFormats = [
			// Month names (Jan, January, etc.)
			/^(\d{1,2})[-\s](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[-\s](\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?$/i,
			/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[-\s](\d{1,2})[-\s](\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?$/i,
			// ISO-like without T
			/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/,
		];

		for (const regex of unambiguousFormats) {
			const match = featuredAtStr.match(regex);
			if (match) {
				// Handle different match groups based on regex
				let year: string,
					month: string,
					day: string,
					hour: string,
					minute: string,
					second: string,
					ampm: string | undefined;

				if (regex.source.includes("(\\d{4})")) {
					// ISO-like format: YYYY-MM-DD HH:MM
					[, year, month, day, hour, minute, second = "0"] = match;
				} else if (regex.source.startsWith("^(\\d{1,2})")) {
					// DD-MMM-YYYY format
					[, day, month, year, hour, minute, second = "0", ampm] = match;
					month = getMonthNumber(month);
				} else {
					// MMM-DD-YYYY format
					[, month, day, year, hour, minute, second = "0", ampm] = match;
					month = getMonthNumber(month);
				}

				// Handle AM/PM
				let hourNum = parseInt(hour, 10);
				if (ampm) {
					if (ampm.toUpperCase() === "PM" && hourNum !== 12) {
						hourNum += 12;
					} else if (ampm.toUpperCase() === "AM" && hourNum === 12) {
						hourNum = 0;
					}
				}

				const date = new Date(
					`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hourNum.toString().padStart(2, "0")}:${minute}:${second.padStart(2, "0")}`,
				);

				if (!isNaN(date.getTime())) {
					console.log(
						`✅ Parsed unambiguous timestamp: "${featuredAtStr}" → ${date.toISOString()}`,
					);
					return date.toISOString();
				}
			}
		}

		// Handle potentially ambiguous DD/MM/YYYY or MM/DD/YYYY formats
		const ambiguousDateRegex =
			/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?$/i;
		const match = featuredAtStr.match(ambiguousDateRegex);

		if (match) {
			const [, first, second, year, hour, minute, second_val = "0", ampm] =
				match;
			const firstNum = parseInt(first, 10);
			const secondNum = parseInt(second, 10);

			// Handle AM/PM
			let hourNum = parseInt(hour, 10);
			if (ampm) {
				if (ampm.toUpperCase() === "PM" && hourNum !== 12) {
					hourNum += 12;
				} else if (ampm.toUpperCase() === "AM" && hourNum === 12) {
					hourNum = 0;
				}
			}

			// Smart disambiguation logic
			let month: string, day: string, format: string;

			if (firstNum > 12 && secondNum <= 12) {
				// First number > 12, must be DD/MM/YYYY (UK format)
				day = first;
				month = second;
				format = "UK (DD/MM/YYYY)";
			} else if (secondNum > 12 && firstNum <= 12) {
				// Second number > 12, must be MM/DD/YYYY (US format)
				month = first;
				day = second;
				format = "US (MM/DD/YYYY)";
			} else if (firstNum <= 12 && secondNum <= 12) {
				// Both numbers could be month or day - this is ambiguous!
				console.warn(`⚠️ AMBIGUOUS DATE FORMAT: "${featuredAtStr}"`);
				console.warn(
					`   Could be: ${first}/${second}/${year} (US: ${getMonthName(first)} ${second}) or ${first}/${second}/${year} (UK: ${first} ${getMonthName(second)})`,
				);
				console.warn(
					`   Using UK format (DD/MM/YYYY) by default for European app. For clarity, please use:`,
				);
				console.warn(
					`   ✅ ISO format: ${year}-${second.padStart(2, "0")}-${first.padStart(2, "0")}T${hourNum.toString().padStart(2, "0")}:${minute}:${second_val}`,
				);
				console.warn(
					`   ✅ Or with month name: ${first}-${getMonthName(second)}-${year} ${hour}:${minute}${ampm ? ` ${ampm}` : ""}`,
				);

				// Collect warning for admin panel
				addDateFormatWarning({
					originalValue: featuredAtStr,
					eventName,
					columnType: "featured",
					warningType: "ambiguous",
					potentialFormats: {
						us: {
							date: `${year}-${first.padStart(2, "0")}-${second.padStart(2, "0")}T${hourNum.toString().padStart(2, "0")}:${minute}:${second_val.padStart(2, "0")}`,
							description: `US: ${getMonthName(first)} ${second}, ${year} ${hourNum % 12 || 12}:${minute}${hourNum >= 12 ? " PM" : " AM"}`,
						},
						uk: {
							date: `${year}-${second.padStart(2, "0")}-${first.padStart(2, "0")}T${hourNum.toString().padStart(2, "0")}:${minute}:${second_val.padStart(2, "0")}`,
							description: `UK: ${first} ${getMonthName(second)}, ${year} ${hourNum % 12 || 12}:${minute}${hourNum >= 12 ? " PM" : " AM"}`,
						},
						iso: `${year}-${second.padStart(2, "0")}-${first.padStart(2, "0")}T${hourNum.toString().padStart(2, "0")}:${minute}:${second_val.padStart(2, "0")}`,
					},
					detectedFormat: "UK (DD/MM/YYYY) - ASSUMED",
					recommendedAction: "Use ISO format or month name to avoid ambiguity",
					rowIndex,
				});

				// Default to UK format (DD/MM/YYYY) for European app
				day = first;
				month = second;
				format = "UK (DD/MM/YYYY) - ASSUMED";
			} else {
				// Both numbers > 12, invalid
				console.error(
					`❌ Invalid date: both ${first} and ${second} cannot be valid month or day`,
				);
				return undefined;
			}

			const date = new Date(
				`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hourNum.toString().padStart(2, "0")}:${minute}:${second_val.padStart(2, "0")}`,
			);

			if (!isNaN(date.getTime())) {
				console.log(
					`✅ Parsed potentially ambiguous timestamp: "${featuredAtStr}" → ${date.toISOString()} (detected as ${format})`,
				);

				// Check for future dates in featured column
				const now = new Date();
				if (date > now) {
					console.log(
						`📅 Future date detected in featured column: "${featuredAtStr}"`,
					);
					console.log(`   Parsed as: ${date.toISOString()}`);
					console.log(
						`   Since this is a future date, starting featuring NOW instead`,
					);
					console.log(
						`   💡 Tip: For future event dates, use the event date column, not featured column`,
					);

					addDateFormatWarning({
						originalValue: featuredAtStr,
						eventName,
						columnType: "featured",
						warningType: "future_featured",
						potentialFormats: {
							us: {
								date: date.toISOString(),
								description: `Future: ${date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`,
							},
							uk: {
								date: date.toISOString(),
								description: `Future: ${date.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`,
							},
							iso: date.toISOString().split(".")[0],
						},
						detectedFormat: format,
						recommendedAction:
							"Future date detected - featuring started immediately. Use event date column for future events.",
						rowIndex,
					});
				}

				return date.toISOString();
			}
		}

		// Try parsing as simple date (last resort)
		const date = new Date(featuredAtStr);
		if (!isNaN(date.getTime())) {
			console.log(
				`✅ Parsed generic timestamp: "${featuredAtStr}" → ${date.toISOString()}`,
			);
			return date.toISOString();
		}

		console.warn(`❌ Could not parse featuredAt timestamp: "${featuredAtStr}"`);
		console.warn(`💡 Recommended formats:`);
		console.warn(`   • ISO: 2025-06-07T20:00:00`);
		console.warn(`   • Month name: 7-Jun-2025 20:00:00`);
		console.warn(`   • Unambiguous: 2025-06-07 20:00:00`);

		// Collect unparseable warning
		addDateFormatWarning({
			originalValue: featuredAtStr,
			eventName,
			columnType: "featured",
			warningType: "unparseable",
			potentialFormats: {
				us: {
					date: "Invalid",
					description: "Could not parse as US format",
				},
				uk: {
					date: "Invalid",
					description: "Could not parse as UK format",
				},
				iso: "2025-06-07T20:00:00",
			},
			detectedFormat: "UNPARSEABLE",
			recommendedAction:
				"Use ISO format (YYYY-MM-DDTHH:MM:SS) or month names for clarity",
			rowIndex,
		});

		return undefined;
	} catch (error) {
		console.warn(
			`Error parsing featuredAt timestamp: "${featuredAtStr}"`,
			error,
		);
		return undefined;
	}
};

// Helper function to convert month abbreviations to numbers
function getMonthNumber(monthStr: string): string {
	const months: Record<string, string> = {
		jan: "01",
		feb: "02",
		mar: "03",
		apr: "04",
		may: "05",
		jun: "06",
		jul: "07",
		aug: "08",
		sep: "09",
		oct: "10",
		nov: "11",
		dec: "12",
		january: "01",
		february: "02",
		march: "03",
		april: "04",
		june: "06",
		july: "07",
		august: "08",
		september: "09",
		october: "10",
		november: "11",
		december: "12",
	};
	return months[monthStr.toLowerCase()] || monthStr;
}

// Helper function to get month name from number
function getMonthName(monthNum: string): string {
	const months = [
		"Jan",
		"Feb",
		"Mar",
		"Apr",
		"May",
		"Jun",
		"Jul",
		"Aug",
		"Sep",
		"Oct",
		"Nov",
		"Dec",
	];
	const num = parseInt(monthNum, 10);
	return months[num - 1] || monthNum;
}

/**
 * Generate a stable, content-based ID for an event
 * This ensures that if event content changes, the change detection will catch it
 */
const generateEventId = (csvRow: CSVEventRow, index: number): string => {
	// Create ID based on event content for better change detection
	// Use name + date + location as the primary identifier
	const name = (csvRow.name || `Event ${index + 1}`).toLowerCase().trim();
	const date = csvRow.date || "";
	const location = (csvRow.location || "").toLowerCase().trim();

	// Create a more stable identifier
	const contentHash = `${name}-${date}-${location}`.replace(
		/[^a-z0-9\-]/g,
		"-",
	);

	// Fallback to index-based ID if content is too generic
	if (
		!csvRow.name ||
		csvRow.name.trim() === "" ||
		csvRow.name === `Event ${index + 1}`
	) {
		return `csv-event-${index}`;
	}

	return `csv-${contentHash}-${index}`;
};

/**
 * Convert CSVEventRow to Event
 */
export const convertCSVRowToEvent = (
	csvRow: CSVEventRow,
	index: number,
): Event => {
	const eventType: EventType = isAfterParty(csvRow.name, csvRow.startTime)
		? "After Party"
		: "Day Party";
	const time = convertToTime(csvRow.startTime);
	const endTime = csvRow.endTime ? convertToTime(csvRow.endTime) : undefined;
	const venueTypes = convertToVenueTypes(csvRow.indoorOutdoor);

	// Process the ticket links (can be multiple)
	const processTicketLinks = (
		linkField: string,
		eventName: string,
	): string[] => {
		if (!linkField || linkField.trim() === "" || linkField === "#") {
			return [
				`https://www.google.com/search?q=${encodeURIComponent(eventName)}`,
			];
		}
		// Split on newlines, commas, or semicolons
		const rawLinks = linkField
			.split(/\n|,|;/)
			.map((l) => l.trim())
			.filter(Boolean);
		return rawLinks.map((link) => {
			// Clean and validate each link
			if (!link || link === "#")
				return `https://www.google.com/search?q=${encodeURIComponent(eventName)}`;
			try {
				if (!link.startsWith("http://") && !link.startsWith("https://")) {
					if (link.includes(".") && !link.includes(" ")) {
						return `https://${link}`;
					}
					return `https://www.google.com/search?q=${encodeURIComponent(eventName)}`;
				}
				new URL(link);
				return link;
			} catch {
				return `https://www.google.com/search?q=${encodeURIComponent(eventName)}`;
			}
		});
	};

	const links = processTicketLinks(csvRow.ticketLink, csvRow.name);

	return {
		id: generateEventId(csvRow, index),
		name: csvRow.name || `Event ${index + 1}`,
		day: convertToEventDay(csvRow.date),
		date: convertToISODate(csvRow.date),
		time: time === "TBC" ? undefined : time,
		endTime: endTime === "TBC" ? undefined : endTime,
		arrondissement: convertToArrondissement(
			csvRow.arrondissement,
			csvRow.location,
		),
		location: csvRow.location || "TBA",
		link: links[0], // for backwards compatibility
		links, // new field
		description: csvRow.notes || undefined,
		type: eventType,
		genre: convertToMusicGenres(csvRow.genre),
		venueTypes,
		indoor: venueTypes.includes("indoor"), // Backwards compatibility
		verified: false,
		price: csvRow.price || undefined,
		age: csvRow.age || undefined,
		isOOOCPick:
			csvRow.oocPicks === "🌟" ||
			csvRow.oocPicks.toLowerCase().includes("pick"),
		...processFeaturedColumn(
			csvRow.featured,
			csvRow.name || `Event ${index + 1}`,
			index,
		),
		nationality: convertToNationality(csvRow.nationality),
	};
}; 