// Strict type definitions for enhanced event categorization
export type EventDay =
	| "monday"
	| "tuesday"
	| "wednesday"
	| "thursday"
	| "friday"
	| "saturday"
	| "sunday"
	| "tbc";

export type DayNightPeriod = "day" | "night";

export type EventType = "After Party" | "Day Party";

// Host country type for GB/FR column
export type Nationality = "UK" | "FR" | "CA";

// Venue type for Indoor/Outdoor column
export type VenueType = "indoor" | "outdoor";

// Coordinate types for MapLibre GL JS integration
export type Coordinates = {
	lng: number;
	lat: number;
};

export type EventLocation = {
	id: string;
	name: string;
	arrondissement: ParisArrondissement;
	coordinates: Coordinates;
	confidence?: number; // Geocoding confidence score 0-1
	source: "manual" | "geocoded" | "estimated";
	lastUpdated: string; // ISO timestamp
};

// Expanded genre types based on CSV data
export type MusicGenre =
	| "amapiano"
	| "afrobeats"
	| "soca"
	| "pop"
	| "bashment"
	| "hip hop"
	| "r&b"
	| "shatta"
	| "dancehall"
	| "reggaeton"
	| "baile funk"
	| "house"
	| "disco"
	| "afro house"
	| "electro"
	| "funk"
	| "rap"
	| "trap"
	| "uk drill"
	| "uk garage"
	| "bouyon"
	| "zouk"
	| "coupé-décalé"
	| "urban fr"
	| "kompa"
	| "afro"
	| "gqom"
	| "alternative"
	| "dance"
	| "other";

export type ParisArrondissement =
	| 1
	| 2
	| 3
	| 4
	| 5
	| 6
	| 7
	| 8
	| 9
	| 10
	| 11
	| 12
	| 13
	| 14
	| 15
	| 16
	| 17
	| 18
	| 19
	| 20
	| "unknown";

// Legacy type for backwards compatibility
export type EventCategory =
	| "electronic"
	| "block-party"
	| "afterparty"
	| "club"
	| "cruise"
	| "outdoor"
	| "cultural";

export type Event = {
	id: string;
	name: string;
	day: EventDay;
	date: string; // ISO date string (YYYY-MM-DD)
	time?: string; // 24-hour format (HH:MM) or 'TBC'
	endTime?: string; // 24-hour format (HH:MM) or 'TBC'
	arrondissement: ParisArrondissement;
	location?: string;
	coordinates?: Coordinates; // Event-specific coordinates from geocoding or manual entry
	link: string;
	links?: string[]; // All ticket links, if multiple
	description?: string;
	type: EventType;
	genre: MusicGenre[];
	venueTypes: VenueType[]; // New field for venue types
	indoor: boolean; // Deprecated: kept for backwards compatibility
	verified: boolean;
	price?: string; // Price information from CSV
	age?: string; // Age restrictions from CSV
	isOOOCPick?: boolean; // 🌟 indicator from CSV
	isFeatured?: boolean; // Manual override for featured events in preview section
	featuredAt?: string; // ISO timestamp when event was featured (e.g., "2024-01-20T14:30:00Z")
	nationality?: Nationality[]; // GB/FR indicators from CSV - now supports multiple
	// Legacy field for backwards compatibility
	category?: EventCategory;
};

// CSV data type matching the structure in ooc_list_tracker.csv
export type CSVEventRow = {
	oocPicks: string; // "🌟" or empty
	nationality: string; // "🇬🇧" or "🇫🇷"
	name: string;
	date: string;
	startTime: string;
	endTime: string;
	location: string;
	arrondissement: string; // New Arr column
	genre: string; // Comma-separated genres
	price: string;
	ticketLink: string;
	age: string;
	indoorOutdoor: string; // New Indoor/Outdoor column
	notes: string;
	featured: string; // Featured column - can contain timestamp or any string indicating featured status
};

export type Arrondissement = {
	id: number;
	name: string;
	events: Event[];
	coordinates: {
		lat: number;
		lng: number;
	};
};

export type EventFilters = {
	day?: EventDay[];
	dayNightPeriod?: DayNightPeriod[];
	arrondissements?: ParisArrondissement[];
	eventTypes?: EventType[];
	genres?: MusicGenre[];
	venueTypes?: VenueType[]; // New venue types filter
	indoor?: boolean | null; // Deprecated: kept for backwards compatibility
	searchTerm?: string;
	priceRange?: [number, number]; // [min, max] price range
};

export type MapViewport = {
	center: [number, number];
	zoom: number;
};

export const EVENT_DAYS = [
	{ key: "monday" as const, label: "Monday", color: "bg-purple-500" },
	{ key: "tuesday" as const, label: "Tuesday", color: "bg-pink-500" },
	{ key: "wednesday" as const, label: "Wednesday", color: "bg-rose-500" },
	{ key: "thursday" as const, label: "Thursday", color: "bg-indigo-500" },
	{ key: "friday" as const, label: "Friday", color: "bg-blue-500" },
	{ key: "saturday" as const, label: "Saturday", color: "bg-green-500" },
	{ key: "sunday" as const, label: "Sunday", color: "bg-orange-500" },
	{ key: "tbc" as const, label: "TBC", color: "bg-gray-500" },
] as const;

export const DAY_NIGHT_PERIODS = [
	{
		key: "day" as const,
		label: "Day",
		timeRange: "6:00 AM - 9:59 PM",
		icon: "☀️",
	},
	{
		key: "night" as const,
		label: "Night",
		timeRange: "10:00 PM - 5:59 AM",
		icon: "🌙",
	},
] as const;

export const MUSIC_GENRES = [
	{ key: "amapiano" as const, label: "Amapiano", color: "bg-emerald-500" },
	{ key: "afrobeats" as const, label: "Afrobeats", color: "bg-orange-500" },
	{ key: "soca" as const, label: "Soca", color: "bg-yellow-500" },
	{ key: "pop" as const, label: "Pop", color: "bg-pink-500" },
	{ key: "bashment" as const, label: "Bashment", color: "bg-red-500" },
	{ key: "hip hop" as const, label: "Hip Hop", color: "bg-purple-600" },
	{ key: "r&b" as const, label: "R&B", color: "bg-indigo-500" },
	{ key: "shatta" as const, label: "Shatta", color: "bg-green-600" },
	{ key: "dancehall" as const, label: "Dancehall", color: "bg-lime-500" },
	{ key: "reggaeton" as const, label: "Reggaeton", color: "bg-amber-500" },
	{ key: "baile funk" as const, label: "Baile Funk", color: "bg-teal-500" },
	{ key: "house" as const, label: "House", color: "bg-blue-600" },
	{ key: "disco" as const, label: "Disco", color: "bg-violet-500" },
	{ key: "afro house" as const, label: "Afro House", color: "bg-orange-600" },
	{ key: "electro" as const, label: "Electro", color: "bg-cyan-500" },
	{ key: "funk" as const, label: "Funk", color: "bg-fuchsia-500" },
	{ key: "rap" as const, label: "Rap", color: "bg-gray-600" },
	{ key: "trap" as const, label: "Trap", color: "bg-slate-600" },
	{ key: "uk drill" as const, label: "UK Drill", color: "bg-red-600" },
	{ key: "uk garage" as const, label: "UK Garage", color: "bg-blue-500" },
	{ key: "bouyon" as const, label: "Bouyon", color: "bg-emerald-600" },
	{ key: "zouk" as const, label: "Zouk", color: "bg-rose-500" },
	{
		key: "coupé-décalé" as const,
		label: "Coupé-Décalé",
		color: "bg-yellow-600",
	},
	{ key: "urban fr" as const, label: "Urban FR", color: "bg-indigo-600" },
	{ key: "kompa" as const, label: "Kompa", color: "bg-pink-600" },
	{ key: "afro" as const, label: "Afro", color: "bg-orange-400" },
	{ key: "gqom" as const, label: "Gqom", color: "bg-purple-400" },
	{ key: "alternative" as const, label: "Alternative", color: "bg-stone-500" },
	{ key: "dance" as const, label: "Dance", color: "bg-sky-500" },
	{ key: "other" as const, label: "Other", color: "bg-gray-500" },
] as const;

export const EVENT_TYPES = [
	{ key: "After Party" as const, label: "After Party", icon: "🌃" },
	{ key: "Day Party" as const, label: "Day Party", icon: "☀️" },
] as const;

export const NATIONALITIES = [
	{ key: "CA" as const, label: "Canada", flag: "🇨🇦", shortCode: "CA" },
	{ key: "FR" as const, label: "France", flag: "🇫🇷", shortCode: "FR" },
	{ key: "UK" as const, label: "United Kingdom", flag: "🇬🇧", shortCode: "GB" },
] as const;

export const PARIS_ARRONDISSEMENTS = [
	{
		id: 1 as ParisArrondissement,
		name: "1er - Louvre",
		coordinates: { lat: 48.8606, lng: 2.3376 },
	},
	{
		id: 2 as ParisArrondissement,
		name: "2e - Bourse",
		coordinates: { lat: 48.8677, lng: 2.3414 },
	},
	{
		id: 3 as ParisArrondissement,
		name: "3e - Temple",
		coordinates: { lat: 48.8644, lng: 2.3615 },
	},
	{
		id: 4 as ParisArrondissement,
		name: "4e - Hôtel-de-Ville",
		coordinates: { lat: 48.8551, lng: 2.3618 },
	},
	{
		id: 5 as ParisArrondissement,
		name: "5e - Panthéon",
		coordinates: { lat: 48.8462, lng: 2.3518 },
	},
	{
		id: 6 as ParisArrondissement,
		name: "6e - Luxembourg",
		coordinates: { lat: 48.8496, lng: 2.3344 },
	},
	{
		id: 7 as ParisArrondissement,
		name: "7e - Palais-Bourbon",
		coordinates: { lat: 48.8566, lng: 2.3165 },
	},
	{
		id: 8 as ParisArrondissement,
		name: "8e - Élysée",
		coordinates: { lat: 48.8736, lng: 2.3111 },
	},
	{
		id: 9 as ParisArrondissement,
		name: "9e - Opéra",
		coordinates: { lat: 48.8785, lng: 2.3373 },
	},
	{
		id: 10 as ParisArrondissement,
		name: "10e - Entrepôt",
		coordinates: { lat: 48.876, lng: 2.359 },
	},
	{
		id: 11 as ParisArrondissement,
		name: "11e - Popincourt",
		coordinates: { lat: 48.8594, lng: 2.3765 },
	},
	{
		id: 12 as ParisArrondissement,
		name: "12e - Reuilly",
		coordinates: { lat: 48.8448, lng: 2.389 },
	},
	{
		id: 13 as ParisArrondissement,
		name: "13e - Gobelins",
		coordinates: { lat: 48.8322, lng: 2.3647 },
	},
	{
		id: 14 as ParisArrondissement,
		name: "14e - Observatoire",
		coordinates: { lat: 48.8339, lng: 2.3273 },
	},
	{
		id: 15 as ParisArrondissement,
		name: "15e - Vaugirard",
		coordinates: { lat: 48.8422, lng: 2.2966 },
	},
	{
		id: 16 as ParisArrondissement,
		name: "16e - Passy",
		coordinates: { lat: 48.8555, lng: 2.269 },
	},
	{
		id: 17 as ParisArrondissement,
		name: "17e - Batignolles-Monceau",
		coordinates: { lat: 48.8848, lng: 2.312 },
	},
	{
		id: 18 as ParisArrondissement,
		name: "18e - Butte-Montmartre",
		coordinates: { lat: 48.8927, lng: 2.3436 },
	},
	{
		id: 19 as ParisArrondissement,
		name: "19e - Buttes-Chaumont",
		coordinates: { lat: 48.8799, lng: 2.3781 },
	},
	{
		id: 20 as ParisArrondissement,
		name: "20e - Ménilmontant",
		coordinates: { lat: 48.8632, lng: 2.3969 },
	},
	{
		id: "unknown" as ParisArrondissement,
		name: "Unknown - Location TBC",
		coordinates: { lat: 48.84, lng: 2.42 },
	},
];

// Price range constants for the slider
export const PRICE_RANGE_CONFIG = {
	min: 0,
	max: 150,
	step: 1,
	defaultRange: [0, 150] as [number, number],
} as const;

// Age range constants for the slider
export const AGE_RANGE_CONFIG = {
	min: 18,
	max: 25,
	step: 1,
	defaultRange: [18, 25] as [number, number],
} as const;

// Age range type for filtering
export type AgeRange = [number, number];

// Utility functions for time-based classification
export const getDayNightPeriod = (time: string): DayNightPeriod | null => {
	if (!time || time === "TBC") return null;

	const [hours] = time.split(":").map(Number);

	// Day: 6:00 AM (06:00) - 9:59 PM (21:59)
	// Night: 10:00 PM (22:00) - 5:59 AM (05:59)
	if (hours >= 6 && hours <= 21) {
		return "day";
	} else {
		return "night";
	}
};

export const isEventInDayNightPeriod = (
	event: Event,
	period: DayNightPeriod,
): boolean => {
	const eventPeriod = getDayNightPeriod(event.time || "");
	return eventPeriod === period;
};

export const formatTimeWithPeriod = (time: string): string => {
	if (!time || time === "TBC") return time;

	const period = getDayNightPeriod(time);
	const periodEmoji = period === "day" ? "☀️" : "🌙";

	return `${time} ${periodEmoji}`;
};

// Utility functions for price handling
export const parsePrice = (priceStr?: string): number | null => {
	if (!priceStr) return null;

	const cleanPrice = priceStr.toLowerCase().trim();

	// Handle free cases
	if (
		cleanPrice === "free" ||
		cleanPrice === "0" ||
		cleanPrice === "0€" ||
		cleanPrice === "£0"
	) {
		return 0;
	}

	// Extract numbers from price string, handle both € and £
	const priceMatch = cleanPrice.match(/(\d+(?:\.\d+)?)/);
	if (!priceMatch) return null;

	const numericPrice = parseFloat(priceMatch[1]);

	// Convert pounds to euros (approximate rate: 1 GBP = 1.17 EUR)
	if (
		cleanPrice.includes("£") ||
		cleanPrice.includes("gbp") ||
		cleanPrice.includes("pound")
	) {
		return numericPrice * 1.17;
	}

	return numericPrice;
};

export const formatPrice = (priceStr?: string): string => {
	if (!priceStr) return "TBA";

	const cleanPrice = priceStr.toLowerCase().trim();

	// Handle free cases
	if (
		cleanPrice === "free" ||
		cleanPrice === "0" ||
		cleanPrice === "0€" ||
		cleanPrice === "£0"
	) {
		return "Free";
	}

	// Return original format if it already looks formatted
	if (priceStr.includes("€") || priceStr.includes("£")) {
		return priceStr;
	}

	// Try to parse and format
	const numericPrice = parsePrice(priceStr);
	if (numericPrice === null) return priceStr;
	if (numericPrice === 0) return "Free";

	return `€${numericPrice.toFixed(0)}`;
};

export const isPriceInRange = (
	priceStr: string | undefined,
	priceRange: [number, number],
): boolean => {
	const numericPrice = parsePrice(priceStr);
	if (numericPrice === null) return false;

	const [min, max] = priceRange;
	return numericPrice >= min && numericPrice <= max;
};

export const formatPriceRange = (range: [number, number]): string => {
	const [min, max] = range;

	if (min === 0 && max === 0) return "Free only";
	if (min === 0) return `Free - €${max}`;
	if (max >= PRICE_RANGE_CONFIG.max) return `€${min}+`;

	return `€${min} - €${max}`;
};

// Utility functions for age handling
export const parseAge = (ageStr?: string): number | null => {
	if (!ageStr) return null;

	const cleanAge = ageStr.toLowerCase().trim();

	// Handle common age formats
	if (cleanAge === "all ages" || cleanAge === "0+") return 0;
	if (cleanAge === "18+" || cleanAge === "18") return 18;
	if (cleanAge === "21+" || cleanAge === "21") return 21;
	if (cleanAge === "25+" || cleanAge === "25") return 25;

	// Extract numbers from age string
	const ageMatch = cleanAge.match(/(\d+)/);
	if (!ageMatch) return null;

	return parseInt(ageMatch[1], 10);
};

export const formatAge = (ageStr?: string): string => {
	if (!ageStr) return "All ages";

	const cleanAge = ageStr.toLowerCase().trim();

	// Handle common formats
	if (cleanAge === "all ages" || cleanAge === "0+" || cleanAge === "0")
		return "All ages";
	if (cleanAge.includes("+")) return ageStr;

	// Try to parse and format
	const numericAge = parseAge(ageStr);
	if (numericAge === null) return ageStr;
	if (numericAge === 0) return "All ages";

	return `${numericAge}+`;
};

export const isAgeInRange = (
	ageStr: string | undefined,
	ageRange: [number, number],
): boolean => {
	const numericAge = parseAge(ageStr);
	if (numericAge === null) return false; // Unknown age, exclude when filtering
	if (numericAge === 0) return ageRange[0] <= 18; // All ages events included if range includes 18 or less

	const [min, max] = ageRange;
	return numericAge >= min && numericAge <= max;
};

export const formatAgeRange = (range: [number, number]): string => {
	const [min, max] = range;

	if (min === AGE_RANGE_CONFIG.min && max === AGE_RANGE_CONFIG.max) {
		return "All ages";
	}

	if (min === 18 && max === 25) return "18-25";
	if (max >= AGE_RANGE_CONFIG.max) return `${min}+`;

	return `${min}-${max}`;
};

// Utility function to format venue type icons
export const formatVenueTypeIcons = (event: Event): string => {
	if (!event.venueTypes || event.venueTypes.length === 0) {
		// Fallback to legacy indoor field
		return event.indoor ? "🏢" : "🌤️";
	}

	// Map venue types to icons
	const icons = event.venueTypes.map((venueType) => {
		const venueInfo = VENUE_TYPES.find((v) => v.key === venueType);
		return venueInfo?.icon || (venueType === "indoor" ? "🏢" : "🌤️");
	});

	// Remove duplicates and join
	const uniqueIcons = [...new Set(icons)];
	return uniqueIcons.join("");
};

// Utility function to format day with date number
export const formatDayWithDate = (day: EventDay, isoDate: string): string => {
	if (day === "tbc") return "TBC";

	// Extract day number from ISO date (YYYY-MM-DD)
	const dayNumber = parseInt(isoDate.split("-")[2], 10);

	// Add ordinal suffix (st, nd, rd, th)
	const getOrdinalSuffix = (num: number): string => {
		const lastDigit = num % 10;
		const lastTwoDigits = num % 100;

		// Special cases for 11th, 12th, 13th
		if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
			return "th";
		}

		// Regular cases
		switch (lastDigit) {
			case 1:
				return "st";
			case 2:
				return "nd";
			case 3:
				return "rd";
			default:
				return "th";
		}
	};

	// Capitalize first letter of day
	const capitalizedDay = day.charAt(0).toUpperCase() + day.slice(1);

	return `${capitalizedDay} ${dayNumber}${getOrdinalSuffix(dayNumber)}`;
};

export const VENUE_TYPES = [
	{ key: "indoor" as const, label: "Indoor", icon: "🏢" },
	{ key: "outdoor" as const, label: "Outdoor", icon: "🌤️" },
] as const;
