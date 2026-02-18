import "server-only";

import { createHmac } from "crypto";
import { env } from "@/lib/config/env";
import { getRateLimitRepository } from "@/lib/platform/postgres/rate-limit-repository";

const AUTH_VERIFY_IP_LIMIT = 60;
const AUTH_VERIFY_IP_WINDOW_SECONDS = 60;
const AUTH_VERIFY_EMAIL_IP_LIMIT = 6;
const AUTH_VERIFY_EMAIL_IP_WINDOW_SECONDS = 15 * 60;
const RATE_LIMIT_CLEANUP_GRACE_SECONDS = 24 * 60 * 60;

export type RateLimitScope = "auth_verify_ip" | "auth_verify_email_ip";
export type RateLimitReason =
	| "ok"
	| "ip_limit"
	| "email_ip_limit"
	| "limiter_unavailable";

export interface RateLimitDecision {
	allowed: boolean;
	retryAfterSeconds: number | null;
	reason: RateLimitReason;
	scope: RateLimitScope;
	keyHash: string;
}

export const extractClientIpFromHeaders = (
	headers: Pick<Headers, "get">,
): string => {
	const forwardedFor = headers.get("x-forwarded-for");
	if (forwardedFor?.trim()) {
		return forwardedFor.split(",")[0]?.trim() || "unknown";
	}

	const realIp = headers.get("x-real-ip");
	if (realIp?.trim()) {
		return realIp.trim();
	}

	return "unknown";
};

export const normalizeRateLimitEmail = (email: string): string =>
	email.trim().toLowerCase();

export const buildRateLimitKeyHash = (parts: string[]): string =>
	createHmac("sha256", env.AUTH_SECRET).update(parts.join("|")).digest("hex");

const allowDecision = (
	scope: RateLimitScope,
	keyHash: string,
): RateLimitDecision => ({
	allowed: true,
	retryAfterSeconds: null,
	reason: "ok",
	scope,
	keyHash,
});

const blockDecision = (
	scope: RateLimitScope,
	keyHash: string,
	reason: Extract<RateLimitReason, "ip_limit" | "email_ip_limit">,
	retryAfterSeconds: number,
): RateLimitDecision => ({
	allowed: false,
	retryAfterSeconds: Math.max(1, Math.floor(retryAfterSeconds)),
	reason,
	scope,
	keyHash,
});

const failOpenDecision = (
	scope: RateLimitScope,
	keyHash: string,
): RateLimitDecision => ({
	allowed: true,
	retryAfterSeconds: null,
	reason: "limiter_unavailable",
	scope,
	keyHash,
});

const evaluateConsumeResult = (params: {
	scope: RateLimitScope;
	keyHash: string;
	count: number;
	limit: number;
	retryAfterSeconds: number;
}): RateLimitDecision => {
	if (params.count <= params.limit) {
		return allowDecision(params.scope, params.keyHash);
	}

	return blockDecision(
		params.scope,
		params.keyHash,
		params.scope === "auth_verify_ip" ? "ip_limit" : "email_ip_limit",
		params.retryAfterSeconds,
	);
};

export const checkAuthVerifyIpLimit = async (
	ip: string,
): Promise<RateLimitDecision> => {
	const scope: RateLimitScope = "auth_verify_ip";
	const normalizedIp = ip.trim() || "unknown";
	const keyHash = buildRateLimitKeyHash([scope, normalizedIp]);

	const repository = getRateLimitRepository();
	if (!repository) {
		return failOpenDecision(scope, keyHash);
	}

	try {
		const consumed = await repository.consumeWindow({
			scope,
			keyHash,
			windowSeconds: AUTH_VERIFY_IP_WINDOW_SECONDS,
			limit: AUTH_VERIFY_IP_LIMIT,
		});

		return evaluateConsumeResult({
			scope,
			keyHash,
			count: consumed.count,
			limit: consumed.limit,
			retryAfterSeconds: consumed.retryAfterSeconds,
		});
	} catch {
		return failOpenDecision(scope, keyHash);
	}
};

export const checkAuthVerifyEmailIpLimit = async (
	email: string,
	ip: string,
): Promise<RateLimitDecision> => {
	const scope: RateLimitScope = "auth_verify_email_ip";
	const normalizedEmail = normalizeRateLimitEmail(email);
	const normalizedIp = ip.trim() || "unknown";
	const keyHash = buildRateLimitKeyHash([scope, normalizedEmail, normalizedIp]);

	const repository = getRateLimitRepository();
	if (!repository) {
		return failOpenDecision(scope, keyHash);
	}

	try {
		const consumed = await repository.consumeWindow({
			scope,
			keyHash,
			windowSeconds: AUTH_VERIFY_EMAIL_IP_WINDOW_SECONDS,
			limit: AUTH_VERIFY_EMAIL_IP_LIMIT,
		});

		return evaluateConsumeResult({
			scope,
			keyHash,
			count: consumed.count,
			limit: consumed.limit,
			retryAfterSeconds: consumed.retryAfterSeconds,
		});
	} catch {
		return failOpenDecision(scope, keyHash);
	}
};

export const cleanupAuthVerifyRateLimits = async (
	graceSeconds = RATE_LIMIT_CLEANUP_GRACE_SECONDS,
): Promise<number> => {
	const repository = getRateLimitRepository();
	if (!repository) {
		return 0;
	}

	return repository.cleanupExpired(graceSeconds);
};
