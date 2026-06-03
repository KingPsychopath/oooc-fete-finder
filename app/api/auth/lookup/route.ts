import { validateName } from "@/features/auth/email-gate-utils";
import { UserCollectionStore } from "@/features/auth/user-collection-store";
import {
	type RateLimitDecision,
	checkAuthLookupIpLimit,
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
import { legalPrivacyVersion, legalTermsVersion } from "@/lib/legal";
import { log } from "@/lib/platform/logger";
import { getUserCollectionRepository } from "@/lib/platform/postgres/user-collection-repository";
import { NextResponse } from "next/server";
import { z } from "zod";

const lookupBodySchema = z.object({
	email: z.string().optional(),
});

const isValidEmail = (email: string): boolean => {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email);
};

const getLookupProfile = async (email: string) => {
	const repository = getUserCollectionRepository();
	const normalizedEmail = email.trim().toLowerCase();
	if (!normalizedEmail) return null;

	if (repository) {
		return await repository.findByEmail(normalizedEmail);
	}

	const profile = await UserCollectionStore.getUserProfile({
		email: normalizedEmail,
	});
	return profile?.user ?? null;
};

const hasValidStoredName = (
	profile: Awaited<ReturnType<typeof getLookupProfile>>,
): boolean =>
	Boolean(
		profile?.firstName?.trim() &&
			profile?.lastName?.trim() &&
			validateName(profile.firstName) &&
			validateName(profile.lastName),
	);

const hasCurrentLegalAcceptance = (
	profile: Awaited<ReturnType<typeof getLookupProfile>>,
): boolean =>
	Boolean(
		profile?.consent &&
			profile.termsAcceptedAt &&
			profile.termsVersion === legalTermsVersion &&
			profile.privacyAcceptedAt &&
			profile.privacyVersion === legalPrivacyVersion,
	);

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

	log.warn("auth-lookup", "Rate limiter unavailable; allowing request", {
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
	const ipDecision = await checkAuthLookupIpLimit(clientIp);
	logLimiterUnavailable(ipDecision);
	if (!ipDecision.allowed) {
		return rateLimitedResponse(ipDecision.retryAfterSeconds ?? 1);
	}

	let body: z.infer<typeof lookupBodySchema>;
	try {
		const parsed = lookupBodySchema.safeParse(await request.json());
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

	const email = body.email?.trim().toLowerCase() || "";
	if (!isValidEmail(email)) {
		return NextResponse.json(
			{ success: false, error: "Valid email address is required" },
			{ status: 400, headers: NO_STORE_HEADERS },
		);
	}

	const profile = await getLookupProfile(email);
	const hasStoredName = hasValidStoredName(profile);
	const hasStoredConsent = hasCurrentLegalAcceptance(profile);

	return NextResponse.json(
		{
			success: true,
			email,
			requiresName: !hasStoredName,
			requiresConsent: !hasStoredConsent,
		},
		{ headers: NO_STORE_HEADERS },
	);
}
