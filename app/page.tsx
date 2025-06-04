'use client';

import React, { useState, useMemo } from 'react';
import Header from '@/components/Header';
import ParisMap from '@/components/ParisMap';
import FilterPanel from '@/components/FilterPanel';
import EventModal from '@/components/EventModal';
import SearchBar from '@/components/SearchBar';
import { EVENTS_DATA } from '@/data/events';
import type { Event, EventDay, EventCategory } from '@/types/events';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Home() {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [hoveredArrondissement, setHoveredArrondissement] = useState<number | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedDays, setSelectedDays] = useState<EventDay[]>([]);
  const [selectedArrondissements, setSelectedArrondissements] = useState<number[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<EventCategory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Get available filter options
  const availableArrondissements = useMemo(() => {
    const arrondissements = new Set(EVENTS_DATA.map(event => event.arrondissement));
    return Array.from(arrondissements).sort((a, b) => a - b);
  }, []);

  const availableCategories = useMemo(() => {
    const categories = new Set(EVENTS_DATA.map(event => event.category).filter(Boolean));
    return Array.from(categories) as EventCategory[];
  }, []);

  // Filter events based on selected filters and search query
  const filteredEvents = useMemo(() => {
    return EVENTS_DATA.filter(event => {
      // Filter by selected days
      if (selectedDays.length > 0 && !selectedDays.includes(event.day)) return false;

      // Filter by selected arrondissements
      if (selectedArrondissements.length > 0 && !selectedArrondissements.includes(event.arrondissement)) return false;

      // Filter by selected categories
      if (selectedCategories.length > 0 && event.category && !selectedCategories.includes(event.category)) return false;

      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = event.name.toLowerCase().includes(query);
        const matchesLocation = event.location?.toLowerCase().includes(query);
        const matchesDescription = event.description?.toLowerCase().includes(query);
        const matchesArrondissement = event.arrondissement.toString().includes(query);
        const matchesDay = event.day.toLowerCase().includes(query);

        if (!matchesName && !matchesLocation && !matchesDescription && !matchesArrondissement && !matchesDay) {
          return false;
        }
      }

      return true;
    });
  }, [selectedDays, selectedArrondissements, selectedCategories, searchQuery]);

  // Filter handlers
  const handleDayToggle = (day: EventDay) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleArrondissementToggle = (arrondissement: number) => {
    setSelectedArrondissements(prev =>
      prev.includes(arrondissement) ? prev.filter(a => a !== arrondissement) : [...prev, arrondissement]
    );
  };

  const handleCategoryToggle = (category: EventCategory) => {
    setSelectedCategories(prev =>
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    );
  };

  const handleClearFilters = () => {
    setSelectedDays([]);
    setSelectedArrondissements([]);
    setSelectedCategories([]);
    setSearchQuery('');
  };

  const hasActiveFilters = selectedDays.length > 0 || selectedArrondissements.length > 0 || selectedCategories.length > 0 || searchQuery.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-6">
        {/* Search Bar */}
        <div className="mb-6">
          <SearchBar
            onSearch={setSearchQuery}
            placeholder="Search events, locations, arrondissements..."
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
                        {selectedDays.length + selectedArrondissements.length + selectedCategories.length}
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
              selectedArrondissements={selectedArrondissements}
              selectedCategories={selectedCategories}
              onDayToggle={handleDayToggle}
              onArrondissementToggle={handleArrondissementToggle}
              onCategoryToggle={handleCategoryToggle}
              onClearFilters={handleClearFilters}
              availableArrondissements={availableArrondissements}
              availableCategories={availableCategories}
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
                  className="p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setSelectedEvent(event)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold truncate">{event.name}</h3>
                    <Badge variant="outline" className="text-xs">
                      {event.arrondissement}e
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <div className="flex items-center space-x-1 mb-1">
                      <Clock className="h-3 w-3" />
                      <span>{event.time || 'TBC'} • {event.day}</span>
                    </div>
                    {event.location && event.location !== 'TBA' && (
                      <div className="flex items-center space-x-1">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{event.location}</span>
                      </div>
                    )}
                  </div>
                  {event.category && (
                    <Badge variant="secondary" className="mt-2 text-xs">
                      {event.category}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Mobile Filter Panel */}
      <FilterPanel
        selectedDays={selectedDays}
        selectedArrondissements={selectedArrondissements}
        selectedCategories={selectedCategories}
        onDayToggle={handleDayToggle}
        onArrondissementToggle={handleArrondissementToggle}
        onCategoryToggle={handleCategoryToggle}
        onClearFilters={handleClearFilters}
        availableArrondissements={availableArrondissements}
        availableCategories={availableCategories}
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
