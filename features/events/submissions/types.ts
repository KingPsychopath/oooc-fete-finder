export const EVENT_SUBMISSION_STATUSES = [
	"pending",
	"accepted",
	"declined",
] as const;

export type EventSubmissionStatus =
	(typeof EVENT_SUBMISSION_STATUSES)[number];

export type EventSubmissionReviewStatus = Exclude<
	EventSubmissionStatus,
	"pending"
>;

export interface EventSubmissionPayload {
	eventName: string;
	date: string;
	startTime: string;
	location: string;
	hostEmail: string;
	proofLink: string;
	submittedAt: string;
	endTime?: string;
	genre?: string;
	price?: string;
	age?: string;
	indoorOutdoor?: string;
	notes?: string;
	arrondissement?: string;
}

export interface EventSubmissionSpamSignals {
	honeypotFilled: boolean;
	completedTooFast: boolean;
	completionSeconds: number | null;
	reasons: string[];
}

export interface EventSubmissionRecord {
	id: string;
	status: EventSubmissionStatus;
	payload: EventSubmissionPayload;
	hostEmail: string;
	sourceIpHash: string;
	emailIpHash: string;
	fingerprintHash: string;
	spamSignals: EventSubmissionSpamSignals;
	reviewReason: string | null;
	acceptedEventKey: string | null;
	reviewedAt: string | null;
	reviewedBy: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface EventSubmissionMetrics {
	totalCount: number;
	pendingCount: number;
	acceptedLast7Days: number;
	declinedLast7Days: number;
}

export interface EventSubmissionSnapshot {
	metrics: EventSubmissionMetrics;
	pending: EventSubmissionRecord[];
	accepted: EventSubmissionRecord[];
	declined: EventSubmissionRecord[];
}

export interface CreateEventSubmissionInput {
	status: EventSubmissionStatus;
	payload: EventSubmissionPayload;
	hostEmail: string;
	sourceIpHash: string;
	emailIpHash: string;
	fingerprintHash: string;
	spamSignals: EventSubmissionSpamSignals;
	reviewReason?: string | null;
	acceptedEventKey?: string | null;
	reviewedAt?: string | null;
	reviewedBy?: string | null;
}

export interface ReviewEventSubmissionInput {
	id: string;
	status: EventSubmissionReviewStatus;
	reviewReason?: string | null;
	acceptedEventKey?: string | null;
	reviewedBy?: string;
}

export interface EventSubmissionSettings {
	version: 1;
	enabled: boolean;
	updatedAt: string;
	updatedBy: string;
}

export interface EventSubmissionPublicSettings {
	enabled: boolean;
	updatedAt: string;
}

export interface EventSubmissionSettingsStatus {
	provider: "file" | "memory" | "postgres";
	location: string;
	key: string;
	updatedAt: string;
	updatedBy: string;
}

export const EVENT_SUBMISSION_DECLINE_REASONS = [
	"not_enough_information",
	"duplicate_submission",
	"event_not_relevant",
	"unable_to_verify",
	"spam_signal",
	"other",
] as const;

export type EventSubmissionDeclineReason =
	(typeof EVENT_SUBMISSION_DECLINE_REASONS)[number];
