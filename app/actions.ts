"use server";

import { promises as fs } from "fs";
import path from "path";
import Papa from "papaparse";
import jwt from "jsonwebtoken";
import { CacheManager } from "@/lib/cache-manager";
import type { CacheStatus, EventsResult } from "@/lib/cache-manager";
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
	AuthenticateUserResponse,
	CollectedEmailsResponse,
} from "@/types/user";

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
 * Force refresh the events cache using the centralized cache manager
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

	const adminKey = formData.get("adminKey") as string;
	const sheetInput = formData.get("sheetInput") as string;
	const sheetRange = formData.get("sheetRange") as string;

	// Verify admin access
	const expectedKey = process.env.ADMIN_KEY || "your-secret-key-123";
	if (adminKey !== expectedKey) {
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
export async function analyzeDateFormats(adminKey?: string): Promise<{
	success: boolean;
	warnings?: DateFormatWarning[];
	error?: string;
}> {
	"use server";

	// Verify admin access first
	const expectedKey = process.env.ADMIN_KEY || "your-secret-key-123";
	if (adminKey !== expectedKey) {
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
export async function authenticateUser(
	firstName: string,
	lastName: string,
	email: string,
): Promise<AuthenticateUserResponse> {
	"use server";

	// Validate input
	if (!firstName || !lastName || !email) {
		console.error("❌ User authentication failed: Missing required fields");
		return { success: false, error: "All fields are required" };
	}

	if (!email.includes("@")) {
		console.error("❌ User authentication failed: Invalid email format");
		return { success: false, error: "Invalid email format" };
	}

	const user: UserRecord = {
		firstName: firstName.trim(),
		lastName: lastName.trim(),
		email: email.toLowerCase().trim(),
		timestamp: new Date().toISOString(),
		consent: true,
		source: "fete-finder-auth",
	};

	// Check if user already exists (by email)
	const existingUserIndex = collectedUsers.findIndex(
		(u) => u.email === user.email,
	);

	if (existingUserIndex >= 0) {
		// Update existing user
		collectedUsers[existingUserIndex] = {
			...collectedUsers[existingUserIndex],
			firstName: user.firstName,
			lastName: user.lastName,
			timestamp: user.timestamp,
		};
		console.log(`✅ Updated existing user: ${user.email}`);
	} else {
		// Add new user
		collectedUsers.push(user);
		console.log(`✅ Added new user: ${user.email}`);
	}

	// Submit to Google Sheets if configured
	if (process.env.GOOGLE_SHEETS_URL) {
		console.log(
			"📊 Google Sheets integration configured - submitting user data...",
		);

		try {
			const response = await fetch(process.env.GOOGLE_SHEETS_URL, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					firstName: user.firstName,
					lastName: user.lastName,
					email: user.email,
					consent: user.consent,
					source: user.source,
					timestamp: user.timestamp,
				}),
				signal: AbortSignal.timeout(10000), // 10 second timeout
			});

			if (response.ok) {
				const result = await response.json();
				console.log("✅ User data successfully submitted to Google Sheets");
				console.log(`   Response: ${JSON.stringify(result)}`);
			} else {
				const errorText = await response.text().catch(() => "Unknown error");
				console.warn("⚠️ Failed to submit user data to Google Sheets:");
				console.warn(`   Status: ${response.status} ${response.statusText}`);
				console.warn(`   Error: ${errorText}`);

				// Provide more specific error context
				if (response.status === 401) {
					console.warn(
						"   💡 This may indicate authentication issues with your Google Apps Script",
					);
				} else if (response.status === 403) {
					console.warn(
						"   💡 This may indicate permission issues with your Google Apps Script",
					);
				} else if (response.status === 404) {
					console.warn(
						"   💡 Check if your Google Apps Script URL is correct and deployed",
					);
				} else if (response.status >= 500) {
					console.warn(
						"   💡 This may be a temporary Google Apps Script issue",
					);
				}
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			console.error(
				"❌ Error submitting user data to Google Sheets:",
				errorMessage,
			);

			// Provide more specific error context
			if (errorMessage.includes("timeout")) {
				console.error(
					"   💡 Request timed out - Google Sheets may be slow to respond",
				);
			} else if (
				errorMessage.includes("network") ||
				errorMessage.includes("fetch")
			) {
				console.error("   💡 Network error - check your internet connection");
			} else {
				console.error(
					"   💡 Check your Google Sheets URL and Apps Script configuration",
				);
			}

			// Don't fail the authentication if Google Sheets submission fails
		}
	} else {
		console.log("📝 Google Sheets URL not configured");
		console.log("   💡 To enable automatic data submission to Google Sheets:");
		console.log("   • Set the GOOGLE_SHEETS_URL environment variable");
		console.log("   • Deploy a Google Apps Script to handle data submission");
		console.log("   • User data will be stored locally only until then");
	}

	return {
		success: true,
		message: "User authenticated successfully",
		email: user.email,
	};
}

// Admin function to get collected emails
export async function getCollectedEmails(
	adminKey?: string,
): Promise<CollectedEmailsResponse> {
	"use server";

	// Simple protection - you can set this as an environment variable
	const expectedKey = process.env.ADMIN_KEY || "your-secret-key-123";

	if (adminKey !== expectedKey) {
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

// Google Sheets Admin Utilities - communicate with the merged script's admin functions
export async function getGoogleSheetsStats(adminKey?: string): Promise<{
	success: boolean;
	stats?: {
		totalUsers: number;
		totalWithNames: number;
		totalLegacy: number;
		duplicateEmails: number;
		recentActivity: string;
		sheetHealth: string;
	};
	error?: string;
}> {
	"use server";

	// Admin authentication
	const expectedKey = process.env.ADMIN_KEY || "your-secret-key-123";
	if (adminKey !== expectedKey) {
		return { success: false, error: "Unauthorized" };
	}

	if (!process.env.GOOGLE_SHEETS_URL) {
		return {
			success: false,
			error: "Google Sheets integration not configured",
		};
	}

	try {
		console.log("📊 Fetching Google Sheets statistics...");

		// Call the Google Apps Script with a special stats request
		const response = await fetch(
			`${process.env.GOOGLE_SHEETS_URL}?action=stats`,
			{
				method: "GET",
				signal: AbortSignal.timeout(10000),
			},
		);

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const data = await response.json();

		// Extract stats from the response
		const stats = {
			totalUsers: data.totalUsers || 0,
			totalWithNames: data.totalWithNames || 0,
			totalLegacy: data.totalLegacy || 0,
			duplicateEmails: data.duplicateEmails || 0,
			recentActivity: data.lastActivity || "No recent activity",
			sheetHealth: data.sheetHealth || "Unknown",
		};

		console.log("✅ Google Sheets stats retrieved:", stats);
		return { success: true, stats };
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : "Unknown error";
		console.error("❌ Failed to get Google Sheets stats:", errorMsg);
		return { success: false, error: errorMsg };
	}
}

export async function getRecentSheetEntries(
	adminKey?: string,
	limit: number = 5,
): Promise<{
	success: boolean;
	entries?: Array<{
		firstName: string;
		lastName: string;
		email: string;
		timestamp: string;
		consent: boolean;
		source: string;
	}>;
	error?: string;
}> {
	"use server";

	// Admin authentication
	const expectedKey = process.env.ADMIN_KEY || "your-secret-key-123";
	if (adminKey !== expectedKey) {
		return { success: false, error: "Unauthorized" };
	}

	if (!process.env.GOOGLE_SHEETS_URL) {
		return {
			success: false,
			error: "Google Sheets integration not configured",
		};
	}

	try {
		console.log(`📋 Fetching ${limit} recent entries from Google Sheets...`);

		const response = await fetch(
			`${process.env.GOOGLE_SHEETS_URL}?action=recent&limit=${limit}`,
			{
				method: "GET",
				signal: AbortSignal.timeout(10000),
			},
		);

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const data = await response.json();

		console.log("✅ Recent entries retrieved:", data.entries?.length || 0);
		return { success: true, entries: data.entries || [] };
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : "Unknown error";
		console.error("❌ Failed to get recent entries:", errorMsg);
		return { success: false, error: errorMsg };
	}
}

export async function cleanupSheetDuplicates(adminKey?: string): Promise<{
	success: boolean;
	message?: string;
	removed?: number;
	error?: string;
}> {
	"use server";

	// Admin authentication
	const expectedKey = process.env.ADMIN_KEY || "your-secret-key-123";
	if (adminKey !== expectedKey) {
		return { success: false, error: "Unauthorized access" };
	}

	if (!process.env.GOOGLE_SHEETS_URL) {
		return {
			success: false,
			error:
				"Google Sheets integration not configured. Please set GOOGLE_SHEETS_URL environment variable.",
		};
	}

	try {
		console.log("🗑️ Starting duplicate cleanup on Google Sheets...");

		const response = await fetch(
			`${process.env.GOOGLE_SHEETS_URL}?action=cleanup`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					operation: "remove_duplicates",
					criteria: "email", // Remove duplicates based on email field
				}),
				signal: AbortSignal.timeout(30000), // 30 second timeout for cleanup operation
			},
		);

		if (!response.ok) {
			const errorText = await response.text().catch(() => "Unknown error");
			throw new Error(
				`HTTP ${response.status}: ${response.statusText} - ${errorText}`,
			);
		}

		const data = await response.json();

		const removedCount = data.removed || 0;
		const successMessage =
			removedCount > 0
				? `Successfully removed ${removedCount} duplicate entries from Google Sheets`
				: "No duplicate entries found to remove";

		console.log(`✅ Cleanup completed: ${successMessage}`);

		return {
			success: true,
			message: successMessage,
			removed: removedCount,
		};
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : "Unknown error";
		console.error("❌ Failed to cleanup duplicates:", errorMsg);

		// Provide more specific error messages
		let userFriendlyError = errorMsg;
		if (errorMsg.includes("timeout")) {
			userFriendlyError =
				"Operation timed out. The cleanup may take longer for large datasets.";
		} else if (errorMsg.includes("404")) {
			userFriendlyError =
				"Google Sheets cleanup endpoint not found. Please check your Google Apps Script deployment.";
		} else if (errorMsg.includes("401") || errorMsg.includes("403")) {
			userFriendlyError =
				"Authorization failed. Please check your Google Sheets permissions.";
		} else if (errorMsg.includes("500")) {
			userFriendlyError =
				"Server error occurred. Please try again later or check your Google Apps Script logs.";
		}

		return {
			success: false,
			error: userFriendlyError,
		};
	}
}
