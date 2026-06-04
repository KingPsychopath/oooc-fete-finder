"use client";

import AuthGate from "@/features/auth/components/AuthGate";
import FilterPanel from "@/features/events/components/FilterPanel";
import SearchBar from "@/features/events/components/SearchBar";
import { useEventsSearchFilters } from "@/features/events/components/events-search-filters-provider";
import {
	MOBILE_DISCOVERY_FILTER_EVENT,
	MOBILE_DISCOVERY_PENDING_ACTION_KEY,
	MOBILE_DISCOVERY_PENDING_QUERY_KEY,
	MOBILE_DISCOVERY_SEARCH_EVENT,
	MOBILE_DISCOVERY_STATE_EVENT,
	type MobileDiscoveryPendingAction,
	type MobileDiscoverySearchDetail,
	type MobileDiscoveryStateDetail,
} from "@/features/events/components/mobile-discovery-events";
import { getActiveFiltersCount } from "@/features/events/filtering";
import type { SearchChip } from "@/features/events/search-chips";
import { useEffect } from "react";
import type { ReactNode } from "react";

const EVENTS_SEARCH_INPUT_ID = "events-search-input";

interface EventsSearchFiltersIslandProps {
	canUseProtectedDiscovery: boolean;
	children: (searchSlot: ReactNode) => ReactNode;
	dynamicSearchChips: SearchChip[];
	isAuthResolved: boolean;
	onAuthRequired: () => void;
}

export function EventsSearchFiltersIsland({
	canUseProtectedDiscovery,
	children,
	dynamicSearchChips,
	isAuthResolved,
	onAuthRequired,
}: EventsSearchFiltersIslandProps) {
	const {
		availableArrondissements,
		availableEventCategories,
		availableEventDates,
		availableGenres,
		availableNationalities,
		defaultDateRange,
		filteredEvents,
		handleSearchFocus,
		handleSearchIntent,
		hasAnyActiveFilters,
		isFilterDrawerForced,
		isFilterExpanded,
		isFilterOpen,
		includeFreeOptions,
		onAgeRangeChange,
		onArrondissementToggle,
		onClearFilters,
		onDateRangeChange,
		onDayNightPeriodToggle,
		onGenreExcludeToggle,
		onGenreToggle,
		onEventCategoryToggle,
		onIndoorPreferenceChange,
		onIncludeFreeOptionsChange,
		onNationalityToggle,
		onOOOCPicksToggle,
		onPriceRangeChange,
		onVenueTypeToggle,
		openFilterPanel,
		quickSelectEventDates,
		searchQuery,
		selectedAgeRange,
		selectedArrondissements,
		selectedDateRange,
		selectedDayNightPeriods,
		selectedEventCategories,
		excludedGenres,
		selectedGenres,
		selectedIndoorPreference,
		selectedNationalities,
		selectedOOOCPicks,
		selectedPriceRange,
		selectedVenueTypes,
		setIsFilterOpen,
		toggleFilterExpansion,
	} = useEventsSearchFilters();

	const activeFilterCount = getActiveFiltersCount(
		{
			selectedDateRange,
			selectedDayNightPeriods,
			selectedArrondissements,
			selectedGenres,
			excludedGenres,
			selectedEventCategories,
			selectedNationalities,
			selectedVenueTypes,
			selectedIndoorPreference,
			selectedPriceRange,
			includeFreeOptions,
			selectedAgeRange,
			selectedOOOCPicks,
			searchQuery,
		},
		{ defaultDateRange },
	);

	useEffect(() => {
		const detail: MobileDiscoveryStateDetail = {
			activeFilterCount,
			hasActiveFilters: hasAnyActiveFilters,
			isAvailable: true,
			query: searchQuery,
			resultsCount: filteredEvents.length,
		};
		window.dispatchEvent(
			new CustomEvent<MobileDiscoveryStateDetail>(
				MOBILE_DISCOVERY_STATE_EVENT,
				{ detail },
			),
		);
	}, [
		activeFilterCount,
		filteredEvents.length,
		hasAnyActiveFilters,
		searchQuery,
	]);

	useEffect(() => {
		const scrollToEvents = (behavior: ScrollBehavior = "smooth") => {
			document
				.getElementById("all-events")
				?.scrollIntoView({ block: "start", behavior });
		};

		const focusSearch = () => {
			window.requestAnimationFrame(() => {
				const input = document.getElementById(EVENTS_SEARCH_INPUT_ID);
				if (input instanceof HTMLInputElement) {
					input.focus({ preventScroll: true });
				}
			});
		};

		const handleMobileSearch = (event: Event) => {
			const detail = (event as CustomEvent<MobileDiscoverySearchDetail>).detail;
			scrollToEvents(detail?.behavior);
			if (typeof detail?.query === "string") {
				handleSearchIntent(detail.query, "input");
			}
			if (detail?.shouldFocus !== false) {
				focusSearch();
			}
		};

		const handleMobileFilter = () => {
			if (!canUseProtectedDiscovery) {
				onAuthRequired();
				return;
			}
			openFilterPanel();
		};

		window.addEventListener(MOBILE_DISCOVERY_SEARCH_EVENT, handleMobileSearch);
		window.addEventListener(MOBILE_DISCOVERY_FILTER_EVENT, handleMobileFilter);

		const pendingAction = window.sessionStorage.getItem(
			MOBILE_DISCOVERY_PENDING_ACTION_KEY,
		) as MobileDiscoveryPendingAction | null;
		if (pendingAction) {
			window.sessionStorage.removeItem(MOBILE_DISCOVERY_PENDING_ACTION_KEY);
			const pendingQuery =
				window.sessionStorage.getItem(MOBILE_DISCOVERY_PENDING_QUERY_KEY) ??
				undefined;
			window.sessionStorage.removeItem(MOBILE_DISCOVERY_PENDING_QUERY_KEY);
			window.requestAnimationFrame(() => {
				if (pendingAction === "filter") {
					handleMobileFilter();
					return;
				}
				handleMobileSearch({
					type: MOBILE_DISCOVERY_SEARCH_EVENT,
					detail: {
						behavior: "auto",
						query: pendingQuery,
						shouldFocus: false,
					},
				} as CustomEvent<MobileDiscoverySearchDetail>);
			});
		}

		return () => {
			window.removeEventListener(
				MOBILE_DISCOVERY_SEARCH_EVENT,
				handleMobileSearch,
			);
			window.removeEventListener(
				MOBILE_DISCOVERY_FILTER_EVENT,
				handleMobileFilter,
			);
		};
	}, [
		canUseProtectedDiscovery,
		handleSearchIntent,
		onAuthRequired,
		openFilterPanel,
	]);

	const searchSlot = (
		<div id="tour-search" className="w-full">
			<SearchBar
				onSearch={(query, _results, source) =>
					handleSearchIntent(query, source)
				}
				onSearchFocus={handleSearchFocus}
				placeholder="Search events, locations, genres, categories..."
				className="mx-auto w-full"
				value={searchQuery}
				resultsCount={filteredEvents.length}
				showResultsCount
				resultsCountLabelMode={hasAnyActiveFilters ? "found" : "available"}
				dynamicChips={dynamicSearchChips}
				inputId={EVENTS_SEARCH_INPUT_ID}
			/>
		</div>
	);

	return (
		<div
			id="all-events"
			className="scroll-mt-6 lg:grid lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] xl:grid-cols-[minmax(300px,340px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(340px,380px)_minmax(0,1fr)] lg:items-start lg:gap-5 2xl:gap-6 sm:scroll-mt-28"
		>
			<aside className="lg:sticky lg:top-30 lg:self-start">
				<AuthGate
					isAuthenticated={canUseProtectedDiscovery}
					isAuthResolved={isAuthResolved}
					onAuthRequired={onAuthRequired}
					className="min-h-0"
					variant="filter-preview"
				>
					<FilterPanel
						selectedDateRange={selectedDateRange}
						defaultDateRange={defaultDateRange}
						selectedDayNightPeriods={selectedDayNightPeriods}
						selectedArrondissements={selectedArrondissements}
						selectedGenres={selectedGenres}
						excludedGenres={excludedGenres}
						selectedEventCategories={selectedEventCategories}
						selectedNationalities={selectedNationalities}
						selectedVenueTypes={selectedVenueTypes}
						selectedIndoorPreference={selectedIndoorPreference}
						selectedPriceRange={selectedPriceRange}
						includeFreeOptions={includeFreeOptions}
						selectedAgeRange={selectedAgeRange}
						selectedOOOCPicks={selectedOOOCPicks}
						onDateRangeChange={onDateRangeChange}
						onDayNightPeriodToggle={onDayNightPeriodToggle}
						onArrondissementToggle={onArrondissementToggle}
						onGenreToggle={onGenreToggle}
						onGenreExcludeToggle={onGenreExcludeToggle}
						onEventCategoryToggle={onEventCategoryToggle}
						onNationalityToggle={onNationalityToggle}
						onVenueTypeToggle={onVenueTypeToggle}
						onIndoorPreferenceChange={onIndoorPreferenceChange}
						onPriceRangeChange={onPriceRangeChange}
						onIncludeFreeOptionsChange={onIncludeFreeOptionsChange}
						onAgeRangeChange={onAgeRangeChange}
						onOOOCPicksToggle={onOOOCPicksToggle}
						onClearFilters={onClearFilters}
						availableArrondissements={availableArrondissements}
						availableEventCategories={availableEventCategories}
						availableGenres={availableGenres}
						availableNationalities={availableNationalities}
						availableEventDates={availableEventDates}
						quickSelectEventDates={quickSelectEventDates}
						filteredEventsCount={filteredEvents.length}
						isOpen={isFilterOpen}
						onClose={() => setIsFilterOpen(false)}
						onOpen={openFilterPanel}
						forceDrawer={isFilterDrawerForced}
						isExpanded={isFilterExpanded}
						onToggleExpanded={toggleFilterExpansion}
						hideFloatingButton
					/>
				</AuthGate>
			</aside>

			<div id="tour-all-events" className="min-w-0 scroll-mt-6 sm:scroll-mt-28">
				{children(searchSlot)}
			</div>
		</div>
	);
}
