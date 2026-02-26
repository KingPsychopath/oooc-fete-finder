"use client";

import type { Event } from "@/features/events/types";
import { clientLog } from "@/lib/platform/client-logger";
import { useMemo } from "react";
import { FEATURED_EVENTS_CONFIG, FEATURED_EVENTS_LIMITS } from "../constants";
import type { FeaturedEventSelectionResult } from "../types";
import { shouldDisplayFeaturedEvent } from "../utils/timestamp-utils";

/**
 * Custom hook to select and manage featured events
 * - Automatically filters out expired timestamp-based featured events
 * - Permanently displays manually featured events without timestamps
 * - Uses deterministic shuffling to avoid hydration errors
 */
export function useFeaturedEvents(
	events: Event[],
	maxFeaturedEvents: number = FEATURED_EVENTS_CONFIG.MAX_FEATURED_EVENTS,
): FeaturedEventSelectionResult {
	const result = useMemo(() => {
		// Input validation
		if (!Array.isArray(events)) {
			clientLog.warn("events.featured", "events must be an array");
			return {
				featuredEvents: [],
				totalEventsCount: 0,
				hasMoreEvents: false,
			};
		}

		if (
			maxFeaturedEvents < FEATURED_EVENTS_LIMITS.MIN_FEATURED_EVENTS ||
			maxFeaturedEvents > FEATURED_EVENTS_LIMITS.MAX_FEATURED_EVENTS_LIMIT
		) {
			clientLog.warn("events.featured", "maxFeaturedEvents out of bounds; using default", {
				requested: maxFeaturedEvents,
				min: FEATURED_EVENTS_LIMITS.MIN_FEATURED_EVENTS,
				max: FEATURED_EVENTS_LIMITS.MAX_FEATURED_EVENTS_LIMIT,
			});
			maxFeaturedEvents = FEATURED_EVENTS_CONFIG.MAX_FEATURED_EVENTS;
		}

		// Handle empty events array
		if (events.length === 0) {
			return {
				featuredEvents: [],
				totalEventsCount: 0,
				hasMoreEvents: false,
			};
		}
		// Deterministic shuffle function using date as seed for consistent server/client results
		const deterministicShuffle = <T>(array: T[]): T[] => {
			const shuffled = [...array];
			const seed = new Date().toDateString(); // Same seed for entire day
			let hash = 0;
			for (let i = 0; i < seed.length; i++) {
				hash = (hash << 5) - hash + seed.charCodeAt(i);
				hash = hash & hash; // Convert to 32-bit integer
			}

			// Simple deterministic shuffle using the hash as seed
			for (let i = shuffled.length - 1; i > 0; i--) {
				hash = (hash * 1664525 + 1013904223) % Math.pow(2, 32); // Linear congruential generator
				const j = Math.floor((hash / Math.pow(2, 32)) * (i + 1));
				[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
			}

			return shuffled;
		};

		// Filter events by type and check expiration for featured events
		const manuallyFeatured = events.filter(
			(event) => event != null && shouldDisplayFeaturedEvent(event),
		);

		const oooPicksEvents = events.filter(
			(event) =>
				event != null &&
				event.isOOOCPick === true &&
				!shouldDisplayFeaturedEvent(event),
		);

		const regularEvents = events.filter(
			(event) =>
				event != null &&
				event.isOOOCPick !== true &&
				!shouldDisplayFeaturedEvent(event),
		);

		// Build featured events list starting with manually featured events
		const featured = [...manuallyFeatured].slice(0, maxFeaturedEvents);

		// Calculate remaining slots
		const remainingSlots = maxFeaturedEvents - featured.length;

		if (remainingSlots > 0) {
			// Use deterministic shuffle for OOOC picks that aren't manually featured
			const shuffledOOOCPicks = deterministicShuffle(oooPicksEvents);

			// Fill remaining slots with shuffled OOOC picks first
			const availableOOOCPicks = shuffledOOOCPicks.slice(0, remainingSlots);
			featured.push(...availableOOOCPicks);

			// If still need more events, add regular events
			if (featured.length < maxFeaturedEvents) {
				const stillRemainingSlots = maxFeaturedEvents - featured.length;
				const shuffledRegularEvents = deterministicShuffle(regularEvents);
				featured.push(...shuffledRegularEvents.slice(0, stillRemainingSlots));
			}
		}

		// Safety check: filter out any undefined events
		const safeFeatured = featured.filter((event) => event != null);
		const seenEventKeys = new Set<string>();
		const dedupedFeatured = safeFeatured.filter((event) => {
			if (!event.eventKey) return true;
			if (seenEventKeys.has(event.eventKey)) return false;
			seenEventKeys.add(event.eventKey);
			return true;
		});

		if (dedupedFeatured.length < maxFeaturedEvents) {
			const fillCandidates = deterministicShuffle(events).filter(
				(event) =>
					Boolean(event) &&
					Boolean(event.eventKey) &&
					!seenEventKeys.has(event.eventKey),
			);
			for (const candidate of fillCandidates) {
				dedupedFeatured.push(candidate);
				if (candidate.eventKey) {
					seenEventKeys.add(candidate.eventKey);
				}
				if (dedupedFeatured.length >= maxFeaturedEvents) {
					break;
				}
			}
		}

		// Debug logging if we have issues
		if (safeFeatured.length !== featured.length) {
			clientLog.warn("events.featured", "Filtered undefined events in featured selection", {
				filteredCount: featured.length - safeFeatured.length,
			});
		}

		return {
			featuredEvents: dedupedFeatured,
			totalEventsCount: events.length,
			hasMoreEvents: events.length > maxFeaturedEvents,
		};
	}, [events, maxFeaturedEvents]);

	return result;
}
