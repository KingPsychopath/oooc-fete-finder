/**
 * Events Service - Centralized event data access
 *
 * This service provides a clean interface for accessing event data
 * without creating circular dependencies between data and delivery layers.
 */

import { CacheManager } from "@/lib/cache/cache-manager";
import type { Event, MusicGenre } from "@/features/events/types";
import { log } from "@/lib/platform/logger";

/**
 * Get all events from the runtime data manager
 */
export async function getAllEvents(): Promise<Event[]> {
	try {
		const result = await CacheManager.getEvents();

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
