"use client";

import React, { useState, useMemo, useCallback, useRef } from "react";
import ParisMap from "@/components/ParisMap";
import FilterPanel from "@/components/FilterPanel";
import EventModal from "@/components/EventModal";
import SearchBar from "@/components/SearchBar";
import EventStats from "@/components/EventStats";
import { FeaturedEvents } from "@/components/featured-events/FeaturedEvents";
import { AllEvents } from "@/components/AllEvents";
import EmailGateModal from "@/components/EmailGateModal";
import AuthGate from "@/components/AuthGate";
import { useAuth } from "@/lib/auth-context";
import {
	getDayNightPeriod,
	isEventInDayNightPeriod,
	MUSIC_GENRES,
	NATIONALITIES,
	formatPrice,
	isPriceInRange,
	PRICE_RANGE_CONFIG,
	formatPriceRange,
	AGE_RANGE_CONFIG,
	formatAge,
	isAgeInRange,
	formatAgeRange,
	type Event,
	type EventDay,
	type DayNightPeriod,
	type MusicGenre,
	type Nationality,
	type VenueType,
	type ParisArrondissement,
	type AgeRange,
} from "@/types/events";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
	MapPin,
	Clock,
	Filter,
	Star,
	Euro,
	Users,
	ChevronDown,
	ChevronUp,
	Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface EventsClientProps {
	initialEvents: Event[];
}

export function EventsClient({ initialEvents }: EventsClientProps) {
	const [events] = useState<Event[]>(initialEvents);
	const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
	const [hoveredArrondissement, setHoveredArrondissement] = useState<
		number | null
	>(null);
	const [isFilterOpen, setIsFilterOpen] = useState(false);
	const [isMapExpanded, setIsMapExpanded] = useState(false);
	const [isFilterExpanded, setIsFilterExpanded] = useState(false);
	const [selectedDays, setSelectedDays] = useState<EventDay[]>([]);
	const [selectedDayNightPeriods, setSelectedDayNightPeriods] = useState<
		DayNightPeriod[]
	>([]);
	const [selectedArrondissements, setSelectedArrondissements] = useState<
		ParisArrondissement[]
	>([]);
	const [selectedGenres, setSelectedGenres] = useState<MusicGenre[]>([]);
	const [selectedNationalities, setSelectedNationalities] = useState<
		Nationality[]
	>([]);
	const [selectedVenueTypes, setSelectedVenueTypes] = useState<VenueType[]>([]);
	const [selectedIndoorPreference, setSelectedIndoorPreference] = useState<
		boolean | null
	>(null);
	const [selectedPriceRange, setSelectedPriceRange] = useState<
		[number, number]
	>(PRICE_RANGE_CONFIG.defaultRange);
	const [selectedAgeRange, setSelectedAgeRange] = useState<AgeRange | null>(
		null,
	);
	const [selectedOOOCPicks, setSelectedOOOCPicks] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");

	// Authentication state
	const { isAuthenticated, authenticate } = useAuth();
	const [showEmailGate, setShowEmailGate] = useState(false);

	// Ref for scrolling to all events section
	const allEventsRef = useRef<HTMLDivElement>(null);

	// Get available filter options
	const availableArrondissements = useMemo(() => {
		const arrondissements = new Set(
			events.map((event) => event.arrondissement),
		);
		return Array.from(arrondissements).sort((a, b) => {
			if (a === "unknown") return 1;
			if (b === "unknown") return -1;
			return (a as number) - (b as number);
		}) as ParisArrondissement[];
	}, [events]);

	// Get available event days from the events data
	const availableEventDays = useMemo(() => {
		const days = new Set(events.map((event) => event.day));
		return Array.from(days).filter((day): day is EventDay => day !== undefined);
	}, [events]);

	// Filter events based on selected filters and search query
	const filteredEvents = useMemo(() => {
		return events.filter((event) => {
			// Filter by OOOC Picks
			if (selectedOOOCPicks && event.isOOOCPick !== true) return false;

			// Filter by selected days
			if (selectedDays.length > 0 && !selectedDays.includes(event.day))
				return false;

			// Filter by day/night periods
			if (selectedDayNightPeriods.length > 0) {
				const hasMatchingPeriod = selectedDayNightPeriods.some((period) =>
					isEventInDayNightPeriod(event, period),
				);
				if (!hasMatchingPeriod) return false;
			}

			// Filter by selected arrondissements
			if (
				selectedArrondissements.length > 0 &&
				!selectedArrondissements.includes(event.arrondissement)
			)
				return false;

			// Filter by selected genres
			if (selectedGenres.length > 0) {
				const hasMatchingGenre = event.genre.some((genre) =>
					selectedGenres.includes(genre),
				);
				if (!hasMatchingGenre) return false;
			}

			// Filter by selected nationalities
			if (
				selectedNationalities.length > 0 &&
				(!event.nationality ||
					!selectedNationalities.some((nationality) =>
						event.nationality?.includes(nationality),
					))
			) {
				return false;
			}

			// Filter by venue types
			if (selectedVenueTypes.length > 0) {
				// Check if event has the new venueTypes field
				if (event.venueTypes && event.venueTypes.length > 0) {
					if (!selectedVenueTypes.some((vt) => event.venueTypes.includes(vt))) {
						return false;
					}
				} else {
					// Fallback to legacy indoor field
					const hasIndoor = selectedVenueTypes.includes("indoor");
					const hasOutdoor = selectedVenueTypes.includes("outdoor");
					if (hasIndoor && hasOutdoor) {
						// If both selected, show all events
						// No filtering needed
					} else if (hasIndoor && !event.indoor) {
						return false;
					} else if (hasOutdoor && event.indoor) {
						return false;
					}
				}
			}

			// Legacy indoor preference filter (for backwards compatibility)
			if (selectedIndoorPreference !== null) {
				if (event.venueTypes && event.venueTypes.length > 0) {
					// Use new venueTypes field
					const hasIndoor = event.venueTypes.includes("indoor");
					const hasOutdoor = event.venueTypes.includes("outdoor");
					if (selectedIndoorPreference && !hasIndoor) {
						return false;
					}
					if (!selectedIndoorPreference && !hasOutdoor) {
						return false;
					}
				} else {
					// Fallback to legacy indoor field
					if (event.indoor !== selectedIndoorPreference) {
						return false;
					}
				}
			}

			// Filter by price range
			if (
				selectedPriceRange[0] !== PRICE_RANGE_CONFIG.min ||
				selectedPriceRange[1] !== PRICE_RANGE_CONFIG.max
			) {
				if (!isPriceInRange(event.price, selectedPriceRange)) return false;
			}

			// Filter by age range
			if (selectedAgeRange) {
				if (!event.age || !isAgeInRange(event.age, selectedAgeRange))
					return false;
			}

			// Filter by search query
			if (searchQuery) {
				const query = searchQuery.toLowerCase();
				const matchesName = event.name.toLowerCase().includes(query);
				const matchesLocation = event.location?.toLowerCase().includes(query);
				const matchesDescription = event.description
					?.toLowerCase()
					.includes(query);
				const matchesArrondissement = event.arrondissement
					.toString()
					.includes(query);
				const matchesDay = event.day.toLowerCase().includes(query);
				const matchesGenre = event.genre.some((genre) =>
					genre.toLowerCase().includes(query),
				);
				const matchesType = event.type.toLowerCase().includes(query);

				if (
					!matchesName &&
					!matchesLocation &&
					!matchesDescription &&
					!matchesArrondissement &&
					!matchesDay &&
					!matchesGenre &&
					!matchesType
				) {
					return false;
				}
			}

			return true;
		});
	}, [
		selectedDays,
		selectedDayNightPeriods,
		selectedArrondissements,
		selectedGenres,
		selectedNationalities,
		selectedVenueTypes,
		selectedIndoorPreference,
		selectedPriceRange,
		selectedAgeRange,
		searchQuery,
		events,
		selectedOOOCPicks,
	]);

	// Handle authentication requirement
	const requireAuth = useCallback(() => {
		if (!isAuthenticated) {
			setShowEmailGate(true);
			return false;
		}
		return true;
	}, [isAuthenticated]);

	// Handle email submission
	const handleEmailSubmit = useCallback(
		(email: string) => {
			authenticate(email);
			setShowEmailGate(false);
		},
		[authenticate],
	);

	// Filter handlers
	const handleDayToggle = (day: EventDay) => {
		if (!requireAuth()) return;
		setSelectedDays((prev) =>
			prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
		);
	};

	const handleDayNightPeriodToggle = (period: DayNightPeriod) => {
		if (!requireAuth()) return;
		setSelectedDayNightPeriods((prev) =>
			prev.includes(period)
				? prev.filter((p) => p !== period)
				: [...prev, period],
		);
	};

	const handleArrondissementToggle = (arrondissement: ParisArrondissement) => {
		if (!requireAuth()) return;
		setSelectedArrondissements((prev) =>
			prev.includes(arrondissement)
				? prev.filter((a) => a !== arrondissement)
				: [...prev, arrondissement],
		);
	};

	const handleGenreToggle = (genre: MusicGenre) => {
		if (!requireAuth()) return;
		setSelectedGenres((prev) =>
			prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre],
		);
	};

	const handleNationalityToggle = (nationality: Nationality) => {
		if (!requireAuth()) return;
		setSelectedNationalities((prev) =>
			prev.includes(nationality)
				? prev.filter((n) => n !== nationality)
				: [...prev, nationality],
		);
	};

	const handleVenueTypeToggle = (venueType: VenueType) => {
		if (!requireAuth()) return;
		setSelectedVenueTypes((prev) =>
			prev.includes(venueType)
				? prev.filter((v) => v !== venueType)
				: [...prev, venueType],
		);
	};

	const handleIndoorPreferenceChange = (preference: boolean | null) => {
		if (!requireAuth()) return;
		setSelectedIndoorPreference(preference);
	};

	const handlePriceRangeChange = useCallback(
		(range: [number, number]) => {
			if (!requireAuth()) return;
			setSelectedPriceRange(range);
		},
		[requireAuth],
	);

	const handleAgeRangeChange = useCallback(
		(range: AgeRange | null) => {
			if (!requireAuth()) return;
			// If the range is set to the default full range, treat it as no filter
			if (
				range &&
				range[0] === AGE_RANGE_CONFIG.min &&
				range[1] === AGE_RANGE_CONFIG.max
			) {
				setSelectedAgeRange(null);
			} else {
				setSelectedAgeRange(range);
			}
		},
		[requireAuth],
	);

	const handleClearFilters = useCallback(() => {
		if (!requireAuth()) return;
		setSelectedDays([]);
		setSelectedDayNightPeriods([]);
		setSelectedArrondissements([]);
		setSelectedGenres([]);
		setSelectedNationalities([]);
		setSelectedVenueTypes([]);
		setSelectedIndoorPreference(null);
		setSelectedPriceRange(PRICE_RANGE_CONFIG.defaultRange);
		setSelectedAgeRange(null);
		setSelectedOOOCPicks(false);
		setSearchQuery("");
	}, [requireAuth]);

	const toggleFilterPanel = useCallback(() => {
		if (!requireAuth()) return;
		setIsFilterOpen((prev) => !prev);
	}, [requireAuth]);

	const toggleMapExpansion = useCallback(() => {
		setIsMapExpanded((prev) => !prev);
	}, []);

	const toggleFilterExpansion = useCallback(() => {
		setIsFilterExpanded((prev) => !prev);
	}, []);

	const hasActiveFilters =
		selectedDays.length > 0 ||
		selectedDayNightPeriods.length > 0 ||
		selectedArrondissements.length > 0 ||
		selectedGenres.length > 0 ||
		selectedNationalities.length > 0 ||
		selectedVenueTypes.length > 0 ||
		selectedIndoorPreference !== null ||
		selectedPriceRange[0] !== PRICE_RANGE_CONFIG.min ||
		selectedPriceRange[1] !== PRICE_RANGE_CONFIG.max ||
		(selectedAgeRange !== null &&
			(selectedAgeRange[0] !== AGE_RANGE_CONFIG.min ||
				selectedAgeRange[1] !== AGE_RANGE_CONFIG.max)) ||
		selectedOOOCPicks ||
		searchQuery.length > 0;

	const scrollToAllEvents = () => {
		allEventsRef.current?.scrollIntoView({
			behavior: "smooth",
			block: "start",
		});
	};

	return (
		<>
			{/* Search Bar */}
			<div className="mb-8">
				<AuthGate
					isAuthenticated={isAuthenticated}
					onAuthRequired={() => setShowEmailGate(true)}
					className="min-h-[120px] flex items-center"
				>
					<SearchBar
						onSearch={(query) => {
							if (!requireAuth()) return;
							setSearchQuery(query);
						}}
						placeholder="Search events, locations, genres, types..."
						className="max-w-md mx-auto"
					/>
				</AuthGate>
			</div>

			{/* Featured Events Section */}
			<FeaturedEvents
				events={filteredEvents}
				onEventClick={setSelectedEvent}
				onScrollToAllEvents={scrollToAllEvents}
			/>

			{/* Event Stats */}
			<EventStats
				events={events}
				filteredEvents={filteredEvents}
				filteredArrondissementsCount={useMemo(() => {
					const arrondissements = new Set(
						filteredEvents.map((event) => event.arrondissement),
					);
					return arrondissements.size;
				}, [filteredEvents])}
				hasActiveFilters={hasActiveFilters}
			/>

			{/* Collapsible Paris Event Map */}
			<div className="mb-8 relative z-10">
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="flex items-center justify-between">
							<div className="flex items-center space-x-2">
								<MapPin className="h-5 w-5" />
								<span>Paris Event Map</span>
								<Badge variant="secondary" className="text-xs">
									{filteredEvents.length} event
									{filteredEvents.length !== 1 ? "s" : ""}
								</Badge>
							</div>
							<div className="flex flex-col space-y-2">
								<Button
									variant="outline"
									size="sm"
									onClick={toggleFilterPanel}
									className="lg:hidden"
								>
									<Filter className="h-4 w-4 mr-2" />
									Filters
									{hasActiveFilters && (
										<Badge
											variant="destructive"
											className="ml-2 h-4 w-4 rounded-full p-0 text-xs"
										>
											{selectedDays.length +
												selectedDayNightPeriods.length +
												selectedArrondissements.length +
												selectedGenres.length +
												selectedNationalities.length +
												selectedVenueTypes.length +
												(selectedPriceRange[0] !== PRICE_RANGE_CONFIG.min ||
												selectedPriceRange[1] !== PRICE_RANGE_CONFIG.max
													? 1
													: 0) +
												(selectedAgeRange !== null &&
												(selectedAgeRange[0] !== AGE_RANGE_CONFIG.min ||
													selectedAgeRange[1] !== AGE_RANGE_CONFIG.max)
													? 1
													: 0)}
										</Badge>
									)}
								</Button>
								<Button
									variant="ghost"
									size="sm"
									onClick={toggleMapExpansion}
									className="text-muted-foreground hover:text-foreground"
								>
									{isMapExpanded ? (
										<>
											<ChevronUp className="h-4 w-4 mr-1" />
											Collapse
										</>
									) : (
										<>
											<ChevronDown className="h-4 w-4 mr-1" />
											Expand
										</>
									)}
								</Button>
							</div>
						</CardTitle>
					</CardHeader>
					<CardContent className="pt-2">
						<div
							className={`relative transition-all duration-300 ease-in-out ${
								isMapExpanded ? "h-[600px]" : "h-32"
							} overflow-hidden rounded-md`}
						>
							<div className="w-full h-full p-1">
								<ParisMap
									events={filteredEvents}
									onEventClick={setSelectedEvent}
									onArrondissementHover={setHoveredArrondissement}
									hoveredArrondissement={hoveredArrondissement}
								/>
							</div>
							{!isMapExpanded && (
								<div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-card to-transparent pointer-events-none rounded-b-md" />
							)}
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Filter Panel - Desktop and Mobile */}
			<div className="mb-8">
				<AuthGate
					isAuthenticated={isAuthenticated}
					onAuthRequired={() => setShowEmailGate(true)}
					className="min-h-[400px]"
				>
					<FilterPanel
						selectedDays={selectedDays}
						selectedDayNightPeriods={selectedDayNightPeriods}
						selectedArrondissements={selectedArrondissements}
						selectedGenres={selectedGenres}
						selectedNationalities={selectedNationalities}
						selectedVenueTypes={selectedVenueTypes}
						selectedIndoorPreference={selectedIndoorPreference}
						selectedPriceRange={selectedPriceRange}
						selectedAgeRange={selectedAgeRange}
						selectedOOOCPicks={selectedOOOCPicks}
						onDayToggle={handleDayToggle}
						onDayNightPeriodToggle={handleDayNightPeriodToggle}
						onArrondissementToggle={handleArrondissementToggle}
						onGenreToggle={handleGenreToggle}
						onNationalityToggle={handleNationalityToggle}
						onVenueTypeToggle={handleVenueTypeToggle}
						onIndoorPreferenceChange={handleIndoorPreferenceChange}
						onPriceRangeChange={handlePriceRangeChange}
						onAgeRangeChange={handleAgeRangeChange}
						onOOOCPicksToggle={(value) => {
							if (!requireAuth()) return;
							setSelectedOOOCPicks(value);
						}}
						onClearFilters={handleClearFilters}
						availableArrondissements={availableArrondissements}
						availableEventDays={availableEventDays}
						filteredEventsCount={filteredEvents.length}
						isOpen={isFilterOpen}
						onClose={() => setIsFilterOpen(false)}
						onOpen={() => setIsFilterOpen(true)}
						isExpanded={isFilterExpanded}
						onToggleExpanded={toggleFilterExpansion}
					/>
				</AuthGate>
			</div>

			{/* All Events Section */}
			<AllEvents
				ref={allEventsRef}
				events={filteredEvents}
				onEventClick={setSelectedEvent}
			/>

			{/* Event Modal */}
			<EventModal
				event={selectedEvent}
				isOpen={!!selectedEvent}
				onClose={() => setSelectedEvent(null)}
			/>

			{/* Email Gate Modal */}
			<EmailGateModal
				isOpen={showEmailGate}
				onClose={() => setShowEmailGate(false)}
				onEmailSubmit={handleEmailSubmit}
			/>
		</>
	);
}
