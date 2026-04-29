"use server";

import type {
	CollectedEmailsResponse,
	UserRecord,
} from "@/features/auth/types";
import { recordAdminActivity } from "@/features/admin/activity/record";
import { UserCollectionStore } from "@/features/auth/user-collection-store";
import { isAdminAuthEnabled } from "@/lib/config/env";
import { log } from "@/lib/platform/logger";
import Papa from "papaparse";
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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeHeader = (value: string): string =>
	value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();

const getHeaderValue = (
	row: Record<string, unknown>,
	aliases: string[],
): string => {
	const aliasSet = new Set(aliases.map(normalizeHeader));
	for (const [key, value] of Object.entries(row)) {
		if (!aliasSet.has(normalizeHeader(key))) continue;
		return typeof value === "string" ? value.trim() : "";
	}
	return "";
};

const parseConsent = (value: string): boolean => {
	const normalized = value.trim().toLowerCase();
	return ["true", "yes", "y", "1", "consented", "opted in", "opt-in"].includes(
		normalized,
	);
};

const parseTimestamp = (value: string): string => {
	if (!value.trim()) return new Date().toISOString();
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime())
		? new Date().toISOString()
		: parsed.toISOString();
};

const rowToUserRecord = (
	row: Record<string, unknown>,
	fallbackSource: string,
): UserRecord | null => {
	const email = getHeaderValue(row, ["email", "email address", "e-mail"]);
	if (!EMAIL_PATTERN.test(email.trim().toLowerCase())) return null;

	return {
		firstName: getHeaderValue(row, ["first name", "firstname", "first"]) || "",
		lastName:
			getHeaderValue(row, ["last name", "lastname", "surname", "last"]) || "",
		email,
		timestamp: parseTimestamp(
			getHeaderValue(row, ["timestamp", "submitted at", "last seen", "date"]),
		),
		consent: parseConsent(
			getHeaderValue(row, ["consent", "marketing consent", "opt in", "opt-in"]),
		),
		source: getHeaderValue(row, ["source"]) || fallbackSource,
	};
};

const parseImportedUsers = (
	rawInput: string,
): { users: UserRecord[]; skippedCount: number } => {
	const input = rawInput.trim();
	if (!input) return { users: [], skippedCount: 0 };

	const fallbackSource = "admin-import";
	const parsedWithHeaders = Papa.parse<Record<string, unknown>>(input, {
		header: true,
		skipEmptyLines: true,
	});
	const fields = parsedWithHeaders.meta.fields ?? [];
	if (fields.some((field) => normalizeHeader(field).includes("email"))) {
		const users = parsedWithHeaders.data
			.map((row) => rowToUserRecord(row, fallbackSource))
			.filter((user): user is UserRecord => Boolean(user));
		return {
			users,
			skippedCount: parsedWithHeaders.data.length - users.length,
		};
	}

	const parsedRows = Papa.parse<string[]>(input, {
		skipEmptyLines: true,
	});
	const users: UserRecord[] = [];
	let skippedCount = 0;
	for (const row of parsedRows.data) {
		const cells = row.map((cell) => String(cell ?? "").trim());
		const emailIndex = cells.findIndex((cell) =>
			EMAIL_PATTERN.test(cell.toLowerCase()),
		);
		if (emailIndex < 0) {
			skippedCount += 1;
			continue;
		}

		users.push({
			firstName: cells[emailIndex + 1] ?? "",
			lastName: cells[emailIndex + 2] ?? "",
			email: cells[emailIndex],
			timestamp: new Date().toISOString(),
			consent: false,
			source: fallbackSource,
		});
	}

	return { users, skippedCount };
};

/**
 * Create admin session (used during login)
 */
export async function createAdminSession(adminKey: string): Promise<{
	success: boolean;
	error?: string;
	expiresAt?: number;
	jti?: string;
}> {
	if (!isAdminAuthEnabled()) {
		return {
			success: false,
			error: "Admin access is disabled (ADMIN_KEY is not configured)",
		};
	}

	const normalizedAdminKey = adminKey.trim();
	if (!validateDirectAdminKey(normalizedAdminKey)) {
		return { success: false, error: "Invalid admin key" };
	}

	const session = await createAdminSessionWithCookie();
	await recordAdminActivity({
		actorType: "admin_session",
		actorSessionJti: session.jti,
		actorLabel: `Admin session ${session.jti.slice(0, 8)}...${session.jti.slice(-4)}`,
		action: "auth.session.created",
		category: "auth",
		targetType: "admin_session",
		targetId: session.jti,
		targetLabel: "Admin login",
		summary: "Admin session created",
		href: "/admin/operations#admin-session",
	});
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
 * Return current session status and tracked token sessions in one read path.
 */
export async function getAdminSessionOverview(keyOrToken?: string): Promise<{
	success: boolean;
	sessionStatus: Awaited<ReturnType<typeof getAdminSessionStatus>>;
	tokenSessions?: Awaited<ReturnType<typeof listAdminTokenSessions>>;
	currentTokenVersion?: number;
	error?: string;
}> {
	const sessionStatus = await getAdminSessionStatus();
	if (!sessionStatus.success || !sessionStatus.isValid) {
		return {
			success: sessionStatus.success,
			sessionStatus,
			tokenSessions: [],
			currentTokenVersion: 1,
		};
	}

	if (!(await validateAdminAccess(keyOrToken))) {
		return {
			success: false,
			sessionStatus,
			error: "Unauthorized",
		};
	}

	const [tokenSessions, currentTokenVersion] = await Promise.all([
		listAdminTokenSessions(),
		getCurrentTokenVersion(),
	]);

	return {
		success: true,
		sessionStatus,
		tokenSessions,
		currentTokenVersion,
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

	await recordAdminActivity({
		action: "auth.session.revoked",
		category: "auth",
		targetType: "admin_session",
		targetId: jti,
		targetLabel: `Session ${jti.slice(0, 8)}...${jti.slice(-4)}`,
		summary: "Admin session revoked",
		severity: "warning",
		href: "/admin/operations#admin-session",
	});

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
	await recordAdminActivity({
		action: "auth.sessions.revoked_all",
		category: "auth",
		targetType: "admin_sessions",
		targetLabel: "All admin sessions",
		summary: `All admin sessions revoked; token version is now ${nextTokenVersion}`,
		metadata: { nextTokenVersion },
		severity: "destructive",
		href: "/admin/operations#admin-session",
	});
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

	const snapshot = await UserCollectionStore.getAdminSnapshot();

	log.info("admin-users", "Loaded collected users for admin panel", {
		count: snapshot.users.length,
		provider: snapshot.status.provider,
	});

	return {
		success: true,
		emails: snapshot.users,
		count: snapshot.users.length,
		store: snapshot.status,
		analytics: snapshot.analytics,
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

/**
 * Import collected users from CSV or a pasted email list.
 */
export async function importCollectedEmails(
	rawInput: string,
	keyOrToken?: string,
): Promise<{
	success: boolean;
	error?: string;
	importedCount?: number;
	updatedCount?: number;
	skippedCount?: number;
	totalCount?: number;
}> {
	if (!(await validateAdminAccess(keyOrToken))) {
		return { success: false, error: "Unauthorized" };
	}

	const { users, skippedCount } = parseImportedUsers(rawInput);
	if (users.length === 0) {
		return {
			success: false,
			error: "No valid email records found to import.",
			skippedCount,
		};
	}

	let importedCount = 0;
	let updatedCount = 0;
	for (const user of users) {
		const result = await UserCollectionStore.addOrUpdate(user);
		if (result.alreadyExisted) {
			updatedCount += 1;
		} else {
			importedCount += 1;
		}
	}

	const status = await UserCollectionStore.getStatus();
	await recordAdminActivity({
		action: "audience.emails.imported",
		category: "insights",
		targetType: "collected_users",
		targetLabel: "Collected users",
		summary: `Imported ${importedCount} and updated ${updatedCount} collected user record${importedCount + updatedCount === 1 ? "" : "s"}`,
		metadata: {
			importedCount,
			updatedCount,
			skippedCount,
			totalCount: status.totalUsers,
		},
		href: "/admin/insights#collected-users",
	});
	return {
		success: true,
		importedCount,
		updatedCount,
		skippedCount,
		totalCount: status.totalUsers,
	};
}

/**
 * Delete selected collected users by email.
 */
export async function deleteCollectedEmails(
	emails: string[],
	keyOrToken?: string,
): Promise<{
	success: boolean;
	error?: string;
	deletedCount?: number;
	totalCount?: number;
}> {
	if (!(await validateAdminAccess(keyOrToken))) {
		return { success: false, error: "Unauthorized" };
	}

	const deletedCount = await UserCollectionStore.deleteByEmails(emails);
	const status = await UserCollectionStore.getStatus();
	await recordAdminActivity({
		action: "audience.emails.deleted",
		category: "insights",
		targetType: "collected_users",
		targetLabel: "Collected users",
		summary: `Deleted ${deletedCount} collected user record${deletedCount === 1 ? "" : "s"}`,
		metadata: {
			requestedCount: emails.length,
			deletedCount,
			totalCount: status.totalUsers,
		},
		severity: "destructive",
		href: "/admin/insights#collected-users",
	});
	return {
		success: true,
		deletedCount,
		totalCount: status.totalUsers,
	};
}
