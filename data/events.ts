import type { Event, MusicGenre, ParisArrondissement } from "@/types/events";
import { parseCSVContent } from "@/utils/csvParser";
import { getEvents } from "@/app/actions";

// Toggle flag to switch between test data and CSV data
// Set this to true to use CSV data, false to use test data
export const USE_CSV_DATA = true;

// Event data with enhanced categorization and strict typing
export const EVENTS_DATA: Event[] = [
	// Friday Events
	{
		id: "ovmbr-friday",
		name: "Ovmbr",
		day: "friday",
		date: "2025-06-20",
		time: "20:00",
		arrondissement: 11,
		location: "TBA",
		link: "#",
		description: "Electronic music event",
		type: "Day Party",
		genre: ["pop", "afrobeats"],
		indoor: false,
		verified: false,
		category: "electronic",
	},
	{
		id: "vibesoverseas-friday",
		name: "Vibesoverseas",
		day: "friday",
		date: "2025-06-20",
		time: "21:00",
		arrondissement: 18,
		location: "TBA",
		link: "#",
		description: "International vibes party",
		type: "Day Party",
		genre: ["afrobeats", "amapiano"],
		indoor: true,
		verified: false,
		category: "club",
	},
	{
		id: "sjwa-friday",
		name: "SJWA",
		day: "friday",
		date: "2025-06-20",
		time: "22:00",
		arrondissement: 3,
		location: "TBA",
		link: "#",
		description: "Underground music scene",
		type: "After Party",
		genre: ["bashment", "afrobeats"],
		indoor: true,
		verified: false,
		category: "electronic",
	},
	{
		id: "aura-love-bowl",
		name: "Aura x Love & Bowl",
		day: "friday",
		date: "2025-06-20",
		time: "19:00",
		arrondissement: 15,
		location: "TBA",
		link: "#",
		description: "Collaborative event",
		type: "Day Party",
		genre: ["pop", "soca"],
		indoor: false,
		verified: false,
		category: "club",
	},
	{
		id: "francophone-party",
		name: "Francophone Party Paris",
		day: "friday",
		date: "2025-06-20",
		time: "20:30",
		arrondissement: 5,
		location: "TBA",
		link: "#",
		description: "French music celebration",
		type: "Day Party",
		genre: ["pop", "afrobeats"],
		indoor: true,
		verified: false,
		category: "cultural",
	},
	{
		id: "mob-madness",
		name: "Mob Madness",
		day: "friday",
		date: "2025-06-20",
		time: "23:00",
		arrondissement: 10,
		location: "TBA",
		link: "#",
		description: "High energy party",
		type: "After Party",
		genre: ["bashment", "amapiano"],
		indoor: true,
		verified: false,
		category: "club",
	},

	// Saturday Day Events
	{
		id: "ovmbr-saturday",
		name: "Ovmbr",
		day: "saturday",
		date: "2025-06-21",
		time: "14:00",
		arrondissement: 11,
		location: "TBA",
		link: "#",
		description: "Daytime electronic session",
		type: "Day Party",
		genre: ["afrobeats", "amapiano"],
		indoor: false,
		verified: false,
		category: "electronic",
	},
	{
		id: "njoy-chalatet",
		name: "N'joy @ Chalalet",
		day: "saturday",
		date: "2025-06-21",
		time: "15:00",
		arrondissement: 16,
		location: "Chalalet",
		link: "#",
		description: "Outdoor party at Chalalet",
		type: "Day Party",
		genre: ["soca", "afrobeats"],
		indoor: false,
		verified: false,
		category: "outdoor",
	},
	{
		id: "damside-block-party",
		name: "Damside Block Party",
		day: "saturday",
		date: "2025-06-21",
		time: "13:00",
		arrondissement: 19,
		location: "TBA",
		link: "#",
		description: "Street party vibes",
		type: "Day Party",
		genre: ["bashment", "afrobeats"],
		indoor: false,
		verified: false,
		category: "block-party",
	},
	{
		id: "sixtion-recess-everyday",
		name: "Sixtion x Recess x Everyday People",
		day: "saturday",
		date: "2025-06-21",
		time: "16:00",
		arrondissement: 20,
		location: "TBA",
		link: "#",
		description: "Collaborative daytime event",
		type: "Day Party",
		genre: ["amapiano", "afrobeats"],
		indoor: false,
		verified: false,
		category: "block-party",
	},
	{
		id: "savage-block-party-day",
		name: "Savage Block Party",
		day: "saturday",
		date: "2025-06-21",
		time: "14:00",
		arrondissement: 18,
		location: "TBA",
		link: "#",
		description: "Wild street celebration",
		type: "Day Party",
		genre: ["bashment", "amapiano"],
		indoor: false,
		verified: false,
		category: "block-party",
	},
	{
		id: "yaya-club-afrowaan",
		name: "Yaya Club x Afrowaan",
		day: "saturday",
		date: "2025-06-21",
		time: "17:00",
		arrondissement: 2,
		location: "TBA",
		link: "#",
		description: "Afrobeats celebration",
		type: "Day Party",
		genre: ["afrobeats", "amapiano"],
		indoor: false,
		verified: false,
		category: "cultural",
	},

	// Saturday Night Events
	{
		id: "sixtion-afterparty",
		name: "Sixtion Afterparty",
		day: "saturday",
		date: "2025-06-21",
		time: "22:00",
		arrondissement: 20,
		location: "TBA",
		link: "#",
		description: "Late night continuation",
		type: "After Party",
		genre: ["amapiano", "bashment"],
		indoor: true,
		verified: false,
		category: "afterparty",
	},
	{
		id: "ovmbr-afterparty",
		name: "Ovmbr Afterparty",
		day: "saturday",
		date: "2025-06-21",
		time: "23:00",
		arrondissement: 11,
		location: "TBA",
		link: "#",
		description: "Electronic afterparty",
		type: "After Party",
		genre: ["afrobeats", "amapiano"],
		indoor: true,
		verified: false,
		category: "afterparty",
	},
	{
		id: "njoy-afterparty",
		name: "N'joy Afterparty",
		day: "saturday",
		date: "2025-06-21",
		time: "22:30",
		arrondissement: 16,
		location: "TBA",
		link: "#",
		description: "Continuation of the day party",
		type: "After Party",
		genre: ["soca", "bashment"],
		indoor: true,
		verified: false,
		category: "afterparty",
	},
	{
		id: "mamacita",
		name: "Mamacita",
		day: "saturday",
		date: "2025-06-21",
		time: "21:00",
		arrondissement: 8,
		location: "TBA",
		link: "#",
		description: "Latin vibes party",
		type: "After Party",
		genre: ["soca", "pop"],
		indoor: true,
		verified: false,
		category: "club",
	},
	{
		id: "savage-block-party-night",
		name: "Savage Block Party",
		day: "saturday",
		date: "2025-06-21",
		time: "20:00",
		arrondissement: 18,
		location: "TBA",
		link: "#",
		description: "Continued street celebration",
		type: "After Party",
		genre: ["bashment", "amapiano"],
		indoor: false,
		verified: false,
		category: "block-party",
	},
	{
		id: "area-29",
		name: "Area 29",
		day: "saturday",
		date: "2025-06-21",
		time: "23:30",
		arrondissement: 1,
		location: "TBA",
		link: "#",
		description: "Underground club experience",
		type: "After Party",
		genre: ["afrobeats", "amapiano"],
		indoor: true,
		verified: false,
		category: "club",
	},
	{
		id: "sjwa-saturday",
		name: "SJWA",
		day: "saturday",
		date: "2025-06-21",
		time: "21:30",
		arrondissement: 3,
		location: "TBA",
		link: "#",
		description: "Saturday night edition",
		type: "After Party",
		genre: ["bashment", "pop"],
		indoor: true,
		verified: false,
		category: "electronic",
	},

	// Sunday Events
	{
		id: "sunday-groove-paris",
		name: "Sunday Groove Paris",
		day: "sunday",
		date: "2025-06-22",
		time: "16:00",
		arrondissement: 7,
		location: "TBA",
		link: "#",
		description: "Chill Sunday vibes",
		type: "Day Party",
		genre: ["soca", "afrobeats"],
		indoor: false,
		verified: false,
		category: "outdoor",
	},
	{
		id: "la-sunday-abidjan",
		name: "La Sunday Abidjan",
		day: "sunday",
		date: "2025-06-22",
		time: "15:00",
		arrondissement: 13,
		location: "TBA",
		link: "#",
		description: "African music celebration",
		type: "Day Party",
		genre: ["afrobeats", "amapiano"],
		indoor: false,
		verified: false,
		category: "cultural",
	},
	{
		id: "galactajeeniius",
		name: "Galactajeeniius",
		day: "sunday",
		date: "2025-06-22",
		time: "17:00",
		arrondissement: 12,
		location: "TBA",
		link: "#",
		description: "Cosmic music experience",
		type: "Day Party",
		genre: ["pop", "amapiano"],
		indoor: true,
		verified: false,
		category: "electronic",
	},
	{
		id: "ftp",
		name: "FTP",
		day: "sunday",
		date: "2025-06-22",
		time: "18:00",
		arrondissement: 4,
		location: "TBA",
		link: "#",
		description: "Underground Sunday session",
		type: "Day Party",
		genre: ["bashment", "afrobeats"],
		indoor: true,
		verified: false,
		category: "electronic",
	},
	{
		id: "vibesoverseas-sunday",
		name: "Vibesoverseas",
		day: "sunday",
		date: "2025-06-22",
		time: "19:00",
		arrondissement: 18,
		location: "TBA",
		link: "#",
		description: "Sunday edition",
		type: "Day Party",
		genre: ["afrobeats", "soca"],
		indoor: true,
		verified: false,
		category: "club",
	},
	{
		id: "parismatik-cruise",
		name: "Parismatik Cruise",
		day: "sunday",
		date: "2025-06-22",
		time: "14:00",
		arrondissement: 7,
		location: "Seine River",
		link: "#",
		description: "Boat party on the Seine",
		type: "Day Party",
		genre: ["soca", "pop"],
		indoor: false,
		verified: false,
		category: "cruise",
	},

	// TBC Events
	{
		id: "wanderlust-friday",
		name: "Wanderlust Friday",
		day: "tbc",
		date: "2025-06-20",
		time: "TBC",
		arrondissement: 16,
		location: "Bois de Vincennes",
		link: "#",
		description: "Outdoor electronic festival",
		type: "Day Party",
		genre: ["pop", "amapiano"],
		indoor: false,
		verified: false,
		category: "outdoor",
	},
	{
		id: "wanderlust-saturday",
		name: "Wanderlust Saturday",
		day: "tbc",
		date: "2025-06-21",
		time: "TBC",
		arrondissement: 16,
		location: "Bois de Vincennes",
		link: "#",
		description: "Outdoor electronic festival",
		type: "Day Party",
		genre: ["pop", "amapiano"],
		indoor: false,
		verified: false,
		category: "outdoor",
	},
	{
		id: "all-night-long",
		name: "All Night Long",
		day: "tbc",
		date: "2025-06-23",
		time: "TBC",
		arrondissement: 9,
		location: "TBA",
		link: "#",
		description: "Marathon party session",
		type: "After Party",
		genre: ["bashment", "afrobeats"],
		indoor: true,
		verified: false,
		category: "club",
	},
	{
		id: "trendy",
		name: "Trendy",
		day: "tbc",
		date: "2025-06-23",
		time: "TBC",
		arrondissement: 6,
		location: "TBA",
		link: "#",
		description: "Fashionable party scene",
		type: "Day Party",
		genre: ["pop", "soca"],
		indoor: true,
		verified: false,
		category: "club",
	},
	{
		id: "spiritual-gangster",
		name: "Spiritual Gangster",
		day: "tbc",
		date: "2025-06-23",
		time: "TBC",
		arrondissement: 14,
		location: "TBA",
		link: "#",
		description: "Unique spiritual party experience",
		type: "Day Party",
		genre: ["amapiano", "afrobeats"],
		indoor: false,
		verified: false,
		category: "cultural",
	},
	{
		id: "hotel-zamara",
		name: "Hotel Zamara",
		day: "tbc",
		date: "2025-06-23",
		time: "TBC",
		arrondissement: 17,
		location: "TBA",
		link: "#",
		description: "Boutique hotel party",
		type: "After Party",
		genre: ["soca", "pop"],
		indoor: true,
		verified: false,
		category: "club",
	},
	{
		id: "shindig",
		name: "Shindig",
		day: "tbc",
		date: "2025-06-23",
		time: "TBC",
		arrondissement: 19,
		location: "TBA",
		link: "#",
		description: "Alternative music celebration",
		type: "Day Party",
		genre: ["pop", "bashment"],
		indoor: true,
		verified: false,
		category: "electronic",
	},
	{
		id: "moody-hifi",
		name: "Moody HiFi",
		day: "tbc",
		date: "2025-06-23",
		time: "TBC",
		arrondissement: 11,
		location: "TBA",
		link: "#",
		description: "High-quality sound experience",
		type: "Day Party",
		genre: ["afrobeats", "amapiano"],
		indoor: true,
		verified: false,
		category: "electronic",
	},
];

// Enhanced helper functions with CSV support
export async function getAllEvents(): Promise<Event[]> {
	try {
		const { data: events, error } = await getEvents();
		
		if (error) {
			console.error("Error loading events:", error);
			return [];
		}

		return events;
	} catch (error) {
		console.error("Error in getAllEvents:", error);
		return [];
	}
}

export const getEventsByDay = async (day: string): Promise<Event[]> => {
	const events = await getAllEvents();
	return events.filter((event) => event.day === day);
};

export const getEventsByArrondissement = async (
	arrondissement: number,
): Promise<Event[]> => {
	const events = await getAllEvents();
	return events.filter((event) => event.arrondissement === arrondissement);
};

export const getEventsCount = async (): Promise<number> => {
	const events = await getAllEvents();
	return events.length;
};

export const getArrondissementsWithEvents = async (): Promise<
	ParisArrondissement[]
> => {
	const events = await getAllEvents();
	const arrondissements = new Set(events.map((event) => event.arrondissement));
	return Array.from(arrondissements).sort((a, b) => {
		// Handle 'unknown' arrondissement - put it at the end
		if (a === "unknown" && b === "unknown") return 0;
		if (a === "unknown") return 1;
		if (b === "unknown") return -1;

		// Both are numbers, sort numerically
		return (a as number) - (b as number);
	});
};

export const getOOOCPickEvents = async (): Promise<Event[]> => {
	const events = await getAllEvents();
	return events.filter((event) => event.isOOOCPick);
};

export const getEventsByGenre = async (genre: MusicGenre): Promise<Event[]> => {
	const events = await getAllEvents();
	return events.filter((event) => event.genre.includes(genre));
};

export const getFreeEvents = async (): Promise<Event[]> => {
	const events = await getAllEvents();
	return events.filter(
		(event) =>
			event.price?.toLowerCase().includes("free") ||
			event.price === "" ||
			!event.price,
	);
};

// Synchronous versions for backwards compatibility (using test data only)
export const getEventsByDaySync = (day: string) => {
	return EVENTS_DATA.filter((event) => event.day === day);
};

export const getEventsByArrondissementSync = (arrondissement: number) => {
	return EVENTS_DATA.filter((event) => event.arrondissement === arrondissement);
};

export const getEventsCountSync = () => {
	return EVENTS_DATA.length;
};

export const getArrondissementsWithEventsSync = (): ParisArrondissement[] => {
	const arrondissements = new Set(
		EVENTS_DATA.map((event) => event.arrondissement),
	);
	return Array.from(arrondissements).sort((a, b) => {
		// Handle 'unknown' arrondissement - put it at the end
		if (a === "unknown" && b === "unknown") return 0;
		if (a === "unknown") return 1;
		if (b === "unknown") return -1;

		// Both are numbers, sort numerically
		return (a as number) - (b as number);
	});
};
