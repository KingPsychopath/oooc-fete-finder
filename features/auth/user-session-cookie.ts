import "server-only";

import jwt from "jsonwebtoken";
import { env } from "@/lib/config/env";
import { log } from "@/lib/platform/logger";

export const USER_AUTH_COOKIE_NAME = "oooc_user_session";
const USER_AUTH_COOKIE_TTL_SECONDS = 60 * 60 * 24 * 30;
const USER_AUTH_COOKIE_AUDIENCE = "oooc-fete-finder:user";
const USER_AUTH_COOKIE_ISSUER = "oooc-fete-finder";

type UserSessionPayload = {
	email: string;
	v: 1;
} & jwt.JwtPayload;

const RUNTIME_FALLBACK_USER_AUTH_SECRET = `user-session-fallback-${Math.random()
	.toString(36)
	.slice(2)}-${Date.now()}`;
let warnedAboutFallbackSecret = false;

const getUserAuthSecret = (): string => {
	if (env.AUTH_SECRET?.trim()) {
		return env.AUTH_SECRET.trim();
	}

	if (env.ADMIN_KEY.trim()) {
		return env.ADMIN_KEY.trim();
	}

	if (!warnedAboutFallbackSecret) {
		warnedAboutFallbackSecret = true;
		log.warn(
			"auth",
			"AUTH_SECRET and ADMIN_KEY are both unset; using process-local fallback secret for user session cookies",
		);
	}

	return RUNTIME_FALLBACK_USER_AUTH_SECRET;
};

export const signUserSessionToken = (email: string): string => {
	return jwt.sign(
		{
			email: email.toLowerCase().trim(),
			v: 1,
		},
		getUserAuthSecret(),
		{
			algorithm: "HS256",
			expiresIn: USER_AUTH_COOKIE_TTL_SECONDS,
			audience: USER_AUTH_COOKIE_AUDIENCE,
			issuer: USER_AUTH_COOKIE_ISSUER,
		},
	);
};

export const verifyUserSessionToken = (
	token: string | undefined,
): UserSessionPayload | null => {
	if (!token) return null;
	try {
		const decoded = jwt.verify(token, getUserAuthSecret(), {
			algorithms: ["HS256"],
			audience: USER_AUTH_COOKIE_AUDIENCE,
			issuer: USER_AUTH_COOKIE_ISSUER,
		});
		if (!decoded || typeof decoded !== "object") return null;
		if (typeof decoded.email !== "string") return null;
		return decoded as UserSessionPayload;
	} catch {
		return null;
	}
};

export const getUserSessionFromCookieHeader = (
	cookieValue: string | undefined,
): { isAuthenticated: boolean; email: string | null } => {
	const payload = verifyUserSessionToken(cookieValue);
	if (!payload?.email) {
		return { isAuthenticated: false, email: null };
	}

	return {
		isAuthenticated: true,
		email: payload.email,
	};
};

export const getUserAuthCookieOptions = () => ({
	httpOnly: true,
	secure: env.NODE_ENV === "production",
	sameSite: "lax" as const,
	path: "/",
	maxAge: USER_AUTH_COOKIE_TTL_SECONDS,
});
