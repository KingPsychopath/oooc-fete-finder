import type { Event, CSVEventRow, EventDay, MusicGenre, EventType, ParisArrondissement } from '@/types/events';

/**
 * Parse CSV content into CSVEventRow objects
 */
export const parseCSVContent = (csvContent: string): CSVEventRow[] => {
  const lines = csvContent.trim().split('\n');
  const headers = lines[0].split(',');
  
  return lines.slice(1).map((line, index) => {
    // Handle CSV parsing with potential commas in quoted fields
    const values = parseCSVLine(line);
    
    if (values.length !== headers.length) {
      console.warn(`Row ${index + 2} has ${values.length} values but expected ${headers.length}`);
    }
    
    return {
      oocPicks: values[0] || '',
      name: values[1] || '',
      date: values[2] || '',
      startTime: values[3] || '',
      endTime: values[4] || '',
      location: values[5] || '',
      genre: values[6] || '',
      price: values[7] || '',
      ticketLink: values[8] || '',
      age: values[9] || '',
      notes: values[10] || ''
    };
  });
};

/**
 * Parse a CSV line handling quoted fields that may contain commas
 */
const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;
  
  // Using functional approach with proper state management
  while (i < line.length) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
    i++;
  }
  
  result.push(current.trim());
  return result;
};

/**
 * Convert date string to EventDay
 * Using functional approach with clear mapping
 */
const convertToEventDay = (dateStr: string): EventDay => {
  const lowerDate = dateStr.toLowerCase();
  
  // Direct mapping for clarity (preferred over switch/if chains)
  const dateMapping = {
    '19 june': 'friday' as const,
    '20 june': 'friday' as const,
    '21 june': 'saturday' as const,
    '22 june': 'sunday' as const,
  };
  
  return Object.entries(dateMapping).find(([key]) => 
    lowerDate.includes(key)
  )?.[1] || 'tbc';
};

/**
 * Convert genre string to MusicGenre array
 * Using const assertions and proper type mapping
 */
const convertToMusicGenres = (genreStr: string): MusicGenre[] => {
  if (!genreStr) return [];
  
  // Using const assertion for better type safety
  const genreMap = {
    'afrobeats': 'afrobeats',
    'afro': 'afro',
    'amapiano': 'amapiano',
    'hip hop': 'hip hop',
    'r&b': 'r&b',
    'shatta': 'shatta',
    'dancehall': 'dancehall',
    'reggaeton': 'reggaeton',
    'baile funk': 'baile funk',
    'house': 'house',
    'disco': 'disco',
    'afro house': 'afro house',
    'electro': 'electro',
    'funk': 'funk',
    'rap': 'rap',
    'trap': 'trap',
    'uk drill': 'uk drill',
    'uk garage': 'uk garage',
    'bouyon': 'bouyon',
    'zouk': 'zouk',
    'bashment': 'bashment',
    'soca': 'soca',
    'pop': 'pop',
    'coupé-décalé': 'coupé-décalé',
    'urban fr': 'urban fr',
    'kompa': 'kompa'
  } as const;
  
  const genres = genreStr.toLowerCase().split(',').map(g => g.trim());
  
  // Functional approach using map and filter
  const mappedGenres = genres
    .map(genre => genreMap[genre as keyof typeof genreMap])
    .filter((genre): genre is MusicGenre => Boolean(genre))
    .filter((genre, index, arr) => arr.indexOf(genre) === index); // Remove duplicates
  
  return mappedGenres.length > 0 ? mappedGenres : ['afrobeats']; // Default fallback
};

/**
 * Convert time string to 24-hour format
 * Using functional approach with pattern matching
 */
const convertToTime = (timeStr: string): string => {
  if (!timeStr || timeStr.toLowerCase() === 'tbc') return 'TBC';
  
  // Handle formats like "2:00 pm", "11:00 pm", "10:30 pm"
  const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
  if (!timeMatch) return timeStr;
  
  const [, hourStr, minutes, period] = timeMatch;
  const hours = parseInt(hourStr);
  const isAM = period.toLowerCase() === 'am';
  
  // Functional approach to hour conversion
  const convertedHours = (() => {
    if (isAM && hours === 12) return 0;
    if (!isAM && hours !== 12) return hours + 12;
    return hours;
  })();
  
  return `${convertedHours.toString().padStart(2, '0')}:${minutes}`;
};

/**
 * Estimate arrondissement from location string
 * Using functional mapping approach
 */
const estimateArrondissement = (location: string): ParisArrondissement => {
  const locationLower = location.toLowerCase();
  
  // Location mappings based on known venues/areas
  const locationMap = {
    'temple': 3,
    'montparnasse': 14,
    'bellevilloise': 20,
    'wanderlust': 12,
    'belleville': 20,
    'marais': 4,
    'bastille': 11,
    'république': 11,
    'châtelet': 1,
    'louvre': 1,
    'pigalle': 18,
    'moulin rouge': 18,
    'canal': 10,
    'notre dame': 4,
    'richerand': 10,
    'quai françois mauriac': 13
  } as const;
  
  // Functional approach using find
  const matchedArrondissement = Object.entries(locationMap)
    .find(([key]) => locationLower.includes(key))?.[1];
  
  return (matchedArrondissement || 11) as ParisArrondissement;
};

/**
 * Determine if event is after party based on name and time
 * Using functional predicates
 */
const isAfterParty = (name: string, startTime: string): boolean => {
  const nameLower = name.toLowerCase();
  const time = convertToTime(startTime);
  
  // Functional predicates for clarity
  const hasAfterPartyInName = nameLower.includes('after') || nameLower.includes('afterparty');
  const isLateNight = (() => {
    if (time === 'TBC') return false;
    const [hours] = time.split(':').map(Number);
    return hours >= 23;
  })();
  
  return hasAfterPartyInName || isLateNight;
};

/**
 * Convert ISO date format
 */
const convertToISODate = (dateStr: string): string => {
  const dateMatch = dateStr.match(/(\d{1,2})\s+june/i);
  if (dateMatch) {
    const day = parseInt(dateMatch[1]).toString().padStart(2, '0');
    return `2025-06-${day}`;
  }
  return '2025-06-21'; // Default to Saturday
};

/**
 * Convert CSVEventRow to Event
 * Main conversion function using functional composition
 */
export const convertCSVRowToEvent = (csvRow: CSVEventRow, index: number): Event => {
  const eventType: EventType = isAfterParty(csvRow.name, csvRow.startTime) ? 'After Party' : 'Block Party';
  const time = convertToTime(csvRow.startTime);
  const endTime = csvRow.endTime ? convertToTime(csvRow.endTime) : undefined;
  
  return {
    id: `csv-event-${index}`,
    name: csvRow.name,
    day: convertToEventDay(csvRow.date),
    date: convertToISODate(csvRow.date),
    time: time === 'TBC' ? undefined : time,
    endTime: endTime === 'TBC' ? undefined : endTime,
    arrondissement: estimateArrondissement(csvRow.location),
    location: csvRow.location || 'TBA',
    link: csvRow.ticketLink || '#',
    description: csvRow.notes || `${csvRow.genre} event`,
    type: eventType,
    genre: convertToMusicGenres(csvRow.genre),
    indoor: !csvRow.location.toLowerCase().includes('outdoor') && !csvRow.location.toLowerCase().includes('open air'),
    verified: false,
    price: csvRow.price || undefined,
    age: csvRow.age || undefined,
    isOOOCPick: csvRow.oocPicks === '🌟'
  };
};

/**
 * Load and parse events from CSV via API route
 * Client-side function that fetches from the server API
 */
export const loadEventsFromCSV = async (): Promise<Event[]> => {
  try {
    const response = await fetch('/api/events');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || 'Failed to load events');
    }
    
    return result.data;
  } catch (error) {
    console.error('Error loading CSV events from API:', error);
    throw new Error('Failed to load events from CSV');
  }
};

/**
 * Get events count from CSV
 */
export const getCSVEventsCount = async (): Promise<number> => {
  try {
    const events = await loadEventsFromCSV();
    return events.length;
  } catch (error) {
    console.error('Error getting CSV events count:', error);
    return 0;
  }
}; 