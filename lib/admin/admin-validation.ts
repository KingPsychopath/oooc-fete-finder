import { env } from "@/lib/config/env";
import {
	secureCompare,
	verifyAdminSessionToken,
} from "@/lib/admin/admin-auth-token";

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
	return providedKey.length > 0 && secureCompare(providedKey, expectedKey);
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

	// Try signed admin session token
	return verifyAdminSessionToken(keyOrToken);
};
