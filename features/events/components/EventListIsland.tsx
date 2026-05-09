"use client";

import { AllEvents } from "@/features/events/components/AllEvents";
import { useEventsSearchFilters } from "@/features/events/components/events-search-filters-provider";
import type { Event } from "@/features/events/types";
import type { ReactNode, RefObject } from "react";

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
		nearbyMatchedEventsCount,
		onClearFilters,
		setSortMode,
		socialProofDisplayModes,
		sortMode,
		toggleNearbyEvents,
		toggleFilterPanel,
	} = useEventsSearchFilters();

	return (
		<AllEvents
			ref={allEventsRef}
			events={allEventsOrdered}
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
			nearbyMatchedEventsCount={nearbyMatchedEventsCount}
			onNearbyClick={toggleNearbyEvents}
			searchSlot={searchSlot}
		/>
	);
}
