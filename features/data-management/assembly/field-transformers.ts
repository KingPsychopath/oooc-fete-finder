/**
 * Event Field Transformers
 *
 * Pure transformation functions for converting CSV fields to typed Event properties.
 * Each transformer handles one specific field type with all its variations and edge cases.
 */

import type {
	EventDay,
	MusicGenre,
	Nationality,
	ParisArrondissement,
	VenueType,
} from "@/features/events/types";
import { parseSupportedNationalities } from "@/features/events/nationality-utils";
import { createDateNormalizationContext, normalizeCsvDate } from "./date-normalization";

/**
 * Date and Day Transformers
 */
export const DateTransformers = {
	/**
	 * Convert date string to EventDay using actual date calculation
	 */
	convertToEventDay: (dateStr: string, referenceDate?: Date): EventDay => {
		const context = createDateNormalizationContext([], { referenceDate });
		return normalizeCsvDate(dateStr, context).day;
	},

	/**
	 * Convert time string to standardized format
	 */
	convertToTime: (timeStr: string): string => {
		if (!timeStr || timeStr.trim() === "") return "";

		const cleaned = timeStr.trim().toLowerCase();

		// Handle common variations
		const cleanedTime = cleaned
			.replace(/\s+/g, "")
			.replace(/[.-]/g, ":")
			.replace(/h/g, ":")
			.replace(/[;,]/g, ":")
			.replace(/:+/g, ":")
			.replace(/:$/, "");

		// Try to parse 24-hour format first
		const time24Match = cleanedTime.match(/^(\d{1,2}):?(\d{2})?$/);
		if (time24Match) {
			const hours = parseInt(time24Match[1]);
			const minutes = time24Match[2] ? parseInt(time24Match[2]) : 0;

			if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
				return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
			}
		}

		// Handle AM/PM format
		const amPmMatch = cleanedTime.match(/^(\d{1,2}):?(\d{2})?\s*(am|pm)$/);
		if (amPmMatch) {
			let hours = parseInt(amPmMatch[1]);
			const minutes = amPmMatch[2] ? parseInt(amPmMatch[2]) : 0;
			const period = amPmMatch[3];

			if (period === "pm" && hours !== 12) {
				hours += 12;
			} else if (period === "am" && hours === 12) {
				hours = 0;
			}

			if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
				return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
			}
		}

		// Return original if no valid format found
		return timeStr.trim();
	},

	/**
	 * Convert date string to ISO format
	 */
	convertToISODate: (dateStr: string, referenceDate?: Date): string => {
		const context = createDateNormalizationContext([], { referenceDate });
		return normalizeCsvDate(dateStr, context).isoDate;
	},
};

/**
 * Location and Geography Transformers
 */
export const LocationTransformers = {
	/**
	 * Convert arrondissement string to ParisArrondissement
	 */
	convertToArrondissement: (
		arrStr: string,
		location: string,
	): ParisArrondissement => {
		if (!arrStr || arrStr.trim() === "") {
			// Fall back to location-based estimation if arrondissement is empty
			return LocationTransformers.estimateArrondissement(location);
		}

		// Clean the string and extract number
		const cleaned = arrStr.trim().toLowerCase();

		// Try to extract number from various formats
		const numberMatch = cleaned.match(/(\d{1,2})/);
		if (numberMatch) {
			const num = parseInt(numberMatch[1]);
			if (num >= 1 && num <= 20) {
				return num as ParisArrondissement;
			}
		}

		// Handle text variations
		const textMappings: Record<string, ParisArrondissement> = {
			"1er": 1,
			premier: 1,
			first: 1,
			"2e": 2,
			"2ème": 2,
			deuxième: 2,
			second: 2,
			"3e": 3,
			"3ème": 3,
			troisième: 3,
			third: 3,
			"4e": 4,
			"4ème": 4,
			quatrième: 4,
			fourth: 4,
			"5e": 5,
			"5ème": 5,
			cinquième: 5,
			fifth: 5,
			// ... can be expanded for all 20 arrondissements
		};

		for (const [text, num] of Object.entries(textMappings)) {
			if (cleaned.includes(text)) {
				return num;
			}
		}

		// Fallback to location estimation
		return LocationTransformers.estimateArrondissement(location);
	},

	/**
	 * Estimate arrondissement from location string
	 */
	estimateArrondissement: (location: string): ParisArrondissement => {
		if (!location || location.toLowerCase().includes("tba")) {
			return "unknown";
		}

		const lowerLocation = location.toLowerCase();

		// Well-known landmarks and their arrondissements
		const landmarkMappings: Record<string, ParisArrondissement> = {
			// 1st arrondissement
			louvre: 1,
			"palais royal": 1,
			châtelet: 1,
			"les halles": 1,
			// 2nd arrondissement
			bourse: 2,
			"grands boulevards": 2,
			// 3rd arrondissement
			marais: 3,
			temple: 3,
			// 4th arrondissement
			"notre dame": 4,
			"île de la cité": 4,
			"hôtel de ville": 4,
			"saint-paul": 4,
			// 5th arrondissement
			"latin quarter": 5,
			panthéon: 5,
			sorbonne: 5,
			"quartier latin": 5,
			// 6th arrondissement
			"saint-germain": 6,
			luxembourg: 6,
			odéon: 6,
			// 7th arrondissement
			"eiffel tower": 7,
			"tour eiffel": 7,
			invalides: 7,
			"musée d'orsay": 7,
			// 8th arrondissement
			"champs-élysées": 8,
			opéra: 8,
			madeleine: 8,
			// 9th arrondissement
			"opéra garnier": 9,
			"grands magasins": 9,
			// 10th arrondissement
			"gare du nord": 10,
			"gare de l'est": 10,
			"canal saint-martin": 10,
			// 11th arrondissement
			"république place": 11,
			oberkampf: 11,
			// 12th arrondissement
			bastille: 12,
			"gare de lyon": 12,
			bercy: 12,
			// 13th arrondissement
			"place d'italie": 13,
			"gare d'austerlitz": 13,
			"butte-aux-cailles": 13,
			// 14th arrondissement
			montparnasse: 14,
			catacombes: 14,
			// 15th arrondissement
			"gare montparnasse": 15,
			beaugrenelle: 15,
			// 16th arrondissement
			trocadéro: 16,
			"bois de boulogne": 16,
			// 17th arrondissement
			batignolles: 17,
			// 18th arrondissement
			montmartre: 18,
			"sacré-cœur": 18,
			pigalle: 18,
			// 19th arrondissement
			"buttes-chaumont": 19,
			"la villette": 19,
			// 20th arrondissement
			"père lachaise": 20,
			belleville: 20,
			ménilmontant: 20,
		};

		// Check for landmark matches
		for (const [landmark, arrondissement] of Object.entries(landmarkMappings)) {
			if (lowerLocation.includes(landmark)) {
				return arrondissement;
			}
		}

		// Check for arrondissement mentions in location
		const arrMatch = lowerLocation.match(
			/(\d{1,2})(er|e|ème)?\s*(arr|ardt|arrondissement)/,
		);
		if (arrMatch) {
			const num = parseInt(arrMatch[1]);
			if (num >= 1 && num <= 20) {
				return num as ParisArrondissement;
			}
		}

		return "unknown";
	},
};

/**
 * Nationality and Country Transformers
 */
export const NationalityTransformers = {
	/**
	 * Convert host country flag/text to Nationality type array
	 */
	convertToNationality: (nationalityStr: string): Nationality[] | undefined => {
		const parsed = parseSupportedNationalities(nationalityStr);
		return parsed.codes.length > 0 ? parsed.codes : undefined;
	},
};

/**
 * Music and Genre Transformers
 */
export const GenreTransformers = {
	/**
	 * Convert genre string to MusicGenre array
	 */
	convertToMusicGenres: (genreStr: string): MusicGenre[] => {
		if (!genreStr || genreStr.trim() === "") return [];

		const cleaned = genreStr.toLowerCase().trim();
		const genres: MusicGenre[] = [];

		// Genre mapping with variations and aliases
		const genreMappings: Record<string, MusicGenre> = {
			// Electronic/Electro
			electronic: "electro",
			electro: "electro",
			edm: "electro",
			techno: "house", // Map to house as it's closer
			house: "house",
			trance: "electro",
			dubstep: "electro",

			// Hip Hop & Rap
			"hip hop": "hip hop",
			hiphop: "hip hop",
			"hip-hop": "hip hop",
			rap: "rap",

			// Pop
			pop: "pop",
			mainstream: "pop",
			commercial: "pop",

			// R&B and Funk
			"r&b": "r&b",
			rnb: "r&b",
			soul: "r&b",
			funk: "funk",

			// Afrobeats and related
			afrobeats: "afrobeats",
			afro: "afro",
			"afro house": "afro house",
			amapiano: "amapiano",

			// Caribbean
			soca: "soca",
			bashment: "bashment",
			dancehall: "dancehall",
			reggaeton: "reggaeton",
			bouyon: "bouyon",
			zouk: "zouk",
			kompa: "kompa",

			// UK genres
			"uk drill": "uk drill",
			"uk garage": "uk garage",

			// Other genres
			disco: "disco",
			trap: "trap",
			"baile funk": "baile funk",
			shatta: "shatta",
			"coupé-décalé": "coupé-décalé",
			"urban fr": "urban fr",
			gqom: "gqom",
			alternative: "alternative",
			alt: "alternative",
			indie: "alternative",
			"alternative rock": "alternative",
			dance: "dance",
			"dance music": "dance",
			"dance/electronic": "dance",
		};

		// Split by common separators and check each part
		const parts = cleaned.split(/[,\/&+]/).map((part) => part.trim());

		for (const part of parts) {
			// Direct mapping check
			if (genreMappings[part]) {
				if (!genres.includes(genreMappings[part])) {
					genres.push(genreMappings[part]);
				}
				continue;
			}

			// Partial matching for complex descriptions
			for (const [keyword, genre] of Object.entries(genreMappings)) {
				if (part.includes(keyword)) {
					if (!genres.includes(genre)) {
						genres.push(genre);
					}
					break; // Only match first found genre per part
				}
			}
		}

		return genres.length > 0 ? genres : ["other"]; // Use "other" as fallback for unknown genres
	},
};

/**
 * Venue and Event Type Transformers
 */
export const VenueTransformers = {
	/**
	 * Convert indoor/outdoor string to VenueType array
	 */
	convertToVenueTypes: (indoorOutdoorStr: string): VenueType[] => {
		if (!indoorOutdoorStr || indoorOutdoorStr.trim() === "") return [];

		const cleaned = indoorOutdoorStr.toLowerCase().trim();
		const venueTypes: VenueType[] = [];

		// Venue type indicators
		const venueIndicators = {
			indoor: [
				"indoor",
				"inside",
				"club",
				"bar",
				"hall",
				"theater",
				"theatre",
				"venue",
				"salle",
			],
			outdoor: [
				"outdoor",
				"outside",
				"park",
				"garden",
				"terrace",
				"roof",
				"street",
				"plein air",
			],
		};

		// Check for indoor indicators
		if (
			venueIndicators.indoor.some((indicator) => cleaned.includes(indicator))
		) {
			venueTypes.push("indoor");
		}

		// Check for outdoor indicators
		if (
			venueIndicators.outdoor.some((indicator) => cleaned.includes(indicator))
		) {
			venueTypes.push("outdoor");
		}

		// Handle combined venues
		if (
			cleaned.includes("/") ||
			cleaned.includes("&") ||
			cleaned.includes("+")
		) {
			const parts = cleaned.split(/[\/&+]/).map((part) => part.trim());
			for (const part of parts) {
				if (
					venueIndicators.indoor.some((indicator) => part.includes(indicator))
				) {
					if (!venueTypes.includes("indoor")) {
						venueTypes.push("indoor");
					}
				}
				if (
					venueIndicators.outdoor.some((indicator) => part.includes(indicator))
				) {
					if (!venueTypes.includes("outdoor")) {
						venueTypes.push("outdoor");
					}
				}
			}
		}

		return venueTypes;
	},
};

/**
 * Business Logic Helpers
 */
export const BusinessLogicHelpers = {
	/**
	 * Detect if event is likely an after party
	 */
	isAfterParty: (name: string, startTime: string): boolean => {
		const lowerName = name.toLowerCase();
		const afterPartyIndicators = [
			"after party",
			"afterparty",
			"after-party",
			"after show",
			"aftershow",
			"after-show",
			"late night",
			"latenight",
			"late-night",
			"night session",
			"nightsession",
		];

		// Check name for after party indicators
		if (
			afterPartyIndicators.some((indicator) => lowerName.includes(indicator))
		) {
			return true;
		}

		// Check start time - events starting after 23:00 are likely after parties
		if (startTime) {
			const timeMatch = startTime.match(/^(\d{1,2}):?(\d{2})?/);
			if (timeMatch) {
				const hours = parseInt(timeMatch[1]);
				if (hours >= 23 || hours <= 3) {
					// 23:00-03:59
					return true;
				}
			}
		}

		return false;
	},

	/**
	 * Process ticket links from field
	 */
	processTicketLinks: (linkField: string, _eventName: string): string[] => {
		if (!linkField || linkField.trim() === "") return [];

		const links: string[] = [];

		// Split by common separators
		const parts = linkField.split(/[,\n\r\|]/).map((part) => part.trim());

		for (const part of parts) {
			if (!part) continue;

			// Basic URL validation
			if (part.match(/^https?:\/\//)) {
				links.push(part);
			} else if (part.includes(".") && !part.includes(" ")) {
				// Assume it's a URL missing protocol
				links.push(`https://${part}`);
			}
		}

		return links;
	},
};
