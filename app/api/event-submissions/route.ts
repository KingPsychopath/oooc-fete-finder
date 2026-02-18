import { z } from "zod";
import {
	buildEventSubmissionFingerprint,
	createEventSubmission,
	evaluateSubmissionSpamSignals,
	parseEventSubmissionInput,
} from "@/features/events/submissions/store";
import {
	checkEventSubmitEmailIpLimit,
	checkEventSubmitFingerprintLimit,
	checkEventSubmitIpLimit,
	extractClientIpFromHeaders,
} from "@/features/security/rate-limiter";
import { NO_STORE_HEADERS } from "@/lib/http/cache-control";
import { NextResponse } from "next/server";

const ACCEPTED_MESSAGE =
	"Thanks, your event submission has been received for review.";

const withRetryAfterHeaders = (retryAfterSeconds: number): HeadersInit => ({
	...NO_STORE_HEADERS,
	"Retry-After": String(Math.max(1, Math.floor(retryAfterSeconds))),
});

const rateLimitedResponse = (retryAfterSeconds: number): NextResponse =>
	NextResponse.json(
		{
			success: false,
			error: "Too many submissions. Please try again shortly.",
		},
		{
			status: 429,
			headers: withRetryAfterHeaders(retryAfterSeconds),
		},
	);

const acceptedResponse = (): NextResponse =>
	NextResponse.json(
		{
			success: true,
			message: ACCEPTED_MESSAGE,
		},
		{ headers: NO_STORE_HEADERS },
	);

export async function POST(request: Request) {
	const clientIp = extractClientIpFromHeaders(request.headers);

	const ipDecision = await checkEventSubmitIpLimit(clientIp);
	if (!ipDecision.allowed) {
		return rateLimitedResponse(ipDecision.retryAfterSeconds ?? 1);
	}

	let rawBody: unknown;
	try {
		rawBody = await request.json();
	} catch {
		return NextResponse.json(
			{ success: false, error: "Invalid request payload" },
			{ status: 400, headers: NO_STORE_HEADERS },
		);
	}

	let normalizedInput;
	try {
		normalizedInput = parseEventSubmissionInput(rawBody);
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{
					success: false,
					error: "Invalid submission details",
					issues: error.issues.map((issue) => issue.message),
				},
				{ status: 400, headers: NO_STORE_HEADERS },
			);
		}
		return NextResponse.json(
			{ success: false, error: "Invalid submission details" },
			{ status: 400, headers: NO_STORE_HEADERS },
		);
	}

	const emailIpDecision = await checkEventSubmitEmailIpLimit(
		normalizedInput.hostEmail,
		clientIp,
	);
	if (!emailIpDecision.allowed) {
		return rateLimitedResponse(emailIpDecision.retryAfterSeconds ?? 1);
	}

	const fingerprint = buildEventSubmissionFingerprint(normalizedInput);
	const fingerprintDecision = await checkEventSubmitFingerprintLimit(fingerprint);
	if (!fingerprintDecision.allowed) {
		return rateLimitedResponse(fingerprintDecision.retryAfterSeconds ?? 1);
	}

	const spamSignals = evaluateSubmissionSpamSignals(normalizedInput);

	try {
		await createEventSubmission({
			input: normalizedInput,
			sourceIpHash: ipDecision.keyHash,
			emailIpHash: emailIpDecision.keyHash,
			fingerprintHash: fingerprintDecision.keyHash,
			spamSignals,
		});
	} catch {
		return NextResponse.json(
			{ success: false, error: "Submission service unavailable" },
			{ status: 503, headers: NO_STORE_HEADERS },
		);
	}

	return acceptedResponse();
}
