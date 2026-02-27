import "server-only";

import { createHmac } from "crypto";
import { env } from "@/lib/config/env";
import { getRateLimitRepository } from "@/lib/platform/postgres/rate-limit-repository";

const AUTH_VERIFY_IP_LIMIT = 60;
const AUTH_VERIFY_IP_WINDOW_SECONDS = 60;
const AUTH_VERIFY_EMAIL_IP_LIMIT = 6;
const AUTH_VERIFY_EMAIL_IP_WINDOW_SECONDS = 15 * 60;
const EVENT_SUBMIT_IP_LIMIT = 20;
const EVENT_SUBMIT_IP_WINDOW_SECONDS = 10 * 60;
const EVENT_SUBMIT_EMAIL_IP_LIMIT = 5;
const EVENT_SUBMIT_EMAIL_IP_WINDOW_SECONDS = 60 * 60;
const EVENT_SUBMIT_FINGERPRINT_LIMIT = 1;
const EVENT_SUBMIT_FINGERPRINT_WINDOW_SECONDS = 24 * 60 * 60;
const TRACK_EVENT_IP_LIMIT = 240;
const TRACK_EVENT_IP_WINDOW_SECONDS = 60;
const TRACK_EVENT_SESSION_LIMIT = 200;
const TRACK_EVENT_SESSION_WINDOW_SECONDS = 60;
const TRACK_DISCOVERY_IP_LIMIT = 180;
const TRACK_DISCOVERY_IP_WINDOW_SECONDS = 60;
const USER_PREFERENCE_IP_LIMIT = 120;
const USER_PREFERENCE_IP_WINDOW_SECONDS = 60;
const RATE_LIMIT_CLEANUP_GRACE_SECONDS = 24 * 60 * 60;

export type RateLimitScope =
	| "auth_verify_ip"
	| "auth_verify_email_ip"
	| "event_submit_ip"
	| "event_submit_email_ip"
	| "event_submit_fingerprint"
	| "track_event_ip"
	| "track_event_session"
	| "track_discovery_ip"
	| "user_preference_ip";
export type RateLimitReason =
	| "ok"
	| "ip_limit"
	| "email_ip_limit"
	| "fingerprint_limit"
	| "session_limit"
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
	reason: Extract<
		RateLimitReason,
		"ip_limit" | "email_ip_limit" | "fingerprint_limit" | "session_limit"
	>,
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

const rateLimitReasonByScope: Record<
	RateLimitScope,
	Extract<
		RateLimitReason,
		"ip_limit" | "email_ip_limit" | "fingerprint_limit" | "session_limit"
	>
> = {
	auth_verify_ip: "ip_limit",
	auth_verify_email_ip: "email_ip_limit",
	event_submit_ip: "ip_limit",
	event_submit_email_ip: "email_ip_limit",
	event_submit_fingerprint: "fingerprint_limit",
	track_event_ip: "ip_limit",
	track_event_session: "session_limit",
	track_discovery_ip: "ip_limit",
	user_preference_ip: "ip_limit",
};

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
		rateLimitReasonByScope[params.scope],
		params.retryAfterSeconds,
	);
};

const consumeRateLimitWindow = async (params: {
	scope: RateLimitScope;
	keyParts: string[];
	windowSeconds: number;
	limit: number;
}): Promise<RateLimitDecision> => {
	const keyHash = buildRateLimitKeyHash([params.scope, ...params.keyParts]);
	const repository = getRateLimitRepository();
	if (!repository) {
		return failOpenDecision(params.scope, keyHash);
	}

	try {
		const consumed = await repository.consumeWindow({
			scope: params.scope,
			keyHash,
			windowSeconds: params.windowSeconds,
			limit: params.limit,
		});

		return evaluateConsumeResult({
			scope: params.scope,
			keyHash,
			count: consumed.count,
			limit: consumed.limit,
			retryAfterSeconds: consumed.retryAfterSeconds,
		});
	} catch {
		return failOpenDecision(params.scope, keyHash);
	}
};

export const checkAuthVerifyIpLimit = async (
	ip: string,
): Promise<RateLimitDecision> => {
	const scope: RateLimitScope = "auth_verify_ip";
	const normalizedIp = ip.trim() || "unknown";
	return consumeRateLimitWindow({
		scope,
		keyParts: [normalizedIp],
		windowSeconds: AUTH_VERIFY_IP_WINDOW_SECONDS,
		limit: AUTH_VERIFY_IP_LIMIT,
	});
};

export const checkAuthVerifyEmailIpLimit = async (
	email: string,
	ip: string,
): Promise<RateLimitDecision> => {
	const scope: RateLimitScope = "auth_verify_email_ip";
	const normalizedEmail = normalizeRateLimitEmail(email);
	const normalizedIp = ip.trim() || "unknown";
	return consumeRateLimitWindow({
		scope,
		keyParts: [normalizedEmail, normalizedIp],
		windowSeconds: AUTH_VERIFY_EMAIL_IP_WINDOW_SECONDS,
		limit: AUTH_VERIFY_EMAIL_IP_LIMIT,
	});
};

export const checkEventSubmitIpLimit = async (
	ip: string,
): Promise<RateLimitDecision> => {
	const scope: RateLimitScope = "event_submit_ip";
	const normalizedIp = ip.trim() || "unknown";
	return consumeRateLimitWindow({
		scope,
		keyParts: [normalizedIp],
		windowSeconds: EVENT_SUBMIT_IP_WINDOW_SECONDS,
		limit: EVENT_SUBMIT_IP_LIMIT,
	});
};

export const checkEventSubmitEmailIpLimit = async (
	email: string,
	ip: string,
): Promise<RateLimitDecision> => {
	const scope: RateLimitScope = "event_submit_email_ip";
	const normalizedEmail = normalizeRateLimitEmail(email);
	const normalizedIp = ip.trim() || "unknown";
	return consumeRateLimitWindow({
		scope,
		keyParts: [normalizedEmail, normalizedIp],
		windowSeconds: EVENT_SUBMIT_EMAIL_IP_WINDOW_SECONDS,
		limit: EVENT_SUBMIT_EMAIL_IP_LIMIT,
	});
};

export const checkEventSubmitFingerprintLimit = async (
	fingerprint: string,
): Promise<RateLimitDecision> => {
	const scope: RateLimitScope = "event_submit_fingerprint";
	const normalizedFingerprint = fingerprint.trim().toLowerCase() || "unknown";
	return consumeRateLimitWindow({
		scope,
		keyParts: [normalizedFingerprint],
		windowSeconds: EVENT_SUBMIT_FINGERPRINT_WINDOW_SECONDS,
		limit: EVENT_SUBMIT_FINGERPRINT_LIMIT,
	});
};

export const checkTrackEventIpLimit = async (
	ip: string,
): Promise<RateLimitDecision> => {
	const scope: RateLimitScope = "track_event_ip";
	const normalizedIp = ip.trim() || "unknown";
	return consumeRateLimitWindow({
		scope,
		keyParts: [normalizedIp],
		windowSeconds: TRACK_EVENT_IP_WINDOW_SECONDS,
		limit: TRACK_EVENT_IP_LIMIT,
	});
};

export const checkTrackEventSessionLimit = async (
	sessionId: string,
): Promise<RateLimitDecision> => {
	const scope: RateLimitScope = "track_event_session";
	const normalizedSession = sessionId.trim() || "unknown";
	return consumeRateLimitWindow({
		scope,
		keyParts: [normalizedSession],
		windowSeconds: TRACK_EVENT_SESSION_WINDOW_SECONDS,
		limit: TRACK_EVENT_SESSION_LIMIT,
	});
};

export const checkTrackDiscoveryIpLimit = async (
	ip: string,
): Promise<RateLimitDecision> => {
	const scope: RateLimitScope = "track_discovery_ip";
	const normalizedIp = ip.trim() || "unknown";
	return consumeRateLimitWindow({
		scope,
		keyParts: [normalizedIp],
		windowSeconds: TRACK_DISCOVERY_IP_WINDOW_SECONDS,
		limit: TRACK_DISCOVERY_IP_LIMIT,
	});
};

export const checkUserPreferenceIpLimit = async (
	ip: string,
): Promise<RateLimitDecision> => {
	const scope: RateLimitScope = "user_preference_ip";
	const normalizedIp = ip.trim() || "unknown";
	return consumeRateLimitWindow({
		scope,
		keyParts: [normalizedIp],
		windowSeconds: USER_PREFERENCE_IP_WINDOW_SECONDS,
		limit: USER_PREFERENCE_IP_LIMIT,
	});
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
