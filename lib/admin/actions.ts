"use server";

import type {
	UserRecord,
	CollectedEmailsResponse,
} from "@/types/user";
import { validateDirectAdminKey } from "./admin-validation";
import { adminSessions, validateSessionToken } from "./admin-session-store";

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

	// Direct admin key check
	if (validateDirectAdminKey(keyOrToken)) {
		return true;
	}

	// Session token check
	return validateSessionToken(keyOrToken);
}

/**
 * Create admin session (used during login)
 */
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

/**
 * Extend admin session
 */
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