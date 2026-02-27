import {
	AGE_RANGE_CONFIG,
	type AgeRange,
	type DayNightPeriod,
	MUSIC_GENRES,
	type MusicGenre,
	type Nationality,
	PRICE_RANGE_CONFIG,
	type ParisArrondissement,
	SUPPORTED_NATIONALITY_CODES,
	type VenueType,
} from "@/features/events/types";
import { isStrictISODate } from "./date-utils";
import {
	DEFAULT_EVENT_FILTER_STATE,
	type EventFilterState,
	hasActiveFilters,
} from "./filtering";

export const EVENT_FILTER_STORAGE_KEY = "oooc:event-filters:v1";

const FILTER_PARAM_KEYS = [
	"q",
	"df",
	"dt",
	"dn",
	"arr",
	"g",
	"nat",
	"vt",
	"in",
	"pr",
	"ag",
	"pick",
] as const;

const GENRE_KEYS = new Set(MUSIC_GENRES.map((genre) => genre.key));
const NATIONALITY_KEYS = new Set(SUPPORTED_NATIONALITY_CODES);
const DAY_NIGHT_KEYS = new Set<DayNightPeriod>(["day", "night"]);
const VENUE_TYPE_KEYS = new Set<VenueType>(["indoor", "outdoor"]);

const parseCsvParam = (raw: string | null): string[] => {
	if (!raw) return [];
	return raw
		.split(",")
		.map((value) => value.trim())
		.filter((value) => value.length > 0);
};

const parseRange = (raw: string | null): [number, number] | null => {
	if (!raw) return null;
	const [minRaw, maxRaw] = raw.split(":");
	const minValue = Number.parseInt(minRaw ?? "", 10);
	const maxValue = Number.parseInt(maxRaw ?? "", 10);
	if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
		return null;
	}
	const clampedMin = Math.max(0, Math.min(minValue, 500));
	const clampedMax = Math.max(0, Math.min(maxValue, 500));
	const lower = Math.min(clampedMin, clampedMax);
	const upper = Math.max(clampedMin, clampedMax);
	return [lower, upper];
};

const parseArrondissements = (raw: string | null): ParisArrondissement[] => {
	return parseCsvParam(raw)
		.map((value) => value.toLowerCase())
		.map((value): ParisArrondissement | null => {
			if (value === "unknown") return "unknown";
			const parsed = Number.parseInt(value, 10);
			if (!Number.isFinite(parsed)) return null;
			if (parsed < 1 || parsed > 20) return null;
			return parsed as ParisArrondissement;
		})
		.filter((value): value is ParisArrondissement => value != null);
};

export const parseEventFilterStateFromSearchParams = (
	params: URLSearchParams,
): EventFilterState | null => {
	const searchQuery = (params.get("q") ?? "").trim();
	const from = params.get("df")?.trim() ?? null;
	const to = params.get("dt")?.trim() ?? null;
	const dateFrom = from && isStrictISODate(from) ? from : null;
	const dateTo = to && isStrictISODate(to) ? to : null;
	const dayNightPeriods = parseCsvParam(params.get("dn")).filter(
		(value): value is DayNightPeriod =>
			DAY_NIGHT_KEYS.has(value as DayNightPeriod),
	);
	const arrondissements = parseArrondissements(params.get("arr"));
	const genres = parseCsvParam(params.get("g")).filter(
		(value): value is MusicGenre => GENRE_KEYS.has(value as MusicGenre),
	);
	const nationalities = parseCsvParam(params.get("nat"))
		.map((value) => value.toUpperCase())
		.filter((value): value is Nationality =>
			NATIONALITY_KEYS.has(value as Nationality),
		);
	const venueTypes = parseCsvParam(params.get("vt")).filter(
		(value): value is VenueType => VENUE_TYPE_KEYS.has(value as VenueType),
	);

	const indoorParam = (params.get("in") ?? "").trim().toLowerCase();
	const selectedIndoorPreference =
		indoorParam === "indoor" ? true : indoorParam === "outdoor" ? false : null;

	const priceRangeRaw = parseRange(params.get("pr"));
	const selectedPriceRange: [number, number] =
		priceRangeRaw &&
		priceRangeRaw[0] >= PRICE_RANGE_CONFIG.min &&
		priceRangeRaw[1] <= PRICE_RANGE_CONFIG.max
			? priceRangeRaw
			: PRICE_RANGE_CONFIG.defaultRange;

	const ageRangeRaw = parseRange(params.get("ag"));
	const selectedAgeRange: AgeRange | null =
		ageRangeRaw &&
		ageRangeRaw[0] >= AGE_RANGE_CONFIG.min &&
		ageRangeRaw[1] <= AGE_RANGE_CONFIG.max
			? (ageRangeRaw as AgeRange)
			: null;

	const pickParam = (params.get("pick") ?? "").trim().toLowerCase();
	const selectedOOOCPicks =
		pickParam === "1" || pickParam === "true" || pickParam === "yes";

	const nextState: EventFilterState = {
		selectedDateRange: {
			from: dateFrom,
			to: dateTo,
		},
		selectedDayNightPeriods: dayNightPeriods,
		selectedArrondissements: arrondissements,
		selectedGenres: genres,
		selectedNationalities: nationalities,
		selectedVenueTypes: venueTypes,
		selectedIndoorPreference,
		selectedPriceRange,
		selectedAgeRange,
		selectedOOOCPicks,
		searchQuery,
	};

	if (!hasActiveFilters(nextState)) {
		return null;
	}
	return nextState;
};

export const serializeEventFilterStateToSearchParams = (
	params: URLSearchParams,
	state: EventFilterState,
): URLSearchParams => {
	const next = new URLSearchParams(params.toString());
	for (const key of FILTER_PARAM_KEYS) {
		next.delete(key);
	}

	const query = state.searchQuery.trim();
	if (query.length > 0) next.set("q", query);

	if (state.selectedDateRange.from)
		next.set("df", state.selectedDateRange.from);
	if (state.selectedDateRange.to) next.set("dt", state.selectedDateRange.to);

	if (state.selectedDayNightPeriods.length > 0) {
		next.set("dn", state.selectedDayNightPeriods.join(","));
	}
	if (state.selectedArrondissements.length > 0) {
		next.set(
			"arr",
			state.selectedArrondissements.map((value) => String(value)).join(","),
		);
	}
	if (state.selectedGenres.length > 0) {
		next.set("g", state.selectedGenres.join(","));
	}
	if (state.selectedNationalities.length > 0) {
		next.set("nat", state.selectedNationalities.join(","));
	}
	if (state.selectedVenueTypes.length > 0) {
		next.set("vt", state.selectedVenueTypes.join(","));
	}

	if (state.selectedIndoorPreference != null) {
		next.set("in", state.selectedIndoorPreference ? "indoor" : "outdoor");
	}

	const isDefaultPriceRange =
		state.selectedPriceRange[0] === PRICE_RANGE_CONFIG.min &&
		state.selectedPriceRange[1] === PRICE_RANGE_CONFIG.max;
	if (!isDefaultPriceRange) {
		next.set(
			"pr",
			`${state.selectedPriceRange[0]}:${state.selectedPriceRange[1]}`,
		);
	}

	if (state.selectedAgeRange) {
		next.set("ag", `${state.selectedAgeRange[0]}:${state.selectedAgeRange[1]}`);
	}

	if (state.selectedOOOCPicks) {
		next.set("pick", "1");
	}

	return next;
};

export const writeStoredEventFilterState = (state: EventFilterState): void => {
	if (typeof window === "undefined") return;
	try {
		const serialized = JSON.stringify(state);
		window.localStorage.setItem(EVENT_FILTER_STORAGE_KEY, serialized);
	} catch {
		// Ignore storage errors.
	}
};

export const readStoredEventFilterState = (): EventFilterState | null => {
	if (typeof window === "undefined") return null;
	try {
		const raw = window.localStorage.getItem(EVENT_FILTER_STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as EventFilterState | null;
		if (!parsed) return null;
		const merged: EventFilterState = {
			...DEFAULT_EVENT_FILTER_STATE,
			...parsed,
		};
		if (!hasActiveFilters(merged)) {
			return null;
		}
		return merged;
	} catch {
		return null;
	}
};
