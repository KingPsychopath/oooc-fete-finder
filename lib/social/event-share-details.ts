import { DataManager } from "@/features/data-management/data-manager";
import type {
	Event,
	MusicGenre,
	ParisArrondissement,
} from "@/features/events/types";
import { unstable_cache } from "next/cache";

export interface EventShareDetails {
	eventKey: string;
	slug: string;
	name: string;
	day: Event["day"];
	date: string;
	time?: string;
	endTime?: string;
	arrondissement: ParisArrondissement;
	location?: string;
	price?: string;
	genres: MusicGenre[];
}

const normalizeEventKey = (value: string): string => value.trim().toLowerCase();

const toEventShareDetails = (event: Event): EventShareDetails => ({
	eventKey: event.eventKey,
	slug: event.slug,
	name: event.name,
	day: event.day,
	date: event.date,
	time: event.time,
	endTime: event.endTime,
	arrondissement: event.arrondissement,
	location: event.location,
	price: event.price,
	genres: event.genre.slice(0, 3),
});

const getCachedEventShareIndex = unstable_cache(
	async (): Promise<Record<string, Event>> => {
		const result = await DataManager.getEventsData({
			populateCoordinates: false,
		});
		if (!result.success) {
			throw new Error(result.error || "Unable to load event share details");
		}

		return Object.fromEntries(
			result.data.map((event) => [normalizeEventKey(event.eventKey), event]),
		);
	},
	["event-share-details"],
	{
		revalidate: false,
		tags: ["events", "events-data"],
	},
);

const findFreshEventShareEvent = async (
	normalizedEventKey: string,
): Promise<Event | null> => {
	try {
		const result = await DataManager.getEventsData({
			populateCoordinates: false,
		});
		if (!result.success) return null;
		return (
			result.data.find(
				(event) => normalizeEventKey(event.eventKey) === normalizedEventKey,
			) ?? null
		);
	} catch {
		return null;
	}
};

export const getEventShareEvent = async (
	eventKey: string,
): Promise<Event | null> => {
	const normalizedEventKey = normalizeEventKey(eventKey);
	if (!normalizedEventKey) {
		return null;
	}

	try {
		const index = await getCachedEventShareIndex();
		return (
			index[normalizedEventKey] ??
			(await findFreshEventShareEvent(normalizedEventKey))
		);
	} catch {
		return findFreshEventShareEvent(normalizedEventKey);
	}
};

export const getEventShareDetails = async (
	eventKey: string,
): Promise<EventShareDetails | null> => {
	const normalizedEventKey = normalizeEventKey(eventKey);
	if (!normalizedEventKey) {
		return null;
	}

	try {
		const index = await getCachedEventShareIndex();
		const event =
			index[normalizedEventKey] ??
			(await findFreshEventShareEvent(normalizedEventKey));
		return event ? toEventShareDetails(event) : null;
	} catch {
		const event = await findFreshEventShareEvent(normalizedEventKey);
		return event ? toEventShareDetails(event) : null;
	}
};
