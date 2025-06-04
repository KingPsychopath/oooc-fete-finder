'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import ParisMap from '@/components/ParisMap';
import FilterPanel from '@/components/FilterPanel';
import EventModal from '@/components/EventModal';
import SearchBar from '@/components/SearchBar';
import { getAllEvents } from '@/data/events';
import { 
  getDayNightPeriod, 
  isEventInDayNightPeriod,
  MUSIC_GENRES,
  EVENT_TYPES,
  formatPrice,
  isPriceInRange,
  PRICE_RANGE_CONFIG,
  formatPriceRange,
  type Event, 
  type EventDay, 
  type DayNightPeriod,
  type MusicGenre,
  type EventType,
  type ParisArrondissement
} from '@/types/events';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, Filter, Star, Euro } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Home() {
  // Add state for events loading
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [hoveredArrondissement, setHoveredArrondissement] = useState<number | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedDays, setSelectedDays] = useState<EventDay[]>([]);
  const [selectedDayNightPeriods, setSelectedDayNightPeriods] = useState<DayNightPeriod[]>([]);
  const [selectedArrondissements, setSelectedArrondissements] = useState<ParisArrondissement[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<MusicGenre[]>([]);
  const [selectedEventTypes, setSelectedEventTypes] = useState<EventType[]>([]);
  const [selectedIndoorPreference, setSelectedIndoorPreference] = useState<boolean | null>(null);
  const [selectedPriceRange, setSelectedPriceRange] = useState<[number, number]>(PRICE_RANGE_CONFIG.defaultRange);
  const [searchQuery, setSearchQuery] = useState('');

  // Load events on component mount
  useEffect(() => {
    const loadEvents = async () => {
      try {
        setLoading(true);
        const loadedEvents = await getAllEvents();
        setEvents(loadedEvents);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load events');
        console.error('Error loading events:', err);
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
  }, []);

  // Get available filter options
  const availableArrondissements = useMemo(() => {
    const arrondissements = new Set(events.map(event => event.arrondissement));
    return Array.from(arrondissements).sort((a, b) => {
      // Put 'unknown' at the end
      if (a === 'unknown') return 1;
      if (b === 'unknown') return -1;
      // Sort numbers normally
      return (a as number) - (b as number);
    }) as ParisArrondissement[];
  }, [events]);

  // Filter events based on selected filters and search query
  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      // Filter by selected days
      if (selectedDays.length > 0 && !selectedDays.includes(event.day)) return false;

      // Filter by day/night periods
      if (selectedDayNightPeriods.length > 0) {
        const hasMatchingPeriod = selectedDayNightPeriods.some(period => 
          isEventInDayNightPeriod(event, period)
        );
        if (!hasMatchingPeriod) return false;
      }

      // Filter by selected arrondissements
      if (selectedArrondissements.length > 0 && !selectedArrondissements.includes(event.arrondissement)) return false;

      // Filter by selected genres
      if (selectedGenres.length > 0) {
        const hasMatchingGenre = event.genre.some(genre => selectedGenres.includes(genre));
        if (!hasMatchingGenre) return false;
      }

      // Filter by selected event types
      if (selectedEventTypes.length > 0 && !selectedEventTypes.includes(event.type)) return false;

      // Filter by indoor preference
      if (selectedIndoorPreference !== null) {
        if (selectedIndoorPreference !== event.indoor) return false;
      }

      // Filter by price range
      if (selectedPriceRange[0] !== PRICE_RANGE_CONFIG.min || selectedPriceRange[1] !== PRICE_RANGE_CONFIG.max) {
        if (!isPriceInRange(event.price, selectedPriceRange)) {
          return false;
        }
      }

      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = event.name.toLowerCase().includes(query);
        const matchesLocation = event.location?.toLowerCase().includes(query);
        const matchesDescription = event.description?.toLowerCase().includes(query);
        const matchesArrondissement = event.arrondissement.toString().includes(query);
        const matchesDay = event.day.toLowerCase().includes(query);
        const matchesGenre = event.genre.some(genre => genre.toLowerCase().includes(query));
        const matchesType = event.type.toLowerCase().includes(query);

        if (!matchesName && !matchesLocation && !matchesDescription && !matchesArrondissement && !matchesDay && !matchesGenre && !matchesType) {
          return false;
        }
      }

      return true;
    });
  }, [selectedDays, selectedDayNightPeriods, selectedArrondissements, selectedGenres, selectedEventTypes, selectedIndoorPreference, selectedPriceRange, searchQuery, events]);

  // Filter handlers
  const handleDayToggle = (day: EventDay) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleDayNightPeriodToggle = (period: DayNightPeriod) => {
    setSelectedDayNightPeriods(prev =>
      prev.includes(period) ? prev.filter(p => p !== period) : [...prev, period]
    );
  };

  const handleArrondissementToggle = (arrondissement: ParisArrondissement) => {
    setSelectedArrondissements(prev =>
      prev.includes(arrondissement) ? prev.filter(a => a !== arrondissement) : [...prev, arrondissement]
    );
  };

  const handleGenreToggle = (genre: MusicGenre) => {
    setSelectedGenres(prev =>
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
  };

  const handleEventTypeToggle = (eventType: EventType) => {
    setSelectedEventTypes(prev =>
      prev.includes(eventType) ? prev.filter(t => t !== eventType) : [...prev, eventType]
    );
  };

  const handleIndoorPreferenceChange = (preference: boolean | null) => {
    setSelectedIndoorPreference(preference);
  };

  const handlePriceRangeChange = useCallback((range: [number, number]) => {
    setSelectedPriceRange(range);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSelectedDays([]);
    setSelectedDayNightPeriods([]);
    setSelectedArrondissements([]);
    setSelectedGenres([]);
    setSelectedEventTypes([]);
    setSelectedIndoorPreference(null);
    setSelectedPriceRange(PRICE_RANGE_CONFIG.defaultRange);
    setSearchQuery('');
  }, []);

  const hasActiveFilters = 
    selectedDays.length > 0 || 
    selectedDayNightPeriods.length > 0 ||
    selectedArrondissements.length > 0 || 
    selectedGenres.length > 0 ||
    selectedEventTypes.length > 0 ||
    selectedIndoorPreference !== null ||
    (selectedPriceRange[0] !== PRICE_RANGE_CONFIG.min || selectedPriceRange[1] !== PRICE_RANGE_CONFIG.max) ||
    searchQuery.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-6">
        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading events...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <p className="text-destructive mb-2">Error loading events</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
        )}

        {/* Main Content - Only show when not loading and no error */}
        {!loading && !error && (
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
                    <div className="text-2xl font-bold text-primary">{filteredEvents.length}</div>
                    <div className="text-sm text-muted-foreground">
                      Event{filteredEvents.length !== 1 ? 's' : ''} {hasActiveFilters ? 'filtered' : 'total'}
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
                        onClick={() => setIsFilterOpen(!isFilterOpen)}
                        className="lg:hidden"
                      >
                        <Filter className="h-4 w-4 mr-2" />
                        Filters
                        {hasActiveFilters && (
                          <Badge variant="destructive" className="ml-2 h-4 w-4 rounded-full p-0 text-xs">
                            {selectedDays.length + selectedDayNightPeriods.length + selectedArrondissements.length + selectedGenres.length + selectedEventTypes.length + (selectedPriceRange[0] !== PRICE_RANGE_CONFIG.min || selectedPriceRange[1] !== PRICE_RANGE_CONFIG.max ? 1 : 0)}
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

              {/* Filter Panel - Desktop */}
              <div className="hidden lg:block">
                <FilterPanel
                  selectedDays={selectedDays}
                  selectedDayNightPeriods={selectedDayNightPeriods}
                  selectedArrondissements={selectedArrondissements}
                  selectedGenres={selectedGenres}
                  selectedEventTypes={selectedEventTypes}
                  selectedIndoorPreference={selectedIndoorPreference}
                  selectedPriceRange={selectedPriceRange}
                  onDayToggle={handleDayToggle}
                  onDayNightPeriodToggle={handleDayNightPeriodToggle}
                  onArrondissementToggle={handleArrondissementToggle}
                  onGenreToggle={handleGenreToggle}
                  onEventTypeToggle={handleEventTypeToggle}
                  onIndoorPreferenceChange={handleIndoorPreferenceChange}
                  onPriceRangeChange={handlePriceRangeChange}
                  onClearFilters={handleClearFilters}
                  availableArrondissements={availableArrondissements}
                  isOpen={true}
                  onClose={() => {}}
                />
              </div>
            </div>

            {/* Event List */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>All Events ({filteredEvents.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredEvents.map(event => (
                    <div
                      key={event.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors relative ${
                        event.isOOOCPick 
                          ? 'border-yellow-400 bg-gradient-to-br from-yellow-50 to-amber-50 hover:from-yellow-100 hover:to-amber-100 dark:from-yellow-950 dark:to-amber-950 dark:hover:from-yellow-900 dark:hover:to-amber-900' 
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedEvent(event)}
                    >
                      {/* OOOC Pick Badge */}
                      {event.isOOOCPick && (
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
                          {event.isOOOCPick && (
                            <span className="text-yellow-500 text-sm flex-shrink-0">🌟</span>
                          )}
                        </div>
                        <Badge variant="outline" className="text-xs flex-shrink-0 ml-auto">
                          {event.arrondissement === 'unknown' ? '?' : `${event.arrondissement}e`}
                        </Badge>
                      </div>
                      
                      {/* Event details */}
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div className="flex items-center space-x-1">
                          <Clock className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{event.time || 'TBC'} • {event.day}</span>
                          {event.time && getDayNightPeriod(event.time) && (
                            <span className="flex-shrink-0">{getDayNightPeriod(event.time) === 'day' ? '☀️' : '🌙'}</span>
                          )}
                        </div>
                        {event.location && event.location !== 'TBA' && (
                          <div className="flex items-center space-x-1">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate flex-1 min-w-0">{event.location}</span>
                            <span className="flex-shrink-0">{event.indoor ? '🏢' : '🌤️'}</span>
                          </div>
                        )}
                        {/* Price Display */}
                        <div className="flex items-center space-x-1">
                          <Euro className="h-3 w-3 flex-shrink-0" />
                          <span className={`text-xs font-medium ${
                            formatPrice(event.price) === 'Free' ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'
                          }`}>
                            {formatPrice(event.price)}
                          </span>
                        </div>
                      </div>
                      
                      {/* Badges */}
                      <div className="flex flex-wrap gap-1 mt-2">
                        <Badge variant="secondary" className="text-xs">
                          {event.type}
                        </Badge>
                        {event.genre.slice(0, 2).map(genre => (
                          <Badge key={genre} variant="outline" className="text-xs">
                            {MUSIC_GENRES.find(g => g.key === genre)?.label || genre}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>

      {/* Mobile Filter Panel */}
      <FilterPanel
        selectedDays={selectedDays}
        selectedDayNightPeriods={selectedDayNightPeriods}
        selectedArrondissements={selectedArrondissements}
        selectedGenres={selectedGenres}
        selectedEventTypes={selectedEventTypes}
        selectedIndoorPreference={selectedIndoorPreference}
        selectedPriceRange={selectedPriceRange}
        onDayToggle={handleDayToggle}
        onDayNightPeriodToggle={handleDayNightPeriodToggle}
        onArrondissementToggle={handleArrondissementToggle}
        onGenreToggle={handleGenreToggle}
        onEventTypeToggle={handleEventTypeToggle}
        onIndoorPreferenceChange={handleIndoorPreferenceChange}
        onPriceRangeChange={handlePriceRangeChange}
        onClearFilters={handleClearFilters}
        availableArrondissements={availableArrondissements}
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(!isFilterOpen)}
      />

      {/* Event Modal */}
      <EventModal
        event={selectedEvent}
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  );
}
