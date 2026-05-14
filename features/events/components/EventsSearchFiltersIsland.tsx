"use client";

import AuthGate from "@/features/auth/components/AuthGate";
import FilterPanel from "@/features/events/components/FilterPanel";
import SearchBar from "@/features/events/components/SearchBar";
import { useEventsSearchFilters } from "@/features/events/components/events-search-filters-provider";
import type { SearchChip } from "@/features/events/search-chips";
import type { ReactNode } from "react";

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
		includeFreeOptions,
		onAgeRangeChange,
		onArrondissementToggle,
		onClearFilters,
		onDateRangeChange,
		onDayNightPeriodToggle,
		onGenreExcludeToggle,
		onGenreToggle,
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

	const searchSlot = (
		<div id="tour-search" className="w-full">
			<SearchBar
				onSearch={handleSearchIntent}
				onSearchFocus={handleSearchFocus}
				placeholder="Search events, locations, genres, phases..."
				className="mx-auto w-full"
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
						onNationalityToggle={onNationalityToggle}
						onVenueTypeToggle={onVenueTypeToggle}
						onIndoorPreferenceChange={onIndoorPreferenceChange}
						onPriceRangeChange={onPriceRangeChange}
						onIncludeFreeOptionsChange={onIncludeFreeOptionsChange}
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
			</aside>

			<div id="tour-all-events" className="min-w-0 scroll-mt-6 sm:scroll-mt-28">
				{children(searchSlot)}
			</div>
		</div>
	);
}
