'use client';

import type React from 'react';
import { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react';
import { Filter, X, Info, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Toggle } from '@/components/ui/toggle';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useOutsideClick } from '@/lib/useOutsideClick';
import { 
  EVENT_DAYS, 
  DAY_NIGHT_PERIODS, 
  MUSIC_GENRES, 
  EVENT_TYPES,
  PRICE_RANGE_CONFIG,
  formatPriceRange,
  type EventDay, 
  type DayNightPeriod,
  type MusicGenre,
  type EventType,
  type ParisArrondissement
} from '@/types/events';
import { Slider } from '@/components/ui/slider';

type FilterPanelProps = {
  selectedDays: EventDay[];
  selectedDayNightPeriods: DayNightPeriod[];
  selectedArrondissements: ParisArrondissement[];
  selectedGenres: MusicGenre[];
  selectedEventTypes: EventType[];
  selectedIndoorPreference: boolean | null;
  selectedPriceRange: [number, number];
  onDayToggle: (day: EventDay) => void;
  onDayNightPeriodToggle: (period: DayNightPeriod) => void;
  onArrondissementToggle: (arrondissement: ParisArrondissement) => void;
  onGenreToggle: (genre: MusicGenre) => void;
  onEventTypeToggle: (eventType: EventType) => void;
  onIndoorPreferenceChange: (preference: boolean | null) => void;
  onPriceRangeChange: (range: [number, number]) => void;
  onClearFilters: () => void;
  availableArrondissements: ParisArrondissement[];
  isOpen: boolean;
  onClose: () => void;
};

// Shared filter section components
type FilterSectionProps = {
  selectedDays: EventDay[];
  selectedDayNightPeriods: DayNightPeriod[];
  onDayToggle: (day: EventDay) => void;
  onDayNightPeriodToggle: (period: DayNightPeriod) => void;
  compact?: boolean;
};

const DaysTimeSection = memo<FilterSectionProps>(({ 
  selectedDays, 
  selectedDayNightPeriods, 
  onDayToggle, 
  onDayNightPeriodToggle, 
  compact = false 
}) => {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const tooltipButtonRef = useRef<HTMLButtonElement>(null);

  // Stable tooltip handler
  const handleTooltipToggle = useCallback(() => {
    setTooltipOpen(prev => !prev);
  }, []);

  // Close tooltip on outside click for mobile
  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      if (tooltipOpen && tooltipButtonRef.current && !tooltipButtonRef.current.contains(event.target as Node)) {
        setTooltipOpen(false);
      }
    };

    if (tooltipOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [tooltipOpen]);

  if (compact) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {EVENT_DAYS.map(({ key, label, color }) => (
            <Toggle
              key={key}
              pressed={selectedDays.includes(key)}
              onPressedChange={() => onDayToggle(key)}
              size="sm"
              className="text-xs"
            >
              <div className={`w-2 h-2 rounded-full ${color} mr-1.5`} />
              {label}
            </Toggle>
          ))}
        </div>
        
        {selectedDays.length > 0 && (
          <div className="pt-2 border-t">
            <div className="text-xs font-medium text-muted-foreground mb-2">Time Periods:</div>
            <div className="flex flex-wrap gap-2">
              {DAY_NIGHT_PERIODS.map(({ key, label, icon }) => (
                <Toggle
                  key={key}
                  pressed={selectedDayNightPeriods.includes(key)}
                  onPressedChange={() => onDayNightPeriodToggle(key)}
                  size="sm"
                  className="text-xs"
                >
                  <span className="mr-1.5">{icon}</span>
                  {label}
                </Toggle>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center mb-3">
        <h3 className="font-semibold">Days</h3>
        <TooltipProvider>
          <Tooltip open={tooltipOpen}>
            <TooltipTrigger asChild>
              <button
                ref={tooltipButtonRef}
                className="h-4 w-4 ml-2 text-muted-foreground cursor-help focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-sm"
                onClick={handleTooltipToggle}
                type="button"
                aria-label="Show day and night time definitions"
              >
                <Info className="h-4 w-4" />
              </button>
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
            <div className="flex items-center space-x-2">
              <Toggle
                pressed={selectedDays.includes(key)}
                onPressedChange={() => onDayToggle(key)}
                className="justify-start w-full"
              >
                <div className={`w-3 h-3 rounded-full ${color} mr-2`} />
                {label}
              </Toggle>
            </div>
            
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
  );
});

DaysTimeSection.displayName = 'DaysTimeSection';

type EventTypeSectionProps = {
  selectedEventTypes: EventType[];
  onEventTypeToggle: (eventType: EventType) => void;
  compact?: boolean;
};

const EventTypeSection = memo<EventTypeSectionProps>(({ selectedEventTypes, onEventTypeToggle, compact = false }) => {
  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {EVENT_TYPES.map(({ key, label, icon }) => (
          <Toggle
            key={key}
            pressed={selectedEventTypes.includes(key)}
            onPressedChange={() => onEventTypeToggle(key)}
            size="sm"
            className="text-xs"
          >
            <span className="mr-1.5">{icon}</span>
            {label}
          </Toggle>
        ))}
      </div>
    );
  }

  return (
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
  );
});

EventTypeSection.displayName = 'EventTypeSection';

type VenueTypeSectionProps = {
  selectedIndoorPreference: boolean | null;
  onIndoorPreferenceChange: (preference: boolean | null) => void;
  compact?: boolean;
};

const VenueTypeSection = memo<VenueTypeSectionProps>(({ selectedIndoorPreference, onIndoorPreferenceChange, compact = false }) => {
  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        <Toggle
          pressed={selectedIndoorPreference === null}
          onPressedChange={() => onIndoorPreferenceChange(null)}
          size="sm"
          className="text-xs"
        >
          Both
        </Toggle>
        <Toggle
          pressed={selectedIndoorPreference === true}
          onPressedChange={() => onIndoorPreferenceChange(true)}
          size="sm"
          className="text-xs"
        >
          🏢 Indoor
        </Toggle>
        <Toggle
          pressed={selectedIndoorPreference === false}
          onPressedChange={() => onIndoorPreferenceChange(false)}
          size="sm"
          className="text-xs"
        >
          🌤️ Outdoor
        </Toggle>
      </div>
    );
  }

  return (
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
  );
});

VenueTypeSection.displayName = 'VenueTypeSection';

type PriceRangeSectionProps = {
  selectedPriceRange: [number, number];
  onPriceRangeChange: (range: [number, number]) => void;
  compact?: boolean;
};

const PriceRangeSection = memo<PriceRangeSectionProps>(({ selectedPriceRange, onPriceRangeChange, compact = false }) => {
  // Stable handler to prevent re-renders
  const handlePriceRangeChange = useCallback((value: number[]) => {
    // Use requestAnimationFrame to prevent scroll interference
    requestAnimationFrame(() => {
      onPriceRangeChange(value as [number, number]);
    });
  }, [onPriceRangeChange]);

  const content = (
    <div className="space-y-3">
      <div className={compact ? "px-2" : ""}>
        <Slider
          value={selectedPriceRange}
          onValueChange={handlePriceRangeChange}
          min={PRICE_RANGE_CONFIG.min}
          max={PRICE_RANGE_CONFIG.max}
          step={PRICE_RANGE_CONFIG.step}
          className="w-full touch-none select-none"
          aria-label="Price range filter"
          style={{ touchAction: 'none' }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>€{PRICE_RANGE_CONFIG.min}</span>
        <span className="font-medium text-center">
          {formatPriceRange(selectedPriceRange)}
        </span>
        <span>€{PRICE_RANGE_CONFIG.max}+</span>
      </div>
    </div>
  );

  if (compact) return content;

  return (
    <div>
      <h3 className="font-semibold mb-3">Price Range</h3>
      {content}
    </div>
  );
});

PriceRangeSection.displayName = 'PriceRangeSection';

type GenresSectionProps = {
  selectedGenres: MusicGenre[];
  onGenreToggle: (genre: MusicGenre) => void;
  compact?: boolean;
};

const GenresSection = memo<GenresSectionProps>(({ selectedGenres, onGenreToggle, compact = false }) => {
  // Stable scroll container ref
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  if (compact) {
    return (
      <div className="relative">
        <div 
          ref={scrollContainerRef}
          className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto border rounded-md p-2 bg-muted/20"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgb(156 163 175) rgb(243 244 246)'
          }}
        >
          {MUSIC_GENRES.map(({ key, label, color }) => (
            <Toggle
              key={key}
              pressed={selectedGenres.includes(key)}
              onPressedChange={() => onGenreToggle(key)}
              size="sm"
              className="justify-start text-xs h-8"
            >
              <div className={`w-2 h-2 rounded-full ${color} mr-1.5 flex-shrink-0`} />
              <span className="truncate">{label}</span>
            </Toggle>
          ))}
        </div>
        <div className="absolute top-2 left-2 right-2 h-2 bg-gradient-to-b from-muted/40 to-transparent pointer-events-none" />
        <div className="absolute bottom-2 left-2 right-2 h-2 bg-gradient-to-t from-muted/40 to-transparent pointer-events-none" />
        <div className="text-xs text-muted-foreground mt-1 text-center opacity-70 flex items-center justify-center gap-1">
          <span>{MUSIC_GENRES.length} genres</span>
          <span>•</span>
          <span>scroll for more ↕</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="font-semibold mb-3">Music Genres</h3>
      <div className="relative">
        <div 
          ref={scrollContainerRef}
          className="space-y-2 max-h-64 overflow-y-auto border rounded-md p-3 bg-muted/20"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgb(156 163 175) rgb(243 244 246)'
          }}
        >
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
        <div className="absolute top-3 left-3 right-3 h-3 bg-gradient-to-b from-muted/40 to-transparent pointer-events-none" />
        <div className="absolute bottom-3 left-3 right-3 h-3 bg-gradient-to-t from-muted/40 to-transparent pointer-events-none" />
        <div className="text-xs text-muted-foreground mt-2 text-center opacity-70 flex items-center justify-center gap-1">
          <span>{MUSIC_GENRES.length} genres</span>
          <span>•</span>
          <span>swipe to scroll ↕</span>
        </div>
      </div>
    </div>
  );
});

GenresSection.displayName = 'GenresSection';

type ArrondissementsSectionProps = {
  selectedArrondissements: ParisArrondissement[];
  availableArrondissements: ParisArrondissement[];
  onArrondissementToggle: (arrondissement: ParisArrondissement) => void;
  compact?: boolean;
};

const ArrondissementsSection = memo<ArrondissementsSectionProps>(({ 
  selectedArrondissements, 
  availableArrondissements, 
  onArrondissementToggle, 
  compact = false 
}) => {
  const gridCols = compact ? "grid-cols-5" : "grid-cols-4";
  
  return (
    <div>
      {!compact && <h3 className="font-semibold mb-3">Arrondissements</h3>}
      <div className={`grid ${gridCols} gap-${compact ? '1.5' : '2'}`}>
        {availableArrondissements.map(arr => (
          <Toggle
            key={arr}
            pressed={selectedArrondissements.includes(arr)}
            onPressedChange={() => onArrondissementToggle(arr)}
            size="sm"
            className="h-8 text-xs"
          >
            {arr === 'unknown' ? '?' : `${arr}e`}
          </Toggle>
        ))}
      </div>
    </div>
  );
});

ArrondissementsSection.displayName = 'ArrondissementsSection';

// Active filters display component
type ActiveFiltersSectionProps = {
  selectedDays: EventDay[];
  selectedDayNightPeriods: DayNightPeriod[];
  selectedEventTypes: EventType[];
  selectedIndoorPreference: boolean | null;
  selectedPriceRange: [number, number];
  selectedArrondissements: ParisArrondissement[];
  selectedGenres: MusicGenre[];
  onDayToggle: (day: EventDay) => void;
  onDayNightPeriodToggle: (period: DayNightPeriod) => void;
  onEventTypeToggle: (eventType: EventType) => void;
  onIndoorPreferenceChange: (preference: boolean | null) => void;
  onPriceRangeChange: (range: [number, number]) => void;
  onArrondissementToggle: (arrondissement: ParisArrondissement) => void;
  onGenreToggle: (genre: MusicGenre) => void;
  compact?: boolean;
};

const ActiveFiltersSection = memo<ActiveFiltersSectionProps>(({
  selectedDays,
  selectedDayNightPeriods,
  selectedEventTypes,
  selectedIndoorPreference,
  selectedPriceRange,
  selectedArrondissements,
  selectedGenres,
  onDayToggle,
  onDayNightPeriodToggle,
  onEventTypeToggle,
  onIndoorPreferenceChange,
  onPriceRangeChange,
  onArrondissementToggle,
  onGenreToggle,
  compact = false
}) => {
  const resetPriceRange = useCallback(() => {
    onPriceRangeChange(PRICE_RANGE_CONFIG.defaultRange);
  }, [onPriceRangeChange]);

  const maxGenres = compact ? 3 : 4;
  const containerClass = compact ? "flex flex-wrap gap-1 max-h-16 overflow-y-auto" : "flex flex-wrap gap-2";

  return (
    <div className={compact ? "pt-3 border-t" : "pb-4 border-b"}>
      <div className="text-xs font-medium text-muted-foreground mb-2">Active Filters:</div>
      <div className={containerClass}>
        {selectedDays.map(day => (
          <Badge key={day} variant="secondary" className={`text-xs ${compact ? 'h-6' : ''}`}>
            {EVENT_DAYS.find(d => d.key === day)?.label}
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 ml-1 hover:bg-transparent"
              onClick={() => onDayToggle(day)}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        ))}
        {selectedDayNightPeriods.map(period => (
          <Badge key={period} variant="secondary" className={`text-xs ${compact ? 'h-6' : ''}`}>
            {DAY_NIGHT_PERIODS.find(p => p.key === period)?.icon} {period}
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 ml-1 hover:bg-transparent"
              onClick={() => onDayNightPeriodToggle(period)}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        ))}
        {selectedEventTypes.map(eventType => (
          <Badge key={eventType} variant="secondary" className={`text-xs ${compact ? 'h-6' : ''}`}>
            {EVENT_TYPES.find(t => t.key === eventType)?.label}
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 ml-1 hover:bg-transparent"
              onClick={() => onEventTypeToggle(eventType)}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        ))}
        {selectedIndoorPreference !== null && (
          <Badge variant="secondary" className={`text-xs ${compact ? 'h-6' : ''}`}>
            {selectedIndoorPreference ? '🏢 Indoor' : '🌤️ Outdoor'}
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 ml-1 hover:bg-transparent"
              onClick={() => onIndoorPreferenceChange(null)}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        )}
        {(selectedPriceRange[0] !== PRICE_RANGE_CONFIG.min || selectedPriceRange[1] !== PRICE_RANGE_CONFIG.max) && (
          <Badge variant="secondary" className={`text-xs ${compact ? 'h-6' : ''}`}>
            💰 {formatPriceRange(selectedPriceRange)}
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 ml-1 hover:bg-transparent"
              onClick={resetPriceRange}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        )}
        {selectedArrondissements.map(arr => (
          <Badge key={arr} variant="secondary" className={`text-xs ${compact ? 'h-6' : ''}`}>
            {arr === 'unknown' ? '?' : `${arr}e`}
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 ml-1 hover:bg-transparent"
              onClick={() => onArrondissementToggle(arr)}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        ))}
        {selectedGenres.slice(0, maxGenres).map(genre => (
          <Badge key={genre} variant="secondary" className={`text-xs ${compact ? 'h-6' : ''}`}>
            {MUSIC_GENRES.find(g => g.key === genre)?.label}
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 ml-1 hover:bg-transparent"
              onClick={() => onGenreToggle(genre)}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        ))}
        {selectedGenres.length > maxGenres && (
          <Badge variant="outline" className={`text-xs ${compact ? 'h-6' : ''}`}>
            +{selectedGenres.length - maxGenres} more
          </Badge>
        )}
      </div>
    </div>
  );
});

ActiveFiltersSection.displayName = 'ActiveFiltersSection';

const FilterPanel: React.FC<FilterPanelProps> = ({
  selectedDays,
  selectedDayNightPeriods,
  selectedArrondissements,
  selectedGenres,
  selectedEventTypes,
  selectedIndoorPreference,
  selectedPriceRange,
  onDayToggle,
  onDayNightPeriodToggle,
  onArrondissementToggle,
  onGenreToggle,
  onEventTypeToggle,
  onIndoorPreferenceChange,
  onPriceRangeChange,
  onClearFilters,
  availableArrondissements,
  isOpen,
  onClose
}) => {
  // Stable accordion state that won't reset on filter changes
  const [openAccordionSections, setOpenAccordionSections] = useState<string[]>(['days', 'types', 'price']);

  // Memoize the hasActiveFilters calculation to prevent unnecessary re-renders
  const hasActiveFilters = useMemo(() => (
    selectedDays.length > 0 || 
    selectedDayNightPeriods.length > 0 ||
    selectedArrondissements.length > 0 || 
    selectedGenres.length > 0 ||
    selectedEventTypes.length > 0 ||
    selectedIndoorPreference !== null ||
    (selectedPriceRange[0] !== PRICE_RANGE_CONFIG.min || selectedPriceRange[1] !== PRICE_RANGE_CONFIG.max)
  ), [selectedDays, selectedDayNightPeriods, selectedArrondissements, selectedGenres, selectedEventTypes, selectedIndoorPreference, selectedPriceRange]);

  // Memoize the active filter count
  const activeFilterCount = useMemo(() => {
    return selectedDays.length + 
           selectedDayNightPeriods.length + 
           selectedArrondissements.length + 
           selectedGenres.length + 
           selectedEventTypes.length + 
           (selectedIndoorPreference !== null ? 1 : 0) +
           (selectedPriceRange[0] !== PRICE_RANGE_CONFIG.min || selectedPriceRange[1] !== PRICE_RANGE_CONFIG.max ? 1 : 0);
  }, [selectedDays, selectedDayNightPeriods, selectedArrondissements, selectedGenres, selectedEventTypes, selectedIndoorPreference, selectedPriceRange]);

  // Use outside click hook to close panel on mobile/tablet
  const panelRef = useOutsideClick<HTMLDivElement>(() => {
    if (isOpen) {
      onClose();
    }
  });

  // Mobile floating button when closed
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
            {activeFilterCount}
          </Badge>
        )}
      </Button>
    );
  }

  // Desktop version with compact accordion layout
  const DesktopFilterPanel = () => (
    <Card className="h-fit">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center">
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </div>
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearFilters}
              className="text-xs h-7"
            >
              Clear all
            </Button>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <Accordion 
          type="multiple" 
          value={openAccordionSections}
          onValueChange={setOpenAccordionSections}
          className="w-full"
        >
          <AccordionItem value="days" className="border-b-0">
            <AccordionTrigger className="py-2 text-sm font-medium">
              Days & Times
              {(selectedDays.length > 0 || selectedDayNightPeriods.length > 0) && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {selectedDays.length + selectedDayNightPeriods.length}
                </Badge>
              )}
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <DaysTimeSection
                selectedDays={selectedDays}
                selectedDayNightPeriods={selectedDayNightPeriods}
                onDayToggle={onDayToggle}
                onDayNightPeriodToggle={onDayNightPeriodToggle}
                compact={true}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="types" className="border-b-0">
            <AccordionTrigger className="py-2 text-sm font-medium">
              Event Types
              {selectedEventTypes.length > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {selectedEventTypes.length}
                </Badge>
              )}
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <EventTypeSection
                selectedEventTypes={selectedEventTypes}
                onEventTypeToggle={onEventTypeToggle}
                compact={true}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="venue" className="border-b-0">
            <AccordionTrigger className="py-2 text-sm font-medium">
              Venue Type
              {selectedIndoorPreference !== null && (
                <Badge variant="secondary" className="ml-2 text-xs">1</Badge>
              )}
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <VenueTypeSection
                selectedIndoorPreference={selectedIndoorPreference}
                onIndoorPreferenceChange={onIndoorPreferenceChange}
                compact={true}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="price" className="border-b-0">
            <AccordionTrigger className="py-2 text-sm font-medium">
              Price Range
              {(selectedPriceRange[0] !== PRICE_RANGE_CONFIG.min || selectedPriceRange[1] !== PRICE_RANGE_CONFIG.max) && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  Custom
                </Badge>
              )}
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <PriceRangeSection
                selectedPriceRange={selectedPriceRange}
                onPriceRangeChange={onPriceRangeChange}
                compact={true}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="genres" className="border-b-0">
            <AccordionTrigger className="py-2 text-sm font-medium">
              Music Genres
              {selectedGenres.length > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {selectedGenres.length}
                </Badge>
              )}
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <GenresSection
                selectedGenres={selectedGenres}
                onGenreToggle={onGenreToggle}
                compact={true}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="arrondissements" className="border-b-0">
            <AccordionTrigger className="py-2 text-sm font-medium">
              Arrondissements
              {selectedArrondissements.length > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {selectedArrondissements.length}
                </Badge>
              )}
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <ArrondissementsSection
                selectedArrondissements={selectedArrondissements}
                availableArrondissements={availableArrondissements}
                onArrondissementToggle={onArrondissementToggle}
                compact={true}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {hasActiveFilters && (
          <ActiveFiltersSection
            selectedDays={selectedDays}
            selectedDayNightPeriods={selectedDayNightPeriods}
            selectedEventTypes={selectedEventTypes}
            selectedIndoorPreference={selectedIndoorPreference}
            selectedPriceRange={selectedPriceRange}
            selectedArrondissements={selectedArrondissements}
            selectedGenres={selectedGenres}
            onDayToggle={onDayToggle}
            onDayNightPeriodToggle={onDayNightPeriodToggle}
            onEventTypeToggle={onEventTypeToggle}
            onIndoorPreferenceChange={onIndoorPreferenceChange}
            onPriceRangeChange={onPriceRangeChange}
            onArrondissementToggle={onArrondissementToggle}
            onGenreToggle={onGenreToggle}
            compact={true}
          />
        )}
      </CardContent>
    </Card>
  );

  // Mobile version with scroll position preservation
  const MobileFilterPanel = () => {
    const scrollRef = useRef<HTMLDivElement>(null);

    return (
      <div className="fixed inset-0 z-50 bg-black/50">
        <div 
          ref={panelRef}
          className="absolute right-0 top-0 h-full w-full max-w-sm bg-background border-l"
        >
          <Card className="h-full border-0">
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
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 overflow-y-auto" ref={scrollRef}>
              {hasActiveFilters && (
                <ActiveFiltersSection
                  selectedDays={selectedDays}
                  selectedDayNightPeriods={selectedDayNightPeriods}
                  selectedEventTypes={selectedEventTypes}
                  selectedIndoorPreference={selectedIndoorPreference}
                  selectedPriceRange={selectedPriceRange}
                  selectedArrondissements={selectedArrondissements}
                  selectedGenres={selectedGenres}
                  onDayToggle={onDayToggle}
                  onDayNightPeriodToggle={onDayNightPeriodToggle}
                  onEventTypeToggle={onEventTypeToggle}
                  onIndoorPreferenceChange={onIndoorPreferenceChange}
                  onPriceRangeChange={onPriceRangeChange}
                  onArrondissementToggle={onArrondissementToggle}
                  onGenreToggle={onGenreToggle}
                  compact={false}
                />
              )}

              <DaysTimeSection
                selectedDays={selectedDays}
                selectedDayNightPeriods={selectedDayNightPeriods}
                onDayToggle={onDayToggle}
                onDayNightPeriodToggle={onDayNightPeriodToggle}
                compact={false}
              />

              <EventTypeSection
                selectedEventTypes={selectedEventTypes}
                onEventTypeToggle={onEventTypeToggle}
                compact={false}
              />

              <VenueTypeSection
                selectedIndoorPreference={selectedIndoorPreference}
                onIndoorPreferenceChange={onIndoorPreferenceChange}
                compact={false}
              />

              <PriceRangeSection
                selectedPriceRange={selectedPriceRange}
                onPriceRangeChange={onPriceRangeChange}
                compact={false}
              />

              <GenresSection
                selectedGenres={selectedGenres}
                onGenreToggle={onGenreToggle}
                compact={false}
              />

              <ArrondissementsSection
                selectedArrondissements={selectedArrondissements}
                availableArrondissements={availableArrondissements}
                onArrondissementToggle={onArrondissementToggle}
                compact={false}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  // Return desktop or mobile version based on screen size
  return (
    <>
      <div className="hidden lg:block">
        <DesktopFilterPanel />
      </div>
      <div className="lg:hidden">
        <MobileFilterPanel />
      </div>
    </>
  );
};

export default FilterPanel;
