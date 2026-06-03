import {
	getLiveEventByKey,
	getLiveEvents,
} from "@/features/data-management/runtime-service";
import type {
	Event,
	MusicGenre,
	ParisArrondissement,
} from "@/features/events/types";
import { getTicketExchangeSummariesForEvents } from "@/features/ticket-exchange/service";
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
		const result = await getLiveEvents({
			includeFeaturedProjection: false,
			includeEngagementProjection: false,
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
		return await getLiveEventByKey(normalizedEventKey, {
			includeFeaturedProjection: false,
			includeEngagementProjection: false,
			bypassSourceCache: true,
		});
	} catch {
		return null;
	}
};

const withTicketExchangeProjection = async (event: Event): Promise<Event> => {
	try {
		const [summary] = await getTicketExchangeSummariesForEvents([event]);
		return {
			...event,
			ticketExchangeSellingCount: summary?.sellingCount ?? 0,
			ticketExchangeLookingCount: summary?.lookingCount ?? 0,
			ticketExchangeLatestListingAt: summary?.latestListingAt ?? null,
		};
	} catch {
		return event;
	}
};

export const getEventShareEvent = async (
	eventKey: string,
	options?: { bypassCache?: boolean },
): Promise<Event | null> => {
	const normalizedEventKey = normalizeEventKey(eventKey);
	if (!normalizedEventKey) {
		return null;
	}

	if (options?.bypassCache) {
		const event = await findFreshEventShareEvent(normalizedEventKey);
		return event ? withTicketExchangeProjection(event) : null;
	}

	try {
		const index = await getCachedEventShareIndex();
		const event =
			index[normalizedEventKey] ??
			(await findFreshEventShareEvent(normalizedEventKey));
		return event ? withTicketExchangeProjection(event) : null;
	} catch {
		const event = await findFreshEventShareEvent(normalizedEventKey);
		return event ? withTicketExchangeProjection(event) : null;
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
