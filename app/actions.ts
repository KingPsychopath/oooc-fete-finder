"use server";

import { promises as fs } from "fs";
import path from "path";
import Papa from "papaparse";
import jwt from "jsonwebtoken";
import {
	CacheManager,
	CacheInvalidationManager,
} from "@/lib/cache-management/cache-management";
import type {
	CacheStatus,
	EventsResult,
} from "@/lib/cache-management/cache-management";
import {
	getDateFormatWarnings,
	type DateFormatWarning,
} from "@/utils/csvParser";
import {
	Event,
	EventDay,
	MusicGenre,
	Nationality,
	VenueType,
} from "@/types/events";
import type {
	UserRecord,
	// AuthenticateUserResponse moved to lib/google/apps-script-actions.ts
	CollectedEmailsResponse,
} from "@/types/user";
import { validateDirectAdminKey } from "@/lib/admin/admin-validation";
import { adminSessions, validateSessionToken } from "@/lib/admin/admin-session-store";

// Simple in-memory user storage (will reset on deployment, but good for development)
const collectedUsers: UserRecord[] = [];

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
	data?: Event[];
	count?: number;
	source?: "remote" | "local" | "cached";
	error?: string;
}> {
	return CacheManager.forceRefresh();
}

/**
 * Emergency cache bust - clear all cache layers immediately
 */
export async function emergencyCacheBust(): Promise<{
	success: boolean;
	message: string;
	operations: string[];
	errors: string[];
}> {
	return CacheInvalidationManager.emergencyCacheBust();
}

/**
 * Smart cache invalidation - only invalidate if data changed
 */
export async function smartCacheInvalidation(paths: string[] = ["/"]): Promise<{
	success: boolean;
	clearedPaths: string[];
	errors: string[];
}> {
	return CacheInvalidationManager.clearAllCaches(paths);
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
		const allWarnings = getDateFormatWarnings();

		// Filter warnings based on configured columns
		const warnings = allWarnings.filter((warning) => {
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
			warnings.forEach((warning, index) => {
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

/**
 * Admin authentication functions
 */
// authenticateUser has been moved to lib/google/apps-script-actions.ts

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

// Create admin session (used during login)
export async function createAdminSession(
	adminKey: string,
	sessionToken: string,
): Promise<{ success: boolean; error?: string; expiresAt?: number }> {
	"use server";

	if (!validateDirectAdminKey(adminKey)) {
		return { success: false, error: "Invalid admin key" };
	}

	const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

	adminSessions.set(sessionToken, {
		adminKey,
		expiresAt,
		createdAt: Date.now(),
	});

	console.log(
		`✅ Server session created for token: ${sessionToken.substring(0, 8)}...`,
	);

	return { success: true, expiresAt };
}

// Extend admin session
export async function extendAdminSession(
	sessionToken: string,
): Promise<{ success: boolean; error?: string; expiresAt?: number }> {
	"use server";

	const session = adminSessions.get(sessionToken);

	if (!session) {
		return { success: false, error: "Session not found" };
	}

	if (Date.now() >= session.expiresAt) {
		adminSessions.delete(sessionToken);
		return { success: false, error: "Session expired" };
	}

	const newExpiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
	session.expiresAt = newExpiresAt;

	console.log(
		`✅ Server session extended for token: ${sessionToken.substring(0, 8)}...`,
	);

	return { success: true, expiresAt: newExpiresAt };
}

// Admin function to get collected emails (accepts admin key OR session token)
export async function getCollectedEmails(
	keyOrToken?: string,
): Promise<CollectedEmailsResponse> {
	"use server";

	if (!validateAdminAccess(keyOrToken)) {
		return { success: false, error: "Unauthorized" };
	}

	// Debug logging
	console.log(
		"Admin panel accessed - current emails in memory:",
		collectedUsers.length,
	);
	console.log("Emails:", collectedUsers);

	return {
		success: true,
		emails: collectedUsers,
		count: collectedUsers.length,
	};
}

// Google Sheets Admin Utilities have been moved to lib/google/apps-script-actions.ts

// getRecentSheetEntries has been moved to lib/google/apps-script-actions.ts

// cleanupSheetDuplicates has been moved to lib/google/apps-script-actions.ts

/**
 * Revalidate pages and refresh cache - replaces the API route
 */
export async function revalidatePages(
	keyOrToken?: string,
	path: string = "/",
): Promise<{
	success: boolean;
	message?: string;
	cacheRefreshed?: boolean;
	pageRevalidated?: boolean;
	processingTimeMs?: number;
	error?: string;
}> {
	"use server";

	const startTime = Date.now();
	console.log("🔄 Revalidate server action called");

	// Verify admin access
	if (!validateAdminAccess(keyOrToken)) {
		return { success: false, error: "Unauthorized access" };
	}

	// Validate and normalize path
	const normalizePath = (inputPath: string): string => {
		if (!inputPath || typeof inputPath !== "string") {
			return "/";
		}

		// Ensure path starts with /
		const normalizedPath = inputPath.startsWith("/")
			? inputPath
			: `/${inputPath}`;

		// Basic path validation to prevent malicious paths
		if (
			normalizedPath.includes("..") ||
			!normalizedPath.match(/^\/[\w\-\/]*$/)
		) {
			console.warn(
				`⚠️ Invalid path provided, falling back to root: ${inputPath}`,
			);
			return "/";
		}

		return normalizedPath;
	};

	const normalizedPath = normalizePath(path);

	console.log("📋 Revalidate request:", {
		normalizedPath,
		timestamp: new Date().toISOString(),
	});

	try {
		console.log("✅ Admin access verified, starting full revalidation...");

		// Use the centralized cache manager for full revalidation
		const revalidationResult =
			await CacheManager.fullRevalidation(normalizedPath);

		const processingTime = Date.now() - startTime;
		console.log(`✅ Revalidation completed in ${processingTime}ms`);

		return {
			...revalidationResult,
			processingTimeMs: processingTime,
		};
	} catch (error) {
		const processingTime = Date.now() - startTime;
		console.error("❌ Revalidation error:", error);

		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
			processingTimeMs: processingTime,
		};
	}
}
