"use client";

import { ScrollToTopButton } from "@/components/ScrollToTopButton";
import { useAuth } from "@/features/auth/auth-context";
import AuthGate from "@/features/auth/components/AuthGate";
import EmailGateModal from "@/features/auth/components/EmailGateModal";
import { AllEvents } from "@/features/events/components/AllEvents";
import EventModal from "@/features/events/components/EventModal";
import EventStats from "@/features/events/components/EventStats";
import FilterPanel from "@/features/events/components/FilterPanel";
import SearchBar from "@/features/events/components/SearchBar";
import { FeaturedEvents } from "@/features/events/featured/FeaturedEvents";
import { useEventFilters } from "@/features/events/hooks/use-event-filters";
import type { Event } from "@/features/events/types";
import { EventsMapCard } from "@/features/maps/components/events-map-card";
import { useCallback, useRef, useState } from "react";

interface EventsClientProps {
	initialEvents: Event[];
}

export function EventsClient({ initialEvents }: EventsClientProps) {
	const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
	const [isFilterOpen, setIsFilterOpen] = useState(false);
	const [isMapExpanded, setIsMapExpanded] = useState(false);
	const [isFilterExpanded, setIsFilterExpanded] = useState(false);
	const [showEmailGate, setShowEmailGate] = useState(false);
	const allEventsRef = useRef<HTMLDivElement>(null);
	const { isAuthenticated, isAuthResolved, authenticate } = useAuth();

	const requireAuth = useCallback(() => {
		if (!isAuthenticated) {
			setShowEmailGate(true);
			return false;
		}
		return true;
	}, [isAuthenticated]);

	const {
		selectedDate,
		selectedDayNightPeriods,
		selectedArrondissements,
		selectedGenres,
		selectedNationalities,
		selectedVenueTypes,
		selectedIndoorPreference,
		selectedPriceRange,
		selectedAgeRange,
		selectedOOOCPicks,
		availableArrondissements,
		availableEventDates,
		filteredEvents,
		hasAnyActiveFilters,
		activeFiltersCount,
		onDateChange,
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
	} = useEventFilters({
		events: initialEvents,
		requireAuth,
	});

	const handleEmailSubmit = useCallback(
		(email: string) => {
			authenticate(email);
			setShowEmailGate(false);
		},
		[authenticate],
	);

	const toggleFilterPanel = useCallback(() => {
		if (!requireAuth()) return;
		setIsFilterOpen((previous) => !previous);
	}, [requireAuth]);

	const toggleMapExpansion = useCallback(() => {
		setIsMapExpanded((previous) => !previous);
	}, []);

	const toggleFilterExpansion = useCallback(() => {
		setIsFilterExpanded((previous) => !previous);
	}, []);

	const scrollToAllEvents = useCallback(() => {
		allEventsRef.current?.scrollIntoView({
			behavior: "smooth",
			block: "start",
		});
	}, []);

	return (
		<>
			<div className="mb-8">
				<AuthGate
					isAuthenticated={isAuthenticated}
					isAuthResolved={isAuthResolved}
					onAuthRequired={() => setShowEmailGate(true)}
					className="min-h-[120px] flex items-center"
				>
					<SearchBar
						onSearch={onSearchQueryChange}
						placeholder="Search events, locations, genres, types..."
						className="max-w-md mx-auto"
					/>
				</AuthGate>
			</div>

			<FeaturedEvents
				events={filteredEvents}
				onEventClick={setSelectedEvent}
				onScrollToAllEvents={scrollToAllEvents}
			/>

			<EventStats events={initialEvents} filteredEvents={filteredEvents} />

			<div className="mb-8 relative z-10">
				<EventsMapCard
					events={filteredEvents}
					isExpanded={isMapExpanded}
					onToggleExpanded={toggleMapExpansion}
					onEventClick={setSelectedEvent}
				/>
			</div>

			<div className="mb-8">
				<AuthGate
					isAuthenticated={isAuthenticated}
					isAuthResolved={isAuthResolved}
					onAuthRequired={() => setShowEmailGate(true)}
					className="min-h-[400px]"
				>
					<FilterPanel
						selectedDate={selectedDate}
						selectedDayNightPeriods={selectedDayNightPeriods}
						selectedArrondissements={selectedArrondissements}
						selectedGenres={selectedGenres}
						selectedNationalities={selectedNationalities}
						selectedVenueTypes={selectedVenueTypes}
						selectedIndoorPreference={selectedIndoorPreference}
						selectedPriceRange={selectedPriceRange}
						selectedAgeRange={selectedAgeRange}
						selectedOOOCPicks={selectedOOOCPicks}
						onDateChange={onDateChange}
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
						availableEventDates={availableEventDates}
						filteredEventsCount={filteredEvents.length}
						isOpen={isFilterOpen}
						onClose={() => setIsFilterOpen(false)}
						onOpen={() => setIsFilterOpen(true)}
						isExpanded={isFilterExpanded}
						onToggleExpanded={toggleFilterExpansion}
					/>
				</AuthGate>
			</div>

			<AllEvents
				ref={allEventsRef}
				events={filteredEvents}
				onEventClick={setSelectedEvent}
				onFilterClickAction={toggleFilterPanel}
				hasActiveFilters={hasAnyActiveFilters}
				activeFiltersCount={activeFiltersCount}
			/>

			<EventModal
				event={selectedEvent}
				isOpen={selectedEvent !== null}
				onClose={() => setSelectedEvent(null)}
			/>

			<EmailGateModal
				isOpen={showEmailGate}
				onClose={() => setShowEmailGate(false)}
				onEmailSubmit={handleEmailSubmit}
			/>

			<ScrollToTopButton />
		</>
	);
}
