"use client";

import EventModal from "@/components/EventModal";
import FilterPanel from "@/components/FilterPanel";
import ParisMap from "@/components/ParisMap";
import ParisMapLibre from "@/components/ParisMapLibre";
import { SelectedEventDisplay } from "@/components/SelectedEventDisplay";
import { getEvents } from "@/lib/data-management/actions";
import type {
	AgeRange,
	DayNightPeriod,
	Event,
	EventDay,
	MusicGenre,
	Nationality,
	ParisArrondissement,
	VenueType,
} from "@/types/events";
import {
	AGE_RANGE_CONFIG,
	PRICE_RANGE_CONFIG,
	isAgeInRange,
	isEventInDayNightPeriod,
	isPriceInRange,
} from "@/types/events";
import React, { useState, useEffect, useMemo, useCallback } from "react";

export default function MapsDemoPage() {
	const [events, setEvents] = useState<Event[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
	const [hoveredArrondissement, setHoveredArrondissement] = useState<
		number | null
	>(null);

	// Filter states
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

	// Fetch real events data
	useEffect(() => {
		const fetchEventsData = async () => {
			try {
				setLoading(true);
				setError(null);

				const result = await getEvents();

				if (result.success && result.data) {
					setEvents(result.data);
					console.log(`📍 Loaded ${result.data.length} total events`);
				} else {
					setError(result.error || "Failed to load events data");
				}
			} catch (err) {
				console.error("Error loading events:", err);
				setError(err instanceof Error ? err.message : "Unknown error occurred");
			} finally {
				setLoading(false);
			}
		};

		fetchEventsData();
	}, []);

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

	const availableEventDays = useMemo(() => {
		const days = new Set(events.map((event) => event.day));
		return Array.from(days).filter((day): day is EventDay => day !== undefined);
	}, [events]);

	// Filter events based on selected filters
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
				if (!event.nationality || event.nationality.length === 0) return false;
				const hasAllSelectedNationalities = selectedNationalities.every(
					(nationality) => event.nationality?.includes(nationality),
				);
				if (!hasAllSelectedNationalities) return false;
			}

			// Filter by venue types
			if (selectedVenueTypes.length > 0) {
				if (event.venueTypes && event.venueTypes.length > 0) {
					if (!selectedVenueTypes.some((vt) => event.venueTypes.includes(vt)))
						return false;
				} else {
					// Fallback to legacy indoor field
					const hasIndoor = selectedVenueTypes.includes("indoor");
					const hasOutdoor = selectedVenueTypes.includes("outdoor");
					if (hasIndoor && hasOutdoor) {
						// If both selected, show all events
					} else if (hasIndoor && !event.indoor) {
						return false;
					} else if (hasOutdoor && event.indoor) {
						return false;
					}
				}
			}

			// Legacy indoor preference filter
			if (selectedIndoorPreference !== null) {
				if (event.venueTypes && event.venueTypes.length > 0) {
					const hasIndoor = event.venueTypes.includes("indoor");
					const hasOutdoor = event.venueTypes.includes("outdoor");
					if (selectedIndoorPreference && !hasIndoor) return false;
					if (!selectedIndoorPreference && !hasOutdoor) return false;
				} else {
					if (event.indoor !== selectedIndoorPreference) return false;
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

			return true;
		});
	}, [
		events,
		selectedDays,
		selectedDayNightPeriods,
		selectedArrondissements,
		selectedGenres,
		selectedNationalities,
		selectedVenueTypes,
		selectedIndoorPreference,
		selectedPriceRange,
		selectedAgeRange,
		selectedOOOCPicks,
	]);

	// Filter handlers
	const handleDayToggle = useCallback((day: EventDay) => {
		setSelectedDays((prev) =>
			prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
		);
	}, []);

	const handleDayNightPeriodToggle = useCallback((period: DayNightPeriod) => {
		setSelectedDayNightPeriods((prev) =>
			prev.includes(period)
				? prev.filter((p) => p !== period)
				: [...prev, period],
		);
	}, []);

	const handleArrondissementToggle = useCallback(
		(arrondissement: ParisArrondissement) => {
			setSelectedArrondissements((prev) =>
				prev.includes(arrondissement)
					? prev.filter((a) => a !== arrondissement)
					: [...prev, arrondissement],
			);
		},
		[],
	);

	const handleGenreToggle = useCallback((genre: MusicGenre) => {
		setSelectedGenres((prev) =>
			prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre],
		);
	}, []);

	const handleNationalityToggle = useCallback((nationality: Nationality) => {
		setSelectedNationalities((prev) =>
			prev.includes(nationality)
				? prev.filter((n) => n !== nationality)
				: [...prev, nationality],
		);
	}, []);

	const handleVenueTypeToggle = useCallback((venueType: VenueType) => {
		setSelectedVenueTypes((prev) =>
			prev.includes(venueType)
				? prev.filter((v) => v !== venueType)
				: [...prev, venueType],
		);
	}, []);

	const handleIndoorPreferenceChange = useCallback(
		(preference: boolean | null) => {
			setSelectedIndoorPreference(preference);
		},
		[],
	);

	const handlePriceRangeChange = useCallback((range: [number, number]) => {
		setSelectedPriceRange(range);
	}, []);

	const handleAgeRangeChange = useCallback((range: AgeRange | null) => {
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
		setSelectedVenueTypes([]);
		setSelectedIndoorPreference(null);
		setSelectedPriceRange(PRICE_RANGE_CONFIG.defaultRange);
		setSelectedAgeRange(null);
		setSelectedOOOCPicks(false);
	}, []);

	const handleEventClick = (event: Event) => {
		setSelectedEvent(event);
		console.log("Event clicked:", event);
	};

	const handleArrondissementHover = (arrondissement: number | null) => {
		setHoveredArrondissement(arrondissement);
	};

	// Calculate event statistics for display
	const eventStats = React.useMemo(() => {
		const totalEvents = filteredEvents.length;
		const totalEventsWithCoords = filteredEvents.filter(
			(event) => event.coordinates,
		).length;
		const arrondissementCounts = filteredEvents.reduce(
			(acc, event) => {
				const arr = event.arrondissement;
				acc[arr] = (acc[arr] || 0) + 1;
				return acc;
			},
			{} as Record<number | string, number>,
		);

		const arrondissementsWithEvents = Object.keys(arrondissementCounts).length;
		const mostPopularArrondissement = Object.entries(arrondissementCounts).sort(
			([, a], [, b]) => b - a,
		)[0];

		return {
			totalEvents,
			totalEventsWithCoords,
			arrondissementsWithEvents,
			mostPopular: mostPopularArrondissement
				? {
						arrondissement: Number(mostPopularArrondissement[0]),
						count: mostPopularArrondissement[1],
					}
				: null,
			distribution: arrondissementCounts,
		};
	}, [filteredEvents]);

	// Check if filters are active
	const hasActiveFilters = useMemo(() => {
		return (
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
			selectedOOOCPicks
		);
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
		selectedOOOCPicks,
	]);

	if (loading) {
		return (
			<div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
				<div className="max-w-7xl mx-auto">
					<div className="mb-8 text-center">
						<h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
							Paris Maps Comparison
						</h1>
						<p className="text-lg text-gray-600 dark:text-gray-300">
							Loading events data...
						</p>
					</div>
					<div className="flex justify-center items-center h-64">
						<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
					</div>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
				<div className="max-w-7xl mx-auto">
					<div className="mb-8 text-center">
						<h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
							Paris Maps Comparison
						</h1>
						<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
							<h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
								Error Loading Events
							</h3>
							<p className="text-red-700 dark:text-red-300">{error}</p>
							<button
								onClick={() => window.location.reload()}
								className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
							>
								Retry
							</button>
						</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
			<div className="max-w-7xl mx-auto">
				<div className="mb-8 text-center">
					<h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
						Paris Maps Comparison
					</h1>
					<p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
						Comparing the original SVG-based Paris map with the new MapLibre GL
						JS implementation. Both maps show the same event data and support
						the same interactions.
					</p>
				</div>

				{/* Filter Panel */}
				<div className="mb-8">
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
						onOOOCPicksToggle={setSelectedOOOCPicks}
						onClearFilters={handleClearFilters}
						availableArrondissements={availableArrondissements}
						availableEventDays={availableEventDays}
						filteredEventsCount={filteredEvents.length}
						isOpen={isFilterOpen}
						onClose={() => setIsFilterOpen(false)}
						onOpen={() => setIsFilterOpen(true)}
					/>
				</div>

				{/* Real Event Data Stats */}
				<div className="mb-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
					<h3 className="text-lg font-semibold mb-2 text-blue-900 dark:text-blue-100">
						{hasActiveFilters ? "Filtered Event Data" : "Live Event Data"}
					</h3>
					<div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-blue-800 dark:text-blue-200">
						<div className="bg-white dark:bg-gray-800 rounded p-3">
							<div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
								{eventStats.totalEvents}
							</div>
							<div className="text-xs text-gray-600 dark:text-gray-400">
								{hasActiveFilters ? "Filtered Events" : "Total Events"}
							</div>
						</div>
						<div className="bg-white dark:bg-gray-800 rounded p-3">
							<div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
								{eventStats.totalEventsWithCoords}
							</div>
							<div className="text-xs text-gray-600 dark:text-gray-400">
								With Coordinates
							</div>
						</div>
						<div className="bg-white dark:bg-gray-800 rounded p-3">
							<div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
								{eventStats.arrondissementsWithEvents}
							</div>
							<div className="text-xs text-gray-600 dark:text-gray-400">
								Arrondissements
							</div>
						</div>
						<div className="bg-white dark:bg-gray-800 rounded p-3">
							<div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
								{eventStats.mostPopular?.count || 0}
							</div>
							<div className="text-xs text-gray-600 dark:text-gray-400">
								Max in District
							</div>
						</div>
					</div>
					<p className="text-blue-800 dark:text-blue-200 text-sm mt-4">
						{hasActiveFilters
							? `Showing ${eventStats.totalEvents} filtered events (${eventStats.totalEventsWithCoords} with coordinates) across ${eventStats.arrondissementsWithEvents} arrondissements.`
							: `Showing ${eventStats.totalEvents} live events with geocoded coordinates across ${eventStats.arrondissementsWithEvents} arrondissements.`}
						Data fetched from Google Sheets and geocoded using the optimized
						Google Maps API integration.
					</p>
				</div>

				{/* Map Feature Comparison */}
				<div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
					<div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
						<h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
							Original SVG Map
						</h3>
						<ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
							<li>✅ Custom SVG-based implementation</li>
							<li>✅ Simplified arrondissement shapes</li>
							<li>✅ Event count visualization</li>
							<li>✅ Click to see event lists</li>
							<li>❌ No precise location pins</li>
							<li>❌ Static positioning</li>
							<li>❌ No real geographic data</li>
						</ul>
					</div>

					<div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
						<h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
							New MapLibre GL JS Map
						</h3>
						<ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
							<li>✅ Free, open-source mapping</li>
							<li>✅ Real GeoJSON boundaries</li>
							<li>✅ Precise event location pins</li>
							<li>✅ Pan & zoom capabilities</li>
							<li>✅ Hover interactions</li>
							<li>✅ Professional cartography</li>
							<li>✅ No API keys required</li>
						</ul>
					</div>
				</div>

				{/* Color Legend */}
				<div className="mb-8 bg-white dark:bg-gray-800 rounded-lg p-6">
					<h4 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
						Event Density Color Legend
					</h4>
					<div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
						<div className="flex items-center space-x-2">
							<div
								className="w-4 h-4 rounded"
								style={{ backgroundColor: "#e5e7eb" }}
							></div>
							<span className="text-gray-700 dark:text-gray-300">0 events</span>
						</div>
						<div className="flex items-center space-x-2">
							<div
								className="w-4 h-4 rounded"
								style={{ backgroundColor: "#16a34a" }}
							></div>
							<span className="text-gray-700 dark:text-gray-300">1 event</span>
						</div>
						<div className="flex items-center space-x-2">
							<div
								className="w-4 h-4 rounded"
								style={{ backgroundColor: "#ea580c" }}
							></div>
							<span className="text-gray-700 dark:text-gray-300">
								2-4 events
							</span>
						</div>
						<div className="flex items-center space-x-2">
							<div
								className="w-4 h-4 rounded"
								style={{ backgroundColor: "#dc2626" }}
							></div>
							<span className="text-gray-700 dark:text-gray-300">
								5+ events
							</span>
						</div>
					</div>
				</div>

				{/* Maps Side by Side */}
				<div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
					{/* Original SVG Map */}
					<div className="space-y-4">
						<h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
							Original SVG Map
							<span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
								({eventStats.totalEvents} events)
							</span>
						</h2>
						<ParisMap
							events={filteredEvents}
							onEventClick={handleEventClick}
							onArrondissementHover={handleArrondissementHover}
							hoveredArrondissement={hoveredArrondissement}
						/>
					</div>

					{/* New MapLibre Map */}
					<div className="space-y-4">
						<h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
							New MapLibre GL JS Map
							<span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
								({eventStats.totalEvents} events)
							</span>
						</h2>
						<ParisMapLibre
							events={filteredEvents}
							onEventClick={handleEventClick}
							selectedDay={
								selectedDays.length === 1 ? selectedDays[0] : undefined
							}
						/>
					</div>
				</div>

				{/* Selected Event Display (Original) */}
				<SelectedEventDisplay
					selectedEvent={selectedEvent}
					onClose={() => setSelectedEvent(null)}
				/>

				{/* Event Modal */}
				<EventModal
					event={selectedEvent}
					isOpen={!!selectedEvent}
					onClose={() => setSelectedEvent(null)}
				/>

				{/* Technology Stack Info */}
				<div className="mt-8 bg-gray-100 dark:bg-gray-800 rounded-lg p-6">
					<h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
						Technology Stack
					</h3>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
						<div>
							<h4 className="font-semibold text-gray-900 dark:text-white mb-2">
								Mapping
							</h4>
							<ul className="space-y-1 text-gray-600 dark:text-gray-300">
								<li>• MapLibre GL JS (free)</li>
								<li>• OpenStreetMap tiles</li>
								<li>• GeoJSON boundaries</li>
								<li>• Vector-based rendering</li>
							</ul>
						</div>
						<div>
							<h4 className="font-semibold text-gray-900 dark:text-white mb-2">
								Geocoding
							</h4>
							<ul className="space-y-1 text-gray-600 dark:text-gray-300">
								<li>• Google Maps API (optimized)</li>
								<li>• Local coordinate caching</li>
								<li>• Arrondissement fallbacks</li>
								<li>• Confidence scoring</li>
							</ul>
						</div>
						<div>
							<h4 className="font-semibold text-gray-900 dark:text-white mb-2">
								Data Management
							</h4>
							<ul className="space-y-1 text-gray-600 dark:text-gray-300">
								<li>• Google Sheets integration</li>
								<li>• Service account auth</li>
								<li>• Batch processing</li>
								<li>• Smart caching</li>
							</ul>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
