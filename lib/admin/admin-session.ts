/**
 * Simple Admin Session Management (Client-side only)
 * Server-side validation happens in server actions
 */

import { env } from "@/lib/config/env";

const ADMIN_SESSION_KEY = "fete_finder_admin_session";

interface AdminSession {
	sessionToken: string;
	expiresAt: number;
	createdAt: number;
	version: string;
}

/**
 * Generate a secure session token
 */
const generateSessionToken = (): string => {
	const array = new Uint8Array(32);
	crypto.getRandomValues(array);
	return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
};

/**
 * Get session duration from environment or use default
 */
const getSessionDuration = (): number => {
	const envHours = env.NEXT_PUBLIC_ADMIN_SESSION_HOURS;
	return Math.max(1, Math.min(envHours, 168)); // Min 1 hour, max 1 week
};

/**
 * Create a new admin session (returns token for server validation)
 */
export const createAdminSession = (): string => {
	const now = Date.now();
	const sessionHours = getSessionDuration();
	const expiresAt = now + sessionHours * 60 * 60 * 1000;
	const sessionToken = generateSessionToken();

	const session: AdminSession = {
		sessionToken,
		expiresAt,
		createdAt: now,
		version: "2.0",
	};

	localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
	console.log(`✅ Admin session created, expires in ${sessionHours} hours`);

	return sessionToken;
};

/**
 * Get current session token (if valid locally)
 */
export const getSessionToken = (): string | null => {
	try {
		const stored = localStorage.getItem(ADMIN_SESSION_KEY);
		if (!stored) return null;

		const session: AdminSession = JSON.parse(stored);

		// Check local expiration
		if (Date.now() > session.expiresAt) {
			localStorage.removeItem(ADMIN_SESSION_KEY);
			return null;
		}

		return session.sessionToken;
	} catch (error) {
		console.error("❌ Error reading session:", error);
		localStorage.removeItem(ADMIN_SESSION_KEY);
		return null;
	}
};

/**
 * Clear admin session
 */
export const clearAdminSession = (): void => {
	localStorage.removeItem(ADMIN_SESSION_KEY);
	console.log("🔓 Admin session cleared");
};

/**
 * Get session info for display
 */
export const getSessionInfo = (): {
	isValid: boolean;
	expiresAt?: Date;
	expiresIn?: string;
	createdAt?: Date;
	sessionAge?: string;
} => {
	try {
		const stored = localStorage.getItem(ADMIN_SESSION_KEY);
		if (!stored) return { isValid: false };

		const session: AdminSession = JSON.parse(stored);
		const now = Date.now();

		if (now > session.expiresAt) {
			localStorage.removeItem(ADMIN_SESSION_KEY);
			return { isValid: false };
		}

		const expiresAt = new Date(session.expiresAt);
		const createdAt = new Date(session.createdAt);
		const timeUntilExpiry = session.expiresAt - now;
		const sessionAge = now - session.createdAt;

		// Format time remaining
		const formatTime = (ms: number): string => {
			const hours = Math.floor(ms / (1000 * 60 * 60));
			const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
			return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
		};

		return {
			isValid: true,
			expiresAt,
			expiresIn: formatTime(timeUntilExpiry),
			createdAt,
			sessionAge: formatTime(sessionAge) + " ago",
		};
	} catch (error) {
		console.error("❌ Error getting session info:", error);
		return { isValid: false };
	}
};
