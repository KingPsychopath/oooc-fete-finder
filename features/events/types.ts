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
export type EventTemporalPeriod =
	| DayNightPeriod
	| "evening"
	| "overnight"
	| "unknown";

export type EventType = "Pre-Fete" | "Fete" | "Post-Fete";
export type EventExperienceCategory =
	| "party"
	| "activity"
	| "culture"
	| "food"
	| "wellness";

export interface EventExperienceCategoryDefinition {
	key: EventExperienceCategory;
	label: string;
	description: string;
	color: string;
}

export const EVENT_EXPERIENCE_CATEGORIES = [
	{
		key: "party",
		label: "Party",
		description: "Dance, club, day party, afterparty, or social event",
		color:
			"border-amber-500/20 bg-muted/45 text-amber-900/75 dark:text-amber-100/80",
	},
	{
		key: "activity",
		label: "Activity",
		description: "Things to do with a planned activity or group experience",
		color: "border-sky-500/18 bg-muted/45 text-sky-900/75 dark:text-sky-100/80",
	},
	{
		key: "culture",
		label: "Culture",
		description:
			"Art, fashion, performance, talks, screenings, exhibitions, or culture",
		color:
			"border-violet-500/18 bg-muted/45 text-violet-900/75 dark:text-violet-100/80",
	},
	{
		key: "food",
		label: "Food",
		description: "Food, drink, dining, tasting, brunch, or supper-club events",
		color:
			"border-emerald-500/18 bg-muted/45 text-emerald-900/75 dark:text-emerald-100/80",
	},
	{
		key: "wellness",
		label: "Wellness",
		description: "Movement, fitness, rest, health, or wellbeing-led events",
		color:
			"border-teal-500/18 bg-muted/45 text-teal-900/75 dark:text-teal-100/80",
	},
] as const satisfies readonly EventExperienceCategoryDefinition[];

const EVENT_EXPERIENCE_CATEGORY_KEYS = new Set<EventExperienceCategory>(
	EVENT_EXPERIENCE_CATEGORIES.map((category) => category.key),
);
const PARTY_EVENT_TYPE_OPTIONS = new Set(["prefete", "fete", "postfete"]);
const normalizeEventTypeToken = (value: string | null | undefined): string =>
	value
		?.trim()
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[\s_-]/g, "") ?? "";

export const isPartyEventType = (
	type: EventType | string | null | undefined,
): boolean => PARTY_EVENT_TYPE_OPTIONS.has(normalizeEventTypeToken(type));

export const getPartyEventTypeLabel = (
	type: EventType | string | null | undefined,
): string | null => {
	const normalized = normalizeEventTypeToken(type);
	if (!PARTY_EVENT_TYPE_OPTIONS.has(normalized)) return null;

	return normalized === "prefete"
		? "Pre-Fete"
		: normalized === "postfete"
			? "Post-Fete"
			: "Fête";
};

export const getResolvedEventExperienceCategoryDefinition = (
	event: Pick<Event, "type" | "eventCategory" | "category">,
): EventExperienceCategoryDefinition | null =>
	getEventExperienceCategoryDefinition(event.eventCategory) ??
	getEventExperienceCategoryDefinition(event.category) ??
	(isPartyEventType(event.type)
		? getEventExperienceCategoryDefinition("party")
		: null);

const EVENT_EXPERIENCE_CATEGORY_ALIASES: Record<
	string,
	EventExperienceCategory
> = {
	parties: "party",
	"club-night": "party",
	clubnight: "party",
	nightlife: "party",
	social: "party",
	event: "party",
	events: "party",
	activities: "activity",
	experience: "activity",
	experiences: "activity",
	"things-to-do": "activity",
	cultural: "culture",
	arts: "culture",
	art: "culture",
	fashion: "culture",
	"fashion-show": "culture",
	exhibition: "culture",
	performance: "culture",
	screening: "culture",
	talk: "culture",
	"food-drink": "food",
	"food-and-drink": "food",
	drinks: "food",
	dining: "food",
	brunch: "food",
	wellbeing: "wellness",
	fitness: "wellness",
	movement: "wellness",
	health: "wellness",
};

const normalizeEventExperienceCategoryToken = (value: string): string =>
	value
		.trim()
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/&/g, " and ")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");

export const normalizeEventExperienceCategory = (
	value: string | null | undefined,
): EventExperienceCategory | null => {
	if (!value) return null;
	const normalized = normalizeEventExperienceCategoryToken(value);
	if (!normalized) return null;
	if (
		EVENT_EXPERIENCE_CATEGORY_KEYS.has(normalized as EventExperienceCategory)
	) {
		return normalized as EventExperienceCategory;
	}
	return EVENT_EXPERIENCE_CATEGORY_ALIASES[normalized] ?? null;
};

const normalizeEventExperienceCategoryInput = (
	category: EventExperienceCategory | string | null | undefined,
): EventExperienceCategory | null =>
	category == null
		? null
		: (normalizeEventExperienceCategory(category.toString()) ??
			(EVENT_EXPERIENCE_CATEGORY_KEYS.has(category as EventExperienceCategory)
				? (category as EventExperienceCategory)
				: null));

export const getEventExperienceCategoryDefinition = (
	category: EventExperienceCategory | string | null | undefined,
): EventExperienceCategoryDefinition | null => {
	const normalizedCategory = normalizeEventExperienceCategoryInput(category);
	if (!normalizedCategory) return null;
	return (
		EVENT_EXPERIENCE_CATEGORIES.find(
			(option) => option.key === normalizedCategory,
		) ?? null
	);
};

export const formatEventExperienceCategory = (
	category: EventExperienceCategory | string | null | undefined,
): string => getEventExperienceCategoryDefinition(category)?.label ?? "";

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
	address?: string;
	postalCode?: string;
	city?: string;
	countryCode?: string;
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

export type EventLocationEntry = {
	name: string;
	arrondissement?: ParisArrondissement;
	address?: string;
	postalCode?: string;
	city?: string;
	countryCode?: string;
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
	| "multiple-locations"
	| "unknown";

export const NON_PARIS_AREA_VALUES = [
	"greater-paris",
	"outside-paris",
	"multiple-locations",
	"unknown",
] as const satisfies ParisArrondissement[];

export const isNumberedArrondissement = (
	value: ParisArrondissement,
): value is Exclude<ParisArrondissement, string> =>
	typeof value === "number" && value >= 1 && value <= 20;

export const formatLocationAreaShort = (value: ParisArrondissement): string => {
	if (value === "greater-paris") return "Greater Paris";
	if (value === "outside-paris") return "Outside Paris";
	if (value === "multiple-locations") return "Multiple";
	if (value === "unknown") return "TBC";
	return `${value}e`;
};

export const formatLocationAreaLong = (value: ParisArrondissement): string => {
	if (value === "greater-paris") return "Greater Paris Area";
	if (value === "outside-paris") return "Outside Paris";
	if (value === "multiple-locations") return "Multiple Locations";
	if (value === "unknown") return "Location TBC";
	return `${value}e Arrondissement`;
};

export const getLocationAreaSortValue = (
	value: ParisArrondissement,
): number => {
	if (typeof value === "number") return value;
	if (value === "greater-paris") return 21;
	if (value === "outside-paris") return 22;
	if (value === "multiple-locations") return 23;
	return 24;
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
	seriesKey?: string;
	sourceEventKey?: string;
	occurrenceIndex?: number;
	occurrenceCount?: number;
	dateRangeStart?: string;
	dateRangeEnd?: string;
	slug: string;
	id: string;
	name: string;
	day: EventDay;
	date: string; // ISO date string (YYYY-MM-DD); can be empty when source date is invalid/unparseable
	time?: string; // 24-hour format (HH:MM) or 'TBC'
	endTime?: string; // 24-hour format (HH:MM) or 'TBC'
	arrondissement: ParisArrondissement;
	location?: string;
	locationAddress?: string;
	postalCode?: string;
	city?: string;
	countryCode?: string;
	locations?: string[];
	locationEntries?: EventLocationEntry[];
	coordinates?: Coordinates; // Event-specific coordinates from geocoding or manual entry
	locationResolution?: LocationResolution; // Optional trusted/approximate location enrichment
	link: string;
	links?: string[]; // All ticket links, if multiple
	description?: string;
	type: EventType; // Festival phase label derived from date
	eventCategory?: EventExperienceCategory; // Descriptive category such as party/activity/culture
	genre: MusicGenre[];
	tags?: string[]; // Metadata tags parsed from the CSV Tags column
	venueTypes: VenueType[]; // New field for venue types
	indoor: boolean; // Deprecated: kept for backwards compatibility
	detailsQuality?: "complete" | "review" | "blocking";
	detailsQualitySource?: "inferred" | "manual";
	sourceConfirmed?: boolean;
	price?: string; // Price information from CSV
	age?: string; // Age restrictions from CSV
	isOOOCPick?: boolean; // 🌟 indicator from CSV
	isFeatured?: boolean; // Manual override for featured events in preview section
	featuredAt?: string; // ISO timestamp when event was featured (e.g., "2024-01-20T14:30:00Z")
	featuredEndsAt?: string; // ISO timestamp when featured window ends (scheduler projection)
	isPromoted?: boolean; // Indicates promoted listing projection is active
	promotedAt?: string; // ISO timestamp when promoted window starts
	promotedEndsAt?: string; // ISO timestamp when promoted window ends
	firstSeenAt?: string; // ISO timestamp when this app first saw the event in the managed store
	lastMeaningfulChangeAt?: string; // ISO timestamp when public event details last changed in the managed store
	socialProofSaveCount?: number; // Public numeric proof count from fresh, deduped save/calendar actions
	socialProofHistoricalSaveCount?: number; // Generic proof fallback count from the broader historical save window
	ticketExchangeSellingCount?: number; // Active Ticket Exchange listings from people selling for this event
	ticketExchangeLookingCount?: number; // Active Ticket Exchange listings from people looking for this event
	ticketExchangeLatestListingAt?: string | null; // Most recent active Ticket Exchange listing timestamp
	nationality?: Nationality[]; // GB/FR indicators from CSV - now supports multiple
	hostCountries?: Nationality[]; // Host Country column, kept separate for detail views
	audienceCountries?: Nationality[]; // Audience Country column, kept separate for detail views
	// Legacy field for backwards compatibility
	category?: EventCategory;
};

export type EventLocationDisplayState =
	| "single"
	| "multiple-listed"
	| "multiple-unlisted"
	| "tbc";

export type EventLocationDisplay = {
	state: EventLocationDisplayState;
	areaShortLabel: string;
	areaLongLabel: string;
	sectionLabel: string;
	cardLabel?: string;
	modalLabel: string;
	listedLocations: string[];
	listedLocationEntries: EventLocationEntry[];
	singleLocation?: string;
	canOpenSingleLocation: boolean;
	canOpenAnyLocation: boolean;
};

export const isLocationTbcValue = (value: string | undefined): boolean => {
	if (!value) return true;
	const normalized = value.trim().toLowerCase();
	return (
		normalized === "" ||
		normalized === "tba" ||
		normalized === "tbc" ||
		normalized === "location tba" ||
		normalized === "location tbc"
	);
};

export const isMultipleLocationPlaceholderValue = (
	value: string | undefined,
): boolean => value?.trim().toLowerCase() === "multiple locations";

export const getEventLocationDisplay = (
	event: Pick<
		Event,
		"arrondissement" | "location" | "locations" | "locationEntries"
	>,
): EventLocationDisplay => {
	const rawListedLocations = (event.locations ?? [])
		.map((location) => location.trim())
		.filter(Boolean);
	const explicitLocationEntries: EventLocationEntry[] =
		"locationEntries" in event && event.locationEntries
			? event.locationEntries
					.map((entry) => ({
						...entry,
						name: entry.name.trim(),
					}))
					.filter((entry) => entry.name.length > 0)
			: [];
	const listedLocationEntries: EventLocationEntry[] =
		explicitLocationEntries.length > 0
			? explicitLocationEntries
			: rawListedLocations.map((name) => ({ name }));
	const listedLocations = listedLocationEntries.map((entry) => entry.name);
	const hasListedLocations = listedLocationEntries.length > 1;
	const singleListedLocation = listedLocationEntries[0];
	const isMultipleLocation =
		event.arrondissement === "multiple-locations" ||
		isMultipleLocationPlaceholderValue(event.location) ||
		hasListedLocations;

	if (hasListedLocations) {
		return {
			state: "multiple-listed",
			areaShortLabel: "Multi-site",
			areaLongLabel: "Multiple Locations",
			sectionLabel: "Location",
			cardLabel: `${listedLocations.length} locations`,
			modalLabel: `${listedLocations.length} locations listed`,
			listedLocations,
			listedLocationEntries,
			canOpenSingleLocation: false,
			canOpenAnyLocation: true,
		};
	}

	if (singleListedLocation && isMultipleLocation) {
		return {
			state: "single",
			areaShortLabel: singleListedLocation.arrondissement
				? formatLocationAreaShort(singleListedLocation.arrondissement)
				: formatLocationAreaShort(event.arrondissement),
			areaLongLabel: singleListedLocation.arrondissement
				? formatLocationAreaLong(singleListedLocation.arrondissement)
				: formatLocationAreaLong(event.arrondissement),
			sectionLabel: singleListedLocation.arrondissement
				? formatLocationAreaLong(singleListedLocation.arrondissement)
				: formatLocationAreaLong(event.arrondissement),
			cardLabel: singleListedLocation.name,
			modalLabel: singleListedLocation.name,
			listedLocations: [],
			listedLocationEntries: [],
			singleLocation: singleListedLocation.name,
			canOpenSingleLocation: true,
			canOpenAnyLocation: true,
		};
	}

	if (isMultipleLocation) {
		return {
			state: "multiple-unlisted",
			areaShortLabel: "Multi-site",
			areaLongLabel: "Multiple Locations",
			sectionLabel: "Multiple locations",
			modalLabel: "Exact venue list not provided",
			listedLocations: [],
			listedLocationEntries: [],
			canOpenSingleLocation: false,
			canOpenAnyLocation: false,
		};
	}

	if (isLocationTbcValue(event.location)) {
		return {
			state: "tbc",
			areaShortLabel: "TBC",
			areaLongLabel: "Location TBC",
			sectionLabel: "Location",
			modalLabel: "Exact location not announced yet",
			listedLocations: [],
			listedLocationEntries: [],
			canOpenSingleLocation: false,
			canOpenAnyLocation: false,
		};
	}

	const singleLocation = event.location?.trim();

	return {
		state: "single",
		areaShortLabel: formatLocationAreaShort(event.arrondissement),
		areaLongLabel: formatLocationAreaLong(event.arrondissement),
		sectionLabel: formatLocationAreaLong(event.arrondissement),
		cardLabel: singleLocation,
		modalLabel: singleLocation ?? "Location TBC",
		listedLocations: [],
		listedLocationEntries: [],
		singleLocation,
		canOpenSingleLocation: Boolean(singleLocation),
		canOpenAnyLocation: Boolean(singleLocation),
	};
};

export const getEventLocationSearchText = (
	event: Pick<
		Event,
		"arrondissement" | "location" | "locations" | "locationEntries"
	>,
): string =>
	[
		event.location,
		...(event.locations ?? []),
		...(event.locationEntries ?? []).map((entry) => entry.name),
		formatLocationAreaLong(event.arrondissement),
		formatLocationAreaShort(event.arrondissement),
	]
		.filter(Boolean)
		.join(" ");

// CSV data type matching the structure in ooc_list_tracker.csv
export type CSVEventRow = {
	eventKey: string;
	seriesKey?: string; // Stable group key for related range/materialized occurrences
	curated: string; // "🌟" or empty
	eventCategory?: string; // Party, Activity, Culture, Food, Wellness
	hostCountry: string; // Country flags/codes/text (for example "🇬🇧", "🇫🇷", "GB/FR")
	audienceCountry: string; // Audience country flags/codes/text
	title: string;
	date: string;
	dateTo?: string;
	startTime: string;
	endTime: string;
	location: string;
	area: string; // Area column
	categories: string; // Comma-separated genres/categories
	tags: string; // Comma-separated metadata tags
	price: string;
	primaryUrl: string;
	ageGuidance: string;
	setting: string;
	notes: string;
	sourceConfirmed?: string;
	detailsQualityOverride?: string;
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
	eventCategories?: EventExperienceCategory[];
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
		timeRange: "Daytime and early evening",
		icon: "☀️",
	},
	{
		key: "night" as const,
		label: "Night",
		timeRange: "Late starts and events running into the night",
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

const MINUTES_PER_DAY = 24 * 60;
const DAY_START_MINUTES = 6 * 60;
const EVENING_START_MINUTES = 18 * 60;
const NIGHT_START_MINUTES = 21 * 60;
const MEANINGFUL_OVERLAP_MINUTES = 90;

const parseClockTimeMinutes = (time: string | undefined): number | null => {
	if (!time || time.trim().toUpperCase() === "TBC") return null;
	const match = time.trim().match(/^(\d{1,2}):(\d{2})$/);
	if (!match) return null;
	const hours = Number.parseInt(match[1] ?? "", 10);
	const minutes = Number.parseInt(match[2] ?? "", 10);
	if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
	return hours * 60 + minutes;
};

const getOverlapMinutes = (
	startMinutes: number,
	endMinutes: number,
	windowStartMinutes: number,
	windowEndMinutes: number,
): number =>
	Math.max(
		0,
		Math.min(endMinutes, windowEndMinutes) -
			Math.max(startMinutes, windowStartMinutes),
	);

export interface EventTemporalProfile {
	primaryPeriod: EventTemporalPeriod;
	matchesLegacyDay: boolean;
	matchesLegacyNight: boolean;
	crossesMidnight: boolean;
	startMinutes: number | null;
	endMinutes: number | null;
	dayOverlapMinutes: number;
	eveningOverlapMinutes: number;
	nightOverlapMinutes: number;
}

const UNKNOWN_TEMPORAL_PROFILE: EventTemporalProfile = {
	primaryPeriod: "unknown",
	matchesLegacyDay: false,
	matchesLegacyNight: false,
	crossesMidnight: false,
	startMinutes: null,
	endMinutes: null,
	dayOverlapMinutes: 0,
	eveningOverlapMinutes: 0,
	nightOverlapMinutes: 0,
};

// Utility functions for time-based classification
export const getDayNightPeriod = (time: string): DayNightPeriod | null => {
	const startMinutes = parseClockTimeMinutes(time);
	if (startMinutes == null) return null;

	return startMinutes >= DAY_START_MINUTES && startMinutes < NIGHT_START_MINUTES
		? "day"
		: "night";
};

export const getEventTemporalProfile = (
	event: Pick<Event, "time" | "endTime">,
): EventTemporalProfile => {
	const startMinutes = parseClockTimeMinutes(event.time);
	if (startMinutes == null) return UNKNOWN_TEMPORAL_PROFILE;

	const rawEndMinutes = parseClockTimeMinutes(event.endTime);
	const hasDuration = rawEndMinutes != null && rawEndMinutes !== startMinutes;
	const endMinutes =
		rawEndMinutes == null
			? null
			: rawEndMinutes <= startMinutes
				? rawEndMinutes + MINUTES_PER_DAY
				: rawEndMinutes;
	const crossesMidnight = rawEndMinutes != null && rawEndMinutes < startMinutes;

	const intervalEndMinutes = hasDuration
		? (endMinutes ?? startMinutes)
		: startMinutes;
	const dayOverlapMinutes = hasDuration
		? getOverlapMinutes(
				startMinutes,
				intervalEndMinutes,
				DAY_START_MINUTES,
				EVENING_START_MINUTES,
			)
		: 0;
	const eveningOverlapMinutes = hasDuration
		? getOverlapMinutes(
				startMinutes,
				intervalEndMinutes,
				EVENING_START_MINUTES,
				NIGHT_START_MINUTES,
			)
		: 0;
	const nightOverlapMinutes = hasDuration
		? getOverlapMinutes(
				startMinutes,
				intervalEndMinutes,
				0,
				DAY_START_MINUTES,
			) +
			getOverlapMinutes(
				startMinutes,
				intervalEndMinutes,
				NIGHT_START_MINUTES,
				MINUTES_PER_DAY + DAY_START_MINUTES,
			)
		: 0;

	const startsInDay =
		startMinutes >= DAY_START_MINUTES && startMinutes < EVENING_START_MINUTES;
	const startsInEvening =
		startMinutes >= EVENING_START_MINUTES && startMinutes < NIGHT_START_MINUTES;
	const startsInNight =
		startMinutes < DAY_START_MINUTES || startMinutes >= NIGHT_START_MINUTES;
	const eveningRunsIntoNight =
		startsInEvening && endMinutes != null && endMinutes > NIGHT_START_MINUTES;
	const hasMeaningfulNightOverlap =
		nightOverlapMinutes >= MEANINGFUL_OVERLAP_MINUTES;
	const matchesLegacyNight =
		startsInNight ||
		crossesMidnight ||
		eveningRunsIntoNight ||
		hasMeaningfulNightOverlap;
	const matchesLegacyDay =
		startsInDay ||
		(!matchesLegacyNight && startsInEvening) ||
		dayOverlapMinutes >= MEANINGFUL_OVERLAP_MINUTES;

	let primaryPeriod: EventTemporalPeriod;
	if (crossesMidnight) {
		primaryPeriod = "overnight";
	} else if (
		startsInNight ||
		hasMeaningfulNightOverlap ||
		eveningRunsIntoNight
	) {
		primaryPeriod = "night";
	} else if (startsInEvening) {
		primaryPeriod = "evening";
	} else {
		primaryPeriod = "day";
	}

	return {
		primaryPeriod,
		matchesLegacyDay,
		matchesLegacyNight,
		crossesMidnight,
		startMinutes,
		endMinutes: rawEndMinutes,
		dayOverlapMinutes,
		eveningOverlapMinutes,
		nightOverlapMinutes,
	};
};

export const getEventDayNightPeriods = (event: Event): DayNightPeriod[] => {
	const profile = getEventTemporalProfile(event);
	const periods: DayNightPeriod[] = [];
	if (profile.matchesLegacyDay) periods.push("day");
	if (profile.matchesLegacyNight) periods.push("night");
	return periods;
};

export const getEventDisplayDayNightPeriod = (
	event: Event,
	preferredPeriods: DayNightPeriod[] = [],
): DayNightPeriod | null => {
	const profile = getEventTemporalProfile(event);
	const uniquePreferredPeriods = [...new Set(preferredPeriods)];
	if (uniquePreferredPeriods.length === 1) {
		const [period] = uniquePreferredPeriods;
		if (period === "day" && profile.matchesLegacyDay) return "day";
		if (period === "night" && profile.matchesLegacyNight) return "night";
	}
	if (profile.matchesLegacyDay && profile.matchesLegacyNight) {
		const preNightMinutes =
			profile.dayOverlapMinutes + profile.eveningOverlapMinutes;
		return profile.nightOverlapMinutes >= preNightMinutes ? "night" : "day";
	}
	if (profile.matchesLegacyNight) return "night";
	if (profile.matchesLegacyDay) return "day";
	return null;
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
	const profile = getEventTemporalProfile(event);
	return period === "day"
		? profile.matchesLegacyDay
		: profile.matchesLegacyNight;
};

export const formatTimeWithPeriod = (time: string): string => {
	if (!time || time === "TBC") return time;

	const period = getDayNightPeriod(time);
	if (!period) return time;
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

const TRUE_FREE_PRICE_PATTERNS = [
	/^(free|gratuit|gratis|no\s*fee)$/,
	/^(free|gratuit|gratis)\s+(entry|admission)$/,
	/^no\s+ticket\s+needed$/,
	/^0\s*(€|eur|euros?|£|gbp|pounds?|\$|usd|dollars?)?$/,
] as const;

const FREE_OPTION_PATTERNS = [
	/\bfree\s*(rsvp|ticket|entry|admission|before|until|advance|in\s+advance|option|tier)\b/i,
	/\b(rsvp|entry|admission)\s*(is\s*)?free\b/i,
	/\bfree\b.*(?:€|eur|euros?|£|gbp|pounds?|\$|usd|dollars?|\d)/i,
	/(?:€|eur|euros?|£|gbp|pounds?|\$|usd|dollars?|\d).*\bfree\b/i,
] as const;

export type PriceKind = "free" | "free_option" | "paid" | "unknown";

export interface PriceMeta {
	label: string;
	kind: PriceKind;
	minPrice: number | null;
	maxPrice: number | null;
	isConditional: boolean;
	hasFreeOption: boolean;
}

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
	hasGbpMarker(cleanPrice) ||
	hasUsdMarker(cleanPrice) ||
	hasEurMarker(cleanPrice);

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

const hasFreePriceCopy = (cleanPrice: string): boolean =>
	FREE_PRICE_PATTERNS.some((pattern) => pattern.test(cleanPrice));

const isTrueFreePriceCopy = (cleanPrice: string): boolean =>
	TRUE_FREE_PRICE_PATTERNS.some((pattern) => pattern.test(cleanPrice));

const hasFreeOptionPriceCopy = (cleanPrice: string): boolean =>
	FREE_OPTION_PATTERNS.some((pattern) => pattern.test(cleanPrice));

const extractEuroCandidates = (cleanPrice: string): number[] =>
	extractNumericCandidates(cleanPrice).map((candidate) =>
		toEuroAmount(candidate, cleanPrice),
	);

export const getPriceMeta = (priceStr?: string): PriceMeta => {
	if (!priceStr) {
		return {
			label: "TBA",
			kind: "unknown",
			minPrice: null,
			maxPrice: null,
			isConditional: false,
			hasFreeOption: false,
		};
	}

	const cleanPrice = priceStr.toLowerCase().trim();
	const candidates = extractEuroCandidates(cleanPrice);
	const hasFreeCopy = hasFreePriceCopy(cleanPrice);
	const hasTrueFreeCopy = isTrueFreePriceCopy(cleanPrice);
	const hasFreeOptionCopy = hasFreeOptionPriceCopy(cleanPrice);
	const minPaidPrice = candidates.length > 0 ? Math.min(...candidates) : null;
	const maxPaidPrice = candidates.length > 0 ? Math.max(...candidates) : null;

	if (hasTrueFreeCopy && candidates.length === 0) {
		return {
			label: "Free",
			kind: "free",
			minPrice: 0,
			maxPrice: 0,
			isConditional: false,
			hasFreeOption: true,
		};
	}

	if (hasFreeCopy) {
		return {
			label: priceStr,
			kind: "free_option",
			minPrice: 0,
			maxPrice: maxPaidPrice,
			isConditional: !hasTrueFreeCopy || candidates.length > 0,
			hasFreeOption: true,
		};
	}

	if (hasFreeOptionCopy) {
		return {
			label: priceStr,
			kind: "free_option",
			minPrice: 0,
			maxPrice: maxPaidPrice,
			isConditional: true,
			hasFreeOption: true,
		};
	}

	if (minPaidPrice === null) {
		return {
			label: priceStr,
			kind: "unknown",
			minPrice: null,
			maxPrice: null,
			isConditional: false,
			hasFreeOption: false,
		};
	}

	return {
		label: formatPrice(priceStr),
		kind: "paid",
		minPrice: minPaidPrice,
		maxPrice: maxPaidPrice,
		isConditional: candidates.length > 1,
		hasFreeOption: false,
	};
};

export const parsePrice = (priceStr?: string): number | null => {
	if (!priceStr) return null;

	const cleanPrice = priceStr.toLowerCase().trim();

	// Handle free cases
	if (hasFreePriceCopy(cleanPrice)) {
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
	if (isTrueFreePriceCopy(cleanPrice)) {
		return "Free";
	}
	if (hasFreePriceCopy(cleanPrice)) {
		return priceStr;
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
	options?: { includeFreeOptions?: boolean },
): boolean => {
	const priceMeta = getPriceMeta(priceStr);
	if (priceMeta.minPrice === null) return false;

	const [min, max] = priceRange;
	if (min === 0 && max === 0) {
		if (priceMeta.kind === "free") return true;
		return Boolean(
			options?.includeFreeOptions && priceMeta.kind === "free_option",
		);
	}

	return priceMeta.minPrice >= min && priceMeta.minPrice <= max;
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

const parseIsoDateOnly = (isoDate: string | undefined): Date | null => {
	if (!isoDate) return null;
	const trimmedDate = isoDate.trim();
	if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) return null;
	const parsed = new Date(`${trimmedDate}T00:00:00.000Z`);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatRangeDatePart = (
	date: Date,
	options: { includeMonth: boolean; includeYear: boolean },
): string =>
	new Intl.DateTimeFormat("en-GB", {
		day: "numeric",
		month: options.includeMonth ? "short" : undefined,
		year: options.includeYear ? "numeric" : undefined,
		timeZone: "UTC",
	}).format(date);

export const formatEventDateRangeLabel = (event: Event): string | null => {
	if ((event.occurrenceCount ?? 1) <= 1) return null;
	const start = parseIsoDateOnly(event.dateRangeStart);
	const end = parseIsoDateOnly(event.dateRangeEnd);
	if (!start || !end || end.getTime() <= start.getTime()) return null;

	const sameMonth =
		start.getUTCFullYear() === end.getUTCFullYear() &&
		start.getUTCMonth() === end.getUTCMonth();
	const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
	const startLabel = formatRangeDatePart(start, {
		includeMonth: !sameMonth,
		includeYear: !sameYear,
	});
	const endLabel = formatRangeDatePart(end, {
		includeMonth: true,
		includeYear: !sameYear,
	});
	return `${startLabel}-${endLabel}`;
};

export const formatEventOccurrenceLabel = (event: Event): string | null => {
	const count = event.occurrenceCount ?? 1;
	if (count <= 1 || event.occurrenceIndex === undefined) return null;
	return `Day ${event.occurrenceIndex + 1} of ${count}`;
};

export const VENUE_TYPES = [
	{ key: "indoor" as const, label: "Indoor", icon: "🏢" },
	{ key: "outdoor" as const, label: "Outdoor", icon: "🌤️" },
] as const;
