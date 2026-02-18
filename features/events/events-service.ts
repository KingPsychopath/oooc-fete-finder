/**
 * Events Service - Centralized event data access
 *
 * This service provides a clean interface for accessing event data
 * without creating circular dependencies between data and delivery layers.
 */

import "server-only";

import { DataManager } from "@/features/data-management/data-manager";
import { getLiveEvents } from "@/features/data-management/runtime-service";
import { buildFeaturedStatusEvents } from "@/features/events/featured/service";
import type { Event, MusicGenre } from "@/features/events/types";
import { log } from "@/lib/platform/logger";

/**
 * Get all events from the runtime data manager
 */
export async function getAllEvents(): Promise<Event[]> {
	try {
		const result = await getLiveEvents();

		if (result.error) {
			log.error("events", "Error loading events", { error: result.error });
			return [];
		}

		return result.data;
	} catch (error) {
		log.error("events", "Error in getAllEvents", undefined, error);
		return [];
	}
}

/**
 * Get events filtered by day
 */
export async function getEventsByDay(day: string): Promise<Event[]> {
	const events = await getAllEvents();
	return events.filter((event) => event.day === day);
}

/**
 * Get events filtered by arrondissement
 */
export async function getEventsByArrondissement(
	arrondissement: number,
): Promise<Event[]> {
	const events = await getAllEvents();
	return events.filter((event) => event.arrondissement === arrondissement);
}

/**
 * Get total count of events
 */
export async function getEventsCount(): Promise<number> {
	const events = await getAllEvents();
	return events.length;
}

/**
 * Get featured events
 */
export async function getFeaturedEvents(): Promise<Event[]> {
	const events = await getAllEvents();
	return events.filter((event) => event.isFeatured);
}

/**
 * Get featured events through a lightweight cached read for static content pages.
 */
export async function getFeaturedEventsCached(): Promise<Event[]> {
	try {
		return await getFeaturedEvents();
	} catch (error) {
		log.error("events", "Error in getFeaturedEventsCached", undefined, error);
		return [];
	}
}

export async function getFeaturedStatusEvents(): Promise<Event[]> {
	try {
		const result = await DataManager.getEventsData({ populateCoordinates: false });
		if (!result.success) {
			if (result.error) {
				log.error("events", "Error loading featured status events", {
					error: result.error,
				});
			}
			return [];
		}
		return await buildFeaturedStatusEvents(result.data);
	} catch (error) {
		log.error("events", "Error in getFeaturedStatusEvents", undefined, error);
		return [];
	}
}

/**
 * Get OOOC pick events
 */
export async function getOOOCPickEvents(): Promise<Event[]> {
	const events = await getAllEvents();
	return events.filter((event) => event.isOOOCPick);
}

/**
 * Get events filtered by genre
 */
export async function getEventsByGenre(genre: MusicGenre): Promise<Event[]> {
	const events = await getAllEvents();
	return events.filter((event) => event.genre.includes(genre));
}

/**
 * Get free events
 */
export async function getFreeEvents(): Promise<Event[]> {
	const events = await getAllEvents();
	return events.filter(
		(event) =>
			event.price?.toLowerCase().includes("free") ||
			event.price === "" ||
			!event.price,
	);
}
