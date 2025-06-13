/**
 * Shared admin session store
 * Used by both server actions and API routes for session validation
 */

// In-memory session store for server-side validation
export const adminSessions = new Map<
	string,
	{
		adminKey: string;
		expiresAt: number;
		createdAt: number;
	}
>();

/**
 * Validate session token
 */
export const validateSessionToken = (sessionToken: string | null): boolean => {
	if (!sessionToken) return false;

	const session = adminSessions.get(sessionToken);
	if (session && Date.now() < session.expiresAt) {
		return true;
	}

	// Clean up expired session if found
	if (session && Date.now() >= session.expiresAt) {
		adminSessions.delete(sessionToken);
	}

	return false;
};
