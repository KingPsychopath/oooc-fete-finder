"use client";

import {
	trackDiscoveryAnalytics,
	trackGenrePreference,
} from "@/features/events/engagement/client-tracking";
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
} from "@/features/events/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	resolveInitialEventFilterStateFromSearchParams,
	serializeEventFilterStateToSearchParams,
	writeStoredEventFilterState,
} from "../filter-state-persistence";
import {
	type DateRangeFilter,
	type EventFilterState,
	filterEvents,
	getActiveFiltersCount,
	getAvailableArrondissements,
	getAvailableEventDates,
	getDefaultEventFilterState,
	getTopEventDatesByCount,
	hasActiveFilters,
} from "../filtering";

type UseEventFiltersArgs = {
	events: Event[];
	requireAuth: () => boolean;
	isFilterAccessAllowed: boolean;
};

const toggleArrayValue = <T>(values: T[], value: T): T[] => {
	return values.includes(value)
		? values.filter((item) => item !== value)
		: [...values, value];
};

const normalizeDateRange = (range: DateRangeFilter): DateRangeFilter => {
	const from = range.from && range.from.trim().length > 0 ? range.from : null;
	const to = range.to && range.to.trim().length > 0 ? range.to : null;
	if (from && to && from > to) {
		return { from: to, to: from };
	}
	return { from, to };
};

export const useEventFilters = ({
	events,
	requireAuth,
	isFilterAccessAllowed,
}: UseEventFiltersArgs) => {
	const defaultFilterState = useMemo(() => getDefaultEventFilterState(events), [events]);
	const searchTrackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const priceTrackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const ageTrackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const lastTrackedSearchRef = useRef("");
	const lastTrackedPriceRef = useRef("");
	const lastTrackedAgeRef = useRef("");
	const pendingInitialFilterStateRef = useRef<EventFilterState | null>(null);
	const hasHydratedInitialStateRef = useRef(false);
	const [selectedDateRange, setSelectedDateRange] = useState<DateRangeFilter>(
		defaultFilterState.selectedDateRange,
	);
	const [selectedDayNightPeriods, setSelectedDayNightPeriods] = useState<
		DayNightPeriod[]
	>(defaultFilterState.selectedDayNightPeriods);
	const [selectedArrondissements, setSelectedArrondissements] = useState<
		ParisArrondissement[]
	>(defaultFilterState.selectedArrondissements);
	const [selectedGenres, setSelectedGenres] = useState<MusicGenre[]>(
		defaultFilterState.selectedGenres,
	);
	const [selectedNationalities, setSelectedNationalities] = useState<
		Nationality[]
	>(defaultFilterState.selectedNationalities);
	const [selectedVenueTypes, setSelectedVenueTypes] = useState<VenueType[]>(
		defaultFilterState.selectedVenueTypes,
	);
	const [selectedIndoorPreference, setSelectedIndoorPreference] = useState<
		boolean | null
	>(defaultFilterState.selectedIndoorPreference);
	const [selectedPriceRange, setSelectedPriceRange] = useState<
		[number, number]
	>(defaultFilterState.selectedPriceRange);
	const [selectedAgeRange, setSelectedAgeRange] = useState<AgeRange | null>(
		defaultFilterState.selectedAgeRange,
	);
	const [selectedOOOCPicks, setSelectedOOOCPicks] = useState(
		defaultFilterState.selectedOOOCPicks,
	);
	const [searchQuery, setSearchQuery] = useState(
		defaultFilterState.searchQuery,
	);
	const [isInitialFilterStateReady, setIsInitialFilterStateReady] =
		useState(false);

	const applyStateSnapshot = useCallback((state: EventFilterState) => {
		setSelectedDateRange(state.selectedDateRange);
		setSelectedDayNightPeriods(state.selectedDayNightPeriods);
		setSelectedArrondissements(state.selectedArrondissements);
		setSelectedGenres(state.selectedGenres);
		setSelectedNationalities(state.selectedNationalities);
		setSelectedVenueTypes(state.selectedVenueTypes);
		setSelectedIndoorPreference(state.selectedIndoorPreference);
		setSelectedPriceRange(state.selectedPriceRange);
		setSelectedAgeRange(state.selectedAgeRange);
		setSelectedOOOCPicks(state.selectedOOOCPicks);
		setSearchQuery(state.searchQuery);
	}, []);

	useEffect(() => {
		return () => {
			if (searchTrackTimeoutRef.current) {
				clearTimeout(searchTrackTimeoutRef.current);
			}
			if (priceTrackTimeoutRef.current) {
				clearTimeout(priceTrackTimeoutRef.current);
			}
			if (ageTrackTimeoutRef.current) {
				clearTimeout(ageTrackTimeoutRef.current);
			}
		};
	}, []);

	useEffect(() => {
		if (!hasHydratedInitialStateRef.current) {
			hasHydratedInitialStateRef.current = true;
			if (typeof window !== "undefined") {
				pendingInitialFilterStateRef.current =
					resolveInitialEventFilterStateFromSearchParams(
						new URLSearchParams(window.location.search),
						{ defaultDateRange: defaultFilterState.selectedDateRange },
					);
			}
		}
		if (!isFilterAccessAllowed) return;
		if (pendingInitialFilterStateRef.current) {
			applyStateSnapshot(pendingInitialFilterStateRef.current);
		}
		pendingInitialFilterStateRef.current = null;
		setIsInitialFilterStateReady(true);
	}, [
		applyStateSnapshot,
		defaultFilterState.selectedDateRange,
		isFilterAccessAllowed,
	]);

	useEffect(() => {
		if (!isFilterAccessAllowed) return;
		if (!isInitialFilterStateReady) return;
		if (typeof window === "undefined") return;
		const stateSnapshot: EventFilterState = {
			selectedDateRange,
			selectedDayNightPeriods,
			selectedArrondissements,
			selectedGenres,
			selectedNationalities,
			selectedVenueTypes,
			selectedIndoorPreference,
			selectedPriceRange,
			selectedAgeRange,
			selectedOOOCPicks,
			searchQuery,
		};
		if (
			hasActiveFilters(stateSnapshot, {
				defaultDateRange: defaultFilterState.selectedDateRange,
			})
		) {
			writeStoredEventFilterState(stateSnapshot);
		} else {
			writeStoredEventFilterState(null);
		}
		const currentParams = new URLSearchParams(window.location.search);
		const nextParams = serializeEventFilterStateToSearchParams(
			currentParams,
			stateSnapshot,
			{
				defaultDateRange: defaultFilterState.selectedDateRange,
			},
		);
		const nextQuery = nextParams.toString();
		const currentQuery = currentParams.toString();
		if (nextQuery === currentQuery) return;
		const currentState =
			window.history.state &&
			typeof window.history.state === "object" &&
			!Array.isArray(window.history.state)
				? (window.history.state as Record<string, unknown>)
				: {};
		const nextUrl = nextQuery
			? `${window.location.pathname}?${nextQuery}`
			: window.location.pathname;
		window.history.replaceState(currentState, "", nextUrl);
	}, [
		isFilterAccessAllowed,
		searchQuery,
		selectedAgeRange,
		selectedArrondissements,
		selectedDateRange,
		selectedDayNightPeriods,
		selectedGenres,
		selectedIndoorPreference,
		selectedNationalities,
		selectedOOOCPicks,
		selectedPriceRange,
		selectedVenueTypes,
		defaultFilterState.selectedDateRange,
		isInitialFilterStateReady,
	]);

	const availableArrondissements = useMemo(
		() => getAvailableArrondissements(events),
		[events],
	);
	const availableEventDates = useMemo(
		() => getAvailableEventDates(events),
		[events],
	);
	const quickSelectEventDates = useMemo(
		() => getTopEventDatesByCount(events, 4, defaultFilterState.selectedDateRange),
		[events, defaultFilterState.selectedDateRange],
	);

	const filteredEvents = useMemo(
		() =>
			filterEvents(events, {
				selectedDateRange,
				selectedDayNightPeriods,
				selectedArrondissements,
				selectedGenres,
				selectedNationalities,
				selectedVenueTypes,
				selectedIndoorPreference,
				selectedPriceRange,
				selectedAgeRange,
				selectedOOOCPicks,
				searchQuery,
			}),
		[
			events,
			selectedDateRange,
			selectedDayNightPeriods,
			selectedArrondissements,
			selectedGenres,
			selectedNationalities,
			selectedVenueTypes,
			selectedIndoorPreference,
			selectedPriceRange,
			selectedAgeRange,
			selectedOOOCPicks,
			searchQuery,
		],
	);

	const activeFiltersCount = useMemo(
		() =>
			getActiveFiltersCount({
				selectedDateRange,
				selectedDayNightPeriods,
				selectedArrondissements,
				selectedGenres,
				selectedNationalities,
				selectedVenueTypes,
				selectedIndoorPreference,
				selectedPriceRange,
				selectedAgeRange,
				selectedOOOCPicks,
				searchQuery,
			}, {
				defaultDateRange: defaultFilterState.selectedDateRange,
			}),
		[
			selectedDateRange,
			selectedDayNightPeriods,
			selectedArrondissements,
			selectedGenres,
			selectedNationalities,
			selectedVenueTypes,
			selectedIndoorPreference,
			selectedPriceRange,
			selectedAgeRange,
			selectedOOOCPicks,
			searchQuery,
			defaultFilterState.selectedDateRange,
		],
	);

	const hasAnyActiveFilters = useMemo(
		() =>
			hasActiveFilters({
				selectedDateRange,
				selectedDayNightPeriods,
				selectedArrondissements,
				selectedGenres,
				selectedNationalities,
				selectedVenueTypes,
				selectedIndoorPreference,
				selectedPriceRange,
				selectedAgeRange,
				selectedOOOCPicks,
				searchQuery,
			}, {
				defaultDateRange: defaultFilterState.selectedDateRange,
			}),
		[
			selectedDateRange,
			selectedDayNightPeriods,
			selectedArrondissements,
			selectedGenres,
			selectedNationalities,
			selectedVenueTypes,
			selectedIndoorPreference,
			selectedPriceRange,
			selectedAgeRange,
			selectedOOOCPicks,
			searchQuery,
			defaultFilterState.selectedDateRange,
		],
	);

	const onDateRangeChange = useCallback(
		(dateRange: DateRangeFilter) => {
			if (!requireAuth()) return;
			const normalized = normalizeDateRange(dateRange);
			setSelectedDateRange(normalized);
			trackDiscoveryAnalytics({
				actionType: "filter_apply",
				filterGroup: "date_range",
				filterValue: `${normalized.from ?? "any"}:${normalized.to ?? "any"}`,
			});
		},
		[requireAuth],
	);

	const onDayNightPeriodToggle = useCallback(
		(period: DayNightPeriod) => {
			if (!requireAuth()) return;
			setSelectedDayNightPeriods((prev) => toggleArrayValue(prev, period));
			trackDiscoveryAnalytics({
				actionType: "filter_apply",
				filterGroup: "day_night",
				filterValue: period,
			});
		},
		[requireAuth],
	);

	const onArrondissementToggle = useCallback(
		(arrondissement: ParisArrondissement) => {
			if (!requireAuth()) return;
			setSelectedArrondissements((prev) =>
				toggleArrayValue(prev, arrondissement),
			);
			trackDiscoveryAnalytics({
				actionType: "filter_apply",
				filterGroup: "arrondissement",
				filterValue: String(arrondissement),
			});
		},
		[requireAuth],
	);

	const onGenreToggle = useCallback(
		(genre: MusicGenre) => {
			if (!requireAuth()) return;
			setSelectedGenres((prev) => toggleArrayValue(prev, genre));
			trackDiscoveryAnalytics({
				actionType: "filter_apply",
				filterGroup: "genre",
				filterValue: genre,
			});
			trackGenrePreference(genre);
		},
		[requireAuth],
	);

	const onNationalityToggle = useCallback(
		(nationality: Nationality) => {
			if (!requireAuth()) return;
			setSelectedNationalities((prev) => toggleArrayValue(prev, nationality));
			trackDiscoveryAnalytics({
				actionType: "filter_apply",
				filterGroup: "nationality",
				filterValue: nationality,
			});
		},
		[requireAuth],
	);

	const onVenueTypeToggle = useCallback(
		(venueType: VenueType) => {
			if (!requireAuth()) return;
			setSelectedVenueTypes((prev) => toggleArrayValue(prev, venueType));
			trackDiscoveryAnalytics({
				actionType: "filter_apply",
				filterGroup: "venue_type",
				filterValue: venueType,
			});
		},
		[requireAuth],
	);

	const onIndoorPreferenceChange = useCallback(
		(preference: boolean | null) => {
			if (!requireAuth()) return;
			setSelectedIndoorPreference(preference);
			trackDiscoveryAnalytics({
				actionType: "filter_apply",
				filterGroup: "venue_setting",
				filterValue:
					preference == null ? "all" : preference ? "indoor" : "outdoor",
			});
		},
		[requireAuth],
	);

	const onPriceRangeChange = useCallback(
		(range: [number, number]) => {
			if (!requireAuth()) return;
			setSelectedPriceRange(range);
			const isDefaultRange =
				range[0] === PRICE_RANGE_CONFIG.min &&
				range[1] === PRICE_RANGE_CONFIG.max;
			if (isDefaultRange) {
				return;
			}
			const value = `${range[0]}:${range[1]}`;
			if (priceTrackTimeoutRef.current) {
				clearTimeout(priceTrackTimeoutRef.current);
			}
			priceTrackTimeoutRef.current = setTimeout(() => {
				if (lastTrackedPriceRef.current === value) {
					return;
				}
				lastTrackedPriceRef.current = value;
				trackDiscoveryAnalytics({
					actionType: "filter_apply",
					filterGroup: "price_range",
					filterValue: value,
				});
			}, 450);
		},
		[requireAuth],
	);

	const onAgeRangeChange = useCallback(
		(range: AgeRange | null) => {
			if (!requireAuth()) return;
			if (
				range &&
				range[0] === AGE_RANGE_CONFIG.min &&
				range[1] === AGE_RANGE_CONFIG.max
			) {
				setSelectedAgeRange(null);
				return;
			}
			setSelectedAgeRange(range);
			if (!range) {
				return;
			}
			const value = `${range[0]}:${range[1]}`;
			if (ageTrackTimeoutRef.current) {
				clearTimeout(ageTrackTimeoutRef.current);
			}
			ageTrackTimeoutRef.current = setTimeout(() => {
				if (lastTrackedAgeRef.current === value) {
					return;
				}
				lastTrackedAgeRef.current = value;
				trackDiscoveryAnalytics({
					actionType: "filter_apply",
					filterGroup: "age_range",
					filterValue: value,
				});
			}, 450);
		},
		[requireAuth],
	);

	const onOOOCPicksToggle = useCallback(
		(selected: boolean) => {
			if (!requireAuth()) return;
			setSelectedOOOCPicks(selected);
			trackDiscoveryAnalytics({
				actionType: "filter_apply",
				filterGroup: "oooc_pick",
				filterValue: selected ? "yes" : "no",
			});
		},
		[requireAuth],
	);

	const onSearchQueryChange = useCallback(
		(query: string) => {
			if (!requireAuth()) return;
			setSearchQuery(query);
			if (searchTrackTimeoutRef.current) {
				clearTimeout(searchTrackTimeoutRef.current);
			}
			const normalized = query.trim().toLowerCase();
			if (normalized.length < 2) {
				return;
			}
			searchTrackTimeoutRef.current = setTimeout(() => {
				if (lastTrackedSearchRef.current === normalized) {
					return;
				}
				lastTrackedSearchRef.current = normalized;
				trackDiscoveryAnalytics({
					actionType: "search",
					searchQuery: normalized,
				});
			}, 500);
		},
		[requireAuth],
	);

	const onClearFilters = useCallback(() => {
		if (!requireAuth()) return;
		applyStateSnapshot(defaultFilterState);
		trackDiscoveryAnalytics({
			actionType: "filter_clear",
			filterGroup: "all",
			filterValue: "reset",
		});
	}, [applyStateSnapshot, defaultFilterState, requireAuth]);

	return {
		defaultDateRange: defaultFilterState.selectedDateRange,
		selectedDateRange,
		selectedDayNightPeriods,
		selectedArrondissements,
		selectedGenres,
		selectedNationalities,
		selectedVenueTypes,
		selectedIndoorPreference,
		selectedPriceRange,
		selectedAgeRange,
		selectedOOOCPicks,
		searchQuery,
		availableArrondissements,
		availableEventDates,
		quickSelectEventDates,
		filteredEvents,
		hasAnyActiveFilters,
		activeFiltersCount,
		onDateRangeChange,
		onDayNightPeriodToggle,
		onArrondissementToggle,
		onGenreToggle,
		onNationalityToggle,
		onVenueTypeToggle,
		onIndoorPreferenceChange,
		onPriceRangeChange,
		onAgeRangeChange,
		onOOOCPicksToggle,
		onSearchQueryChange,
		onClearFilters,
	};
};
