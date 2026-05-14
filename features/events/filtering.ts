import {
	getSearchableGenreText,
	normalizeSearchText,
} from "@/features/events/genre-normalization";
import {
	AGE_RANGE_CONFIG,
	type AgeRange,
	type DayNightPeriod,
	type Event,
	type MusicGenre,
	type Nationality,
	PRICE_RANGE_CONFIG,
	type ParisArrondissement,
	type VenueType,
	formatLocationAreaLong,
	formatPrice,
	getEventDayNightPeriods,
	getLocationAreaSortValue,
	isAgeInRange,
	isEventInDayNightPeriod,
	isPriceInRange,
} from "@/features/events/types";
import { isStrictISODate } from "./date-utils";
import { isEventInDiscoveryDateRange } from "./discovery-eligibility";

export type DateRangeFilter = {
	from: string | null;
	to: string | null;
};

export type EventFilterState = {
	selectedDateRange: DateRangeFilter;
	selectedDayNightPeriods: DayNightPeriod[];
	selectedArrondissements: ParisArrondissement[];
	selectedGenres: MusicGenre[];
	excludedGenres: MusicGenre[];
	selectedNationalities: Nationality[];
	selectedVenueTypes: VenueType[];
	selectedIndoorPreference: boolean | null;
	selectedPriceRange: [number, number];
	includeFreeOptions: boolean;
	selectedAgeRange: AgeRange | null;
	selectedOOOCPicks: boolean;
	searchQuery: string;
};

export const DEFAULT_EVENT_FILTER_STATE: EventFilterState = {
	selectedDateRange: {
		from: null,
		to: null,
	},
	selectedDayNightPeriods: [],
	selectedArrondissements: [],
	selectedGenres: [],
	excludedGenres: [],
	selectedNationalities: [],
	selectedVenueTypes: [],
	selectedIndoorPreference: null,
	selectedPriceRange: PRICE_RANGE_CONFIG.defaultRange,
	includeFreeOptions: false,
	selectedAgeRange: null,
	selectedOOOCPicks: false,
	searchQuery: "",
};

const PARIS_YEAR_FORMATTER = new Intl.DateTimeFormat("en-CA", {
	timeZone: "Europe/Paris",
	year: "numeric",
});

export const areDateRangesEqual = (
	left: DateRangeFilter,
	right: DateRangeFilter,
): boolean => left.from === right.from && left.to === right.to;

export const getCurrentParisYearDateRange = (
	referenceDate = new Date(),
): DateRangeFilter => {
	const currentYear = PARIS_YEAR_FORMATTER.format(referenceDate);
	return {
		from: `${currentYear}-01-01`,
		to: `${currentYear}-12-31`,
	};
};

export const getEventCountForDateRange = (
	events: Event[],
	range: DateRangeFilter,
): number =>
	events.filter((event) => {
		if (!isStrictISODate(event.date)) return false;
		if (range.from && event.date < range.from) return false;
		if (range.to && event.date > range.to) return false;
		return true;
	}).length;

export const getDefaultDateRangeForEvents = (
	events: Event[],
	referenceDate = new Date(),
): DateRangeFilter => {
	const currentYearDateRange = getCurrentParisYearDateRange(referenceDate);
	const hasCurrentYearEvents = events.some((event) => {
		if (!isStrictISODate(event.date)) return false;
		if (!currentYearDateRange.from || !currentYearDateRange.to) return false;
		return (
			event.date >= currentYearDateRange.from &&
			event.date <= currentYearDateRange.to
		);
	});

	return hasCurrentYearEvents
		? currentYearDateRange
		: DEFAULT_EVENT_FILTER_STATE.selectedDateRange;
};

export const getDefaultEventFilterState = (
	events: Event[],
	referenceDate = new Date(),
): EventFilterState => ({
	...DEFAULT_EVENT_FILTER_STATE,
	selectedDateRange: getDefaultDateRangeForEvents(events, referenceDate),
});

const matchesSearchQuery = (event: Event, rawQuery: string): boolean => {
	const query = normalizeSearchText(rawQuery);
	if (query.length === 0) return true;

	const dateParts = event.date.split("-");
	const dayOfMonth = Number.parseInt(dateParts[2] ?? "", 10);
	const dateSearchText =
		Number.isFinite(dayOfMonth) && dayOfMonth > 0
			? normalizeSearchText(
					[
						event.date,
						String(dayOfMonth),
						`${dayOfMonth}${getOrdinalSuffix(dayOfMonth)}`,
					].join(" "),
				)
			: normalizeSearchText(event.date);
	const matchesName = normalizeSearchText(event.name).includes(query);
	const matchesLocation = normalizeSearchText(event.location ?? "").includes(
		query,
	);
	const matchesDescription = normalizeSearchText(
		event.description ?? "",
	).includes(query);
	const matchesDate = dateSearchText.includes(query);
	const matchesArrondissement =
		event.arrondissement.toString().includes(query) ||
		normalizeSearchText(formatLocationAreaLong(event.arrondissement)).includes(
			query,
		);
	const matchesDay = normalizeSearchText(event.day).includes(query);
	const matchesDayNight = getEventDayNightPeriods(event).some(
		(period) => query === period,
	);
	const matchesGenre = event.genre.some((genre) =>
		getSearchableGenreText(genre).includes(query),
	);
	const matchesTags = (event.tags ?? []).some((tag) =>
		normalizeSearchText(tag).includes(query),
	);
	const matchesType = normalizeSearchText(event.type).includes(query);
	const priceLabel = normalizeSearchText(formatPrice(event.price));
	const matchesPrice = priceLabel.includes(query);

	return (
		matchesName ||
		matchesLocation ||
		matchesDescription ||
		matchesDate ||
		matchesArrondissement ||
		matchesDay ||
		matchesDayNight ||
		matchesGenre ||
		matchesTags ||
		matchesType ||
		matchesPrice
	);
};

const getOrdinalSuffix = (day: number): string => {
	const mod100 = day % 100;
	if (mod100 >= 11 && mod100 <= 13) return "th";
	switch (day % 10) {
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

const matchesVenueTypes = (
	event: Event,
	selectedVenueTypes: VenueType[],
): boolean => {
	if (selectedVenueTypes.length === 0) return true;

	if (event.venueTypes && event.venueTypes.length > 0) {
		return selectedVenueTypes.some((venueType) =>
			event.venueTypes.includes(venueType),
		);
	}

	const hasIndoor = selectedVenueTypes.includes("indoor");
	const hasOutdoor = selectedVenueTypes.includes("outdoor");
	if (hasIndoor && hasOutdoor) return true;
	if (hasIndoor && !event.indoor) return false;
	if (hasOutdoor && event.indoor) return false;
	return true;
};

const matchesIndoorPreference = (
	event: Event,
	selectedIndoorPreference: boolean | null,
): boolean => {
	if (selectedIndoorPreference === null) return true;

	if (event.venueTypes && event.venueTypes.length > 0) {
		const hasIndoor = event.venueTypes.includes("indoor");
		const hasOutdoor = event.venueTypes.includes("outdoor");
		if (selectedIndoorPreference && !hasIndoor) return false;
		if (!selectedIndoorPreference && !hasOutdoor) return false;
		return true;
	}

	return event.indoor === selectedIndoorPreference;
};

export const filterEvents = (
	events: Event[],
	filters: EventFilterState,
): Event[] => {
	return events.filter((event) => {
		if (filters.selectedOOOCPicks && event.isOOOCPick !== true) return false;

		if (!isEventInDiscoveryDateRange(event, filters.selectedDateRange))
			return false;

		if (filters.selectedDayNightPeriods.length > 0) {
			const hasMatchingPeriod = filters.selectedDayNightPeriods.some((period) =>
				isEventInDayNightPeriod(event, period),
			);
			if (!hasMatchingPeriod) return false;
		}

		if (
			filters.selectedArrondissements.length > 0 &&
			!filters.selectedArrondissements.includes(event.arrondissement)
		) {
			return false;
		}

		if (filters.selectedGenres.length > 0) {
			const hasMatchingGenre = event.genre.some((genre) =>
				filters.selectedGenres.includes(genre),
			);
			if (!hasMatchingGenre) return false;
		}

		if (filters.excludedGenres.length > 0) {
			const hasExcludedGenre = event.genre.some((genre) =>
				filters.excludedGenres.includes(genre),
			);
			if (hasExcludedGenre) return false;
		}

		if (filters.selectedNationalities.length > 0) {
			if (!event.nationality || event.nationality.length === 0) return false;
			const hasAllSelectedNationalities = filters.selectedNationalities.every(
				(nationality) => event.nationality?.includes(nationality),
			);
			if (!hasAllSelectedNationalities) return false;
		}

		if (!matchesVenueTypes(event, filters.selectedVenueTypes)) return false;
		if (!matchesIndoorPreference(event, filters.selectedIndoorPreference))
			return false;

		if (
			(filters.selectedPriceRange[0] !== PRICE_RANGE_CONFIG.min ||
				filters.selectedPriceRange[1] !== PRICE_RANGE_CONFIG.max) &&
			!isPriceInRange(event.price, filters.selectedPriceRange, {
				includeFreeOptions: filters.includeFreeOptions,
			})
		) {
			return false;
		}

		if (
			filters.selectedAgeRange &&
			(!event.age || !isAgeInRange(event.age, filters.selectedAgeRange))
		) {
			return false;
		}

		if (
			filters.searchQuery &&
			!matchesSearchQuery(event, filters.searchQuery)
		) {
			return false;
		}

		return true;
	});
};

export const getAvailableArrondissements = (
	events: Event[],
): ParisArrondissement[] => {
	const arrondissements = new Set(events.map((event) => event.arrondissement));
	return Array.from(arrondissements).sort((left, right) => {
		return getLocationAreaSortValue(left) - getLocationAreaSortValue(right);
	}) as ParisArrondissement[];
};

export const getAvailableEventDates = (events: Event[]): string[] => {
	const dates = new Set(
		events
			.map((event) => event.date?.trim())
			.filter((date): date is string => Boolean(date && isStrictISODate(date))),
	);
	return Array.from(dates).sort((left, right) => left.localeCompare(right));
};

export const getTopEventDatesByCount = (
	events: Event[],
	limit = 4,
	dateRange: DateRangeFilter = DEFAULT_EVENT_FILTER_STATE.selectedDateRange,
): string[] => {
	const countsByDate = new Map<string, number>();
	for (const event of events) {
		const date = event.date?.trim();
		if (!date || !isStrictISODate(date)) continue;
		if (dateRange.from && date < dateRange.from) continue;
		if (dateRange.to && date > dateRange.to) continue;
		countsByDate.set(date, (countsByDate.get(date) ?? 0) + 1);
	}

	return Array.from(countsByDate.entries())
		.sort((left, right) => {
			if (right[1] !== left[1]) return right[1] - left[1];
			return left[0].localeCompare(right[0]);
		})
		.slice(0, limit)
		.map(([date]) => date);
};

const hasCustomPriceRange = (range: [number, number]): boolean => {
	return (
		range[0] !== PRICE_RANGE_CONFIG.min || range[1] !== PRICE_RANGE_CONFIG.max
	);
};

const hasCustomAgeRange = (range: AgeRange | null): boolean => {
	if (!range) return false;
	return range[0] !== AGE_RANGE_CONFIG.min || range[1] !== AGE_RANGE_CONFIG.max;
};

const hasSelectedDateRange = (range: DateRangeFilter): boolean => {
	return range.from !== null || range.to !== null;
};

const hasCustomSelectedDateRange = (
	range: DateRangeFilter,
	defaultDateRange: DateRangeFilter,
): boolean =>
	hasSelectedDateRange(range) && !areDateRangesEqual(range, defaultDateRange);

export const hasActiveFilters = (
	filters: EventFilterState,
	options?: {
		defaultDateRange?: DateRangeFilter;
	},
): boolean => {
	const defaultDateRange =
		options?.defaultDateRange ?? DEFAULT_EVENT_FILTER_STATE.selectedDateRange;
	const hasSearchQuery = filters.searchQuery.trim().length > 0;
	return (
		hasCustomSelectedDateRange(filters.selectedDateRange, defaultDateRange) ||
		filters.selectedDayNightPeriods.length > 0 ||
		filters.selectedArrondissements.length > 0 ||
		filters.selectedGenres.length > 0 ||
		filters.excludedGenres.length > 0 ||
		filters.selectedNationalities.length > 0 ||
		filters.selectedVenueTypes.length > 0 ||
		filters.selectedIndoorPreference !== null ||
		hasCustomPriceRange(filters.selectedPriceRange) ||
		filters.includeFreeOptions ||
		hasCustomAgeRange(filters.selectedAgeRange) ||
		filters.selectedOOOCPicks ||
		hasSearchQuery
	);
};

export const getActiveFiltersCount = (
	filters: EventFilterState,
	options?: {
		defaultDateRange?: DateRangeFilter;
	},
): number => {
	const defaultDateRange =
		options?.defaultDateRange ?? DEFAULT_EVENT_FILTER_STATE.selectedDateRange;
	const hasSearchQuery = filters.searchQuery.trim().length > 0;
	return (
		(hasCustomSelectedDateRange(filters.selectedDateRange, defaultDateRange)
			? 1
			: 0) +
		filters.selectedDayNightPeriods.length +
		filters.selectedArrondissements.length +
		filters.selectedGenres.length +
		filters.excludedGenres.length +
		filters.selectedNationalities.length +
		filters.selectedVenueTypes.length +
		(hasCustomPriceRange(filters.selectedPriceRange) ? 1 : 0) +
		(filters.includeFreeOptions ? 1 : 0) +
		(hasCustomAgeRange(filters.selectedAgeRange) ? 1 : 0) +
		(filters.selectedIndoorPreference !== null ? 1 : 0) +
		(filters.selectedOOOCPicks ? 1 : 0) +
		(hasSearchQuery ? 1 : 0)
	);
};
