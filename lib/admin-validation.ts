/**
 * Shared admin validation utilities
 * Used by both server actions and API routes
 */

/**
 * Get the expected admin key from environment
 */
export const getExpectedAdminKey = (): string => {
	return process.env.ADMIN_KEY || "your-secret-key-123";
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
 * Basic admin key validation for API routes
 * (They can't access server action session store)
 */
export const validateAdminKeyForApiRoute = (providedKey: string | null): boolean => {
	return validateDirectAdminKey(providedKey);
}; 