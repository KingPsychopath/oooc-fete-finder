'use client';

import type React from 'react';
import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EVENT_DAYS, type EventDay, type EventCategory } from '@/types/events';
import { Toggle } from '@/components/ui/toggle';

interface FilterPanelProps {
  selectedDays: EventDay[];
  selectedArrondissements: number[];
  selectedCategories: EventCategory[];
  onDayToggle: (day: EventDay) => void;
  onArrondissementToggle: (arrondissement: number) => void;
  onCategoryToggle: (category: EventCategory) => void;
  onClearFilters: () => void;
  availableArrondissements: number[];
  availableCategories: EventCategory[];
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORY_LABELS: Record<EventCategory, string> = {
  'electronic': 'Electronic',
  'block-party': 'Block Party',
  'afterparty': 'Afterparty',
  'club': 'Club',
  'cruise': 'Cruise',
  'outdoor': 'Outdoor',
  'cultural': 'Cultural'
};

const FilterPanel: React.FC<FilterPanelProps> = ({
  selectedDays,
  selectedArrondissements,
  selectedCategories,
  onDayToggle,
  onArrondissementToggle,
  onCategoryToggle,
  onClearFilters,
  availableArrondissements,
  availableCategories,
  isOpen,
  onClose
}) => {
  const hasActiveFilters = selectedDays.length > 0 || selectedArrondissements.length > 0 || selectedCategories.length > 0;

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        className="fixed bottom-4 right-4 z-40 shadow-lg"
        onClick={() => onClose()}
      >
        <Filter className="h-4 w-4 mr-2" />
        Filters
        {hasActiveFilters && (
          <Badge variant="destructive" className="ml-2 h-5 w-5 rounded-full p-0 text-xs">
            {selectedDays.length + selectedArrondissements.length + selectedCategories.length}
          </Badge>
        )}
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 lg:relative lg:bg-transparent lg:inset-auto">
      <div className="absolute right-0 top-0 h-full w-full max-w-sm bg-background border-l lg:relative lg:border lg:rounded-lg lg:shadow-lg">
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
            {/* Day filters */}
            <div>
              <h3 className="font-semibold mb-3">Days</h3>
              <div className="space-y-2">
                {EVENT_DAYS.map(({ key, label, color }) => (
                  <div key={key} className="flex items-center space-x-2">
                    <Toggle
                      pressed={selectedDays.includes(key)}
                      onPressedChange={() => onDayToggle(key)}
                      className="justify-start w-full"
                    >
                      <div className={`w-3 h-3 rounded-full ${color} mr-2`} />
                      {label}
                    </Toggle>
                  </div>
                ))}
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

            {/* Category filters */}
            <div>
              <h3 className="font-semibold mb-3">Categories</h3>
              <div className="space-y-2">
                {availableCategories.map(category => (
                  <Toggle
                    key={category}
                    pressed={selectedCategories.includes(category)}
                    onPressedChange={() => onCategoryToggle(category)}
                    className="justify-start w-full text-sm"
                  >
                    {CATEGORY_LABELS[category]}
                  </Toggle>
                ))}
              </div>
            </div>

            {/* Active filters summary */}
            {hasActiveFilters && (
              <div>
                <h3 className="font-semibold mb-3">Active Filters</h3>
                <div className="space-y-2">
                  {selectedDays.map(day => (
                    <Badge key={day} variant="secondary" className="mr-1">
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
                  {selectedArrondissements.map(arr => (
                    <Badge key={arr} variant="secondary" className="mr-1">
                      {arr}e
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 ml-1"
                        onClick={() => onArrondissementToggle(arr)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                  {selectedCategories.map(category => (
                    <Badge key={category} variant="secondary" className="mr-1">
                      {CATEGORY_LABELS[category]}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 ml-1"
                        onClick={() => onCategoryToggle(category)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
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
