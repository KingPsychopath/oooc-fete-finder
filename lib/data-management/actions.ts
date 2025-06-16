"use server";

import { validateSessionToken } from "@/lib/admin/admin-session-store";
import { validateDirectAdminKey } from "@/lib/admin/admin-validation";
import { CacheManager } from "@/lib/cache-management/cache-manager";
import type {
	CacheStatus,
	EventsResult,
} from "@/lib/cache-management/cache-manager";
import {
	type DateFormatWarning,
	WarningSystem,
} from "./validation/date-warnings";

/**
 * Data Management Server Actions
 *
 * Server actions specifically related to data management, CSV processing,
 * and Google Sheets operations. Colocated with data management modules.
 */

// Helper function to validate admin access (key or session token)
function validateAdminAccess(keyOrToken?: string): boolean {
	if (!keyOrToken) return false;

	// Direct admin key check
	if (validateDirectAdminKey(keyOrToken)) {
		return true;
	}

	// Session token check
	return validateSessionToken(keyOrToken);
}

/**
 * Get events data using the centralized cache manager
 */
export async function getEvents(
	forceRefresh: boolean = false,
): Promise<EventsResult> {
	return CacheManager.getEvents(forceRefresh);
}

/**
 * Force refresh the events cache using the centralized cache manager with smart invalidation
 */
export async function forceRefreshEvents(): Promise<{
	success: boolean;
	message: string;
	data?: import("@/types/events").Event[];
	count?: number;
	source?: "remote" | "local" | "cached";
	error?: string;
}> {
	return CacheManager.forceRefresh();
}

/**
 * Get cache and system status using the centralized cache manager
 */
export async function getCacheStatus(): Promise<CacheStatus> {
	return CacheManager.getCacheStatus();
}

/**
 * Set dynamic Google Sheet configuration using the centralized cache manager
 */
export async function setDynamicSheet(formData: FormData): Promise<{
	success: boolean;
	message: string;
	sheetId?: string;
	range?: string;
}> {
	"use server";

	const keyOrToken = formData.get("adminKey") as string;
	const sheetInput = formData.get("sheetInput") as string;
	const sheetRange = formData.get("sheetRange") as string;

	// Verify admin access
	if (!validateAdminAccess(keyOrToken)) {
		return { success: false, message: "Unauthorized access" };
	}

	return CacheManager.setDynamicSheet(sheetInput, sheetRange);
}

/**
 * Get dynamic Google Sheet configuration using the centralized cache manager
 */
export async function getDynamicSheetConfig(): Promise<{
	sheetId: string | null;
	range: string | null;
	isActive: boolean;
}> {
	return CacheManager.getDynamicSheetConfig();
}

/**
 * Configuration for which columns to check for date format issues
 */
const DATE_COLUMNS_TO_CHECK = {
	featured: true, // Check the Featured column for timestamp issues
	date: false, // Check the Date column for ambiguous dates
	startTime: false, // Check the Start Time column for time format issues
	endTime: false, // Check the End Time column for time format issues
} as const;

/**
 * Analyze date formats from Google Sheets data
 */
export async function analyzeDateFormats(keyOrToken?: string): Promise<{
	success: boolean;
	warnings?: DateFormatWarning[];
	error?: string;
}> {
	"use server";

	// Verify admin access first
	if (!validateAdminAccess(keyOrToken)) {
		return { success: false, error: "Unauthorized access" };
	}

	try {
		// Force refresh to ensure we get fresh parsing warnings
		const eventsResult = await CacheManager.getEvents(true);

		if (!eventsResult.success || !eventsResult.data) {
			return {
				success: false,
				error: "Failed to load events data for analysis",
			};
		}

		// Get real warnings captured during CSV parsing
		const allWarnings = WarningSystem.getDateFormatWarnings();

		// Filter warnings based on configured columns
		const warnings = allWarnings.filter((warning: DateFormatWarning) => {
			switch (warning.columnType) {
				case "featured":
					return DATE_COLUMNS_TO_CHECK.featured;
				case "date":
					return DATE_COLUMNS_TO_CHECK.date;
				case "startTime":
					return DATE_COLUMNS_TO_CHECK.startTime;
				case "endTime":
					return DATE_COLUMNS_TO_CHECK.endTime;
				default:
					return false;
			}
		});

		console.log(
			`📊 Found ${warnings.length} date format warnings from CSV parsing`,
		);
		if (warnings.length > 0) {
			console.log("📋 Warning summary:");
			warnings.forEach((warning: DateFormatWarning, index: number) => {
				console.log(
					`   ${index + 1}. ${warning.warningType}: "${warning.originalValue}" in ${warning.eventName} (${warning.columnType} column)`,
				);
			});
		}

		return {
			success: true,
			warnings,
		};
	} catch (error) {
		console.error("❌ Error analyzing date formats:", error);
		return {
			success: false,
			error:
				error instanceof Error
					? error.message
					: "Unknown error analyzing date formats",
		};
	}
}
