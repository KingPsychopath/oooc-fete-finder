import { DataManager } from "@/features/data-management/data-manager";
import type { Event, MusicGenre, ParisArrondissement } from "@/features/events/types";
import { unstable_cache } from "next/cache";

export interface EventShareDetails {
	eventKey: string;
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
	async (): Promise<Record<string, EventShareDetails>> => {
		const result = await DataManager.getEventsData({ populateCoordinates: false });
		if (!result.success) {
			throw new Error(result.error || "Unable to load event share details");
		}

		return Object.fromEntries(
			result.data.map((event) => [
				normalizeEventKey(event.eventKey),
				toEventShareDetails(event),
			]),
		);
	},
	["event-share-details"],
	{
		revalidate: 3600,
		tags: ["events", "events-data"],
	},
);

export const getEventShareDetails = async (
	eventKey: string,
): Promise<EventShareDetails | null> => {
	const normalizedEventKey = normalizeEventKey(eventKey);
	if (!normalizedEventKey) {
		return null;
	}

	try {
		const index = await getCachedEventShareIndex();
		return index[normalizedEventKey] ?? null;
	} catch {
		return null;
	}
};
