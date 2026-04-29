// Strict type definitions for enhanced event categorization
import type { LocationResolution } from "@/features/locations/types";
import {
	COUNTRY_CODES,
	COUNTRY_OPTIONS,
	type CountryOption,
} from "./countries";

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

export type EventType = "Pre-Fete" | "Fete" | "Post-Fete";

// Host/audience country codes supported by ingestion/filtering.
export const SUPPORTED_NATIONALITY_CODES = COUNTRY_CODES;
export type Nationality = string;

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
	source: "manual" | "geocoded" | "estimated" | "estimated_arrondissement";
	precision?: LocationResolution["precision"];
	formattedAddress?: string;
	provider?: string;
	providerPlaceId?: string;
	query?: string;
	lastUpdated: string; // ISO timestamp
};

export type MusicGenre = string;

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
	| "greater-paris"
	| "outside-paris"
	| "unknown";

export const NON_PARIS_AREA_VALUES = [
	"greater-paris",
	"outside-paris",
	"unknown",
] as const satisfies ParisArrondissement[];

export const isNumberedArrondissement = (
	value: ParisArrondissement,
): value is Exclude<ParisArrondissement, string> =>
	typeof value === "number" && value >= 1 && value <= 20;

export const formatLocationAreaShort = (
	value: ParisArrondissement,
): string => {
	if (value === "greater-paris") return "Greater Paris";
	if (value === "outside-paris") return "Outside Paris";
	if (value === "unknown") return "TBC";
	return `${value}e`;
};

export const formatLocationAreaLong = (
	value: ParisArrondissement,
): string => {
	if (value === "greater-paris") return "Greater Paris Area";
	if (value === "outside-paris") return "Outside Paris";
	if (value === "unknown") return "Location TBC";
	return `${value}e Arrondissement`;
};

export const getLocationAreaSortValue = (
	value: ParisArrondissement,
): number => {
	if (typeof value === "number") return value;
	if (value === "greater-paris") return 21;
	if (value === "outside-paris") return 22;
	return 23;
};

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
	eventKey: string;
	slug: string;
	id: string;
	name: string;
	day: EventDay;
	date: string; // ISO date string (YYYY-MM-DD); can be empty when source date is invalid/unparseable
	time?: string; // 24-hour format (HH:MM) or 'TBC'
	endTime?: string; // 24-hour format (HH:MM) or 'TBC'
	arrondissement: ParisArrondissement;
	location?: string;
	coordinates?: Coordinates; // Event-specific coordinates from geocoding or manual entry
	locationResolution?: LocationResolution; // Optional trusted/approximate location enrichment
	link: string;
	links?: string[]; // All ticket links, if multiple
	description?: string;
	type: EventType; // Festival phase label derived from date
	genre: MusicGenre[];
	tags?: string[]; // Metadata tags parsed from the CSV Tags column
	venueTypes: VenueType[]; // New field for venue types
	indoor: boolean; // Deprecated: kept for backwards compatibility
	verified: boolean;
	price?: string; // Price information from CSV
	age?: string; // Age restrictions from CSV
	isOOOCPick?: boolean; // 🌟 indicator from CSV
	isFeatured?: boolean; // Manual override for featured events in preview section
	featuredAt?: string; // ISO timestamp when event was featured (e.g., "2024-01-20T14:30:00Z")
	featuredEndsAt?: string; // ISO timestamp when featured window ends (scheduler projection)
	isPromoted?: boolean; // Indicates promoted listing projection is active
	promotedAt?: string; // ISO timestamp when promoted window starts
	promotedEndsAt?: string; // ISO timestamp when promoted window ends
	socialProofSaveCount?: number; // Public social proof count from recent, session-deduped calendar sync actions
	nationality?: Nationality[]; // GB/FR indicators from CSV - now supports multiple
	// Legacy field for backwards compatibility
	category?: EventCategory;
};

// CSV data type matching the structure in ooc_list_tracker.csv
export type CSVEventRow = {
	eventKey: string;
	curated: string; // "🌟" or empty
	hostCountry: string; // Country flags/codes/text (for example "🇬🇧", "🇫🇷", "GB/FR")
	audienceCountry: string; // Audience country flags/codes/text
	title: string;
	date: string;
	startTime: string;
	endTime: string;
	location: string;
	districtArea: string; // District/Area column
	categories: string; // Comma-separated genres/categories
	tags: string; // Comma-separated metadata tags
	price: string;
	primaryUrl: string;
	ageGuidance: string;
	setting: string;
	notes: string;
	verified?: string;
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

export interface MusicGenreDefinition {
	key: MusicGenre;
	label: string;
	color: string;
	isDefault?: boolean;
	isActive?: boolean;
	sortOrder?: number;
	aliases?: string[];
}

export const MUSIC_GENRES = [
	{ key: "amapiano" as const, label: "Amapiano", color: "bg-emerald-500" },
	{ key: "afrobeats" as const, label: "Afrobeats", color: "bg-orange-500" },
	{ key: "afrotrap" as const, label: "Afrotrap", color: "bg-orange-700" },
	{
		key: "francophone" as const,
		label: "Francophone",
		color: "bg-amber-600",
	},
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
	{ key: "slow jams" as const, label: "Slow Jams", color: "bg-rose-600" },
	{ key: "3-step" as const, label: "3-Step", color: "bg-cyan-600" },
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
	{ key: "bachata" as const, label: "Bachata", color: "bg-pink-400" },
	{ key: "batida" as const, label: "Batida", color: "bg-teal-600" },
	{ key: "edits" as const, label: "Edits", color: "bg-slate-500" },
	{ key: "reggae" as const, label: "Reggae", color: "bg-lime-600" },
	{ key: "salsa" as const, label: "Salsa", color: "bg-red-400" },
	{ key: "other" as const, label: "Other", color: "bg-gray-500" },
] as const;

export const EVENT_TYPES = [
	{ key: "Pre-Fete" as const, label: "Pre-Fete", icon: "⬅️" },
	{ key: "Fete" as const, label: "Fete", icon: "🎶" },
	{ key: "Post-Fete" as const, label: "Post-Fete", icon: "➡️" },
] as const;

export const NATIONALITIES = COUNTRY_OPTIONS.map((country: CountryOption) => ({
	key: country.code,
	label: country.label,
	flag: country.flag,
	shortCode: country.code,
})) as Array<{
	key: Nationality;
	label: string;
	flag: string;
	shortCode: string;
}>;

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

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const getEventTypeForDate = (date: string): EventType => {
	if (!ISO_DATE_PATTERN.test(date)) {
		return "Fete";
	}

	const [year] = date.split("-");
	const feteDate = `${year}-06-21`;

	if (date < feteDate) {
		return "Pre-Fete";
	}

	if (date > feteDate) {
		return "Post-Fete";
	}

	return "Fete";
};

export const getVisibleEventTypeLabel = (type: EventType): string | null =>
	type === "Fete" ? null : type;

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
const FREE_PRICE_PATTERNS = [
	/\bfree\b/i,
	/\bgratuit\b/i,
	/\bgratis\b/i,
	/\bno\s*fee\b/i,
	/\bfree\s*entry\b/i,
] as const;

const normalizeNumericToken = (raw: string): string => {
	const token = raw.replace(/\s+/g, "");
	const hasComma = token.includes(",");
	const hasDot = token.includes(".");

	if (hasComma && hasDot) {
		const lastComma = token.lastIndexOf(",");
		const lastDot = token.lastIndexOf(".");
		if (lastComma > lastDot) {
			return token.replace(/\./g, "").replace(/,/g, ".");
		}
		return token.replace(/,/g, "");
	}

	if (hasComma) {
		if (/,\d{1,2}$/.test(token)) {
			return token.replace(/,/g, ".");
		}
		return token.replace(/,/g, "");
	}

	if (hasDot) {
		if (/\.\d{1,2}$/.test(token)) {
			return token;
		}
		return token.replace(/\./g, "");
	}

	return token;
};

const extractNumericCandidates = (cleanPrice: string): number[] => {
	const matches = cleanPrice.match(/\d[\d\s.,]*/g) ?? [];
	const parsed: number[] = [];

	for (const match of matches) {
		const normalized = normalizeNumericToken(match);
		const value = Number.parseFloat(normalized);
		if (Number.isFinite(value)) {
			parsed.push(value);
		}
	}

	return parsed;
};

const formatEuroAmount = (amount: number): string =>
	Number.isInteger(amount) ? `€${amount}` : `€${amount.toFixed(2)}`;

const DEFAULT_GBP_TO_EUR_RATE = 1.154;
const DEFAULT_USD_TO_EUR_RATE = 0.854;

const parseConversionRate = (
	rawValue: string | undefined,
	fallback: number,
): number => {
	const value = Number.parseFloat(rawValue ?? "");
	return Number.isFinite(value) && value > 0 ? value : fallback;
};

const getPriceConversionRates = () => ({
	gbpToEur: parseConversionRate(
		process.env.NEXT_PUBLIC_PRICE_RATE_GBP_TO_EUR,
		DEFAULT_GBP_TO_EUR_RATE,
	),
	usdToEur: parseConversionRate(
		process.env.NEXT_PUBLIC_PRICE_RATE_USD_TO_EUR,
		DEFAULT_USD_TO_EUR_RATE,
	),
});

const hasGbpMarker = (cleanPrice: string): boolean =>
	cleanPrice.includes("£") || /\bgbp\b|\bpounds?\b/.test(cleanPrice);

const hasUsdMarker = (cleanPrice: string): boolean =>
	cleanPrice.includes("$") || /\busd\b|\bdollars?\b/.test(cleanPrice);

const hasEurMarker = (cleanPrice: string): boolean =>
	cleanPrice.includes("€") || /\beur\b|\beuros?\b/.test(cleanPrice);

const hasCurrencyMarker = (cleanPrice: string): boolean =>
	hasGbpMarker(cleanPrice) || hasUsdMarker(cleanPrice) || hasEurMarker(cleanPrice);

const toEuroAmount = (amount: number, cleanPrice: string): number => {
	const rates = getPriceConversionRates();
	if (hasGbpMarker(cleanPrice)) {
		return amount * rates.gbpToEur;
	}
	if (hasUsdMarker(cleanPrice)) {
		return amount * rates.usdToEur;
	}
	return amount;
};

export const parsePrice = (priceStr?: string): number | null => {
	if (!priceStr) return null;

	const cleanPrice = priceStr.toLowerCase().trim();

	// Handle free cases
	if (FREE_PRICE_PATTERNS.some((pattern) => pattern.test(cleanPrice))) {
		return 0;
	}
	if (cleanPrice === "0" || cleanPrice === "0€" || cleanPrice === "£0")
		return 0;

	const candidates = extractNumericCandidates(cleanPrice);
	if (candidates.length === 0) return null;

	// Use the minimum candidate so ranges like "€10-€15" filter from the entry price.
	const numericPrice = Math.min(...candidates);

	return toEuroAmount(numericPrice, cleanPrice);
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

	// Return original format if it already includes an explicit currency marker.
	if (hasCurrencyMarker(cleanPrice)) {
		return priceStr;
	}

	const candidates = extractNumericCandidates(cleanPrice);
	if (candidates.length > 1) {
		const minPrice = Math.min(...candidates);
		const maxPrice = Math.max(...candidates);
		if (minPrice !== maxPrice) {
			return `${formatEuroAmount(minPrice)} - ${formatEuroAmount(maxPrice)}`;
		}
	}

	// Try to parse and format
	const numericPrice = parsePrice(priceStr);
	if (numericPrice === null) return priceStr;
	if (numericPrice === 0) return "Free";

	return formatEuroAmount(numericPrice);
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
	const trimmedDate = isoDate.trim();
	const isoMatch = trimmedDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!isoMatch) {
		return day.charAt(0).toUpperCase() + day.slice(1);
	}

	// Extract day number from ISO date (YYYY-MM-DD)
	const dayNumber = Number.parseInt(isoMatch[3], 10);
	if (!Number.isInteger(dayNumber)) {
		return day.charAt(0).toUpperCase() + day.slice(1);
	}

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
