"use client";

import { useEventsOffline } from "@/features/events/components/events-offline-provider";
import { getCountryOption } from "@/features/events/countries";
import { getDiscoveryEligibleEvents } from "@/features/events/discovery-eligibility";
import { trackDiscoveryAnalytics } from "@/features/events/engagement/client-tracking";
import {
	type SpotlightRotationContext,
	getSpotlightRotationContext,
} from "@/features/events/featured/selection";
import { shouldDisplayFeaturedEvent } from "@/features/events/featured/utils/timestamp-utils";
import {
	getCustomGenreColor,
	toGenreLabel,
} from "@/features/events/genre-normalization";
import { useEventFilters } from "@/features/events/hooks/use-event-filters";
import type { SearchAnalyticsSource } from "@/features/events/hooks/use-event-filters";
import {
	createFreshActivityComparator,
	createRegularEventsComparator,
} from "@/features/events/ordering";
import { getSocialProofDisplayModes } from "@/features/events/social-proof";
import {
	type Event,
	MUSIC_GENRES,
	type MusicGenreDefinition,
	type Nationality,
} from "@/features/events/types";
import {
	type SavedClientLocation,
	getParisTestClientLocation,
	isClientLocationDevToolsEnabled,
	requestClientLocation,
} from "@/features/locations/client-location";
import {
	DEFAULT_NEARBY_RADIUS_KM,
	NEARBY_RADIUS_OPTIONS_KM,
	type NearbyLocationScope,
	type NearbyRadiusKm,
	getNearbyLocationScope,
	normalizeNearbyRadiusKm,
	shouldApplyNearbyRadius,
} from "@/features/locations/nearby-location";
import { findNearbyEvents } from "@/features/locations/nearby-event-service";
import { useLocalAppSettings } from "@/hooks/useLocalAppSettings";
import {
	type ReactNode,
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

export type EventSortMode = "upcoming" | "fresh-activity" | "nearby";
export type NearbyEventsRequestSource = "list" | "map";
export type NearbyEventsStatus =
	| "idle"
	| "requesting"
	| "active-current"
	| "active-last-known"
	| "unavailable";
type PendingAuthAction =
	| "show-oooc-picks"
	| { type: "search"; query: string; source: SearchAnalyticsSource };

interface EventsSearchFiltersProviderProps {
	canUseProtectedDiscovery: boolean;
	children: ReactNode;
	isAuthenticated: boolean;
	onAuthRequired: () => void;
	onScrollToAllEvents: () => void;
	requireAuth: () => boolean;
	initialSpotlightRotationContext: SpotlightRotationContext;
}

interface EventsSearchFiltersContextValue {
	activeFiltersCount: number;
	allEventsOrdered: Event[];
	availableArrondissements: ReturnType<
		typeof useEventFilters
	>["availableArrondissements"];
	availableEventCategories: ReturnType<
		typeof useEventFilters
	>["availableEventCategories"];
	availableEventDates: ReturnType<
		typeof useEventFilters
	>["availableEventDates"];
	availableGenres: MusicGenreDefinition[];
	availableNationalities: {
		key: Nationality;
		label: string;
		flag: string;
		shortCode: string;
	}[];
	defaultDateRange: ReturnType<typeof useEventFilters>["defaultDateRange"];
	filteredEvents: Event[];
	handleOOOCPicksCalloutClick: () => void;
	handleSearchFocus: () => void;
	handleSearchIntent: (query: string, source?: SearchAnalyticsSource) => void;
	hasAnyActiveFilters: boolean;
	isFilterDrawerForced: boolean;
	isFilterExpanded: boolean;
	isFilterOpen: boolean;
	nearbyEventsError: string | null;
	nearbyEventsStatus: NearbyEventsStatus;
	nearbyLocation: SavedClientLocation | null;
	nearbyLocationScope: NearbyLocationScope | null;
	nearbyMatchedEventsCount: number;
	nearbyRadiusKm: NearbyRadiusKm;
	nearbyRadiusOptionsKm: readonly NearbyRadiusKm[];
	canUseParisTestLocation: boolean;
	onAgeRangeChange: ReturnType<typeof useEventFilters>["onAgeRangeChange"];
	onArrondissementToggle: ReturnType<
		typeof useEventFilters
	>["onArrondissementToggle"];
	onClearFilters: ReturnType<typeof useEventFilters>["onClearFilters"];
	onDateRangeChange: ReturnType<typeof useEventFilters>["onDateRangeChange"];
	onDayNightPeriodToggle: ReturnType<
		typeof useEventFilters
	>["onDayNightPeriodToggle"];
	onGenreToggle: ReturnType<typeof useEventFilters>["onGenreToggle"];
	onGenreExcludeToggle: ReturnType<
		typeof useEventFilters
	>["onGenreExcludeToggle"];
	onEventCategoryToggle: ReturnType<
		typeof useEventFilters
	>["onEventCategoryToggle"];
	onIndoorPreferenceChange: ReturnType<
		typeof useEventFilters
	>["onIndoorPreferenceChange"];
	onIncludeFreeOptionsChange: ReturnType<
		typeof useEventFilters
	>["onIncludeFreeOptionsChange"];
	onNationalityToggle: ReturnType<
		typeof useEventFilters
	>["onNationalityToggle"];
	onOOOCPicksToggle: ReturnType<typeof useEventFilters>["onOOOCPicksToggle"];
	onPriceRangeChange: ReturnType<typeof useEventFilters>["onPriceRangeChange"];
	onSearchQueryChange: ReturnType<
		typeof useEventFilters
	>["onSearchQueryChange"];
	onVenueTypeToggle: ReturnType<typeof useEventFilters>["onVenueTypeToggle"];
	openFilterDrawer: () => void;
	openFilterPanel: () => void;
	quickSelectEventDates: ReturnType<
		typeof useEventFilters
	>["quickSelectEventDates"];
	searchQuery: string;
	selectedAgeRange: ReturnType<typeof useEventFilters>["selectedAgeRange"];
	selectedArrondissements: ReturnType<
		typeof useEventFilters
	>["selectedArrondissements"];
	selectedDateRange: ReturnType<typeof useEventFilters>["selectedDateRange"];
	selectedDayNightPeriods: ReturnType<
		typeof useEventFilters
	>["selectedDayNightPeriods"];
	selectedGenres: ReturnType<typeof useEventFilters>["selectedGenres"];
	excludedGenres: ReturnType<typeof useEventFilters>["excludedGenres"];
	selectedEventCategories: ReturnType<
		typeof useEventFilters
	>["selectedEventCategories"];
	selectedIndoorPreference: ReturnType<
		typeof useEventFilters
	>["selectedIndoorPreference"];
	includeFreeOptions: ReturnType<typeof useEventFilters>["includeFreeOptions"];
	selectedNationalities: ReturnType<
		typeof useEventFilters
	>["selectedNationalities"];
	selectedOOOCPicks: boolean;
	selectedPriceRange: ReturnType<typeof useEventFilters>["selectedPriceRange"];
	selectedVenueTypes: ReturnType<typeof useEventFilters>["selectedVenueTypes"];
	setIsFilterOpen: (isOpen: boolean) => void;
	setNearbyRadiusKm: (radiusKm: NearbyRadiusKm) => void;
	setSortMode: (sortMode: EventSortMode) => void;
	showNearbyEventsList: () => void;
	socialProofDisplayModes: Map<
		string,
		ReturnType<typeof getSocialProofDisplayModes> extends Map<string, infer T>
			? T
			: never
	>;
	sortMode: EventSortMode;
	spotlightRotationContext: SpotlightRotationContext;
	spotlightEventsOrdered: Event[];
	toggleNearbyEvents: (source?: NearbyEventsRequestSource) => void;
	toggleFilterExpansion: () => void;
	toggleFilterPanel: () => void;
	applyParisTestLocation: (source?: NearbyEventsRequestSource) => void;
}

const EventsSearchFiltersContext =
	createContext<EventsSearchFiltersContextValue | null>(null);

const orderEventsForDiscoverySurface = (
	events: Event[],
	sortMode: EventSortMode,
): Event[] => {
	const featuredMatches: Event[] = [];
	const promotedMatches: Event[] = [];
	const regularMatches: Event[] = [];
	const now = new Date();
	const regularEventsComparator =
		sortMode === "fresh-activity"
			? createFreshActivityComparator(now)
			: createRegularEventsComparator(now);

	for (const event of events) {
		if (shouldDisplayFeaturedEvent(event)) {
			featuredMatches.push(event);
			continue;
		}
		if (event.isPromoted === true) {
			promotedMatches.push(event);
			continue;
		}
		regularMatches.push(event);
	}

	return [
		...featuredMatches,
		...promotedMatches,
		...[...regularMatches].sort(regularEventsComparator),
	];
};

const buildAvailableGenresForEvents = (
	events: Event[],
): MusicGenreDefinition[] => {
	const genreByKey = new Map<string, MusicGenreDefinition>(
		MUSIC_GENRES.map((genre) => [genre.key, { ...genre }]),
	);
	for (const event of events) {
		for (const genre of event.genre ?? []) {
			if (genreByKey.has(genre)) continue;
			genreByKey.set(genre, {
				key: genre,
				label: toGenreLabel(genre),
				color: getCustomGenreColor(genre),
				isActive: true,
			});
		}
	}
	return Array.from(genreByKey.values()).sort((left, right) =>
		left.label.localeCompare(right.label),
	);
};

const buildAvailableNationalitiesForEvents = (events: Event[]) => {
	const optionsByCode = new Map<
		Nationality,
		{ key: Nationality; label: string; flag: string; shortCode: string }
	>();
	for (const event of events) {
		for (const nationality of event.nationality ?? []) {
			if (optionsByCode.has(nationality)) continue;
			const country = getCountryOption(nationality);
			optionsByCode.set(nationality, {
				key: nationality,
				label: country?.label ?? nationality,
				flag: country?.flag ?? "",
				shortCode: nationality,
			});
		}
	}
	return Array.from(optionsByCode.values()).sort((left, right) =>
		left.label.localeCompare(right.label),
	);
};

export function EventsSearchFiltersProvider({
	canUseProtectedDiscovery,
	children,
	isAuthenticated,
	onAuthRequired,
	onScrollToAllEvents,
	requireAuth,
	initialSpotlightRotationContext,
}: EventsSearchFiltersProviderProps) {
	const { events } = useEventsOffline();
	const { settings: localAppSettings, isLoaded: areLocalSettingsLoaded } =
		useLocalAppSettings();
	const [isFilterOpen, setIsFilterOpen] = useState(false);
	const [isFilterExpanded, setIsFilterExpanded] = useState(false);
	const [isFilterDrawerForced, setIsFilterDrawerForced] = useState(false);
	const [spotlightRotationContext, setSpotlightRotationContext] = useState(
		initialSpotlightRotationContext,
	);
	const [sortMode, setSortMode] = useState<EventSortMode>("upcoming");
	const [nearbyEventsStatus, setNearbyEventsStatus] =
		useState<NearbyEventsStatus>("idle");
	const [nearbyEventsError, setNearbyEventsError] = useState<string | null>(
		null,
	);
	const [nearbyLocation, setNearbyLocation] =
		useState<SavedClientLocation | null>(null);
	const [nearbyRadiusKm, setNearbyRadiusKmState] = useState<NearbyRadiusKm>(
		DEFAULT_NEARBY_RADIUS_KM,
	);
	const pendingAuthActionRef = useRef<PendingAuthAction | null>(null);
	const lastAppliedDefaultSortRef = useRef<EventSortMode | null>(null);
	const filters = useEventFilters({
		events,
		requireAuth,
		isFilterAccessAllowed: canUseProtectedDiscovery,
	});
	const {
		defaultDateRange,
		filteredEvents,
		onOOOCPicksToggle,
		onSearchQueryChange,
		selectedOOOCPicks,
	} = filters;

	useEffect(() => {
		const currentContext = getSpotlightRotationContext({
			dateRange: defaultDateRange,
		});
		setSpotlightRotationContext((previous) =>
			previous.rotationKey === currentContext.rotationKey &&
			previous.eventPhase === currentContext.eventPhase
				? previous
				: currentContext,
		);
	}, [defaultDateRange]);

	const availableGenres = useMemo(
		() => buildAvailableGenresForEvents(events),
		[events],
	);
	const availableNationalities = useMemo(
		() => buildAvailableNationalitiesForEvents(events),
		[events],
	);

	useEffect(() => {
		if (
			typeof window !== "undefined" &&
			window.matchMedia("(min-width: 1024px)").matches
		) {
			setIsFilterExpanded(true);
		}
	}, []);

	const toggleFilterPanel = useCallback(() => {
		if (!requireAuth()) return;
		setIsFilterDrawerForced(false);
		if (
			typeof window !== "undefined" &&
			window.matchMedia("(min-width: 1024px)").matches
		) {
			setIsFilterExpanded((previous) => !previous);
			setIsFilterOpen(false);
			return;
		}
		setIsFilterOpen((previous) => !previous);
	}, [requireAuth]);

	const openFilterPanel = useCallback(() => {
		setIsFilterDrawerForced(false);
		if (
			typeof window !== "undefined" &&
			window.matchMedia("(min-width: 1024px)").matches
		) {
			setIsFilterExpanded(true);
			setIsFilterOpen(false);
			return;
		}
		setIsFilterOpen(true);
	}, []);

	const openFilterDrawer = useCallback(() => {
		if (!requireAuth()) return;
		setIsFilterDrawerForced(true);
		setIsFilterOpen(true);
	}, [requireAuth]);

	const setFilterOpen = useCallback((isOpen: boolean) => {
		if (!isOpen) {
			setIsFilterDrawerForced(false);
		}
		setIsFilterOpen(isOpen);
	}, []);

	const toggleFilterExpansion = useCallback(() => {
		setIsFilterExpanded((previous) => !previous);
	}, []);

	const handleOOOCPicksCalloutClick = useCallback(() => {
		const shouldSelectOOOCPicks = !selectedOOOCPicks;
		if (shouldSelectOOOCPicks && !canUseProtectedDiscovery) {
			pendingAuthActionRef.current = "show-oooc-picks";
			onAuthRequired();
			return;
		}

		onOOOCPicksToggle(shouldSelectOOOCPicks);
		if (!shouldSelectOOOCPicks) return;

		window.requestAnimationFrame(() => {
			onScrollToAllEvents();
		});
	}, [
		canUseProtectedDiscovery,
		onAuthRequired,
		onOOOCPicksToggle,
		onScrollToAllEvents,
		selectedOOOCPicks,
	]);

	const handleSearchIntent = useCallback(
		(query: string, source: SearchAnalyticsSource = "input") => {
			if (!canUseProtectedDiscovery) {
				if (query.trim().length > 0) {
					pendingAuthActionRef.current = { type: "search", query, source };
				}
				onAuthRequired();
				return;
			}
			onSearchQueryChange(query, source);
		},
		[canUseProtectedDiscovery, onAuthRequired, onSearchQueryChange],
	);

	const handleSearchFocus = useCallback(() => {
		if (canUseProtectedDiscovery) {
			return;
		}
		onAuthRequired();
	}, [canUseProtectedDiscovery, onAuthRequired]);

	const handleSortModeChange = useCallback((nextSortMode: EventSortMode) => {
		setSortMode((current) => {
			if (current === nextSortMode) return current;
			trackDiscoveryAnalytics({
				actionType: "sort_change",
				filterGroup: "sort_mode",
				filterValue: nextSortMode,
			});
			return nextSortMode;
		});
	}, []);

	useEffect(() => {
		if (!areLocalSettingsLoaded) return;
		const defaultSortMode = localAppSettings.defaultEventSortMode;
		if (lastAppliedDefaultSortRef.current === defaultSortMode) return;
		lastAppliedDefaultSortRef.current = defaultSortMode;
		setSortMode((current) =>
			current === "nearby" ? current : defaultSortMode,
		);
	}, [areLocalSettingsLoaded, localAppSettings.defaultEventSortMode]);

	const canUseParisTestLocation = isClientLocationDevToolsEnabled();
	const showNearbyEventsList = useCallback(() => {
		window.requestAnimationFrame(() => {
			onScrollToAllEvents();
		});
	}, [onScrollToAllEvents]);
	const shouldScrollAfterNearbyRequest = useCallback(
		(source: NearbyEventsRequestSource) => source !== "map",
		[],
	);

	const applyNearbyLocation = useCallback(
		(input: {
			location: SavedClientLocation;
			requestSource: NearbyEventsRequestSource;
			status: Exclude<NearbyEventsStatus, "idle" | "requesting" | "unavailable">;
			trackingValue: string;
		}) => {
			setNearbyLocation(input.location);
			setNearbyEventsStatus(input.status);
			handleSortModeChange("nearby");
			trackDiscoveryAnalytics({
				actionType: "location_request",
				filterGroup: "nearby",
				filterValue: input.trackingValue,
			});
			if (shouldScrollAfterNearbyRequest(input.requestSource)) {
				showNearbyEventsList();
			}
		},
		[handleSortModeChange, shouldScrollAfterNearbyRequest, showNearbyEventsList],
	);

	const toggleNearbyEvents = useCallback(
		async (source: NearbyEventsRequestSource = "list") => {
			if (sortMode === "nearby") {
				handleSortModeChange("upcoming");
				setNearbyEventsError(null);
				return;
			}
			if (!requireAuth()) return;

			trackDiscoveryAnalytics({
				actionType: "location_request",
				filterGroup: "nearby",
				filterValue: source === "map" ? "map_request" : "all_events_request",
			});
			setNearbyEventsStatus("requesting");
			setNearbyEventsError(null);
			const result = await requestClientLocation();
			if (!result.location) {
				setNearbyEventsStatus("unavailable");
				setNearbyEventsError(result.error);
				trackDiscoveryAnalytics({
					actionType: "location_request",
					filterGroup: "nearby",
					filterValue:
						source === "map" ? "map_unavailable" : "all_events_unavailable",
				});
				return;
			}

			applyNearbyLocation({
				location: result.location,
				requestSource: source,
				status:
					result.status === "last-known"
						? "active-last-known"
						: "active-current",
				trackingValue:
					result.status === "last-known"
						? source === "map"
							? "map_last_known"
							: "all_events_last_known"
						: source === "map"
							? "map_current"
							: "all_events_current",
			});
		},
		[applyNearbyLocation, handleSortModeChange, requireAuth, sortMode],
	);

	const applyParisTestLocation = useCallback(
		(source: NearbyEventsRequestSource = "map") => {
			if (!canUseParisTestLocation) return;
			applyNearbyLocation({
				location: getParisTestClientLocation(),
				requestSource: source,
				status: "active-current",
				trackingValue:
					source === "map"
						? "map_paris_test_location"
						: "all_events_paris_test_location",
			});
			setNearbyEventsError(null);
		},
		[applyNearbyLocation, canUseParisTestLocation],
	);

	const setNearbyRadiusKm = useCallback((radiusKm: NearbyRadiusKm) => {
		setNearbyRadiusKmState(normalizeNearbyRadiusKm(radiusKm));
		trackDiscoveryAnalytics({
			actionType: "filter_apply",
			filterGroup: "nearby_radius",
			filterValue: `${radiusKm}km`,
		});
	}, []);

	useEffect(() => {
		if (!isAuthenticated) return;
		const pendingAuthAction = pendingAuthActionRef.current;
		if (!pendingAuthAction) return;

		pendingAuthActionRef.current = null;
		if (pendingAuthAction === "show-oooc-picks") {
			onOOOCPicksToggle(true);
		} else {
			onSearchQueryChange(pendingAuthAction.query, pendingAuthAction.source);
		}
		window.requestAnimationFrame(() => {
			onScrollToAllEvents();
		});
	}, [
		isAuthenticated,
		onOOOCPicksToggle,
		onScrollToAllEvents,
		onSearchQueryChange,
	]);

	const spotlightEligibleEvents = useMemo(
		() =>
			getDiscoveryEligibleEvents(events, {
				dateRange: defaultDateRange,
			}),
		[defaultDateRange, events],
	);

	const spotlightEventsOrdered = useMemo(
		() => orderEventsForDiscoverySurface(spotlightEligibleEvents, "upcoming"),
		[spotlightEligibleEvents],
	);

	const nearbyEventsOrdered = useMemo(() => {
		if (!nearbyLocation) return [];
		const maxDistanceKm = shouldApplyNearbyRadius(nearbyLocation.coordinates)
			? nearbyRadiusKm
			: undefined;
		return findNearbyEvents(filteredEvents, nearbyLocation.coordinates, {
			limit: filteredEvents.length,
			maxDistanceKm,
		});
	}, [filteredEvents, nearbyLocation, nearbyRadiusKm]);

	const nearbyLocationScope = useMemo(
		() =>
			nearbyLocation
				? getNearbyLocationScope(nearbyLocation.coordinates)
				: null,
		[nearbyLocation],
	);

	const allEventsOrdered = useMemo(() => {
		if (sortMode === "nearby") return nearbyEventsOrdered;
		return orderEventsForDiscoverySurface(filteredEvents, sortMode);
	}, [filteredEvents, nearbyEventsOrdered, sortMode]);

	const socialProofDisplayModes = useMemo(
		() => getSocialProofDisplayModes(spotlightEligibleEvents),
		[spotlightEligibleEvents],
	);

	const value = useMemo(
		() => ({
			...filters,
			allEventsOrdered,
			availableGenres,
			availableNationalities,
			canUseParisTestLocation,
			handleOOOCPicksCalloutClick,
			handleSearchFocus,
			handleSearchIntent,
			isFilterExpanded,
			isFilterDrawerForced,
			isFilterOpen,
			nearbyEventsError,
			nearbyEventsStatus,
			nearbyLocation,
			nearbyLocationScope,
			nearbyMatchedEventsCount: nearbyEventsOrdered.length,
			nearbyRadiusKm,
			nearbyRadiusOptionsKm: NEARBY_RADIUS_OPTIONS_KM,
			openFilterDrawer,
			openFilterPanel,
			setIsFilterOpen: setFilterOpen,
			setNearbyRadiusKm,
			setSortMode: handleSortModeChange,
			showNearbyEventsList,
			socialProofDisplayModes,
			sortMode,
			spotlightRotationContext,
			spotlightEventsOrdered,
			toggleNearbyEvents,
			toggleFilterExpansion,
			toggleFilterPanel,
			applyParisTestLocation,
		}),
		[
			filters,
			allEventsOrdered,
			availableGenres,
			availableNationalities,
			canUseParisTestLocation,
			handleOOOCPicksCalloutClick,
			handleSearchFocus,
			handleSearchIntent,
			isFilterExpanded,
			isFilterDrawerForced,
			isFilterOpen,
			nearbyEventsError,
			nearbyEventsStatus,
			nearbyLocation,
			nearbyLocationScope,
			nearbyEventsOrdered.length,
			nearbyRadiusKm,
			openFilterDrawer,
			openFilterPanel,
			setFilterOpen,
			setNearbyRadiusKm,
			handleSortModeChange,
			showNearbyEventsList,
			socialProofDisplayModes,
			sortMode,
			spotlightRotationContext,
			spotlightEventsOrdered,
			toggleNearbyEvents,
			toggleFilterExpansion,
			toggleFilterPanel,
			applyParisTestLocation,
		],
	);

	return (
		<EventsSearchFiltersContext.Provider value={value}>
			{children}
		</EventsSearchFiltersContext.Provider>
	);
}

export function useEventsSearchFilters() {
	const context = useContext(EventsSearchFiltersContext);
	if (!context) {
		throw new Error(
			"useEventsSearchFilters must be used within EventsSearchFiltersProvider",
		);
	}
	return context;
}
