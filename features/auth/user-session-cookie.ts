import "server-only";

import { env } from "@/lib/config/env";
import jwt from "jsonwebtoken";

export const USER_AUTH_COOKIE_NAME = "oooc_user_session";
const USER_AUTH_COOKIE_TTL_SECONDS = 60 * 60 * 24 * 30;
const USER_AUTH_COOKIE_AUDIENCE = "oooc-fete-finder:user";
const USER_AUTH_COOKIE_ISSUER = "oooc-fete-finder";
const MIN_AUTH_SECRET_LENGTH = 32;

type UserSessionPayload = {
	email: string;
	v: 1;
} & jwt.JwtPayload;

const getUserAuthSecret = (): string => {
	const authSecret = env.AUTH_SECRET?.trim();
	if (!authSecret) {
		throw new Error(
			"AUTH_SECRET is required for user session cookie signing and verification",
		);
	}
	if (authSecret.length < MIN_AUTH_SECRET_LENGTH) {
		throw new Error(
			`AUTH_SECRET must be at least ${MIN_AUTH_SECRET_LENGTH} characters`,
		);
	}
	return authSecret;
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
