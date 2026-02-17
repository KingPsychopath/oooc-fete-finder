"use server";

import type { CollectedEmailsResponse, UserRecord } from "@/types/user";
import { UserCollectionStore } from "@/lib/user-management/user-collection-store";
import { env } from "@/lib/config/env";
import {
	clearAdminSessionCookie,
	createAdminSessionWithCookie,
	getCurrentAdminSession,
	getCurrentTokenVersion,
	listAdminTokenSessions,
	revokeAdminSessionByJti,
	revokeAllAdminSessions,
} from "./admin-auth-token";
import {
	validateAdminAccessFromServerContext,
	validateDirectAdminKey,
} from "./admin-validation";

/**
 * Admin Management Server Actions
 *
 * Cookie-authenticated admin workflow with JWT sessions and revocation support.
 */

// Helper function to validate admin access (key, bearer token, or auth cookie)
async function validateAdminAccess(keyOrToken?: string): Promise<boolean> {
	return validateAdminAccessFromServerContext(keyOrToken ?? null);
}

const toCsvCell = (value: string): string => {
	if (value.includes(",") || value.includes('"') || value.includes("\n")) {
		return `"${value.replaceAll('"', '""')}"`;
	}
	return value;
};

const buildCollectedUsersCsv = (users: UserRecord[]): string => {
	const header = [
		"First Name",
		"Last Name",
		"Email",
		"Timestamp",
		"Consent",
		"Source",
	];
	const rows = users.map((user) => [
		user.firstName,
		user.lastName,
		user.email,
		user.timestamp,
		String(user.consent),
		user.source,
	]);

	return [header, ...rows]
		.map((row) => row.map((cell) => toCsvCell(cell)).join(","))
		.join("\n");
};

/**
 * Create admin session (used during login)
 */
export async function createAdminSession(
	adminKey: string,
): Promise<{
	success: boolean;
	error?: string;
	expiresAt?: number;
	jti?: string;
}> {
	if (!validateDirectAdminKey(adminKey)) {
		return { success: false, error: "Invalid admin key" };
	}

	const session = await createAdminSessionWithCookie();
	return {
		success: true,
		expiresAt: session.expiresAt,
		jti: session.jti,
	};
}

/**
 * Clear current admin auth cookie
 */
export async function logoutAdminSession(): Promise<{ success: boolean }> {
	await clearAdminSessionCookie();
	return { success: true };
}

/**
 * Return current session status for dashboard UI
 */
export async function getAdminSessionStatus(): Promise<{
	success: boolean;
	isValid: boolean;
	expiresAt?: number;
	iat?: number;
	jti?: string;
	expiresIn?: string;
	sessionAge?: string;
	error?: string;
}> {
	const payload = await getCurrentAdminSession();
	if (!payload) {
		return { success: true, isValid: false };
	}

	const nowMs = Date.now();
	const expiresAtMs = payload.exp * 1000;
	const issuedAtMs = payload.iat * 1000;
	const expiresInMs = Math.max(0, expiresAtMs - nowMs);
	const sessionAgeMs = Math.max(0, nowMs - issuedAtMs);

	const formatDuration = (durationMs: number): string => {
		const totalMinutes = Math.floor(durationMs / (1000 * 60));
		const hours = Math.floor(totalMinutes / 60);
		const minutes = totalMinutes % 60;
		return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
	};

	return {
		success: true,
		isValid: true,
		expiresAt: expiresAtMs,
		iat: issuedAtMs,
		jti: payload.jti,
		expiresIn: formatDuration(expiresInMs),
		sessionAge: `${formatDuration(sessionAgeMs)} ago`,
	};
}

/**
 * List issued admin JWT sessions and their status.
 */
export async function getAdminTokenSessions(keyOrToken?: string): Promise<{
	success: boolean;
	error?: string;
	sessions?: Awaited<ReturnType<typeof listAdminTokenSessions>>;
	count?: number;
	currentTokenVersion?: number;
}> {
	if (!(await validateAdminAccess(keyOrToken))) {
		return { success: false, error: "Unauthorized" };
	}

	const sessions = await listAdminTokenSessions();
	return {
		success: true,
		sessions,
		count: sessions.length,
		currentTokenVersion: await getCurrentTokenVersion(),
	};
}

/**
 * Revoke a single JWT session by jti.
 */
export async function revokeAdminTokenSessionByJti(
	jti: string,
	keyOrToken?: string,
): Promise<{
	success: boolean;
	error?: string;
}> {
	if (!(await validateAdminAccess(keyOrToken))) {
		return { success: false, error: "Unauthorized" };
	}

	const ok = await revokeAdminSessionByJti(jti);
	if (!ok) {
		return { success: false, error: "Session not found or invalid jti" };
	}

	return { success: true };
}

/**
 * Revoke all admin JWT sessions by bumping token version.
 */
export async function revokeAllAdminTokenSessionsAction(
	keyOrToken?: string,
): Promise<{
	success: boolean;
	error?: string;
	nextTokenVersion?: number;
}> {
	if (!(await validateAdminAccess(keyOrToken))) {
		return { success: false, error: "Unauthorized" };
	}

	const nextTokenVersion = await revokeAllAdminSessions();
	return {
		success: true,
		nextTokenVersion,
	};
}

/**
 * Admin function to get collected emails.
 */
export async function getCollectedEmails(
	keyOrToken?: string,
): Promise<CollectedEmailsResponse> {
	if (!(await validateAdminAccess(keyOrToken))) {
		return { success: false, error: "Unauthorized" };
	}

	const [collectedUsers, storeStatus, analytics] = await Promise.all([
		UserCollectionStore.listAll(),
		UserCollectionStore.getStatus(),
		UserCollectionStore.getAnalytics(),
	]);

	console.log(
		`Admin panel accessed - loaded ${collectedUsers.length} users from ${storeStatus.provider} provider`,
	);

	return {
		success: true,
		emails: collectedUsers,
		count: collectedUsers.length,
		store: storeStatus,
		analytics,
		mirror: {
			enabled: env.GOOGLE_MIRROR_WRITES,
			endpointConfigured: Boolean(env.GOOGLE_SHEETS_URL),
		},
	};
}

/**
 * Export collected users CSV (server-generated and correctly escaped).
 */
export async function exportCollectedEmailsCsv(keyOrToken?: string): Promise<{
	success: boolean;
	error?: string;
	filename?: string;
	csv?: string;
	count?: number;
}> {
	if (!(await validateAdminAccess(keyOrToken))) {
		return { success: false, error: "Unauthorized" };
	}

	const users = await UserCollectionStore.listAll();
	return {
		success: true,
		filename: `fete-finder-users-${new Date().toISOString().split("T")[0]}.csv`,
		csv: buildCollectedUsersCsv(users),
		count: users.length,
	};
}
