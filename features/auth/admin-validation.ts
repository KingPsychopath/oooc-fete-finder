import type { NextRequest } from "next/server";
import { env } from "@/lib/config/env";
import {
	secureCompare,
	verifyAdminSessionFromRequest,
	verifyAdminSessionFromServerContext,
} from "@/features/auth/admin-auth-token";

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
 * Unified admin validation for API routes.
 * Supports direct ADMIN_KEY, bearer/header token, and httpOnly auth cookie.
 */
export const validateAdminKeyForApiRoute = async (
	request: NextRequest,
	overrideCredential?: string | null,
): Promise<boolean> => {
	const candidate = overrideCredential?.trim() || request.headers.get("x-admin-key");
	if (validateDirectAdminKey(candidate)) {
		return true;
	}

	const payload = await verifyAdminSessionFromRequest(request, candidate);
	return Boolean(payload);
};

/**
 * Unified admin validation for server actions.
 * Supports direct ADMIN_KEY, bearer/header token, and httpOnly auth cookie.
 */
export const validateAdminAccessFromServerContext = async (
	keyOrToken?: string | null,
): Promise<boolean> => {
	const candidate = keyOrToken?.trim() || "";
	if (candidate && validateDirectAdminKey(candidate)) {
		return true;
	}

	const payload = await verifyAdminSessionFromServerContext(candidate || undefined);
	return Boolean(payload);
};
