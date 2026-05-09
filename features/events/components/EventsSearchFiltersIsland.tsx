"use client";

import AuthGate from "@/features/auth/components/AuthGate";
import SearchBar from "@/features/events/components/SearchBar";
import { useEventsSearchFilters } from "@/features/events/components/events-search-filters-provider";
import type { SearchChip } from "@/features/events/search-chips";
import { type ReactNode, Suspense, lazy } from "react";

const FilterPanel = lazy(
	() => import("@/features/events/components/FilterPanel"),
);

const NoopSuspenseFallback = (
	<span className="sr-only" aria-hidden="true">
		Loading
	</span>
);

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
		onAgeRangeChange,
		onArrondissementToggle,
		onClearFilters,
		onDateRangeChange,
		onDayNightPeriodToggle,
		onGenreToggle,
		onIndoorPreferenceChange,
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
		selectedGenres,
		selectedIndoorPreference,
		selectedNationalities,
		selectedOOOCPicks,
		selectedPriceRange,
		selectedVenueTypes,
		setIsFilterOpen,
		toggleFilterExpansion,
	} = useEventsSearchFilters();

	const searchSlot = (
		<div id="tour-search" className="w-full">
			<SearchBar
				onSearch={handleSearchIntent}
				onSearchFocus={handleSearchFocus}
				placeholder="Search events, locations, genres, phases..."
				className="mx-auto w-full max-w-[64rem]"
				value={searchQuery}
				resultsCount={filteredEvents.length}
				showResultsCount
				resultsCountLabelMode={hasAnyActiveFilters ? "found" : "available"}
				dynamicChips={dynamicSearchChips}
			/>
		</div>
	);

	return (
		<div
			id="all-events"
			className="scroll-mt-6 lg:grid lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] lg:items-start lg:gap-5 sm:scroll-mt-28"
		>
			<aside className="lg:sticky lg:top-30 lg:self-start">
				<Suspense fallback={NoopSuspenseFallback}>
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
							selectedNationalities={selectedNationalities}
							selectedVenueTypes={selectedVenueTypes}
							selectedIndoorPreference={selectedIndoorPreference}
							selectedPriceRange={selectedPriceRange}
							selectedAgeRange={selectedAgeRange}
							selectedOOOCPicks={selectedOOOCPicks}
							onDateRangeChange={onDateRangeChange}
							onDayNightPeriodToggle={onDayNightPeriodToggle}
							onArrondissementToggle={onArrondissementToggle}
							onGenreToggle={onGenreToggle}
							onNationalityToggle={onNationalityToggle}
							onVenueTypeToggle={onVenueTypeToggle}
							onIndoorPreferenceChange={onIndoorPreferenceChange}
							onPriceRangeChange={onPriceRangeChange}
							onAgeRangeChange={onAgeRangeChange}
							onOOOCPicksToggle={onOOOCPicksToggle}
							onClearFilters={onClearFilters}
							availableArrondissements={availableArrondissements}
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
							hideFloatingButton={!canUseProtectedDiscovery}
						/>
					</AuthGate>
				</Suspense>
			</aside>

			<div id="tour-all-events" className="min-w-0 scroll-mt-6 sm:scroll-mt-28">
				{children(searchSlot)}
			</div>
		</div>
	);
}
