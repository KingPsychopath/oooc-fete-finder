"use client";

import React, { useState, useMemo, useCallback, useRef } from "react";
import ParisMap from "@/components/ParisMap";
import FilterPanel from "@/components/FilterPanel";
import EventModal from "@/components/EventModal";
import SearchBar from "@/components/SearchBar";
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
	type ParisArrondissement,
	type AgeRange,
} from "@/types/events";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, Filter, Star, Euro, Users, ChevronDown } from "lucide-react";
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
			if (selectedNationalities.length > 0) {
				if (
					!event.nationality ||
					!selectedNationalities.includes(event.nationality)
				)
					return false;
			}

			// Filter by indoor preference
			if (selectedIndoorPreference !== null) {
				if (selectedIndoorPreference !== event.indoor) return false;
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
		selectedIndoorPreference,
		selectedPriceRange,
		selectedAgeRange,
		searchQuery,
		events,
		selectedOOOCPicks,
	]);

	// Filter handlers
	const handleDayToggle = (day: EventDay) => {
		setSelectedDays((prev) =>
			prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
		);
	};

	const handleDayNightPeriodToggle = (period: DayNightPeriod) => {
		setSelectedDayNightPeriods((prev) =>
			prev.includes(period)
				? prev.filter((p) => p !== period)
				: [...prev, period],
		);
	};

	const handleArrondissementToggle = (arrondissement: ParisArrondissement) => {
		setSelectedArrondissements((prev) =>
			prev.includes(arrondissement)
				? prev.filter((a) => a !== arrondissement)
				: [...prev, arrondissement],
		);
	};

	const handleGenreToggle = (genre: MusicGenre) => {
		setSelectedGenres((prev) =>
			prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre],
		);
	};

	const handleNationalityToggle = (nationality: Nationality) => {
		setSelectedNationalities((prev) =>
			prev.includes(nationality)
				? prev.filter((n) => n !== nationality)
				: [...prev, nationality],
		);
	};

	const handleIndoorPreferenceChange = (preference: boolean | null) => {
		setSelectedIndoorPreference(preference);
	};

	const handlePriceRangeChange = useCallback((range: [number, number]) => {
		setSelectedPriceRange(range);
	}, []);

	const handleAgeRangeChange = useCallback((range: AgeRange | null) => {
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
	}, []);

	const handleClearFilters = useCallback(() => {
		setSelectedDays([]);
		setSelectedDayNightPeriods([]);
		setSelectedArrondissements([]);
		setSelectedGenres([]);
		setSelectedNationalities([]);
		setSelectedIndoorPreference(null);
		setSelectedPriceRange(PRICE_RANGE_CONFIG.defaultRange);
		setSelectedAgeRange(null);
		setSelectedOOOCPicks(false);
		setSearchQuery("");
	}, []);

	const toggleFilterPanel = useCallback(() => {
		setIsFilterOpen((prev) => !prev);
	}, []);

	const hasActiveFilters =
		selectedDays.length > 0 ||
		selectedDayNightPeriods.length > 0 ||
		selectedArrondissements.length > 0 ||
		selectedGenres.length > 0 ||
		selectedNationalities.length > 0 ||
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
			behavior: 'smooth',
			block: 'start'
		});
	};

	// Deterministic shuffle function using date as seed for consistent server/client results
	const deterministicShuffle = <T,>(array: T[]): T[] => {
		const shuffled = [...array];
		const seed = new Date().toDateString(); // Same seed for entire day
		let hash = 0;
		for (let i = 0; i < seed.length; i++) {
			hash = ((hash << 5) - hash) + seed.charCodeAt(i);
			hash = hash & hash; // Convert to 32-bit integer
		}
		
		// Simple deterministic shuffle using the hash as seed
		for (let i = shuffled.length - 1; i > 0; i--) {
			hash = (hash * 1664525 + 1013904223) % Math.pow(2, 32); // Linear congruential generator
			const j = Math.floor((hash / Math.pow(2, 32)) * (i + 1));
			[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
		}
		
		return shuffled;
	};

	// Get preview events: prioritize manually featured events, then OOOC picks with deterministic daily shuffle, max 2 events
	const previewEvents = useMemo(() => {
		// First, get manually featured events
		const manuallyFeatured = filteredEvents.filter(event => event != null && event.isFeatured === true);
		
		// If we have enough manually featured events, use them
		if (manuallyFeatured.length >= 2) {
			return manuallyFeatured.slice(0, 2);
		}
		
		// Otherwise, fill remaining slots with OOOC picks and regular events
		const oooPicksEvents = filteredEvents.filter(event => event != null && event.isOOOCPick === true && event.isFeatured !== true);
		const regularEvents = filteredEvents.filter(event => event != null && event.isOOOCPick !== true && event.isFeatured !== true);
		
		// Use deterministic shuffle for OOOC picks that aren't manually featured
		const shuffledOOOCPicks = deterministicShuffle(oooPicksEvents);
		
		// Build preview starting with manually featured events
		const preview = [...manuallyFeatured];
		const remainingSlots = 2 - preview.length;
		
		// Fill remaining slots with shuffled OOOC picks first
		const availableOOOCPicks = shuffledOOOCPicks.slice(0, remainingSlots);
		preview.push(...availableOOOCPicks);
		
		// If still need more events, add regular events
		if (preview.length < 2) {
			const stillRemainingSlots = 2 - preview.length;
			preview.push(...regularEvents.slice(0, stillRemainingSlots));
		}
		
		// Safety check: filter out any undefined events
		const safePreview = preview.filter(event => event != null);
		
		// Debug logging if we have issues
		if (safePreview.length !== preview.length) {
			console.warn('Found undefined events in preview, filtered out:', preview.length - safePreview.length);
		}
		
		return safePreview;
	}, [filteredEvents]);

	return (
		<>
			{/* Search Bar */}
			<div className="mb-6">
				<SearchBar
					onSearch={setSearchQuery}
					placeholder="Search events, locations, genres, types..."
					className="max-w-md mx-auto"
				/>
			</div>

			{/* Stats and Quick Info */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
				<Card>
					<CardContent className="p-4">
						<div className="flex items-center space-x-2">
							<div className="text-2xl font-bold text-primary">
								{filteredEvents.length}
							</div>
							<div className="text-sm text-muted-foreground">
								Event{filteredEvents.length !== 1 ? "s" : ""}{" "}
								{hasActiveFilters ? "filtered" : "total"}
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="p-4">
						<div className="flex items-center space-x-2">
							<MapPin className="h-4 w-4 text-muted-foreground" />
							<div className="text-sm text-muted-foreground">
								{availableArrondissements.length} arrondissements with events
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="p-4">
						<div className="flex items-center space-x-2">
							<Clock className="h-4 w-4 text-muted-foreground" />
							<div className="text-sm text-muted-foreground">
								June 19-22, 2025
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Event Preview Section */}
			<Card className="mb-6">
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle>Featured Events</CardTitle>
						<Button 
							variant="outline" 
							size="sm"
							onClick={scrollToAllEvents}
							className="text-sm"
						>
							View All {filteredEvents.length} Events
							<ChevronDown className="h-4 w-4 ml-1" />
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{previewEvents.map((event) => (
							<div
								key={event.id}
								className={`p-4 border rounded-lg cursor-pointer transition-colors relative ${
									event.isOOOCPick === true
										? "border-yellow-400 bg-gradient-to-br from-yellow-50 to-amber-50 hover:from-yellow-100 hover:to-amber-100 dark:from-yellow-950 dark:to-amber-950 dark:hover:from-yellow-900 dark:hover:to-amber-900"
										: "hover:bg-muted/50"
								}`}
								onClick={() => setSelectedEvent(event)}
							>
								{/* OOOC Pick Badge */}
								{event.isOOOCPick === true && (
									<div className="absolute -top-3 -right-3 bg-yellow-400 text-black text-xs font-bold rounded-full w-8 h-8 flex items-center justify-center shadow-md z-10 border-2 border-white dark:border-gray-900">
										<Star className="h-4 w-4 fill-current" />
									</div>
								)}

								{/* Header with proper overflow handling */}
								<div className="flex items-start justify-between gap-3 mb-2">
									<div className="flex items-center space-x-2 min-w-0 flex-1">
										<h3 className="font-semibold text-sm leading-tight truncate flex-1 min-w-0">
											{event.name}
										</h3>
										{event.isOOOCPick === true && (
											<span className="text-yellow-500 text-sm flex-shrink-0">
												🌟
											</span>
										)}
									</div>
									<Badge
										variant="outline"
										className="text-xs flex-shrink-0 ml-auto"
									>
										{event.arrondissement === "unknown"
											? "?"
											: `${event.arrondissement}e`}
									</Badge>
								</div>

								{/* Event details */}
								<div className="text-sm text-muted-foreground space-y-1">
									<div className="flex items-center space-x-1">
										<Clock className="h-3 w-3 flex-shrink-0" />
										<span className="truncate">
											{event.time || "TBC"}
											{event.endTime && event.time !== "TBC" && (
												<> - {event.endTime}</>
											)}{" "}
											• {event.day}
										</span>
										{event.time && getDayNightPeriod(event.time) && (
											<span className="flex-shrink-0">
												{getDayNightPeriod(event.time) === "day" ? "☀️" : "🌙"}
											</span>
										)}
									</div>
									{event.location && event.location !== "TBA" && (
										<div className="flex items-center space-x-1">
											<MapPin className="h-3 w-3 flex-shrink-0" />
											<span className="truncate flex-1 min-w-0">
												{event.location}
											</span>
											<span className="flex-shrink-0">
												{event.indoor ? "🏢" : "🌤️"}
											</span>
										</div>
									)}
									{/* Price Display */}
									<div className="flex items-center space-x-1">
										<Euro className="h-3 w-3 flex-shrink-0" />
										<span
											className={`text-xs font-medium ${
												formatPrice(event.price) === "Free"
													? "text-green-600 dark:text-green-400"
													: "text-gray-600 dark:text-gray-400"
											}`}
										>
											{formatPrice(event.price)}
										</span>
									</div>
									{/* Age Display */}
									{event.age && (
										<div className="flex items-center space-x-1">
											<Users className="h-3 w-3 flex-shrink-0" />
											<span className="text-xs font-medium text-gray-600 dark:text-gray-400">
												{formatAge(event.age)}
											</span>
										</div>
									)}
								</div>

								{/* Badges */}
								<div className="flex flex-wrap gap-1 mt-2">
									<Badge variant="secondary" className="text-xs">
										{event.type}
									</Badge>
									{event.nationality && (
										<Badge variant="outline" className="text-xs">
											{
												NATIONALITIES.find(
													(nationality) =>
														nationality.key === event.nationality,
												)?.flag
											}{" "}
											{
												NATIONALITIES.find(
													(nationality) =>
														nationality.key === event.nationality,
												)?.shortCode
											}
										</Badge>
									)}
									{event.genre.slice(0, 2).map((genre) => (
										<Badge key={genre} variant="outline" className="text-xs">
											{MUSIC_GENRES.find((g) => g.key === genre)?.label ||
												genre}
										</Badge>
									))}
								</div>
							</div>
						))}
					</div>
					{filteredEvents.length > 2 && (
						<div className="mt-4 text-center">
							<Button 
								variant="secondary" 
								onClick={scrollToAllEvents}
								className="w-full sm:w-auto"
							>
								Browse All {filteredEvents.length} Events
								<ChevronDown className="h-4 w-4 ml-1" />
							</Button>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Main Content Grid */}
			<div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
				{/* Map */}
				<div className="lg:col-span-3">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center justify-between">
								Paris Event Map
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
							</CardTitle>
						</CardHeader>
						<CardContent>
							<ParisMap
								events={filteredEvents}
								onEventClick={setSelectedEvent}
								onArrondissementHover={setHoveredArrondissement}
								hoveredArrondissement={hoveredArrondissement}
							/>
						</CardContent>
					</Card>
				</div>

				{/* Unified Filter Panel - Responsive */}
				<div className="lg:block">
					<FilterPanel
						selectedDays={selectedDays}
						selectedDayNightPeriods={selectedDayNightPeriods}
						selectedArrondissements={selectedArrondissements}
						selectedGenres={selectedGenres}
						selectedNationalities={selectedNationalities}
						selectedIndoorPreference={selectedIndoorPreference}
						selectedPriceRange={selectedPriceRange}
						selectedAgeRange={selectedAgeRange}
						selectedOOOCPicks={selectedOOOCPicks}
						onDayToggle={handleDayToggle}
						onDayNightPeriodToggle={handleDayNightPeriodToggle}
						onArrondissementToggle={handleArrondissementToggle}
						onGenreToggle={handleGenreToggle}
						onNationalityToggle={handleNationalityToggle}
						onIndoorPreferenceChange={handleIndoorPreferenceChange}
						onPriceRangeChange={handlePriceRangeChange}
						onAgeRangeChange={handleAgeRangeChange}
						onOOOCPicksToggle={setSelectedOOOCPicks}
						onClearFilters={handleClearFilters}
						availableArrondissements={availableArrondissements}
						isOpen={isFilterOpen}
						onClose={() => setIsFilterOpen(false)}
						onOpen={() => setIsFilterOpen(true)}
					/>
				</div>
			</div>

			{/* Event List */}
			<Card ref={allEventsRef} className="mt-6">
				<CardHeader>
					<CardTitle>All Events ({filteredEvents.length})</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{filteredEvents.filter(event => event != null).map((event) => (
							<div
								key={event.id}
								className={`p-4 border rounded-lg cursor-pointer transition-colors relative ${
									event.isOOOCPick === true
										? "border-yellow-400 bg-gradient-to-br from-yellow-50 to-amber-50 hover:from-yellow-100 hover:to-amber-100 dark:from-yellow-950 dark:to-amber-950 dark:hover:from-yellow-900 dark:hover:to-amber-900"
										: "hover:bg-muted/50"
								}`}
								onClick={() => setSelectedEvent(event)}
							>
								{/* OOOC Pick Badge */}
								{event.isOOOCPick === true && (
									<div className="absolute -top-3 -right-3 bg-yellow-400 text-black text-xs font-bold rounded-full w-8 h-8 flex items-center justify-center shadow-md z-10 border-2 border-white dark:border-gray-900">
										<Star className="h-4 w-4 fill-current" />
									</div>
								)}

								{/* Header with proper overflow handling */}
								<div className="flex items-start justify-between gap-3 mb-2">
									<div className="flex items-center space-x-2 min-w-0 flex-1">
										<h3 className="font-semibold text-sm leading-tight truncate flex-1 min-w-0">
											{event.name}
										</h3>
										{event.isOOOCPick === true && (
											<span className="text-yellow-500 text-sm flex-shrink-0">
												🌟
											</span>
										)}
									</div>
									<Badge
										variant="outline"
										className="text-xs flex-shrink-0 ml-auto"
									>
										{event.arrondissement === "unknown"
											? "?"
											: `${event.arrondissement}e`}
									</Badge>
								</div>

								{/* Event details */}
								<div className="text-sm text-muted-foreground space-y-1">
									<div className="flex items-center space-x-1">
										<Clock className="h-3 w-3 flex-shrink-0" />
										<span className="truncate">
											{event.time || "TBC"}
											{event.endTime && event.time !== "TBC" && (
												<> - {event.endTime}</>
											)}{" "}
											• {event.day}
										</span>
										{event.time && getDayNightPeriod(event.time) && (
											<span className="flex-shrink-0">
												{getDayNightPeriod(event.time) === "day" ? "☀️" : "🌙"}
											</span>
										)}
									</div>
									{event.location && event.location !== "TBA" && (
										<div className="flex items-center space-x-1">
											<MapPin className="h-3 w-3 flex-shrink-0" />
											<span className="truncate flex-1 min-w-0">
												{event.location}
											</span>
											<span className="flex-shrink-0">
												{event.indoor ? "🏢" : "🌤️"}
											</span>
										</div>
									)}
									{/* Price Display */}
									<div className="flex items-center space-x-1">
										<Euro className="h-3 w-3 flex-shrink-0" />
										<span
											className={`text-xs font-medium ${
												formatPrice(event.price) === "Free"
													? "text-green-600 dark:text-green-400"
													: "text-gray-600 dark:text-gray-400"
											}`}
										>
											{formatPrice(event.price)}
										</span>
									</div>
									{/* Age Display */}
									{event.age && (
										<div className="flex items-center space-x-1">
											<Users className="h-3 w-3 flex-shrink-0" />
											<span className="text-xs font-medium text-gray-600 dark:text-gray-400">
												{formatAge(event.age)}
											</span>
										</div>
									)}
								</div>

								{/* Badges */}
								<div className="flex flex-wrap gap-1 mt-2">
									<Badge variant="secondary" className="text-xs">
										{event.type}
									</Badge>
									{event.nationality && (
										<Badge variant="outline" className="text-xs">
											{
												NATIONALITIES.find(
													(nationality) =>
														nationality.key === event.nationality,
												)?.flag
											}{" "}
											{
												NATIONALITIES.find(
													(nationality) =>
														nationality.key === event.nationality,
												)?.shortCode
											}
										</Badge>
									)}
									{event.genre.slice(0, 2).map((genre) => (
										<Badge key={genre} variant="outline" className="text-xs">
											{MUSIC_GENRES.find((g) => g.key === genre)?.label ||
												genre}
										</Badge>
									))}
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>

			{/* Event Modal */}
			<EventModal
				event={selectedEvent}
				isOpen={!!selectedEvent}
				onClose={() => setSelectedEvent(null)}
			/>
		</>
	);
}
