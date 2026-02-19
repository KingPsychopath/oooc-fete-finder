import {
	secureCompare,
	verifyAdminSessionFromRequest,
	verifyAdminSessionFromServerContext,
} from "@/features/auth/admin-auth-token";
import { env, isAdminAuthEnabled } from "@/lib/config/env";
import type { NextRequest } from "next/server";

const getExpectedAdminKey = (): string => {
	return env.ADMIN_KEY.trim();
};

/**
 * Validate a direct admin key
 */
export const validateDirectAdminKey = (providedKey: string | null): boolean => {
	if (!providedKey) return false;
	if (!isAdminAuthEnabled()) return false;
	const expectedKey = getExpectedAdminKey();
	if (!expectedKey) return false;
	const candidate = providedKey.trim();
	return candidate.length > 0 && secureCompare(candidate, expectedKey);
};

/**
 * Unified admin validation for API routes.
 * Supports direct ADMIN_KEY, bearer/header token, and httpOnly auth cookie.
 */
export const validateAdminKeyForApiRoute = async (
	request: NextRequest,
	overrideCredential?: string | null,
): Promise<boolean> => {
	if (!isAdminAuthEnabled()) return false;

	const candidate =
		overrideCredential?.trim() || request.headers.get("x-admin-key");
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
	if (!isAdminAuthEnabled()) return false;

	const candidate = keyOrToken?.trim() || "";
	if (candidate && validateDirectAdminKey(candidate)) {
		return true;
	}

	const payload = await verifyAdminSessionFromServerContext(
		candidate || undefined,
	);
	return Boolean(payload);
};
