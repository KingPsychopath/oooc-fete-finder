import { EventSubmissionSettingsStore } from "@/features/events/submissions/settings-store";
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
import {
	EVENT_SUBMISSION_JSON_BODY_LIMIT_BYTES,
	forbiddenNoStoreResponse,
	isSameOriginRequest,
	isWithinBodySizeLimit,
	tooLargeNoStoreResponse,
} from "@/lib/http/request-security";
import { NextResponse } from "next/server";
import { z } from "zod";

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

const serviceUnavailableResponse = (): NextResponse =>
	NextResponse.json(
		{
			success: false,
			error: "Submission service unavailable",
		},
		{ status: 503, headers: NO_STORE_HEADERS },
	);

export async function POST(request: Request) {
	if (!isSameOriginRequest(request)) {
		return forbiddenNoStoreResponse();
	}
	if (!isWithinBodySizeLimit(request, EVENT_SUBMISSION_JSON_BODY_LIMIT_BYTES)) {
		return tooLargeNoStoreResponse();
	}

	const contentType = request.headers.get("content-type") || "";
	if (!contentType.toLowerCase().includes("application/json")) {
		return NextResponse.json(
			{ success: false, error: "Unsupported media type" },
			{ status: 415, headers: NO_STORE_HEADERS },
		);
	}

	let submissionSettings;
	try {
		submissionSettings = await EventSubmissionSettingsStore.getPublicSettings();
	} catch {
		return serviceUnavailableResponse();
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

	const submissionType =
		rawBody && typeof rawBody === "object" && "submissionType" in rawBody
			? rawBody.submissionType === "event_update" ||
				rawBody.submissionType === "price_flag"
				? rawBody.submissionType
				: "new_event"
			: "new_event";
	const isSubmissionTypeEnabled =
		submissionType === "event_update" || submissionType === "price_flag"
			? submissionSettings.eventUpdatesEnabled
			: submissionSettings.newEventsEnabled;
	if (!isSubmissionTypeEnabled) {
		return NextResponse.json(
			{
				success: false,
				error:
					submissionType === "event_update"
						? "Event update requests are temporarily closed."
						: submissionType === "price_flag"
							? "Price flags are temporarily closed."
							: "Event submissions are temporarily closed.",
			},
			{
				status: 503,
				headers: NO_STORE_HEADERS,
			},
		);
	}

	const clientIp = extractClientIpFromHeaders(request.headers);

	const ipDecision = await checkEventSubmitIpLimit(clientIp);
	if (ipDecision.reason === "limiter_unavailable") {
		return serviceUnavailableResponse();
	}
	if (!ipDecision.allowed) {
		return rateLimitedResponse(ipDecision.retryAfterSeconds ?? 1);
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
	if (emailIpDecision.reason === "limiter_unavailable") {
		return serviceUnavailableResponse();
	}
	if (!emailIpDecision.allowed) {
		return rateLimitedResponse(emailIpDecision.retryAfterSeconds ?? 1);
	}

	const fingerprint = buildEventSubmissionFingerprint(normalizedInput);
	const fingerprintDecision =
		await checkEventSubmitFingerprintLimit(fingerprint);
	if (fingerprintDecision.reason === "limiter_unavailable") {
		return serviceUnavailableResponse();
	}
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
		return serviceUnavailableResponse();
	}

	return acceptedResponse();
}
