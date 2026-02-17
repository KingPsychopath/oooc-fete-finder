"use server";

import { validateAdminAccessFromServerContext } from "@/lib/admin/admin-validation";
import { env } from "@/lib/config/env";
import { UserCollectionStore } from "@/lib/user-management/user-collection-store";

/**
 * ✍️ Google Apps Script Server Actions
 *
 * Server actions that interact with the Google Apps Script webhook
 * Co-located with the Google Apps Script integration module
 */

interface AuthenticateUserResponse {
	success: boolean;
	message?: string;
	email?: string;
	error?: string;
}

interface GoogleSheetsStatsResponse {
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
}

interface CleanupDuplicatesResponse {
	success: boolean;
	message?: string;
	removed?: number;
	error?: string;
}

interface RecentEntriesResponse {
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
}

/**
 * Validate admin access for Google Apps Script operations
 */
async function validateAdminAccess(keyOrToken?: string): Promise<boolean> {
	return validateAdminAccessFromServerContext(keyOrToken ?? null);
}

/**
 * Submit user authentication data
 * Primary write target is local provider-backed storage.
 * Google Apps Script mirroring is optional via GOOGLE_MIRROR_WRITES.
 */
export async function submitUserDataToScript(
	firstName: string,
	lastName: string,
	email: string,
): Promise<AuthenticateUserResponse> {
	// Basic validation
	if (!firstName?.trim() || firstName.trim().length < 2) {
		return {
			success: false,
			error: "First name must be at least 2 characters",
		};
	}

	if (!lastName?.trim() || lastName.trim().length < 2) {
		return {
			success: false,
			error: "Last name must be at least 2 characters",
		};
	}

	if (!email?.trim() || !email.includes("@")) {
		return {
			success: false,
			error: "Valid email address is required",
		};
	}

	const user = {
		firstName: firstName.trim(),
		lastName: lastName.trim(),
		email: email.trim().toLowerCase(),
		consent: true,
		source: "fete-finder-auth",
		timestamp: new Date().toISOString(),
	};

	try {
		const storeWriteResult = await UserCollectionStore.addOrUpdate(user);
		const storeStatus = await UserCollectionStore.getStatus();

		let mirrorWarning: string | null = null;
		const shouldMirrorToGoogle = Boolean(
			env.GOOGLE_MIRROR_WRITES && env.GOOGLE_SHEETS_URL,
		);
		if (shouldMirrorToGoogle && env.GOOGLE_SHEETS_URL) {
			try {
				const response = await fetch(env.GOOGLE_SHEETS_URL, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(user),
					signal: AbortSignal.timeout(10000),
				});

				if (!response.ok) {
					mirrorWarning = `Google mirror failed: ${response.status} ${response.statusText}`;
					console.warn(`⚠️ ${mirrorWarning}`);
				}
			} catch (mirrorError) {
				mirrorWarning =
					mirrorError instanceof Error
						? `Google mirror failed: ${mirrorError.message}`
						: "Google mirror failed";
				console.warn(`⚠️ ${mirrorWarning}`);
			}
		}

		const duplicateMessage = storeWriteResult.alreadyExisted
			? "Existing user updated"
			: "New user stored";

		return {
			success: true,
			message: mirrorWarning
				? `${duplicateMessage} in ${storeStatus.provider}. ${mirrorWarning}`
				: `${duplicateMessage} in ${storeStatus.provider}`,
			email: user.email,
		};
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		console.error("❌ Error storing user data:", errorMessage);

		return {
			success: false,
			error: "Failed to store user data. Please try again.",
		};
	}
}

/**
 * Get statistics from Google Apps Script
 */
export async function getScriptStats(
	keyOrToken?: string,
): Promise<GoogleSheetsStatsResponse> {
	if (!(await validateAdminAccess(keyOrToken))) {
		return { success: false, error: "Unauthorized" };
	}

	if (!env.GOOGLE_SHEETS_URL) {
		return {
			success: false,
			error: "Google Sheets integration not configured",
		};
	}

	try {
		console.log("📊 Fetching Google Apps Script statistics...");

		const response = await fetch(`${env.GOOGLE_SHEETS_URL}?action=stats`, {
			method: "GET",
			signal: AbortSignal.timeout(10000),
		});

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const data = await response.json();

		const stats = {
			totalUsers: data.totalUsers || 0,
			totalWithNames: data.totalWithNames || 0,
			totalLegacy: data.totalLegacy || 0,
			duplicateEmails: data.duplicateEmails || 0,
			recentActivity: data.lastActivity || "No recent activity",
			sheetHealth: data.sheetHealth || "Unknown",
		};

		console.log("✅ Google Apps Script stats retrieved:", stats);
		return { success: true, stats };
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : "Unknown error";
		console.error("❌ Failed to get Google Apps Script stats:", errorMsg);
		return { success: false, error: errorMsg };
	}
}

/**
 * Cleanup duplicate entries via Google Apps Script
 */
export async function cleanupScriptDuplicates(
	keyOrToken?: string,
): Promise<CleanupDuplicatesResponse> {
	if (!(await validateAdminAccess(keyOrToken))) {
		return { success: false, error: "Unauthorized access" };
	}

	if (!env.GOOGLE_SHEETS_URL) {
		return {
			success: false,
			error:
				"Google Sheets integration not configured. Please set GOOGLE_SHEETS_URL environment variable.",
		};
	}

	try {
		console.log("🗑️ Starting duplicate cleanup via Google Apps Script...");

		const response = await fetch(`${env.GOOGLE_SHEETS_URL}?action=cleanup`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				operation: "remove_duplicates",
				criteria: "email",
			}),
			signal: AbortSignal.timeout(30000),
		});

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
		console.error(
			"❌ Failed to cleanup duplicates via Google Apps Script:",
			errorMsg,
		);

		let userFriendlyError = errorMsg;
		if (errorMsg.includes("timeout")) {
			userFriendlyError =
				"Operation timed out. The cleanup may take longer for large datasets.";
		} else if (errorMsg.includes("404")) {
			userFriendlyError =
				"Google Apps Script cleanup endpoint not found. Please check your deployment.";
		} else if (errorMsg.includes("401") || errorMsg.includes("403")) {
			userFriendlyError =
				"Authorization failed. Please check your Google Apps Script permissions.";
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

/**
 * Get recent entries from Google Apps Script
 */
export async function getRecentScriptEntries(
	keyOrToken?: string,
	limit: number = 5,
): Promise<RecentEntriesResponse> {
	if (!(await validateAdminAccess(keyOrToken))) {
		return { success: false, error: "Unauthorized" };
	}

	if (!env.GOOGLE_SHEETS_URL) {
		return {
			success: false,
			error: "Google Sheets integration not configured",
		};
	}

	try {
		console.log("📋 Fetching recent entries from Google Apps Script...");

		const response = await fetch(
			`${env.GOOGLE_SHEETS_URL}?action=recent&limit=${limit}`,
			{
				method: "GET",
				signal: AbortSignal.timeout(10000),
			},
		);

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const data = await response.json();

		if (!data.success) {
			throw new Error(data.error || "Failed to fetch recent entries");
		}

		console.log(`✅ Retrieved ${data.entries?.length || 0} recent entries`);
		return { success: true, entries: data.entries || [] };
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : "Unknown error";
		console.error(
			"❌ Failed to get recent entries from Google Apps Script:",
			errorMsg,
		);
		return { success: false, error: errorMsg };
	}
}
