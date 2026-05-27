"use client";

import { AllEvents } from "@/features/events/components/AllEvents";
import { useEventsSearchFilters } from "@/features/events/components/events-search-filters-provider";
import { useSavedEvents } from "@/features/events/components/saved-events-provider";
import type { Event } from "@/features/events/types";
import { type ReactNode, type RefObject, useMemo, useState } from "react";

interface EventListIslandProps {
	allEventsRef: RefObject<HTMLDivElement | null>;
	isAuthenticated: boolean;
	isAuthResolved: boolean;
	onAuthRequired: () => void;
	onEventClick: (event: Event) => void;
	searchSlot?: ReactNode;
}

export function EventListIsland({
	allEventsRef,
	isAuthenticated,
	isAuthResolved,
	onAuthRequired,
	onEventClick,
	searchSlot,
}: EventListIslandProps) {
	const {
		activeFiltersCount,
		allEventsOrdered,
		hasAnyActiveFilters,
		nearbyEventsError,
		nearbyEventsStatus,
		nearbyLocationScope,
		nearbyMatchedEventsCount,
		nearbyRadiusKm,
		nearbyRadiusOptionsKm,
		onClearFilters,
		selectedDayNightPeriods,
		setSortMode,
		setNearbyRadiusKm,
		socialProofDisplayModes,
		sortMode,
		toggleNearbyEvents,
		toggleFilterPanel,
	} = useEventsSearchFilters();
	const {
		getSavedEvents,
		isEventSaved,
		pendingSavedMutationCount,
		pendingSavedMutationStatus,
		savedEventsCount,
	} = useSavedEvents();
	const [showSavedOnly, setShowSavedOnly] = useState(false);
	const visibleEvents = useMemo(
		() => (showSavedOnly ? getSavedEvents(allEventsOrdered) : allEventsOrdered),
		[allEventsOrdered, getSavedEvents, showSavedOnly],
	);

	return (
		<AllEvents
			ref={allEventsRef}
			events={visibleEvents}
			onEventClick={onEventClick}
			socialProofDisplayModes={socialProofDisplayModes}
			sortMode={sortMode}
			onSortModeChange={setSortMode}
			onFilterClickAction={toggleFilterPanel}
			onClearFilters={onClearFilters}
			onAuthRequired={onAuthRequired}
			hasActiveFilters={hasAnyActiveFilters}
			activeFiltersCount={activeFiltersCount}
			isAuthenticated={isAuthenticated}
			isAuthResolved={isAuthResolved}
			nearbyEventsError={nearbyEventsError}
			nearbyEventsStatus={nearbyEventsStatus}
			nearbyLocationScope={nearbyLocationScope}
			nearbyMatchedEventsCount={nearbyMatchedEventsCount}
			nearbyRadiusKm={nearbyRadiusKm}
			nearbyRadiusOptionsKm={nearbyRadiusOptionsKm}
			onNearbyClick={toggleNearbyEvents}
			onNearbyRadiusChange={setNearbyRadiusKm}
			isEventSaved={isEventSaved}
			savedEventsCount={savedEventsCount}
			pendingSavedMutationCount={pendingSavedMutationCount}
			pendingSavedMutationStatus={pendingSavedMutationStatus}
			showSavedOnly={showSavedOnly}
			onSavedOnlyChange={setShowSavedOnly}
			selectedDayNightPeriods={selectedDayNightPeriods}
			searchSlot={searchSlot}
		/>
	);
}
