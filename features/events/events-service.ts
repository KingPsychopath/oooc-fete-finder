/**
 * Events Service - Centralized event data access
 *
 * This service provides a clean interface for accessing event data
 * without creating circular dependencies between data and delivery layers.
 */

import "server-only";

import { DataManager } from "@/features/data-management/data-manager";
import { buildFeaturedStatusEvents } from "@/features/events/featured/service";
import type { Event } from "@/features/events/types";
import { log } from "@/lib/platform/logger";

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
