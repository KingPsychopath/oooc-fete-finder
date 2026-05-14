import "server-only";

import type {
	CreateEventSubmissionInput,
	EventSubmissionPayload,
	EventSubmissionRecord,
	EventSubmissionSnapshot,
	EventSubmissionSpamSignals,
	ReviewEventSubmissionInput,
} from "@/features/events/submissions/types";
import { getEventSubmissionRepository } from "@/lib/platform/postgres/event-submission-repository";
import { z } from "zod";
import { normalizeProofLink, normalizeProofLinks } from "./proof-link";

const MIN_FORM_COMPLETION_SECONDS = 4;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const ARRONDISSEMENT_PATTERN =
	/^([1-9]|1\d|20|greater-paris|outside-paris|unknown)$/;

const normalizeWhitespace = (value: string): string =>
	value.replace(/\s+/g, " ").trim();

const normalizeUpdateFieldValue = (
	field: EventUpdatePatchField | string,
	value: string,
): string =>
	field === "ticketLink" ? value.trim() : normalizeWhitespace(value);

const isValidDateValue = (value: string): boolean => {
	if (!DATE_PATTERN.test(value)) return false;
	const parsed = new Date(`${value}T00:00:00.000Z`);
	return (
		!Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)
	);
};

const normalizedUrlField = (
	value: string,
	context: z.RefinementCtx,
	message: string,
): string => {
	const normalized = normalizeProofLink(value);
	if (!normalized) {
		context.addIssue({ code: "custom", message });
		return z.NEVER;
	}
	return normalized;
};

const normalizedOptionalUrlField = (
	value: string,
	context: z.RefinementCtx,
	message: string,
): string => {
	if (!value) return "";
	return normalizedUrlField(value, context, message);
};

const normalizedOptionalUrlListField = (
	value: string,
	context: z.RefinementCtx,
	message: string,
): string => {
	if (!value) return "";
	const normalizedLinks = normalizeProofLinks(value);
	if (!normalizedLinks) {
		context.addIssue({ code: "custom", message });
		return z.NEVER;
	}
	return normalizedLinks.join("\n");
};

const EVENT_UPDATE_PATCH_FIELDS = [
	"eventName",
	"date",
	"startTime",
	"endTime",
	"location",
	"genre",
	"price",
	"age",
	"indoorOutdoor",
	"arrondissement",
	"ticketLink",
	"notes",
] as const;

type EventUpdatePatchField = (typeof EVENT_UPDATE_PATCH_FIELDS)[number];

const REQUIRED_UPDATE_MERGE_FIELDS = [
	"eventName",
	"date",
	"startTime",
	"location",
	"endTime",
] as const;

const eventCoreSnapshotSchema = z.record(
	z.string(),
	z.string().trim().max(3000),
);

const eventSubmissionBaseSchema = {
	eventName: z.string().trim().min(2).max(180),
	date: z.string().trim().refine(isValidDateValue, "Date must use YYYY-MM-DD"),
	startTime: z.string().trim().regex(TIME_PATTERN, "Start time must use HH:MM"),
	location: z.string().trim().min(2).max(240),
	hostEmail: z.string().trim().email().max(254),
	proofLink: z
		.string()
		.trim()
		.max(2000)
		.transform((value, context) =>
			normalizedUrlField(value, context, "Proof link must be an HTTP(S) URL"),
		),
	ticketLink: z
		.string()
		.trim()
		.max(2000)
		.transform((value, context) =>
			normalizedOptionalUrlListField(
				value,
				context,
				"Ticket links must be HTTP(S) URLs",
			),
		)
		.optional()
		.default(""),
	endTime: z.string().trim().regex(TIME_PATTERN, "End time must use HH:MM"),
	genre: z.string().trim().min(1).max(500),
	suggestedGenres: z.string().trim().max(500).optional().default(""),
	price: z.string().trim().min(1).max(80),
	age: z.string().trim().max(80).optional().default(""),
	indoorOutdoor: z.string().trim().max(80).optional().default(""),
	notes: z.string().trim().max(3000).optional().default(""),
	arrondissement: z
		.string()
		.trim()
		.max(32)
		.refine(
			(value) => value === "" || ARRONDISSEMENT_PATTERN.test(value),
			"Arrondissement must be 1-20, greater-paris, outside-paris, or unknown",
		)
		.optional()
		.default(""),
	formStartedAt: z.string().trim().optional().default(""),
	honeypot: z.string().trim().optional().default(""),
};

const eventSubmissionUpdateInputSchema = z
	.object({
		submissionType: z.literal("event_update"),
		originalEventKey: z.string().trim().min(1).max(180),
		originalEventName: z.string().trim().max(180).optional().default(""),
		originalEventUrl: z
			.string()
			.trim()
			.max(2000)
			.transform((value, context) =>
				normalizedOptionalUrlField(
					value,
					context,
					"Original event URL must be an HTTP(S) URL",
				),
			)
			.optional()
			.default(""),
		originalEventSnapshot: eventCoreSnapshotSchema.optional().default({}),
		eventName: z.string().trim().min(2).max(180).optional(),
		date: z
			.string()
			.trim()
			.refine(isValidDateValue, "Date must use YYYY-MM-DD")
			.optional(),
		startTime: z
			.string()
			.trim()
			.transform((value, context) => {
				const normalized = normalizeWhitespace(value);
				if (!normalized) return "";
				if (!TIME_PATTERN.test(normalized)) {
					context.addIssue({
						code: "custom",
						message: "Start time must use HH:MM",
					});
					return z.NEVER;
				}
				return normalized;
			})
			.optional(),
		location: eventSubmissionBaseSchema.location.optional(),
		hostEmail: eventSubmissionBaseSchema.hostEmail,
		proofLink: eventSubmissionBaseSchema.proofLink,
		endTime: z
			.string()
			.trim()
			.transform((value, context) => {
				const normalized = normalizeWhitespace(value);
				if (!normalized) return "";
				if (!TIME_PATTERN.test(normalized)) {
					context.addIssue({
						code: "custom",
						message: "End time must use HH:MM",
					});
					return z.NEVER;
				}
				return normalized;
			})
			.optional(),
		genre: eventSubmissionBaseSchema.genre.optional(),
		suggestedGenres: z.string().trim().max(500).optional(),
		price: eventSubmissionBaseSchema.price.optional(),
		age: z.string().trim().max(80).optional(),
		indoorOutdoor: z.string().trim().max(80).optional(),
		notes: z.string().trim().max(3000).optional(),
		arrondissement: z
			.string()
			.trim()
			.max(32)
			.refine(
				(value) => value === "" || ARRONDISSEMENT_PATTERN.test(value),
				"Arrondissement must be 1-20, greater-paris, outside-paris, or unknown",
			)
			.optional(),
		ticketLink: z
			.string()
			.trim()
			.max(2000)
			.transform((value, context) =>
				normalizedOptionalUrlListField(
					value,
					context,
					"Ticket links must be HTTP(S) URLs",
				),
			)
			.optional(),
		formStartedAt: eventSubmissionBaseSchema.formStartedAt,
		honeypot: eventSubmissionBaseSchema.honeypot,
	})
	.superRefine((value, context) => {
		const normalizedSnapshot = Object.fromEntries(
			Object.entries(value.originalEventSnapshot)
				.map(([key, val]) => [key, normalizeWhitespace(val)])
				.filter(([, normalized]) => normalized.length > 0),
		);

		const changedFields = EVENT_UPDATE_PATCH_FIELDS.filter(
			(field) =>
				Object.prototype.hasOwnProperty.call(value, field) &&
				normalizeUpdateFieldValue(
					field,
					String((value as Record<string, unknown>)[field] ?? ""),
				) !== normalizeWhitespace(normalizedSnapshot[field] || ""),
		);
		if (changedFields.length === 0) {
			context.addIssue({
				code: "custom",
				path: ["submissionType"],
				message: "Update requests must include at least one changed field",
			});
		}

		for (const requiredField of REQUIRED_UPDATE_MERGE_FIELDS) {
			const valueProvided = Object.prototype.hasOwnProperty.call(
				value,
				requiredField,
			)
				? normalizeWhitespace(
						String((value as Record<string, unknown>)[requiredField] ?? ""),
					)
				: "";
			const snapshotValue = normalizeWhitespace(
				normalizedSnapshot[requiredField] || "",
			);
			if (!valueProvided && !snapshotValue) {
				context.addIssue({
					code: "custom",
					path: [requiredField],
					message: `Update requests require ${requiredField} in payload or snapshot`,
				});
			}
		}
	});

const eventSubmissionPriceFlagInputSchema = z.object({
	submissionType: z.literal("price_flag"),
	originalEventKey: z.string().trim().min(1).max(180),
	originalEventName: z.string().trim().max(180).optional().default(""),
	originalEventUrl: z
		.string()
		.trim()
		.max(2000)
		.transform((value, context) =>
			normalizedOptionalUrlField(
				value,
				context,
				"Original event URL must be an HTTP(S) URL",
			),
		)
		.optional()
		.default(""),
	originalEventSnapshot: eventCoreSnapshotSchema.optional().default({}),
	eventName: z.string().trim().min(2).max(180),
	date: z
		.string()
		.trim()
		.refine(
			(value) => value === "" || isValidDateValue(value),
			"Date must use YYYY-MM-DD",
		)
		.optional()
		.default(""),
	startTime: z
		.string()
		.trim()
		.transform((value, context) => {
			const normalized = normalizeWhitespace(value);
			if (!normalized || normalized.toLowerCase() === "tbc") return "";
			if (!TIME_PATTERN.test(normalized)) {
				context.addIssue({
					code: "custom",
					message: "Start time must use HH:MM",
				});
				return z.NEVER;
			}
			return normalized;
		})
		.optional()
		.default(""),
	location: z.string().trim().max(240).optional().default(""),
	hostEmail: eventSubmissionBaseSchema.hostEmail
		.optional()
		.default("price-flag@outofofficecollective.co.uk"),
	proofLink: eventSubmissionBaseSchema.proofLink,
	ticketLink: z
		.string()
		.trim()
		.max(2000)
		.transform((value, context) =>
			normalizedOptionalUrlListField(
				value,
				context,
				"Ticket links must be HTTP(S) URLs",
			),
		)
		.optional()
		.default(""),
	price: z.string().trim().min(1).max(80),
	notes: z.string().trim().max(3000).optional().default(""),
	reporterNote: z.string().trim().max(1000).optional().default(""),
	formStartedAt: eventSubmissionBaseSchema.formStartedAt,
	honeypot: eventSubmissionBaseSchema.honeypot,
});

const eventSubmissionNewInputSchema = z.object({
	submissionType: z.literal("new_event"),
	originalEventKey: z.string().trim().max(180).optional().default(""),
	originalEventName: z.string().trim().max(180).optional().default(""),
	originalEventUrl: z
		.string()
		.trim()
		.max(2000)
		.transform((value, context) =>
			normalizedOptionalUrlField(
				value,
				context,
				"Original event URL must be an HTTP(S) URL",
			),
		)
		.optional()
		.default(""),
	originalEventSnapshot: eventCoreSnapshotSchema.optional().default({}),
	eventName: eventSubmissionBaseSchema.eventName,
	date: eventSubmissionBaseSchema.date,
	startTime: eventSubmissionBaseSchema.startTime,
	location: eventSubmissionBaseSchema.location,
	hostEmail: eventSubmissionBaseSchema.hostEmail,
	proofLink: eventSubmissionBaseSchema.proofLink,
	ticketLink: eventSubmissionBaseSchema.ticketLink,
	endTime: eventSubmissionBaseSchema.endTime,
	genre: eventSubmissionBaseSchema.genre,
	suggestedGenres: eventSubmissionBaseSchema.suggestedGenres,
	price: eventSubmissionBaseSchema.price,
	age: eventSubmissionBaseSchema.age,
	indoorOutdoor: eventSubmissionBaseSchema.indoorOutdoor,
	notes: eventSubmissionBaseSchema.notes,
	arrondissement: eventSubmissionBaseSchema.arrondissement,
	formStartedAt: eventSubmissionBaseSchema.formStartedAt,
	honeypot: eventSubmissionBaseSchema.honeypot,
});

const eventSubmissionInputSchema = z.preprocess(
	(payload) => {
		if (
			payload &&
			typeof payload === "object" &&
			!("submissionType" in payload)
		) {
			return {
				...(payload as Record<string, unknown>),
				submissionType: "new_event",
			};
		}
		return payload;
	},
	z.discriminatedUnion("submissionType", [
		eventSubmissionNewInputSchema,
		eventSubmissionUpdateInputSchema,
		eventSubmissionPriceFlagInputSchema,
	]),
);

export type EventSubmissionInput = z.infer<typeof eventSubmissionInputSchema>;

export interface NormalizedEventSubmissionInput {
	submissionType: "new_event" | "event_update" | "price_flag";
	originalEventKey: string;
	originalEventName: string;
	originalEventUrl: string;
	originalEventSnapshot: Record<string, string>;
	eventName: string;
	date: string;
	startTime: string;
	location: string;
	hostEmail: string;
	proofLink: string;
	ticketLink: string;
	endTime: string;
	genre: string;
	suggestedGenres: string;
	price: string;
	age: string;
	indoorOutdoor: string;
	notes: string;
	reporterNote: string;
	arrondissement: string;
	formStartedAt: string;
	honeypot: string;
}

const normalizeSnapshotMap = (
	snapshot: Record<string, string>,
): Record<string, string> =>
	Object.fromEntries(
		Object.entries(snapshot)
			.map(([key, value]) => [key, normalizeUpdateFieldValue(key, value)])
			.filter(([, value]) => value.length > 0),
	);

const getRepositoryOrThrow = () => {
	const repository = getEventSubmissionRepository();
	if (!repository) {
		throw new Error(
			"Event submissions require Postgres. Configure DATABASE_URL to enable submissions.",
		);
	}
	return repository;
};

const toOptionalField = (value: string): string => normalizeWhitespace(value);

const normalizeFingerprintSegment = (value: string): string =>
	normalizeWhitespace(value).toLowerCase();

export const parseEventSubmissionInput = (
	payload: unknown,
): NormalizedEventSubmissionInput => {
	const parsed = eventSubmissionInputSchema.parse(payload);

	const normalizedOriginalSnapshot = normalizeSnapshotMap(
		parsed.originalEventSnapshot,
	);
	if (parsed.submissionType === "event_update") {
		const updatePayload = parsed;
		const changedFields = EVENT_UPDATE_PATCH_FIELDS.filter(
			(field) =>
				Object.prototype.hasOwnProperty.call(updatePayload, field) &&
				normalizeUpdateFieldValue(
					field,
					String((updatePayload as Record<string, unknown>)[field] ?? ""),
				) !== normalizeWhitespace(normalizedOriginalSnapshot[field] || ""),
		);
		if (changedFields.length === 0) {
			throw new z.ZodError([
				{
					code: "custom",
					path: ["submissionType"],
					message: "Update requests must include at least one changed field",
				},
			]);
		}

		const mergeWithSnapshot = (field: EventUpdatePatchField): string => {
			const patchValue = updatePayload[field as keyof typeof updatePayload];
			return typeof patchValue === "string"
				? normalizeUpdateFieldValue(field, patchValue)
				: normalizedOriginalSnapshot[field] || "";
		};

		const storedSnapshot = Object.fromEntries(
			Array.from(
				new Set([
					...REQUIRED_UPDATE_MERGE_FIELDS,
					...EVENT_UPDATE_PATCH_FIELDS,
				]),
			)
				.map((field) => [field, normalizedOriginalSnapshot[field]])
				.filter((entry): entry is [string, string] => Boolean(entry[1])),
		);

		return {
			submissionType: "event_update",
			originalEventKey: normalizeWhitespace(updatePayload.originalEventKey),
			originalEventName: normalizeWhitespace(updatePayload.originalEventName),
			originalEventUrl: normalizeWhitespace(updatePayload.originalEventUrl),
			originalEventSnapshot: storedSnapshot,
			eventName: mergeWithSnapshot("eventName"),
			date: mergeWithSnapshot("date"),
			startTime: mergeWithSnapshot("startTime"),
			location: mergeWithSnapshot("location"),
			hostEmail: updatePayload.hostEmail.trim().toLowerCase(),
			proofLink: updatePayload.proofLink,
			ticketLink: mergeWithSnapshot("ticketLink"),
			endTime: mergeWithSnapshot("endTime"),
			genre: mergeWithSnapshot("genre"),
			suggestedGenres: normalizedOriginalSnapshot.suggestedGenres || "",
			price: mergeWithSnapshot("price"),
			age: mergeWithSnapshot("age"),
			indoorOutdoor: mergeWithSnapshot("indoorOutdoor"),
			notes: mergeWithSnapshot("notes"),
			reporterNote: "",
			arrondissement: mergeWithSnapshot("arrondissement"),
			formStartedAt: updatePayload.formStartedAt.trim(),
			honeypot: updatePayload.honeypot.trim(),
		};
	}

	if (parsed.submissionType === "price_flag") {
		const normalizedOriginalSnapshot = normalizeSnapshotMap(
			parsed.originalEventSnapshot,
		);
		return {
			submissionType: "price_flag",
			originalEventKey: normalizeWhitespace(parsed.originalEventKey),
			originalEventName: normalizeWhitespace(parsed.originalEventName),
			originalEventUrl: normalizeWhitespace(parsed.originalEventUrl),
			originalEventSnapshot: normalizedOriginalSnapshot,
			eventName: normalizeWhitespace(parsed.eventName),
			date: normalizeWhitespace(parsed.date),
			startTime: normalizeWhitespace(parsed.startTime),
			location: normalizeWhitespace(parsed.location),
			hostEmail: parsed.hostEmail.trim().toLowerCase(),
			proofLink: parsed.proofLink,
			ticketLink: parsed.ticketLink,
			endTime: normalizedOriginalSnapshot.endTime || "",
			genre: normalizedOriginalSnapshot.genre || "",
			suggestedGenres: "",
			price: normalizeWhitespace(parsed.price),
			age: normalizedOriginalSnapshot.age || "",
			indoorOutdoor: normalizedOriginalSnapshot.indoorOutdoor || "",
			notes: normalizeWhitespace(parsed.notes),
			reporterNote: normalizeWhitespace(parsed.reporterNote),
			arrondissement: normalizedOriginalSnapshot.arrondissement || "",
			formStartedAt: parsed.formStartedAt.trim(),
			honeypot: parsed.honeypot.trim(),
		};
	}

	return {
		submissionType: parsed.submissionType,
		originalEventKey: normalizeWhitespace(parsed.originalEventKey),
		originalEventName: normalizeWhitespace(parsed.originalEventName),
		originalEventUrl: normalizeWhitespace(parsed.originalEventUrl),
		originalEventSnapshot: normalizeSnapshotMap(parsed.originalEventSnapshot),
		eventName: normalizeWhitespace(parsed.eventName),
		date: normalizeWhitespace(parsed.date),
		startTime: normalizeWhitespace(parsed.startTime),
		location: normalizeWhitespace(parsed.location),
		hostEmail: parsed.hostEmail.trim().toLowerCase(),
		proofLink: parsed.proofLink,
		ticketLink: parsed.ticketLink,
		endTime: toOptionalField(parsed.endTime),
		genre: toOptionalField(parsed.genre),
		suggestedGenres: toOptionalField(parsed.suggestedGenres),
		price: toOptionalField(parsed.price),
		age: toOptionalField(parsed.age),
		indoorOutdoor: toOptionalField(parsed.indoorOutdoor),
		notes: toOptionalField(parsed.notes),
		reporterNote: "",
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
	const completionSeconds = computeCompletionSeconds(
		input.formStartedAt,
		nowMs,
	);
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
	submissionType: input.submissionType,
	originalEventKey:
		input.submissionType !== "new_event"
			? input.originalEventKey || undefined
			: undefined,
	originalEventName:
		input.submissionType !== "new_event"
			? input.originalEventName || undefined
			: undefined,
	originalEventUrl:
		input.submissionType !== "new_event"
			? input.originalEventUrl || undefined
			: undefined,
	originalEventSnapshot:
		input.submissionType !== "new_event" &&
		Object.keys(input.originalEventSnapshot).length > 0
			? input.originalEventSnapshot
			: undefined,
	endTime: input.endTime || undefined,
	genre: input.genre || undefined,
	ticketLink: input.ticketLink || undefined,
	suggestedGenres: input.suggestedGenres
		? input.suggestedGenres
				.split(",")
				.map((genre) => genre.trim())
				.filter(Boolean)
		: undefined,
	price: input.price || undefined,
	age: input.age || undefined,
	indoorOutdoor: input.indoorOutdoor || undefined,
	notes: input.notes || undefined,
	reporterNote: input.reporterNote || undefined,
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

export const listAllEventSubmissions = async (): Promise<
	EventSubmissionRecord[]
> => {
	const repository = getEventSubmissionRepository();
	if (!repository) return [];
	return repository.listAllSubmissions();
};

export const replaceAllEventSubmissions = async (
	records: EventSubmissionRecord[],
): Promise<void> => {
	const repository = getRepositoryOrThrow();
	await repository.replaceAllSubmissions(records);
};
