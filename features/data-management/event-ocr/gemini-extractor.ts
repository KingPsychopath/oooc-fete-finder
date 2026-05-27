import { env } from "@/lib/config/env";
import { normalizeRawOcrDraft } from "./normalizer";
import type {
	EventOcrExtractor,
	EventOcrImageInput,
	EventOcrRawDraft,
} from "./types";

const DEFAULT_GEMINI_OCR_MODEL = "gemini-2.5-flash-lite";
const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_TIMEOUT_MS = 25_000;

type GeminiCandidate = {
	content?: {
		parts?: Array<{
			text?: string;
		}>;
	};
};

type GeminiResponse = {
	candidates?: GeminiCandidate[];
	error?: {
		message?: string;
	};
};

const parseTimeout = (): number => {
	const parsed = Number.parseInt(env.EVENT_OCR_TIMEOUT_MS ?? "", 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
};

const getGeminiApiKey = (): string =>
	(env.EVENT_OCR_API_KEY || env.GEMINI_API_KEY || "").trim();

const buildPrompt = (inputs: EventOcrImageInput[]): string => `
You extract one event draft from the attached screenshot or screenshots for an internal event sheet.

Current date: 2026-05-27.
Primary market: Paris events around Fete de la Musique, but do not invent Paris details.
Images:
${inputs.map((input, index) => `- Image ${index + 1}: id=${input.id}, fileName=${input.fileName}`).join("\n")}

Return JSON only. Do not wrap it in markdown.
Every field must be an object with:
- value: string or null
- evidence: exact short text from the image that supports the value, or null
- confidence: number from 0 to 1
- sourceImageIds: array of image ids that support the value
- sourceFileNames: array of file names that support the value
- alternatives: up to 3 ranked alternative objects with the same value/evidence/confidence/sourceImageIds/sourceFileNames shape

Use null when the image does not explicitly contain the information.
Do not infer sourceConfirmed. Do not invent URLs, venue names, prices, dates, or times.
Dates must be ISO yyyy-mm-dd when the year is explicit or safely implied by the flyer context; otherwise null.
Times must be 24-hour HH:mm when present.
For districtArea use Paris arrondissement number when explicit or clearly present, otherwise the named area if shown.
For setting use Indoor, Outdoor, or Indoor/Outdoor only when visible or strongly implied by text like open air.
When multiple screenshots are supplied, merge them into one event only when they appear to describe the same event. Prefer the value with the strongest direct evidence. Put plausible conflicting values in alternatives and add a warning.
If the images clearly describe different events, return the strongest single event and add a warning that separate extraction is needed.

Return exactly:
{
  "fields": {
    "eventCategory": {"value": null, "evidence": null, "confidence": 0, "sourceImageIds": [], "sourceFileNames": [], "alternatives": []},
    "hostCountry": {"value": null, "evidence": null, "confidence": 0, "sourceImageIds": [], "sourceFileNames": [], "alternatives": []},
    "audienceCountry": {"value": null, "evidence": null, "confidence": 0, "sourceImageIds": [], "sourceFileNames": [], "alternatives": []},
    "title": {"value": null, "evidence": null, "confidence": 0, "sourceImageIds": [], "sourceFileNames": [], "alternatives": []},
    "date": {"value": null, "evidence": null, "confidence": 0, "sourceImageIds": [], "sourceFileNames": [], "alternatives": []},
    "dateTo": {"value": null, "evidence": null, "confidence": 0, "sourceImageIds": [], "sourceFileNames": [], "alternatives": []},
    "startTime": {"value": null, "evidence": null, "confidence": 0, "sourceImageIds": [], "sourceFileNames": [], "alternatives": []},
    "endTime": {"value": null, "evidence": null, "confidence": 0, "sourceImageIds": [], "sourceFileNames": [], "alternatives": []},
    "location": {"value": null, "evidence": null, "confidence": 0, "sourceImageIds": [], "sourceFileNames": [], "alternatives": []},
    "districtArea": {"value": null, "evidence": null, "confidence": 0, "sourceImageIds": [], "sourceFileNames": [], "alternatives": []},
    "categories": {"value": null, "evidence": null, "confidence": 0, "sourceImageIds": [], "sourceFileNames": [], "alternatives": []},
    "tags": {"value": null, "evidence": null, "confidence": 0, "sourceImageIds": [], "sourceFileNames": [], "alternatives": []},
    "price": {"value": null, "evidence": null, "confidence": 0, "sourceImageIds": [], "sourceFileNames": [], "alternatives": []},
    "primaryUrl": {"value": null, "evidence": null, "confidence": 0, "sourceImageIds": [], "sourceFileNames": [], "alternatives": []},
    "ageGuidance": {"value": null, "evidence": null, "confidence": 0, "sourceImageIds": [], "sourceFileNames": [], "alternatives": []},
    "setting": {"value": null, "evidence": null, "confidence": 0, "sourceImageIds": [], "sourceFileNames": [], "alternatives": []},
    "notes": {"value": null, "evidence": null, "confidence": 0, "sourceImageIds": [], "sourceFileNames": [], "alternatives": []}
  },
  "rawText": "",
  "warnings": []
}
`;

const parseJsonResponse = (text: string): unknown => {
	try {
		return JSON.parse(text);
	} catch {
		const match =
			text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/({[\s\S]*})/);
		if (!match?.[1]) throw new Error("OCR model returned invalid JSON");
		return JSON.parse(match[1]);
	}
};

export class GeminiEventOcrExtractor implements EventOcrExtractor {
	readonly provider = "gemini";
	readonly model: string;

	constructor(model = env.EVENT_OCR_MODEL || DEFAULT_GEMINI_OCR_MODEL) {
		this.model = model;
	}

	isConfigured(): boolean {
		return Boolean(getGeminiApiKey());
	}

	async extract(input: EventOcrImageInput): Promise<EventOcrRawDraft> {
		return this.extractBatch([input]);
	}

	async extractBatch(inputs: EventOcrImageInput[]): Promise<EventOcrRawDraft> {
		const apiKey = getGeminiApiKey();
		if (!apiKey) {
			throw new Error(
				"Gemini OCR is not configured. Set EVENT_OCR_API_KEY or GEMINI_API_KEY.",
			);
		}
		if (inputs.length === 0) {
			throw new Error("No images were provided for OCR extraction.");
		}

		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), parseTimeout());
		try {
			const imageParts = inputs.flatMap((input, index) => [
				{ text: `Image ${index + 1}: id=${input.id}, fileName=${input.fileName}` },
				{
					inlineData: {
						mimeType: input.mimeType,
						data: input.base64,
					},
				},
			]);
			const response = await fetch(
				`${GEMINI_API_BASE_URL}/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					signal: controller.signal,
					body: JSON.stringify({
						contents: [
							{
								role: "user",
								parts: [
									{ text: buildPrompt(inputs) },
									...imageParts,
								],
							},
						],
						generationConfig: {
							responseMimeType: "application/json",
							temperature: 0,
							topP: 0.1,
							maxOutputTokens: 4096,
						},
					}),
				},
			);

			const payload = (await response.json()) as GeminiResponse;
			if (!response.ok) {
				throw new Error(
					payload.error?.message ||
						`Gemini OCR request failed (${response.status})`,
				);
			}

			const text = payload.candidates?.[0]?.content?.parts
				?.map((part) => part.text ?? "")
				.join("")
				.trim();
			if (!text) throw new Error("Gemini OCR returned no text");
			return normalizeRawOcrDraft(parseJsonResponse(text));
		} catch (error) {
			if (error instanceof Error && error.name === "AbortError") {
				throw new Error("Gemini OCR request timed out");
			}
			throw error;
		} finally {
			clearTimeout(timeout);
		}
	}
}
