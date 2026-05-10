import { UserCollectionStore } from "@/features/auth/user-collection-store";
import {
	USER_AUTH_COOKIE_NAME,
	getUserAuthCookieOptions,
	signUserSessionToken,
} from "@/features/auth/user-session-cookie";
import {
	type RateLimitDecision,
	checkAuthVerifyEmailIpLimit,
	checkAuthVerifyIpLimit,
	extractClientIpFromHeaders,
} from "@/features/security/rate-limiter";
import { NO_STORE_HEADERS } from "@/lib/http/cache-control";
import {
	DEFAULT_JSON_BODY_LIMIT_BYTES,
	forbiddenNoStoreResponse,
	isJsonContentType,
	isSameOriginRequest,
	isWithinBodySizeLimit,
	tooLargeNoStoreResponse,
} from "@/lib/http/request-security";
import { log } from "@/lib/platform/logger";
import { getDiscoveryAnalyticsRepository } from "@/lib/platform/postgres/discovery-analytics-repository";
import { getEventEngagementRepository } from "@/lib/platform/postgres/event-engagement-repository";
import { NextResponse } from "next/server";
import { z } from "zod";

const clientContextSchema = z
	.object({
		deviceClass: z.string().trim().max(40).nullable().optional(),
		platform: z.string().trim().max(40).nullable().optional(),
		browserFamily: z.string().trim().max(40).nullable().optional(),
		timezone: z.string().trim().max(80).nullable().optional(),
		locale: z.string().trim().max(40).nullable().optional(),
	})
	.optional();

const verifyBodySchema = z.object({
	firstName: z.string().optional(),
	lastName: z.string().optional(),
	email: z.string().optional(),
	consent: z.boolean().optional(),
	source: z.string().optional(),
	anonymousSessionId: z.string().trim().max(120).nullable().optional(),
	clientContext: clientContextSchema,
});

const isValidEmail = (email: string): boolean => {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email);
};

const withRetryAfterHeaders = (retryAfterSeconds: number): HeadersInit => ({
	...NO_STORE_HEADERS,
	"Retry-After": String(Math.max(1, Math.floor(retryAfterSeconds))),
});

const rateLimitedResponse = (retryAfterSeconds: number): NextResponse =>
	NextResponse.json(
		{
			success: false,
			error: "Too many attempts. Please try again shortly.",
		},
		{
			status: 429,
			headers: withRetryAfterHeaders(retryAfterSeconds),
		},
	);

const logLimiterUnavailable = (decision: RateLimitDecision): void => {
	if (decision.reason !== "limiter_unavailable") return;

	log.warn("auth-verify", "Rate limiter unavailable; allowing request", {
		reason: decision.reason,
		scope: decision.scope,
		keyHash: decision.keyHash,
	});
};

export async function POST(request: Request) {
	if (!isSameOriginRequest(request)) {
		return forbiddenNoStoreResponse();
	}
	if (!isJsonContentType(request)) {
		return NextResponse.json(
			{ success: false, error: "Unsupported media type" },
			{ status: 415, headers: NO_STORE_HEADERS },
		);
	}
	if (!isWithinBodySizeLimit(request, DEFAULT_JSON_BODY_LIMIT_BYTES)) {
		return tooLargeNoStoreResponse();
	}

	const clientIp = extractClientIpFromHeaders(request.headers);
	const ipDecision = await checkAuthVerifyIpLimit(clientIp);
	logLimiterUnavailable(ipDecision);
	if (!ipDecision.allowed) {
		return rateLimitedResponse(ipDecision.retryAfterSeconds ?? 1);
	}

	let body: z.infer<typeof verifyBodySchema>;
	try {
		const parsed = verifyBodySchema.safeParse(await request.json());
		if (!parsed.success) {
			return NextResponse.json(
				{ success: false, error: "Invalid request payload" },
				{ status: 400, headers: NO_STORE_HEADERS },
			);
		}
		body = parsed.data;
	} catch {
		return NextResponse.json(
			{ success: false, error: "Invalid request payload" },
			{ status: 400, headers: NO_STORE_HEADERS },
		);
	}

	const firstName = body.firstName?.trim() || "";
	const lastName = body.lastName?.trim() || "";
	const email = body.email?.trim().toLowerCase() || "";
	const consent = Boolean(body.consent);

	if (firstName.length < 2) {
		return NextResponse.json(
			{ success: false, error: "First name must be at least 2 characters" },
			{ status: 400, headers: NO_STORE_HEADERS },
		);
	}
	if (lastName.length < 2) {
		return NextResponse.json(
			{ success: false, error: "Last name must be at least 2 characters" },
			{ status: 400, headers: NO_STORE_HEADERS },
		);
	}
	if (!isValidEmail(email)) {
		return NextResponse.json(
			{ success: false, error: "Valid email address is required" },
			{ status: 400, headers: NO_STORE_HEADERS },
		);
	}

	const emailIpDecision = await checkAuthVerifyEmailIpLimit(email, clientIp);
	logLimiterUnavailable(emailIpDecision);
	if (!emailIpDecision.allowed) {
		return rateLimitedResponse(emailIpDecision.retryAfterSeconds ?? 1);
	}

	if (!consent) {
		return NextResponse.json(
			{ success: false, error: "Consent is required" },
			{ status: 400, headers: NO_STORE_HEADERS },
		);
	}

	try {
		const user = {
			firstName,
			lastName,
			email,
			consent: true,
			source: body.source?.trim() || "fete-finder-auth",
			timestamp: new Date().toISOString(),
			deviceClass: body.clientContext?.deviceClass ?? null,
			platform: body.clientContext?.platform ?? null,
			browserFamily: body.clientContext?.browserFamily ?? null,
			timezone: body.clientContext?.timezone ?? null,
			locale: body.clientContext?.locale ?? null,
		};

		const storeResult = await UserCollectionStore.addOrUpdate(user);
		const anonymousSessionId = body.anonymousSessionId?.trim();
		let linkedEventRows = 0;
		let linkedDiscoveryRows = 0;
		if (anonymousSessionId && storeResult.record.userId) {
			const linkInput = {
				sessionId: anonymousSessionId,
				userId: storeResult.record.userId,
				userEmail: email,
				deviceClass: body.clientContext?.deviceClass ?? null,
				platform: body.clientContext?.platform ?? null,
				browserFamily: body.clientContext?.browserFamily ?? null,
				timezone: body.clientContext?.timezone ?? null,
				locale: body.clientContext?.locale ?? null,
			};
			const [eventRows, discoveryRows] = await Promise.all([
				getEventEngagementRepository()?.attachUserToSession(linkInput) ??
					Promise.resolve(0),
				getDiscoveryAnalyticsRepository()?.attachUserToSession(linkInput) ??
					Promise.resolve(0),
			]);
			linkedEventRows = eventRows;
			linkedDiscoveryRows = discoveryRows;
		}
		const storeStatus = await UserCollectionStore.getStatus();

		const response = NextResponse.json(
			{
				success: true,
				email,
				userId: storeResult.record.userId ?? null,
				storedIn: storeStatus.provider,
				linkedBehaviorRows: linkedEventRows + linkedDiscoveryRows,
				message: storeResult.alreadyExisted
					? "Existing user verified"
					: "User verified",
			},
			{ headers: NO_STORE_HEADERS },
		);
		response.cookies.set(
			USER_AUTH_COOKIE_NAME,
			signUserSessionToken(email, storeResult.record.userId),
			getUserAuthCookieOptions(),
		);
		return response;
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Unexpected verify error";
		log.error("auth-verify", "Failed to verify user", { message }, error);
		return NextResponse.json(
			{
				success: false,
				error: "Verification failed. Please try again.",
			},
			{ status: 500, headers: NO_STORE_HEADERS },
		);
	}
}
