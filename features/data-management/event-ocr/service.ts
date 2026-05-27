import { getEventOcrExtractor } from "./extractor-factory";
import { buildEditableRowFromOcrDraft } from "./normalizer";
import type {
	EventOcrDraft,
	EventOcrExtractionResult,
	EventOcrFieldCandidate,
	EventOcrFieldSuggestion,
	EventOcrImageInput,
	EventOcrRawDraft,
} from "./types";

export const getEventOcrStatus = (): {
	provider: string;
	model: string;
	configured: boolean;
	error?: string;
} => {
	try {
		const extractor = getEventOcrExtractor();
		return {
			provider: extractor.provider,
			model: extractor.model,
			configured: extractor.isConfigured(),
		};
	} catch (error) {
		return {
			provider: "unknown",
			model: "unknown",
			configured: false,
			error:
				error instanceof Error ? error.message : "OCR provider unavailable",
		};
	}
};

const normalizeCandidateSources = (
	candidate: EventOcrFieldCandidate,
	sourceImages: EventOcrImageInput[],
): EventOcrFieldCandidate => {
	const sourceById = new Map(
		sourceImages.map((image) => [image.id, image.fileName]),
	);
	const fileNameToId = new Map(
		sourceImages.map((image) => [image.fileName, image.id]),
	);
	const sourceImageIds = [
		...new Set([
			...candidate.sourceImageIds.filter((id) => sourceById.has(id)),
			...candidate.sourceFileNames
				.map((fileName) => fileNameToId.get(fileName))
				.filter((id): id is string => Boolean(id)),
		]),
	];
	return {
		...candidate,
		sourceImageIds,
		sourceFileNames: sourceImageIds.map((id) => sourceById.get(id) ?? id),
	};
};

const normalizeFieldSources = (
	field: EventOcrFieldSuggestion,
	sourceImages: EventOcrImageInput[],
): EventOcrFieldSuggestion => ({
	...normalizeCandidateSources(field, sourceImages),
	alternatives: field.alternatives.map((candidate) =>
		normalizeCandidateSources(candidate, sourceImages),
	),
});

const normalizeDraftSources = (
	draft: EventOcrRawDraft,
	sourceImages: EventOcrImageInput[],
): EventOcrRawDraft => ({
	...draft,
	fields: Object.fromEntries(
		Object.entries(draft.fields).map(([fieldKey, field]) => [
			fieldKey,
			normalizeFieldSources(field, sourceImages),
		]),
	) as EventOcrRawDraft["fields"],
});

export const extractEventOcrDrafts = async (
	images: EventOcrImageInput[],
): Promise<EventOcrExtractionResult[]> => {
	let extractor;
	try {
		extractor = getEventOcrExtractor();
	} catch (error) {
		return images.map((image) => ({
			success: false,
			id: image.id,
			fileName: image.fileName,
			error:
				error instanceof Error ? error.message : "OCR provider unavailable",
		}));
	}

	if (!extractor.isConfigured()) {
		return images.map((image) => ({
			success: false,
			id: image.id,
			fileName: image.fileName,
			provider: extractor.provider,
			model: extractor.model,
			error: "OCR is not configured. Set EVENT_OCR_API_KEY or GEMINI_API_KEY.",
		}));
	}

	const results: EventOcrExtractionResult[] = [];
	for (const image of images) {
		try {
			const rawDraft = normalizeDraftSources(
				await extractor.extractBatch([image]),
				[image],
			);
			const normalized = buildEditableRowFromOcrDraft(rawDraft);
			results.push({
				success: true,
				draft: {
					...rawDraft,
					id: image.id,
					fileName: image.fileName,
					sourceImages: [{ id: image.id, fileName: image.fileName }],
					provider: extractor.provider,
					model: extractor.model,
					row: normalized.row,
					missingRequiredFields: normalized.missingRequiredFields,
					averageConfidence: normalized.averageConfidence,
				},
			});
		} catch (error) {
			results.push({
				success: false,
				id: image.id,
				fileName: image.fileName,
				provider: extractor.provider,
				model: extractor.model,
				error: error instanceof Error ? error.message : "OCR extraction failed",
			});
		}
	}
	return results;
};

export const extractCombinedEventOcrDraft = async (
	images: EventOcrImageInput[],
): Promise<EventOcrExtractionResult> => {
	const id = `combined_${images.map((image) => image.id).join("_")}`;
	const fileName =
		images.length === 1
			? images[0]?.fileName || "Combined event"
			: "Combined event";
	let extractor;
	try {
		extractor = getEventOcrExtractor();
	} catch (error) {
		return {
			success: false,
			id,
			fileName,
			error:
				error instanceof Error ? error.message : "OCR provider unavailable",
		};
	}

	if (!extractor.isConfigured()) {
		return {
			success: false,
			id,
			fileName,
			provider: extractor.provider,
			model: extractor.model,
			error: "OCR is not configured. Set EVENT_OCR_API_KEY or GEMINI_API_KEY.",
		};
	}

	try {
		const rawDraft = normalizeDraftSources(
			await extractor.extractBatch(images),
			images,
		);
		const normalized = buildEditableRowFromOcrDraft(rawDraft);
		const draft: EventOcrDraft = {
			...rawDraft,
			id,
			fileName,
			sourceImages: images.map((image) => ({
				id: image.id,
				fileName: image.fileName,
			})),
			provider: extractor.provider,
			model: extractor.model,
			row: normalized.row,
			missingRequiredFields: normalized.missingRequiredFields,
			averageConfidence: normalized.averageConfidence,
		};
		return { success: true, draft };
	} catch (error) {
		return {
			success: false,
			id,
			fileName,
			provider: extractor.provider,
			model: extractor.model,
			error: error instanceof Error ? error.message : "OCR extraction failed",
		};
	}
};
