import "server-only";

import { createHash, randomUUID, timingSafeEqual } from "crypto";
import jwt from "jsonwebtoken";
import { cookies, headers } from "next/headers";
import type { NextRequest } from "next/server";
import { env, isAdminAuthEnabled } from "@/lib/config/env";
import { getKVStore } from "@/lib/platform/kv/kv-store-factory";
import { log } from "@/lib/platform/logger";

const TOKEN_ISSUER = "oooc-fete-finder";
const TOKEN_AUDIENCE = "admin-api";
const TOKEN_TYPE = "admin";
const MIN_SECRET_LENGTH = 32;

const ADMIN_AUTH_COOKIE_NAME = "oooc-admin-auth";
const ADMIN_AUTH_TTL_SECONDS = 60 * 60;

const TOKEN_VERSION_KEY = "admin-auth:token-version";
const SESSION_KEY_PREFIX = "admin-auth:session:";
const REVOKED_KEY_PREFIX = "admin-auth:revoked:";

/** Delete session records only after this long past expiry (traceability window). */
const SESSION_CLEANUP_GRACE_SECONDS = 7 * 24 * 60 * 60; // 7 days

const SAFE_JTI = /^[0-9a-fA-F-]{32,64}$/;

export type AdminTokenPayload = {
	type: "admin";
	jti: string;
	tv: number;
	iat: number;
	exp: number;
};

export type AdminSessionStatus = "active" | "expired" | "revoked" | "invalidated";

export interface AdminTokenSessionRecord {
	jti: string;
	tv: number;
	iat: number;
	exp: number;
	ip: string;
	ua: string;
	status: AdminSessionStatus;
}

const hashValue = (value: string): Buffer => {
	return createHash("sha256").update(value).digest();
};

export const secureCompare = (left: string, right: string): boolean => {
	const leftHash = hashValue(left);
	const rightHash = hashValue(right);
	return timingSafeEqual(leftHash, rightHash);
};

const parseJson = <T>(raw: string | null): T | null => {
	if (!raw) return null;
	try {
		return JSON.parse(raw) as T;
	} catch {
		return null;
	}
};

const getAuthSecret = (): string => {
	if (env.AUTH_SECRET && env.AUTH_SECRET.length >= MIN_SECRET_LENGTH) {
		return env.AUTH_SECRET;
	}

	if (env.AUTH_SECRET && env.AUTH_SECRET.length > 0) {
		log.warn(
			"admin-auth",
			"AUTH_SECRET is shorter than recommended; falling back to ADMIN_KEY",
		);
	}

	return env.ADMIN_KEY;
};

const sessionKey = (jti: string): string => `${SESSION_KEY_PREFIX}${jti}`;
const revokedKey = (jti: string): string => `${REVOKED_KEY_PREFIX}${jti}`;

const parseTokenPayload = (decoded: jwt.JwtPayload): AdminTokenPayload | null => {
	if (decoded.type !== TOKEN_TYPE) {
		return null;
	}

	const jti = typeof decoded.jti === "string" ? decoded.jti : "";
	if (!SAFE_JTI.test(jti)) {
		return null;
	}

	const tv = typeof decoded.tv === "number" ? decoded.tv : NaN;
	const iat = typeof decoded.iat === "number" ? decoded.iat : NaN;
	const exp = typeof decoded.exp === "number" ? decoded.exp : NaN;

	if (!Number.isInteger(tv) || tv < 1) {
		return null;
	}
	if (!Number.isInteger(iat) || iat <= 0) {
		return null;
	}
	if (!Number.isInteger(exp) || exp <= 0) {
		return null;
	}

	return {
		type: TOKEN_TYPE,
		jti,
		tv,
		iat,
		exp,
	};
};

export const getCurrentTokenVersion = async (): Promise<number> => {
	const kv = await getKVStore();
	const raw = await kv.get(TOKEN_VERSION_KEY);
	const parsed = Number.parseInt(raw ?? "", 10);
	if (Number.isInteger(parsed) && parsed > 0) {
		return parsed;
	}

	await kv.set(TOKEN_VERSION_KEY, "1");
	return 1;
};

const setCurrentTokenVersion = async (nextVersion: number): Promise<void> => {
	const kv = await getKVStore();
	await kv.set(TOKEN_VERSION_KEY, String(nextVersion));
};

const getRequestMetadataFromServerContext = async (): Promise<{
	ip: string;
	ua: string;
}> => {
	const hdrs = await headers();
	const ip =
		hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ||
		hdrs.get("x-real-ip") ||
		"unknown";
	const ua = hdrs.get("user-agent") || "unknown";

	return { ip, ua };
};

const getRequestMetadata = (request: NextRequest): { ip: string; ua: string } => {
	const ip =
		request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
		request.headers.get("x-real-ip") ||
		"unknown";
	const ua = request.headers.get("user-agent") || "unknown";
	return { ip, ua };
};

const isRevoked = async (jti: string, nowSeconds: number): Promise<boolean> => {
	const kv = await getKVStore();
	const raw = await kv.get(revokedKey(jti));
	if (!raw) {
		return false;
	}

	const revokedUntil = Number.parseInt(raw, 10);
	if (!Number.isInteger(revokedUntil)) {
		await kv.delete(revokedKey(jti));
		return false;
	}

	if (revokedUntil > nowSeconds) {
		return true;
	}

	await kv.delete(revokedKey(jti));
	return false;
};

const registerSession = async (
	payload: AdminTokenPayload,
	meta: {
		ip: string;
		ua: string;
	},
): Promise<void> => {
	const kv = await getKVStore();
	await kv.set(
		sessionKey(payload.jti),
		JSON.stringify({
			jti: payload.jti,
			tv: payload.tv,
			iat: payload.iat,
			exp: payload.exp,
			ip: meta.ip,
			ua: meta.ua,
		}),
	);
};

const extractBearer = (raw: string | null): string => {
	if (!raw) return "";
	const [scheme, token] = raw.split(" ");
	if (scheme?.toLowerCase() !== "bearer" || !token) {
		return "";
	}
	return token.trim();
};

const extractCredentialFromRequest = (request: NextRequest): string => {
	const directHeader = request.headers.get("x-admin-key")?.trim();
	if (directHeader) {
		return directHeader;
	}

	const bearer = extractBearer(request.headers.get("authorization"));
	if (bearer) {
		return bearer;
	}

	return request.cookies.get(ADMIN_AUTH_COOKIE_NAME)?.value?.trim() || "";
};

const extractCredentialFromServerContext = async (): Promise<string> => {
	const hdrs = await headers();
	const directHeader = hdrs.get("x-admin-key")?.trim();
	if (directHeader) {
		return directHeader;
	}

	const bearer = extractBearer(hdrs.get("authorization"));
	if (bearer) {
		return bearer;
	}

	const jar = await cookies();
	return jar.get(ADMIN_AUTH_COOKIE_NAME)?.value?.trim() || "";
};

export const getAdminAuthCookieName = (): string => ADMIN_AUTH_COOKIE_NAME;

export const getAdminAuthTtlSeconds = (): number => ADMIN_AUTH_TTL_SECONDS;

export const setAdminSessionCookie = async (token: string): Promise<void> => {
	const jar = await cookies();
	jar.set({
		name: ADMIN_AUTH_COOKIE_NAME,
		value: token,
		httpOnly: true,
		sameSite: "lax",
		secure: env.NODE_ENV === "production",
		path: "/",
		maxAge: ADMIN_AUTH_TTL_SECONDS,
	});
};

export const clearAdminSessionCookie = async (): Promise<void> => {
	const jar = await cookies();
	jar.set({
		name: ADMIN_AUTH_COOKIE_NAME,
		value: "",
		httpOnly: true,
		sameSite: "lax",
		secure: env.NODE_ENV === "production",
		path: "/",
		maxAge: 0,
	});
};

export const signAdminSessionToken = async (): Promise<{
	token: string;
	expiresAt: number;
	payload: AdminTokenPayload;
}> => {
	if (!isAdminAuthEnabled()) {
		throw new Error("Admin authentication is disabled");
	}

	const tokenVersion = await getCurrentTokenVersion();
	const jti = randomUUID();

	const token = jwt.sign(
		{
			type: TOKEN_TYPE,
			jti,
			tv: tokenVersion,
		},
		getAuthSecret(),
		{
			algorithm: "HS256",
			expiresIn: ADMIN_AUTH_TTL_SECONDS,
			issuer: TOKEN_ISSUER,
			audience: TOKEN_AUDIENCE,
		},
	);

	const decoded = jwt.decode(token);
	if (!decoded || typeof decoded !== "object") {
		throw new Error("Failed to decode issued admin token");
	}
	const parsedPayload = parseTokenPayload(decoded as jwt.JwtPayload);
	if (!parsedPayload) {
		throw new Error("Issued admin token payload is invalid");
	}

	const meta = await getRequestMetadataFromServerContext();
	await registerSession(parsedPayload, meta);

	return {
		token,
		expiresAt: parsedPayload.exp * 1000,
		payload: parsedPayload,
	};
};

export const verifyAdminSessionToken = async (
	token: string,
): Promise<AdminTokenPayload | null> => {
	if (!isAdminAuthEnabled()) {
		return null;
	}

	try {
		const decoded = jwt.verify(token, getAuthSecret(), {
			algorithms: ["HS256"],
			issuer: TOKEN_ISSUER,
			audience: TOKEN_AUDIENCE,
		}) as jwt.JwtPayload;

		const payload = parseTokenPayload(decoded);
		if (!payload) {
			return null;
		}

		const nowSeconds = Math.floor(Date.now() / 1000);
		if (payload.exp <= nowSeconds) {
			return null;
		}

		if (await isRevoked(payload.jti, nowSeconds)) {
			return null;
		}

		const currentVersion = await getCurrentTokenVersion();
		if (payload.tv !== currentVersion) {
			return null;
		}

		return payload;
	} catch {
		return null;
	}
};

export const verifyAdminSessionFromRequest = async (
	request: NextRequest,
	overrideCredential?: string | null,
): Promise<AdminTokenPayload | null> => {
	const credential = overrideCredential?.trim() || extractCredentialFromRequest(request);
	if (!credential) {
		return null;
	}

	return verifyAdminSessionToken(credential);
};

export const verifyAdminSessionFromServerContext = async (
	overrideCredential?: string | null,
): Promise<AdminTokenPayload | null> => {
	const credential = overrideCredential?.trim() || (await extractCredentialFromServerContext());
	if (!credential) {
		return null;
	}

	return verifyAdminSessionToken(credential);
};

export const createAdminSessionWithCookie = async (): Promise<{
	expiresAt: number;
	jti: string;
}> => {
	const signed = await signAdminSessionToken();
	await setAdminSessionCookie(signed.token);
	return {
		expiresAt: signed.expiresAt,
		jti: signed.payload.jti,
	};
};

export const getCurrentAdminSession = async (): Promise<AdminTokenPayload | null> => {
	return verifyAdminSessionFromServerContext();
};

export const listAdminTokenSessions = async (): Promise<AdminTokenSessionRecord[]> => {
	const kv = await getKVStore();
	const keys = await kv.list(SESSION_KEY_PREFIX);
	const nowSeconds = Math.floor(Date.now() / 1000);
	const currentVersion = await getCurrentTokenVersion();

	const sessions: AdminTokenSessionRecord[] = [];

	for (const key of keys) {
		const raw = await kv.get(key);
		const parsed = parseJson<{
			jti: string;
			tv: number;
			iat: number;
			exp: number;
			ip?: string;
			ua?: string;
		}>(raw);
		if (!parsed || !SAFE_JTI.test(parsed.jti)) {
			continue;
		}

		const revoked = await isRevoked(parsed.jti, nowSeconds);
		const isExpired = parsed.exp <= nowSeconds;
		const isInvalidated = parsed.tv !== currentVersion;

		let status: AdminSessionStatus = "active";
		if (isExpired) {
			status = "expired";
		} else if (revoked) {
			status = "revoked";
		} else if (isInvalidated) {
			status = "invalidated";
		}

		sessions.push({
			jti: parsed.jti,
			tv: parsed.tv,
			iat: parsed.iat,
			exp: parsed.exp,
			ip: parsed.ip || "unknown",
			ua: parsed.ua || "unknown",
			status,
		});
	}

	sessions.sort((left, right) => right.iat - left.iat);
	return sessions;
};

/**
 * Delete expired admin session records that are past the grace window (exp + SESSION_CLEANUP_GRACE_SECONDS).
 * Intended to be called by a cron job (e.g. daily). Returns the number of records deleted.
 */
export const cleanupExpiredAdminSessions = async (): Promise<number> => {
	const kv = await getKVStore();
	const keys = await kv.list(SESSION_KEY_PREFIX);
	const nowSeconds = Math.floor(Date.now() / 1000);
	const cutoff = nowSeconds - SESSION_CLEANUP_GRACE_SECONDS;
	let deleted = 0;

	for (const key of keys) {
		const raw = await kv.get(key);
		const parsed = parseJson<{ exp?: number }>(raw);
		if (!parsed || typeof parsed.exp !== "number") {
			continue;
		}
		if (parsed.exp <= cutoff) {
			await kv.delete(key);
			deleted++;
		}
	}

	return deleted;
};

export const revokeAdminSessionByJti = async (jti: string): Promise<boolean> => {
	const cleanJti = jti.trim();
	if (!SAFE_JTI.test(cleanJti)) {
		return false;
	}

	const kv = await getKVStore();
	const raw = await kv.get(sessionKey(cleanJti));
	const session = parseJson<{ exp?: number }>(raw);
	if (!session || typeof session.exp !== "number") {
		return false;
	}

	await kv.set(revokedKey(cleanJti), String(Math.max(session.exp, Math.floor(Date.now() / 1000) + 60)));
	return true;
};

export const revokeAllAdminSessions = async (): Promise<number> => {
	const currentVersion = await getCurrentTokenVersion();
	const nextVersion = currentVersion + 1;
	await setCurrentTokenVersion(nextVersion);
	return nextVersion;
};

export const registerAdminSessionFromRequest = async (
	request: NextRequest,
): Promise<{
	token: string;
	expiresAt: number;
	payload: AdminTokenPayload;
}> => {
	if (!isAdminAuthEnabled()) {
		throw new Error("Admin authentication is disabled");
	}

	const tokenVersion = await getCurrentTokenVersion();
	const jti = randomUUID();

	const token = jwt.sign(
		{
			type: TOKEN_TYPE,
			jti,
			tv: tokenVersion,
		},
		getAuthSecret(),
		{
			algorithm: "HS256",
			expiresIn: ADMIN_AUTH_TTL_SECONDS,
			issuer: TOKEN_ISSUER,
			audience: TOKEN_AUDIENCE,
		},
	);

	const decoded = jwt.decode(token);
	if (!decoded || typeof decoded !== "object") {
		throw new Error("Failed to decode issued admin token");
	}
	const parsedPayload = parseTokenPayload(decoded as jwt.JwtPayload);
	if (!parsedPayload) {
		throw new Error("Issued admin token payload is invalid");
	}

	await registerSession(parsedPayload, getRequestMetadata(request));

	return {
		token,
		expiresAt: parsedPayload.exp * 1000,
		payload: parsedPayload,
	};
};
