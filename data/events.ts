import type { Event } from '@/types/events';

// Initial event data - will need to be populated with actual arrondissement, time, and link data
export const EVENTS_DATA: Event[] = [
  // Friday Events
  {
    id: 'ovmbr-friday',
    name: 'Ovmbr',
    day: 'friday',
    time: '20:00',
    arrondissement: 11,
    location: 'TBA',
    link: '#',
    description: 'Electronic music event',
    category: 'electronic',
    verified: false
  },
  {
    id: 'vibesoverseas-friday',
    name: 'Vibesoverseas',
    day: 'friday',
    time: '21:00',
    arrondissement: 18,
    location: 'TBA',
    link: '#',
    description: 'International vibes party',
    category: 'club',
    verified: false
  },
  {
    id: 'sjwa-friday',
    name: 'SJWA',
    day: 'friday',
    time: '22:00',
    arrondissement: 3,
    location: 'TBA',
    link: '#',
    description: 'Underground music scene',
    category: 'electronic',
    verified: false
  },
  {
    id: 'aura-love-bowl',
    name: 'Aura x Love & Bowl',
    day: 'friday',
    time: '19:00',
    arrondissement: 15,
    location: 'TBA',
    link: '#',
    description: 'Collaborative event',
    category: 'club',
    verified: false
  },
  {
    id: 'francophone-party',
    name: 'Francophone Party Paris',
    day: 'friday',
    time: '20:30',
    arrondissement: 5,
    location: 'TBA',
    link: '#',
    description: 'French music celebration',
    category: 'cultural',
    verified: false
  },
  {
    id: 'mob-madness',
    name: 'Mob Madness',
    day: 'friday',
    time: '23:00',
    arrondissement: 10,
    location: 'TBA',
    link: '#',
    description: 'High energy party',
    category: 'club',
    verified: false
  },

  // Saturday Day Events
  {
    id: 'ovmbr-saturday',
    name: 'Ovmbr',
    day: 'saturday-day',
    time: '14:00',
    arrondissement: 11,
    location: 'TBA',
    link: '#',
    description: 'Daytime electronic session',
    category: 'electronic',
    verified: false
  },
  {
    id: 'njoy-chalatet',
    name: "N'joy @ Chalalet",
    day: 'saturday-day',
    time: '15:00',
    arrondissement: 16,
    location: 'Chalalet',
    link: '#',
    description: 'Outdoor party at Chalalet',
    category: 'outdoor',
    verified: false
  },
  {
    id: 'damside-block-party',
    name: 'Damside Block Party',
    day: 'saturday-day',
    time: '13:00',
    arrondissement: 19,
    location: 'TBA',
    link: '#',
    description: 'Street party vibes',
    category: 'block-party',
    verified: false
  },
  {
    id: 'sixtion-recess-everyday',
    name: 'Sixtion x Recess x Everyday People',
    day: 'saturday-day',
    time: '16:00',
    arrondissement: 20,
    location: 'TBA',
    link: '#',
    description: 'Collaborative daytime event',
    category: 'block-party',
    verified: false
  },
  {
    id: 'savage-block-party-day',
    name: 'Savage Block Party',
    day: 'saturday-day',
    time: '14:00',
    arrondissement: 18,
    location: 'TBA',
    link: '#',
    description: 'Wild street celebration',
    category: 'block-party',
    verified: false
  },
  {
    id: 'yaya-club-afrowaan',
    name: 'Yaya Club x Afrowaan',
    day: 'saturday-day',
    time: '17:00',
    arrondissement: 2,
    location: 'TBA',
    link: '#',
    description: 'Afrobeats celebration',
    category: 'cultural',
    verified: false
  },

  // Saturday Night Events
  {
    id: 'sixtion-afterparty',
    name: 'Sixtion Afterparty',
    day: 'saturday-night',
    time: '22:00',
    arrondissement: 20,
    location: 'TBA',
    link: '#',
    description: 'Late night continuation',
    category: 'afterparty',
    verified: false
  },
  {
    id: 'ovmbr-afterparty',
    name: 'Ovmbr Afterparty',
    day: 'saturday-night',
    time: '23:00',
    arrondissement: 11,
    location: 'TBA',
    link: '#',
    description: 'Electronic afterparty',
    category: 'afterparty',
    verified: false
  },
  {
    id: 'njoy-afterparty',
    name: "N'joy Afterparty",
    day: 'saturday-night',
    time: '22:30',
    arrondissement: 16,
    location: 'TBA',
    link: '#',
    description: 'Continuation of the day party',
    category: 'afterparty',
    verified: false
  },
  {
    id: 'mamacita',
    name: 'Mamacita',
    day: 'saturday-night',
    time: '21:00',
    arrondissement: 8,
    location: 'TBA',
    link: '#',
    description: 'Latin vibes party',
    category: 'club',
    verified: false
  },
  {
    id: 'savage-block-party-night',
    name: 'Savage Block Party',
    day: 'saturday-night',
    time: '20:00',
    arrondissement: 18,
    location: 'TBA',
    link: '#',
    description: 'Continued street celebration',
    category: 'block-party',
    verified: false
  },
  {
    id: 'area-29',
    name: 'Area 29',
    day: 'saturday-night',
    time: '23:30',
    arrondissement: 1,
    location: 'TBA',
    link: '#',
    description: 'Underground club experience',
    category: 'club',
    verified: false
  },
  {
    id: 'sjwa-saturday',
    name: 'SJWA',
    day: 'saturday-night',
    time: '21:30',
    arrondissement: 3,
    location: 'TBA',
    link: '#',
    description: 'Saturday night edition',
    category: 'electronic',
    verified: false
  },

  // Sunday Events
  {
    id: 'sunday-groove-paris',
    name: 'Sunday Groove Paris',
    day: 'sunday',
    time: '16:00',
    arrondissement: 7,
    location: 'TBA',
    link: '#',
    description: 'Chill Sunday vibes',
    category: 'outdoor',
    verified: false
  },
  {
    id: 'la-sunday-abidjan',
    name: 'La Sunday Abidjan',
    day: 'sunday',
    time: '15:00',
    arrondissement: 13,
    location: 'TBA',
    link: '#',
    description: 'African music celebration',
    category: 'cultural',
    verified: false
  },
  {
    id: 'galactajeeniius',
    name: 'Galactajeeniius',
    day: 'sunday',
    time: '17:00',
    arrondissement: 12,
    location: 'TBA',
    link: '#',
    description: 'Cosmic music experience',
    category: 'electronic',
    verified: false
  },
  {
    id: 'ftp',
    name: 'FTP',
    day: 'sunday',
    time: '18:00',
    arrondissement: 4,
    location: 'TBA',
    link: '#',
    description: 'Underground Sunday session',
    category: 'electronic',
    verified: false
  },
  {
    id: 'vibesoverseas-sunday',
    name: 'Vibesoverseas',
    day: 'sunday',
    time: '19:00',
    arrondissement: 18,
    location: 'TBA',
    link: '#',
    description: 'Sunday edition',
    category: 'club',
    verified: false
  },
  {
    id: 'parismatik-cruise',
    name: 'Parismatik Cruise',
    day: 'sunday',
    time: '14:00',
    arrondissement: 7,
    location: 'Seine River',
    link: '#',
    description: 'Boat party on the Seine',
    category: 'cruise',
    verified: false
  },

  // TBC Events
  {
    id: 'wanderlust-friday',
    name: 'Wanderlust Friday',
    day: 'tbc',
    time: 'TBC',
    arrondissement: 16,
    location: 'Bois de Vincennes',
    link: '#',
    description: 'Outdoor electronic festival',
    category: 'outdoor',
    verified: false
  },
  {
    id: 'wanderlust-saturday',
    name: 'Wanderlust Saturday',
    day: 'tbc',
    time: 'TBC',
    arrondissement: 16,
    location: 'Bois de Vincennes',
    link: '#',
    description: 'Outdoor electronic festival',
    category: 'outdoor',
    verified: false
  },
  {
    id: 'all-night-long',
    name: 'All Night Long',
    day: 'tbc',
    time: 'TBC',
    arrondissement: 9,
    location: 'TBA',
    link: '#',
    description: 'Marathon party session',
    category: 'club',
    verified: false
  },
  {
    id: 'trendy',
    name: 'Trendy',
    day: 'tbc',
    time: 'TBC',
    arrondissement: 6,
    location: 'TBA',
    link: '#',
    description: 'Fashionable party scene',
    category: 'club',
    verified: false
  },
  {
    id: 'spiritual-gangster',
    name: 'Spiritual Gangster',
    day: 'tbc',
    time: 'TBC',
    arrondissement: 14,
    location: 'TBA',
    link: '#',
    description: 'Unique spiritual party experience',
    category: 'cultural',
    verified: false
  },
  {
    id: 'hotel-zamara',
    name: 'Hotel Zamara',
    day: 'tbc',
    time: 'TBC',
    arrondissement: 17,
    location: 'TBA',
    link: '#',
    description: 'Boutique hotel party',
    category: 'club',
    verified: false
  },
  {
    id: 'shindig',
    name: 'Shindig',
    day: 'tbc',
    time: 'TBC',
    arrondissement: 19,
    location: 'TBA',
    link: '#',
    description: 'Alternative music celebration',
    category: 'electronic',
    verified: false
  },
  {
    id: 'moody-hifi',
    name: 'Moody HiFi',
    day: 'tbc',
    time: 'TBC',
    arrondissement: 11,
    location: 'TBA',
    link: '#',
    description: 'High-quality sound experience',
    category: 'electronic',
    verified: false
  }
];

// Helper functions
export const getEventsByDay = (day: string) => {
  return EVENTS_DATA.filter(event => event.day === day);
};

export const getEventsByArrondissement = (arrondissement: number) => {
  return EVENTS_DATA.filter(event => event.arrondissement === arrondissement);
};

export const getEventsCount = () => {
  return EVENTS_DATA.length;
};

export const getArrondissementsWithEvents = () => {
  const arrondissements = new Set(EVENTS_DATA.map(event => event.arrondissement));
  return Array.from(arrondissements).sort((a, b) => a - b);
};
