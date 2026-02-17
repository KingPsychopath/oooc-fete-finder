/**
 * Client-side admin session persistence.
 *
 * The server issues signed admin session tokens. This module stores the token +
 * metadata in localStorage so existing API calls can keep using `x-admin-key`.
 */

const ADMIN_SESSION_KEY = "fete_finder_admin_session";

interface AdminSession {
	sessionToken: string;
	expiresAt: number;
	createdAt: number;
	version: string;
}

/**
 * Persist a server-issued session locally.
 */
export const storeAdminSession = (
	sessionToken: string,
	expiresAt: number,
): string => {
	const now = Date.now();
	const session: AdminSession = {
		sessionToken,
		expiresAt,
		createdAt: now,
		version: "3.0",
	};

	localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
	return sessionToken;
};

/**
 * Backward-compatible alias used by older call sites.
 */
export const createAdminSession = storeAdminSession;

/**
 * Get current session token (if valid locally)
 */
export const getSessionToken = (): string | null => {
	try {
		const stored = localStorage.getItem(ADMIN_SESSION_KEY);
		if (!stored) return null;

		const session: AdminSession = JSON.parse(stored);
		if (Date.now() > session.expiresAt) {
			localStorage.removeItem(ADMIN_SESSION_KEY);
			return null;
		}

		return session.sessionToken;
	} catch {
		localStorage.removeItem(ADMIN_SESSION_KEY);
		return null;
	}
};

/**
 * Clear admin session
 */
export const clearAdminSession = (): void => {
	localStorage.removeItem(ADMIN_SESSION_KEY);
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
			sessionAge: `${formatTime(sessionAge)} ago`,
		};
	} catch {
		return { isValid: false };
	}
};
