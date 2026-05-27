import { env } from "@/lib/config/env";
import { GeminiEventOcrExtractor } from "./gemini-extractor";
import type { EventOcrExtractor } from "./types";

export const getEventOcrExtractor = (): EventOcrExtractor => {
	const provider = (env.EVENT_OCR_PROVIDER || "gemini").trim().toLowerCase();
	if (provider === "gemini") {
		return new GeminiEventOcrExtractor();
	}
	throw new Error(
		`Unsupported EVENT_OCR_PROVIDER "${provider}". Supported provider: gemini.`,
	);
};
