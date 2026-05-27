import type { EditableSheetRow } from "@/features/data-management/csv/sheet-editor";

export const EVENT_OCR_FIELD_KEYS = [
	"eventCategory",
	"hostCountry",
	"audienceCountry",
	"title",
	"date",
	"dateTo",
	"startTime",
	"endTime",
	"location",
	"districtArea",
	"categories",
	"tags",
	"price",
	"primaryUrl",
	"ageGuidance",
	"setting",
	"notes",
] as const;

export type EventOcrFieldKey = (typeof EVENT_OCR_FIELD_KEYS)[number];

export type EventOcrProviderId = string;

export type EventOcrImageInput = {
	id: string;
	fileName: string;
	mimeType: string;
	base64: string;
};

export type EventOcrSourceImage = {
	id: string;
	fileName: string;
};

export type EventOcrFieldCandidate = {
	value: string | null;
	evidence: string | null;
	confidence: number;
	sourceImageIds: string[];
	sourceFileNames: string[];
};

export type EventOcrFieldSuggestion = EventOcrFieldCandidate & {
	alternatives: EventOcrFieldCandidate[];
};

export type EventOcrRawDraft = {
	fields: Record<EventOcrFieldKey, EventOcrFieldSuggestion>;
	rawText: string;
	warnings: string[];
};

export type EventOcrDraft = EventOcrRawDraft & {
	id: string;
	fileName: string;
	sourceImages: EventOcrSourceImage[];
	provider: EventOcrProviderId;
	model: string;
	row: EditableSheetRow;
	missingRequiredFields: string[];
	averageConfidence: number;
};

export type EventOcrExtractionResult =
	| {
			success: true;
			draft: EventOcrDraft;
	  }
	| {
			success: false;
			id: string;
			fileName: string;
			error: string;
			provider?: EventOcrProviderId;
			model?: string;
	  };

export interface EventOcrExtractor {
	readonly provider: EventOcrProviderId;
	readonly model: string;
	isConfigured(): boolean;
	extract(input: EventOcrImageInput): Promise<EventOcrRawDraft>;
	extractBatch(inputs: EventOcrImageInput[]): Promise<EventOcrRawDraft>;
}
