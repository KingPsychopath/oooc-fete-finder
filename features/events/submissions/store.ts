import "server-only";

import { z } from "zod";
import type {
	CreateEventSubmissionInput,
	EventSubmissionPayload,
	EventSubmissionRecord,
	EventSubmissionSnapshot,
	EventSubmissionSpamSignals,
	ReviewEventSubmissionInput,
} from "@/features/events/submissions/types";
import { getEventSubmissionRepository } from "@/lib/platform/postgres/event-submission-repository";
import { normalizeProofLink } from "./proof-link";

const MIN_FORM_COMPLETION_SECONDS = 4;

const eventSubmissionInputSchema = z.object({
	eventName: z.string().trim().min(2).max(180),
	date: z.string().trim().min(1).max(40),
	startTime: z.string().trim().min(1).max(40),
	location: z.string().trim().min(2).max(240),
	hostEmail: z.string().trim().email().max(254),
	proofLink: z
		.string()
		.trim()
		.max(2000)
		.transform((value, context) => {
			const normalized = normalizeProofLink(value);
			if (!normalized) {
				context.addIssue({
					code: "custom",
					message: "Proof link must be an HTTP(S) URL",
				});
				return z.NEVER;
			}
			return normalized;
		}),
	endTime: z.string().trim().max(40).optional().default(""),
	genre: z.string().trim().max(120).optional().default(""),
	price: z.string().trim().max(80).optional().default(""),
	age: z.string().trim().max(80).optional().default(""),
	indoorOutdoor: z.string().trim().max(80).optional().default(""),
	notes: z.string().trim().max(3000).optional().default(""),
	arrondissement: z.string().trim().max(32).optional().default(""),
	formStartedAt: z.string().trim().optional().default(""),
	honeypot: z.string().trim().optional().default(""),
});

export type EventSubmissionInput = z.infer<typeof eventSubmissionInputSchema>;

export interface NormalizedEventSubmissionInput {
	eventName: string;
	date: string;
	startTime: string;
	location: string;
	hostEmail: string;
	proofLink: string;
	endTime: string;
	genre: string;
	price: string;
	age: string;
	indoorOutdoor: string;
	notes: string;
	arrondissement: string;
	formStartedAt: string;
	honeypot: string;
}

const getRepositoryOrThrow = () => {
	const repository = getEventSubmissionRepository();
	if (!repository) {
		throw new Error(
			"Event submissions require Postgres. Configure DATABASE_URL to enable submissions.",
		);
	}
	return repository;
};

const normalizeWhitespace = (value: string): string =>
	value.replace(/\s+/g, " ").trim();

const toOptionalField = (value: string): string => normalizeWhitespace(value);

const normalizeFingerprintSegment = (value: string): string =>
	normalizeWhitespace(value).toLowerCase();

export const parseEventSubmissionInput = (
	payload: unknown,
): NormalizedEventSubmissionInput => {
	const parsed = eventSubmissionInputSchema.parse(payload);
	return {
		eventName: normalizeWhitespace(parsed.eventName),
		date: normalizeWhitespace(parsed.date),
		startTime: normalizeWhitespace(parsed.startTime),
		location: normalizeWhitespace(parsed.location),
		hostEmail: parsed.hostEmail.trim().toLowerCase(),
		proofLink: parsed.proofLink,
		endTime: toOptionalField(parsed.endTime),
		genre: toOptionalField(parsed.genre),
		price: toOptionalField(parsed.price),
		age: toOptionalField(parsed.age),
		indoorOutdoor: toOptionalField(parsed.indoorOutdoor),
		notes: toOptionalField(parsed.notes),
		arrondissement: toOptionalField(parsed.arrondissement),
		formStartedAt: parsed.formStartedAt.trim(),
		honeypot: parsed.honeypot.trim(),
	};
};

export const buildEventSubmissionFingerprint = (
	input: Pick<
		NormalizedEventSubmissionInput,
		"eventName" | "date" | "startTime" | "location" | "proofLink"
	>,
): string => {
	return [
		normalizeFingerprintSegment(input.eventName),
		normalizeFingerprintSegment(input.date),
		normalizeFingerprintSegment(input.startTime),
		normalizeFingerprintSegment(input.location),
		normalizeFingerprintSegment(input.proofLink),
	].join("|");
};

const computeCompletionSeconds = (
	formStartedAt: string,
	nowMs: number,
): number | null => {
	if (!formStartedAt) return null;
	const startedAtMs = new Date(formStartedAt).getTime();
	if (!Number.isFinite(startedAtMs) || startedAtMs <= 0) {
		return null;
	}
	const elapsedSeconds = (nowMs - startedAtMs) / 1000;
	if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
		return null;
	}
	return Number(elapsedSeconds.toFixed(2));
};

export const evaluateSubmissionSpamSignals = (
	input: Pick<NormalizedEventSubmissionInput, "honeypot" | "formStartedAt">,
	nowMs = Date.now(),
): EventSubmissionSpamSignals => {
	const completionSeconds = computeCompletionSeconds(input.formStartedAt, nowMs);
	const honeypotFilled = input.honeypot.trim().length > 0;
	const completedTooFast =
		typeof completionSeconds === "number" &&
		completionSeconds < MIN_FORM_COMPLETION_SECONDS;

	const reasons: string[] = [];
	if (honeypotFilled) {
		reasons.push("honeypot_filled");
	}
	if (completedTooFast) {
		reasons.push("completed_too_fast");
	}

	return {
		honeypotFilled,
		completedTooFast,
		completionSeconds,
		reasons,
	};
};

const buildSubmissionPayload = (
	input: NormalizedEventSubmissionInput,
	submittedAt: string,
): EventSubmissionPayload => ({
	eventName: input.eventName,
	date: input.date,
	startTime: input.startTime,
	location: input.location,
	hostEmail: input.hostEmail,
	proofLink: input.proofLink,
	submittedAt,
	endTime: input.endTime || undefined,
	genre: input.genre || undefined,
	price: input.price || undefined,
	age: input.age || undefined,
	indoorOutdoor: input.indoorOutdoor || undefined,
	notes: input.notes || undefined,
	arrondissement: input.arrondissement || undefined,
});

export const createEventSubmission = async (params: {
	input: NormalizedEventSubmissionInput;
	sourceIpHash: string;
	emailIpHash: string;
	fingerprintHash: string;
	spamSignals: EventSubmissionSpamSignals;
}): Promise<EventSubmissionRecord> => {
	const repository = getRepositoryOrThrow();
	const submittedAt = new Date().toISOString();
	const isSpam = params.spamSignals.reasons.length > 0;

	const createInput: CreateEventSubmissionInput = {
		status: isSpam ? "declined" : "pending",
		payload: buildSubmissionPayload(params.input, submittedAt),
		hostEmail: params.input.hostEmail,
		sourceIpHash: params.sourceIpHash,
		emailIpHash: params.emailIpHash,
		fingerprintHash: params.fingerprintHash,
		spamSignals: params.spamSignals,
		reviewReason: isSpam ? "spam_signal" : null,
		reviewedAt: isSpam ? submittedAt : null,
		reviewedBy: isSpam ? "system" : null,
		acceptedEventKey: null,
	};

	return repository.createSubmission(createInput);
};

export const getEventSubmissionById = async (
	id: string,
): Promise<EventSubmissionRecord | null> => {
	const repository = getRepositoryOrThrow();
	return repository.getSubmissionById(id);
};

export const getEventSubmissionSnapshot = async (
	limitPerStatus = 100,
): Promise<EventSubmissionSnapshot> => {
	const repository = getRepositoryOrThrow();
	const safeLimit = Math.max(1, Math.min(limitPerStatus, 250));
	const [metrics, pending, accepted, declined] = await Promise.all([
		repository.getMetrics(7),
		repository.listSubmissionsByStatus("pending", safeLimit),
		repository.listSubmissionsByStatus("accepted", safeLimit),
		repository.listSubmissionsByStatus("declined", safeLimit),
	]);

	return {
		metrics,
		pending,
		accepted,
		declined,
	};
};

export const reviewEventSubmission = async (
	input: ReviewEventSubmissionInput,
): Promise<EventSubmissionRecord | null> => {
	const repository = getRepositoryOrThrow();
	return repository.reviewPendingSubmission(input);
};

export const clearAllEventSubmissions = async (): Promise<number> => {
	const repository = getRepositoryOrThrow();
	return repository.clearAllSubmissions();
};
