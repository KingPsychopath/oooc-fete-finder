"use server";

import type { CollectedEmailsResponse, UserRecord } from "@/types/user";
import {
	signAdminSessionToken,
	verifyAdminSessionToken,
} from "./admin-auth-token";
import {
	validateAdminKeyForApiRoute,
	validateDirectAdminKey,
} from "./admin-validation";

/**
 * Admin Management Server Actions
 *
 * Server actions specifically related to admin authentication, session management,
 * and user collection operations. Colocated with admin modules.
 */

// Simple in-memory user storage (will reset on deployment, but good for development)
const collectedUsers: UserRecord[] = [];

// Helper function to validate admin access (key or session token)
function validateAdminAccess(keyOrToken?: string): boolean {
	if (!keyOrToken) return false;
	return validateAdminKeyForApiRoute(keyOrToken);
}

/**
 * Create admin session (used during login)
 */
export async function createAdminSession(
	adminKey: string,
): Promise<{
	success: boolean;
	error?: string;
	expiresAt?: number;
	sessionToken?: string;
}> {
	"use server";

	if (!validateDirectAdminKey(adminKey)) {
		return { success: false, error: "Invalid admin key" };
	}

	const { token, expiresAt } = signAdminSessionToken();
	return { success: true, expiresAt, sessionToken: token };
}

/**
 * Extend admin session
 */
export async function extendAdminSession(
	sessionToken: string,
): Promise<{
	success: boolean;
	error?: string;
	expiresAt?: number;
	sessionToken?: string;
}> {
	"use server";

	if (!verifyAdminSessionToken(sessionToken)) {
		return { success: false, error: "Session invalid" };
	}

	const next = signAdminSessionToken();
	return { success: true, expiresAt: next.expiresAt, sessionToken: next.token };
}

/**
 * Admin function to get collected emails (accepts admin key OR session token)
 */
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
