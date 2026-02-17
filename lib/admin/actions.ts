"use server";

import type { CollectedEmailsResponse, UserRecord } from "@/types/user";
import { UserCollectionStore } from "@/lib/user-management/user-collection-store";
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

	const collectedUsers: UserRecord[] = await UserCollectionStore.listAll();
	const storeStatus = await UserCollectionStore.getStatus();
	console.log(
		`Admin panel accessed - loaded ${collectedUsers.length} users from ${storeStatus.provider} provider`,
	);

	return {
		success: true,
		emails: collectedUsers,
		count: collectedUsers.length,
	};
}
