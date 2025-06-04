'use client';

import type React from 'react';
import { useState } from 'react';
import { Filter, X, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Toggle } from '@/components/ui/toggle';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useOutsideClick } from '@/lib/useOutsideClick';
import { 
  EVENT_DAYS, 
  DAY_NIGHT_PERIODS, 
  MUSIC_GENRES, 
  EVENT_TYPES,
  type EventDay, 
  type DayNightPeriod,
  type MusicGenre,
  type EventType,
  type ParisArrondissement
} from '@/types/events';

type FilterPanelProps = {
  selectedDays: EventDay[];
  selectedDayNightPeriods: DayNightPeriod[];
  selectedArrondissements: ParisArrondissement[];
  selectedGenres: MusicGenre[];
  selectedEventTypes: EventType[];
  selectedIndoorPreference: boolean | null; // null = both, true = indoor only, false = outdoor only
  onDayToggle: (day: EventDay) => void;
  onDayNightPeriodToggle: (period: DayNightPeriod) => void;
  onArrondissementToggle: (arrondissement: ParisArrondissement) => void;
  onGenreToggle: (genre: MusicGenre) => void;
  onEventTypeToggle: (eventType: EventType) => void;
  onIndoorPreferenceChange: (preference: boolean | null) => void;
  onClearFilters: () => void;
  availableArrondissements: ParisArrondissement[];
  isOpen: boolean;
  onClose: () => void;
};

const FilterPanel: React.FC<FilterPanelProps> = ({
  selectedDays,
  selectedDayNightPeriods,
  selectedArrondissements,
  selectedGenres,
  selectedEventTypes,
  selectedIndoorPreference,
  onDayToggle,
  onDayNightPeriodToggle,
  onArrondissementToggle,
  onGenreToggle,
  onEventTypeToggle,
  onIndoorPreferenceChange,
  onClearFilters,
  availableArrondissements,
  isOpen,
  onClose
}) => {
  const hasActiveFilters = 
    selectedDays.length > 0 || 
    selectedDayNightPeriods.length > 0 ||
    selectedArrondissements.length > 0 || 
    selectedGenres.length > 0 ||
    selectedEventTypes.length > 0 ||
    selectedIndoorPreference !== null;
  
  // Use outside click hook to close panel on mobile/tablet
  const panelRef = useOutsideClick<HTMLDivElement>(() => {
    if (isOpen) {
      onClose();
    }
  });

  const handleDayToggle = (day: EventDay) => {
    onDayToggle(day);
  };

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        className="fixed bottom-4 right-4 z-40 shadow-lg lg:hidden"
        onClick={onClose}
      >
        <Filter className="h-4 w-4 mr-2" />
        Filters
        {hasActiveFilters && (
          <Badge variant="destructive" className="ml-2 h-5 w-5 rounded-full p-0 text-xs">
            {selectedDays.length + selectedDayNightPeriods.length + selectedArrondissements.length + selectedGenres.length + selectedEventTypes.length}
          </Badge>
        )}
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 lg:relative lg:bg-transparent lg:inset-auto">
      <div 
        ref={panelRef}
        className="absolute right-0 top-0 h-full w-full max-w-sm bg-background border-l lg:relative lg:border lg:rounded-lg lg:shadow-lg"
      >
        <Card className="h-full border-0 lg:border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="flex items-center">
              <Filter className="h-5 w-5 mr-2" />
              Filters
            </CardTitle>
            <div className="flex items-center space-x-2">
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onClearFilters}
                  className="text-xs"
                >
                  Clear all
                </Button>
              )}
              <Button
                variant="outline"
                size="icon"
                onClick={onClose}
                className="h-8 w-8 lg:hidden"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 overflow-y-auto">
            {/* Day filters with day/night toggle */}
            <div>
              <div className="flex items-center mb-3">
                <h3 className="font-semibold">Days</h3>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 ml-2 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-sm space-y-1">
                        <p><strong>Day:</strong> 6:00 AM - 9:59 PM ☀️</p>
                        <p><strong>Night:</strong> 10:00 PM - 5:59 AM 🌙</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              
              <div className="space-y-3">
                {EVENT_DAYS.map(({ key, label, color }) => (
                  <div key={key} className="space-y-2">
                    {/* Day toggle */}
                    <div className="flex items-center space-x-2">
                      <Toggle
                        pressed={selectedDays.includes(key)}
                        onPressedChange={() => handleDayToggle(key)}
                        className="justify-start w-full"
                      >
                        <div className={`w-3 h-3 rounded-full ${color} mr-2`} />
                        {label}
                      </Toggle>
                    </div>
                    
                    {/* Day/Night period toggles - show when day is selected */}
                    {selectedDays.includes(key) && (
                      <div className="ml-6 flex space-x-2">
                        {DAY_NIGHT_PERIODS.map(({ key: periodKey, label: periodLabel, icon }) => (
                          <Toggle
                            key={periodKey}
                            pressed={selectedDayNightPeriods.includes(periodKey)}
                            onPressedChange={() => onDayNightPeriodToggle(periodKey)}
                            size="sm"
                            className="text-xs"
                          >
                            {icon} {periodLabel}
                          </Toggle>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Event Type filters */}
            <div>
              <h3 className="font-semibold mb-3">Event Type</h3>
              <div className="space-y-2">
                {EVENT_TYPES.map(({ key, label, icon }) => (
                  <Toggle
                    key={key}
                    pressed={selectedEventTypes.includes(key)}
                    onPressedChange={() => onEventTypeToggle(key)}
                    className="justify-start w-full"
                  >
                    <span className="mr-2">{icon}</span>
                    {label}
                  </Toggle>
                ))}
              </div>
            </div>

            {/* Genre filters */}
            <div>
              <h3 className="font-semibold mb-3">Music Genres</h3>
              <div className="space-y-2">
                {MUSIC_GENRES.map(({ key, label, color }) => (
                  <Toggle
                    key={key}
                    pressed={selectedGenres.includes(key)}
                    onPressedChange={() => onGenreToggle(key)}
                    className="justify-start w-full"
                  >
                    <div className={`w-3 h-3 rounded-full ${color} mr-2`} />
                    {label}
                  </Toggle>
                ))}
              </div>
            </div>

            {/* Indoor/Outdoor preference */}
            <div>
              <h3 className="font-semibold mb-3">Venue Type</h3>
              <div className="space-y-2">
                <Toggle
                  pressed={selectedIndoorPreference === null}
                  onPressedChange={() => onIndoorPreferenceChange(null)}
                  className="justify-start w-full"
                >
                  Both Indoor & Outdoor
                </Toggle>
                <Toggle
                  pressed={selectedIndoorPreference === true}
                  onPressedChange={() => onIndoorPreferenceChange(true)}
                  className="justify-start w-full"
                >
                  🏢 Indoor Only
                </Toggle>
                <Toggle
                  pressed={selectedIndoorPreference === false}
                  onPressedChange={() => onIndoorPreferenceChange(false)}
                  className="justify-start w-full"
                >
                  🌤️ Outdoor Only
                </Toggle>
              </div>
            </div>

            {/* Arrondissement filters */}
            <div>
              <h3 className="font-semibold mb-3">Arrondissements</h3>
              <div className="grid grid-cols-4 gap-2">
                {availableArrondissements.map(arr => (
                  <Toggle
                    key={arr}
                    pressed={selectedArrondissements.includes(arr)}
                    onPressedChange={() => onArrondissementToggle(arr)}
                    className="h-8 text-xs"
                  >
                    {arr}e
                  </Toggle>
                ))}
              </div>
            </div>

            {/* Active filters summary */}
            {hasActiveFilters && (
              <div>
                <h3 className="font-semibold mb-3">Active Filters</h3>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1">
                    {selectedDays.map(day => (
                      <Badge key={day} variant="secondary" className="text-xs">
                        {EVENT_DAYS.find(d => d.key === day)?.label}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 ml-1"
                          onClick={() => onDayToggle(day)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                    {selectedDayNightPeriods.map(period => (
                      <Badge key={period} variant="secondary" className="text-xs">
                        {DAY_NIGHT_PERIODS.find(p => p.key === period)?.icon} {period}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 ml-1"
                          onClick={() => onDayNightPeriodToggle(period)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                    {selectedGenres.map(genre => (
                      <Badge key={genre} variant="secondary" className="text-xs">
                        {MUSIC_GENRES.find(g => g.key === genre)?.label}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 ml-1"
                          onClick={() => onGenreToggle(genre)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                    {selectedEventTypes.map(eventType => (
                      <Badge key={eventType} variant="secondary" className="text-xs">
                        {EVENT_TYPES.find(t => t.key === eventType)?.label}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 ml-1"
                          onClick={() => onEventTypeToggle(eventType)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FilterPanel;
