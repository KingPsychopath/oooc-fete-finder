import { createDateNormalizationContext } from "@/features/data-management/assembly/date-normalization";
import {
	type EditableSheetRow,
	normalizeEditableSheetRowValues,
} from "@/features/data-management/csv/sheet-editor";
import {
	EVENT_OCR_FIELD_KEYS,
	type EventOcrFieldCandidate,
	type EventOcrFieldKey,
	type EventOcrFieldSuggestion,
	type EventOcrRawDraft,
} from "./types";

const normalizeStringArray = (value: unknown): string[] =>
	Array.isArray(value)
		? value
				.map((item) => (typeof item === "string" ? item.trim() : ""))
				.filter(Boolean)
		: [];

export const emptyOcrFieldCandidate = (): EventOcrFieldCandidate => ({
	value: null,
	evidence: null,
	confidence: 0,
	sourceImageIds: [],
	sourceFileNames: [],
});

export const emptyOcrFieldSuggestion = (): EventOcrFieldSuggestion => ({
	...emptyOcrFieldCandidate(),
	alternatives: [],
});

export const normalizeOcrConfidence = (value: unknown): number => {
	const numeric = typeof value === "number" ? value : Number(value);
	if (!Number.isFinite(numeric)) return 0;
	return Math.min(1, Math.max(0, numeric));
};

export const normalizeOcrFieldCandidate = (
	value: unknown,
): EventOcrFieldCandidate => {
	if (typeof value === "string") {
		const trimmed = value.trim();
		return {
			value: trimmed || null,
			evidence: null,
			confidence: trimmed ? 0.5 : 0,
			sourceImageIds: [],
			sourceFileNames: [],
		};
	}
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return emptyOcrFieldCandidate();
	}
	const record = value as Record<string, unknown>;
	const rawValue = record.value;
	const rawEvidence = record.evidence;
	const normalizedValue =
		typeof rawValue === "string" && rawValue.trim() ? rawValue.trim() : null;
	const normalizedEvidence =
		typeof rawEvidence === "string" && rawEvidence.trim()
			? rawEvidence.trim()
			: null;
	return {
		value: normalizedValue,
		evidence: normalizedEvidence,
		confidence: normalizeOcrConfidence(record.confidence),
		sourceImageIds: normalizeStringArray(record.sourceImageIds),
		sourceFileNames: normalizeStringArray(record.sourceFileNames),
	};
};

export const normalizeOcrFieldSuggestion = (
	value: unknown,
): EventOcrFieldSuggestion => {
	const suggestion = normalizeOcrFieldCandidate(value);
	const record =
		value && typeof value === "object" && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: {};
	const alternatives = Array.isArray(record.alternatives)
		? record.alternatives
				.map(normalizeOcrFieldCandidate)
				.filter((candidate) => candidate.value)
				.slice(0, 3)
		: [];
	return {
		...suggestion,
		alternatives,
	};
};

export const normalizeRawOcrDraft = (value: unknown): EventOcrRawDraft => {
	const record =
		value && typeof value === "object" && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: {};
	const rawFields =
		record.fields &&
		typeof record.fields === "object" &&
		!Array.isArray(record.fields)
			? (record.fields as Record<string, unknown>)
			: record;
	const fields = Object.fromEntries(
		EVENT_OCR_FIELD_KEYS.map((fieldKey) => [
			fieldKey,
			normalizeOcrFieldSuggestion(rawFields[fieldKey]),
		]),
	) as Record<EventOcrFieldKey, EventOcrFieldSuggestion>;
	const rawWarnings = Array.isArray(record.warnings) ? record.warnings : [];
	return {
		fields,
		rawText: typeof record.rawText === "string" ? record.rawText.trim() : "",
		warnings: rawWarnings
			.map((warning) => (typeof warning === "string" ? warning.trim() : ""))
			.filter(Boolean),
	};
};

export const buildEditableRowFromOcrDraft = (
	draft: EventOcrRawDraft,
): {
	row: EditableSheetRow;
	missingRequiredFields: string[];
	averageConfidence: number;
} => {
	const row: EditableSheetRow = Object.fromEntries(
		EVENT_OCR_FIELD_KEYS.map((fieldKey) => [
			fieldKey,
			draft.fields[fieldKey].value ?? "",
		]),
	);
	row.sourceConfirmed = "";
	row.detailsQualityOverride = "draft";
	row.eventKey = "";
	row.seriesKey = "";
	row.curated = "";

	const context = createDateNormalizationContext([
		{ date: row.date ?? "", dateTo: row.dateTo ?? "" },
	]);
	const normalizedRow = normalizeEditableSheetRowValues(row, context);
	const missingRequiredFields = ["title", "date"].filter(
		(fieldKey) => !String(normalizedRow[fieldKey] ?? "").trim(),
	);
	const populatedConfidences = EVENT_OCR_FIELD_KEYS.map(
		(fieldKey) => draft.fields[fieldKey].confidence,
	).filter((confidence) => confidence > 0);

	return {
		row: normalizedRow,
		missingRequiredFields,
		averageConfidence:
			populatedConfidences.length > 0
				? populatedConfidences.reduce((sum, value) => sum + value, 0) /
					populatedConfidences.length
				: 0,
	};
};
