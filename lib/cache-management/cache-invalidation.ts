/**
 * Cache Invalidation Utilities
 * Handles smart cache invalidation, change detection, and Next.js cache clearing
 */

import { revalidatePath, revalidateTag } from "next/cache";
import { Event } from "@/types/events";

/**
 * Type utilities to ensure cache invalidation stays in sync with Event type
 */
type EventFields = keyof Event;

/**
 * Utility to get all Event field names - this will break compilation
 * if new fields are added to Event type without updating cache logic
 */
const EVENT_FIELD_NAMES: EventFields[] = [
	"id",
	"name",
	"day",
	"date",
	"time",
	"endTime",
	"arrondissement",
	"location",
	"link",
	"links",
	"description",
	"type",
	"genre",
	"venueTypes",
	"indoor",
	"verified",
	"price",
	"age",
	"isOOOCPick",
	"isFeatured",
	"featuredAt",
	"nationality",
	"category",
];
void EVENT_FIELD_NAMES; // Used for compile-time checking

/**
 * Compile-time check: This will cause a TypeScript error if we miss any Event fields
 * or if the Event type gains/loses fields without updating the cache logic
 */
const _fieldCompleteness: Record<EventFields, true> = {
	id: true,
	name: true,
	day: true,
	date: true,
	time: true,
	endTime: true,
	arrondissement: true,
	location: true,
	link: true,
	links: true,
	description: true,
	type: true,
	genre: true,
	venueTypes: true,
	indoor: true,
	verified: true,
	price: true,
	age: true,
	isOOOCPick: true,
	isFeatured: true,
	featuredAt: true,
	nationality: true,
	category: true,
};
void _fieldCompleteness; // Silence unused warning

import type {
	ChangeDetails,
	InvalidationResult,
	CacheClearResult,
	EmergencyCacheBustResult,
} from "./cache-types";

/**
 * Cache Invalidation Manager class
 */
export class CacheInvalidationManager {
	/**
	 * Type-safe normalization of event data for consistent hashing
	 * This function automatically includes ALL Event fields and will cause
	 * compile-time errors if the Event type changes
	 */
	static normalizeEventForHashing(event: Event): Event {
		// TypeScript will enforce that ALL Event fields are handled here
		const normalized: Event = {
			id: event.id,
			name: event.name,
			day: event.day,
			date: event.date,
			time: event.time,
			endTime: event.endTime,
			arrondissement: event.arrondissement,
			location: event.location,
			link: event.link,
			links: event.links ? [...event.links].sort() : undefined,
			description: event.description,
			type: event.type,
			genre: [...event.genre].sort(), // Sort for consistency
			venueTypes: [...event.venueTypes].sort(), // Sort for consistency
			indoor: event.indoor, // Legacy field
			verified: event.verified,
			price: event.price,
			age: event.age,
			isOOOCPick: event.isOOOCPick,
			isFeatured: event.isFeatured,
			featuredAt: event.featuredAt,
			nationality: event.nationality
				? [...event.nationality].sort()
				: undefined,
			category: event.category, // Legacy field
		};

		return normalized;
	}

	/**
	 * Create a comprehensive, type-safe hash of event data for change detection
	 */
	static createEventHash(events: Event[]): string {
		// Sort events by id to avoid order-based false positives
		const sortedEvents = [...events].sort((a, b) => a.id.localeCompare(b.id));

		// Create hash from ALL Event fields using type-safe normalization
		const hashData = sortedEvents.map((event) =>
			this.normalizeEventForHashing(event),
		);

		return JSON.stringify(hashData);
	}

	/**
	 * Detailed change detection - identifies what exactly changed
	 */
	static detectChanges(
		oldEvents: Event[],
		newEvents: Event[],
	): {
		hasChanges: boolean;
		changeDetails: ChangeDetails;
	} {
		const changeDetails: ChangeDetails = {
			countChanged: oldEvents.length !== newEvents.length,
			addedEvents: [],
			removedEvents: [],
			modifiedEvents: [],
		};

		// Create maps for efficient lookup
		const oldEventMap = new Map(oldEvents.map((e) => [e.id, e]));
		const newEventMap = new Map(newEvents.map((e) => [e.id, e]));

		// Find removed events
		for (const oldEvent of oldEvents) {
			if (!newEventMap.has(oldEvent.id)) {
				changeDetails.removedEvents.push(oldEvent.name);
			}
		}

		// Find added and modified events
		for (const newEvent of newEvents) {
			const oldEvent = oldEventMap.get(newEvent.id);

			if (!oldEvent) {
				// New event
				changeDetails.addedEvents.push(newEvent.name);
			} else {
				// Check if existing event was modified
				const oldHash = this.createEventHash([oldEvent]);
				const newHash = this.createEventHash([newEvent]);

				if (oldHash !== newHash) {
					changeDetails.modifiedEvents.push(newEvent.name);
				}
			}
		}

		const hasChanges =
			changeDetails.countChanged ||
			changeDetails.addedEvents.length > 0 ||
			changeDetails.removedEvents.length > 0 ||
			changeDetails.modifiedEvents.length > 0;

		return { hasChanges, changeDetails };
	}

	/**
	 * Clear all cache layers - both in-memory and Next.js page cache
	 */
	static async clearAllCaches(
		paths: string[] = ["/"],
	): Promise<CacheClearResult> {
		console.log("🧹 Starting comprehensive cache clearing...");
		const clearedPaths: string[] = [];
		const errors: string[] = [];

		// Clear Next.js page cache for specified paths
		for (const path of paths) {
			try {
				revalidatePath(path, "page");
				clearedPaths.push(path);
				console.log(`✅ Page cache cleared for: ${path}`);
			} catch (error) {
				const errorMsg =
					error instanceof Error ? error.message : "Unknown error";
				errors.push(`Page cache ${path}: ${errorMsg}`);
				console.error(`❌ Failed to clear page cache for ${path}:`, errorMsg);
			}
		}

		// Clear layout cache more aggressively
		try {
			revalidatePath("/", "layout");
			revalidatePath("/events", "layout");
			revalidatePath("/admin", "layout");
			console.log("✅ Layout cache cleared for multiple paths");
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : "Unknown error";
			errors.push(`Layout cache: ${errorMsg}`);
			console.error("❌ Failed to clear layout cache:", errorMsg);
		}

		// Clear cache tags
		try {
			revalidateTag("events");
			revalidateTag("events-data");
			console.log("✅ Cache tags cleared");
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : "Unknown error";
			errors.push(`Cache tags: ${errorMsg}`);
			console.error("❌ Failed to clear cache tags:", errorMsg);
		}

		const success = errors.length === 0;
		console.log(`🧹 Cache clearing completed. Success: ${success}`);

		return {
			success,
			clearedPaths,
			errors,
		};
	}

	/**
	 * Smart cache invalidation with detailed change detection
	 */
	static async smartInvalidation(
		newData: Event[],
		currentData: Event[] | null,
		paths: string[] = ["/"],
	): Promise<InvalidationResult> {
		console.log("🔍 Performing enhanced smart cache invalidation check...");

		let dataChanged = false;
		let changeDetails: ChangeDetails | undefined;

		if (!currentData) {
			dataChanged = true;
			console.log("📊 No cached data exists - invalidation needed");
		} else {
			// DEBUG: Log data details for investigation
			console.log(`🔍 DEBUG: Comparing data...`);
			console.log(`   Current cache: ${currentData.length} events`);
			console.log(`   New data: ${newData.length} events`);

			// Sample first few events for debugging
			if (currentData.length > 0 && newData.length > 0) {
				console.log(`🔍 DEBUG: First event comparison:`);
				const firstOld = currentData[0];
				const firstNew = newData[0];
				console.log(
					`   Old: id="${firstOld.id}", name="${firstOld.name}", location="${firstOld.location}"`,
				);
				console.log(
					`   New: id="${firstNew.id}", name="${firstNew.name}", location="${firstNew.location}"`,
				);
			}

			// Perform detailed change detection
			const changeResult = this.detectChanges(currentData, newData);
			dataChanged = changeResult.hasChanges;
			changeDetails = changeResult.changeDetails;
		}

		if (dataChanged) {
			console.log("📊 Data changes detected - performing cache invalidation");
			const clearResult = await this.clearAllCaches(paths);

			return {
				success: clearResult.success,
				dataChanged: true,
				invalidated: clearResult.success,
				message: clearResult.success
					? `Cache invalidated due to data changes. Cleared paths: ${clearResult.clearedPaths.join(", ")}`
					: `Cache invalidation failed: ${clearResult.errors.join("; ")}`,
				changeDetails,
			};
		} else {
			console.log(
				"📊 No data changes detected - forcing cache clear anyway (ISR fix)",
			);

			// FORCE cache clear even when no changes detected to fix ISR issues
			const clearResult = await this.clearAllCaches(paths);

			return {
				success: clearResult.success,
				dataChanged: false,
				invalidated: clearResult.success,
				message: clearResult.success
					? `Forced cache invalidation completed (ISR refresh). Cleared paths: ${clearResult.clearedPaths.join(", ")}`
					: `Forced cache invalidation failed: ${clearResult.errors.join("; ")}`,
			};
		}
	}

	/**
	 * Emergency cache bust - immediately invalidate everything
	 */
	static async emergencyCacheBust(): Promise<EmergencyCacheBustResult> {
		console.log("🚨 Performing emergency cache bust...");
		const operations: string[] = [];
		const errors: string[] = [];

		try {
			// Clear all cache layers
			const clearResult = await this.clearAllCaches([
				"/",
				"/events",
				"/admin",
				"/api",
			]);

			if (clearResult.success) {
				operations.push(
					`Cache cleared for paths: ${clearResult.clearedPaths.join(", ")}`,
				);
			} else {
				errors.push(...clearResult.errors);
			}

			// Additional aggressive clearing
			try {
				revalidatePath("/", "layout");
				operations.push("Layout cache cleared");
			} catch (error) {
				errors.push(
					`Layout cache error: ${error instanceof Error ? error.message : "Unknown"}`,
				);
			}

			const success = errors.length === 0;
			const message = success
				? "Emergency cache bust completed successfully"
				: `Emergency cache bust completed with ${errors.length} errors`;

			console.log(`🚨 Emergency cache bust result: ${message}`);

			return {
				success,
				message,
				operations,
				errors,
			};
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : "Unknown error";
			console.error("❌ Emergency cache bust failed:", errorMsg);

			return {
				success: false,
				message: "Emergency cache bust failed",
				operations,
				errors: [errorMsg],
			};
		}
	}
}
