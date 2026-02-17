import type { Event } from "@/features/events/types";
import { FEATURED_EVENTS_CONFIG } from "../constants";

/**
 * Validates if a string is a valid ISO timestamp
 * @param timestamp - The timestamp string to validate
 * @returns true if valid ISO timestamp, false otherwise
 */
export function isValidTimestamp(timestamp?: string): boolean {
	if (!timestamp || timestamp.trim() === "") {
		return false;
	}

	const date = new Date(timestamp);
	return !Number.isNaN(date.getTime()) && date.toISOString() === timestamp;
}

/**
 * Checks if a featured event has expired based on its timestamp
 * @param featuredAt - ISO timestamp when event was featured
 * @param durationHours - Duration in hours (defaults to config value)
 * @returns true if expired, false if still active
 */
export function isFeaturedEventExpired(
	featuredAt?: string,
	durationHours: number = FEATURED_EVENTS_CONFIG.FEATURE_DURATION_HOURS,
): boolean {
	if (!isValidTimestamp(featuredAt)) {
		return false; // No valid timestamp means never expires
	}

	const featuredDate = new Date(featuredAt as string);
	const expirationDate = new Date(
		featuredDate.getTime() + durationHours * 60 * 60 * 1000,
	);

	return new Date() > expirationDate;
}

/**
 * Determines if an event should be displayed as featured
 * - Events with valid timestamps are displayed until they expire
 * - Events without valid timestamps (manual features) are displayed permanently
 * @param event - The event to check
 * @returns true if should be displayed, false if expired
 */
export function shouldDisplayFeaturedEvent(event: Event): boolean {
	// Not a featured event at all
	if (!event.isFeatured) {
		return false;
	}

	// If no timestamp or invalid timestamp, display permanently
	if (!isValidTimestamp(event.featuredAt)) {
		return true;
	}

	// Check if timestamp-based feature has expired
	return !isFeaturedEventExpired(event.featuredAt);
}

/**
 * Gets the expiration date for a featured event
 * @param featuredAt - ISO timestamp when event was featured
 * @param durationHours - Duration in hours (defaults to config value)
 * @returns Date object representing expiration time, or null if no valid timestamp
 */
export function getFeaturedEventExpirationDate(
	featuredAt?: string,
	durationHours: number = FEATURED_EVENTS_CONFIG.FEATURE_DURATION_HOURS,
): Date | null {
	if (!isValidTimestamp(featuredAt)) {
		return null;
	}

	const featuredDate = new Date(featuredAt as string);
	return new Date(featuredDate.getTime() + durationHours * 60 * 60 * 1000);
}
