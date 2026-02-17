import { createHash, timingSafeEqual } from "crypto";
import jwt from "jsonwebtoken";
import { env } from "@/lib/config/env";

const TOKEN_ISSUER = "oooc-fete-finder";
const TOKEN_AUDIENCE = "admin-api";
const MIN_SECRET_LENGTH = 32;

type AdminTokenPayload = {
	type: "admin";
};

const getSessionDurationMs = (): number => {
	const hours = Math.max(1, Math.min(env.NEXT_PUBLIC_ADMIN_SESSION_HOURS, 168));
	return hours * 60 * 60 * 1000;
};

const getAuthSecret = (): string => {
	if (env.AUTH_SECRET && env.AUTH_SECRET.length >= MIN_SECRET_LENGTH) {
		return env.AUTH_SECRET;
	}

	if (env.AUTH_SECRET && env.AUTH_SECRET.length > 0) {
		console.warn(
			"AUTH_SECRET is shorter than recommended. Falling back to ADMIN_KEY for admin tokens.",
		);
	}

	return env.ADMIN_KEY;
};

const hashValue = (value: string): Buffer => {
	return createHash("sha256").update(value).digest();
};

export const secureCompare = (left: string, right: string): boolean => {
	const leftHash = hashValue(left);
	const rightHash = hashValue(right);
	return timingSafeEqual(leftHash, rightHash);
};

export const signAdminSessionToken = (): {
	token: string;
	expiresAt: number;
} => {
	const now = Date.now();
	const expiresAt = now + getSessionDurationMs();
	const expiresInSeconds = Math.max(1, Math.floor((expiresAt - now) / 1000));

	const token = jwt.sign({ type: "admin" satisfies AdminTokenPayload["type"] }, getAuthSecret(), {
		algorithm: "HS256",
		expiresIn: expiresInSeconds,
		issuer: TOKEN_ISSUER,
		audience: TOKEN_AUDIENCE,
	});

	return { token, expiresAt };
};

export const verifyAdminSessionToken = (token: string): boolean => {
	try {
		const decoded = jwt.verify(token, getAuthSecret(), {
			algorithms: ["HS256"],
			issuer: TOKEN_ISSUER,
			audience: TOKEN_AUDIENCE,
		}) as jwt.JwtPayload & AdminTokenPayload;

		return decoded.type === "admin";
	} catch {
		return false;
	}
};
