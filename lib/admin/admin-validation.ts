/**
 * Shared admin validation utilities
 * Used by both server actions and API routes
 */

// Import session management for unified validation
import { validateSessionToken } from "@/lib/admin/admin-session-store";

import { env } from "@/lib/config/env";

/**
 * Get the expected admin key from centralized environment configuration
 */
export const getExpectedAdminKey = (): string => {
	return env.ADMIN_KEY;
};

/**
 * Validate a direct admin key
 */
export const validateDirectAdminKey = (providedKey: string | null): boolean => {
	if (!providedKey) return false;
	const expectedKey = getExpectedAdminKey();
	return providedKey === expectedKey && providedKey.length > 0;
};

/**
 * Unified admin validation for API routes
 * Supports both direct admin keys and session tokens
 */
export const validateAdminKeyForApiRoute = (
	keyOrToken: string | null,
): boolean => {
	if (!keyOrToken) return false;

	// Try direct admin key first
	if (validateDirectAdminKey(keyOrToken)) {
		return true;
	}

	// Try session token
	return validateSessionToken(keyOrToken);
};
