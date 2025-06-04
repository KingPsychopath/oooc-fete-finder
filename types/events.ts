// Strict type definitions for enhanced event categorization
export type EventDay = 'friday' | 'saturday' | 'sunday' | 'monday' | 'tbc';

export type DayNightPeriod = 'day' | 'night';

export type EventType = 'After Party' | 'Block Party';

export type MusicGenre = 'amapiano' | 'afrobeats' | 'soca' | 'pop' | 'bashment';

export type ParisArrondissement = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20;

// Legacy type for backwards compatibility
export type EventCategory = 'electronic' | 'block-party' | 'afterparty' | 'club' | 'cruise' | 'outdoor' | 'cultural';

export type Event = {
  id: string;
  name: string;
  day: EventDay;
  date: string; // ISO date string (YYYY-MM-DD)
  time?: string; // 24-hour format (HH:MM) or 'TBC'
  arrondissement: ParisArrondissement;
  location?: string;
  address?: string;
  link: string;
  description?: string;
  type: EventType;
  genre: MusicGenre[];
  indoor: boolean;
  verified: boolean;
  // Legacy field for backwards compatibility
  category?: EventCategory;
};

export type Arrondissement = {
  id: number;
  name: string;
  events: Event[];
  coordinates: {
    lat: number;
    lng: number;
  };
};

export type EventFilters = {
  day?: EventDay[];
  dayNightPeriod?: DayNightPeriod[];
  arrondissements?: ParisArrondissement[];
  eventTypes?: EventType[];
  genres?: MusicGenre[];
  indoor?: boolean | null; // null = both, true = indoor only, false = outdoor only
  searchTerm?: string;
};

export type MapViewport = {
  center: [number, number];
  zoom: number;
};

export const EVENT_DAYS = [
  { key: 'friday' as const, label: 'Friday', color: 'bg-blue-500' },
  { key: 'saturday' as const, label: 'Saturday', color: 'bg-green-500' },
  { key: 'sunday' as const, label: 'Sunday', color: 'bg-orange-500' },
  { key: 'monday' as const, label: 'Monday', color: 'bg-purple-500' },
  { key: 'tbc' as const, label: 'TBC', color: 'bg-gray-500' }
] as const;

export const DAY_NIGHT_PERIODS = [
  { key: 'day' as const, label: 'Day', timeRange: '6:00 AM - 9:59 PM', icon: '☀️' },
  { key: 'night' as const, label: 'Night', timeRange: '10:00 PM - 5:59 AM', icon: '🌙' }
] as const;

export const MUSIC_GENRES = [
  { key: 'amapiano' as const, label: 'Amapiano', color: 'bg-emerald-500' },
  { key: 'afrobeats' as const, label: 'Afrobeats', color: 'bg-orange-500' },
  { key: 'soca' as const, label: 'Soca', color: 'bg-yellow-500' },
  { key: 'pop' as const, label: 'Pop', color: 'bg-pink-500' },
  { key: 'bashment' as const, label: 'Bashment', color: 'bg-red-500' }
] as const;

export const EVENT_TYPES = [
  { key: 'After Party' as const, label: 'After Party', icon: '🌃' },
  { key: 'Block Party' as const, label: 'Block Party', icon: '🎉' }
] as const;

export const PARIS_ARRONDISSEMENTS = [
  { id: 1 as ParisArrondissement, name: '1er - Louvre', coordinates: { lat: 48.8606, lng: 2.3376 } },
  { id: 2 as ParisArrondissement, name: '2e - Bourse', coordinates: { lat: 48.8677, lng: 2.3414 } },
  { id: 3 as ParisArrondissement, name: '3e - Temple', coordinates: { lat: 48.8644, lng: 2.3615 } },
  { id: 4 as ParisArrondissement, name: '4e - Hôtel-de-Ville', coordinates: { lat: 48.8551, lng: 2.3618 } },
  { id: 5 as ParisArrondissement, name: '5e - Panthéon', coordinates: { lat: 48.8462, lng: 2.3518 } },
  { id: 6 as ParisArrondissement, name: '6e - Luxembourg', coordinates: { lat: 48.8496, lng: 2.3344 } },
  { id: 7 as ParisArrondissement, name: '7e - Palais-Bourbon', coordinates: { lat: 48.8566, lng: 2.3165 } },
  { id: 8 as ParisArrondissement, name: '8e - Élysée', coordinates: { lat: 48.8736, lng: 2.3111 } },
  { id: 9 as ParisArrondissement, name: '9e - Opéra', coordinates: { lat: 48.8785, lng: 2.3373 } },
  { id: 10 as ParisArrondissement, name: '10e - Entrepôt', coordinates: { lat: 48.8760, lng: 2.3590 } },
  { id: 11 as ParisArrondissement, name: '11e - Popincourt', coordinates: { lat: 48.8594, lng: 2.3765 } },
  { id: 12 as ParisArrondissement, name: '12e - Reuilly', coordinates: { lat: 48.8448, lng: 2.3890 } },
  { id: 13 as ParisArrondissement, name: '13e - Gobelins', coordinates: { lat: 48.8322, lng: 2.3647 } },
  { id: 14 as ParisArrondissement, name: '14e - Observatoire', coordinates: { lat: 48.8339, lng: 2.3273 } },
  { id: 15 as ParisArrondissement, name: '15e - Vaugirard', coordinates: { lat: 48.8422, lng: 2.2966 } },
  { id: 16 as ParisArrondissement, name: '16e - Passy', coordinates: { lat: 48.8555, lng: 2.2690 } },
  { id: 17 as ParisArrondissement, name: '17e - Batignolles-Monceau', coordinates: { lat: 48.8848, lng: 2.3120 } },
  { id: 18 as ParisArrondissement, name: '18e - Butte-Montmartre', coordinates: { lat: 48.8927, lng: 2.3436 } },
  { id: 19 as ParisArrondissement, name: '19e - Buttes-Chaumont', coordinates: { lat: 48.8799, lng: 2.3781 } },
  { id: 20 as ParisArrondissement, name: '20e - Ménilmontant', coordinates: { lat: 48.8632, lng: 2.3969 } }
];

// Utility functions for time-based classification
export const getDayNightPeriod = (time: string): DayNightPeriod | null => {
  if (!time || time === 'TBC') return null;

  const [hours] = time.split(':').map(Number);

  // Day: 6:00 AM (06:00) - 9:59 PM (21:59)
  // Night: 10:00 PM (22:00) - 5:59 AM (05:59)
  if (hours >= 6 && hours <= 21) {
    return 'day';
  } else {
    return 'night';
  }
};

export const isEventInDayNightPeriod = (event: Event, period: DayNightPeriod): boolean => {
  const eventPeriod = getDayNightPeriod(event.time || '');
  return eventPeriod === period;
};

export const formatTimeWithPeriod = (time: string): string => {
  if (!time || time === 'TBC') return time;

  const period = getDayNightPeriod(time);
  const periodEmoji = period === 'day' ? '☀️' : '🌙';

  return `${time} ${periodEmoji}`;
};
