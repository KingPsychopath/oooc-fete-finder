import { recordAdminActivity } from "@/features/admin/activity/record";
import { validateAdminKeyForApiRoute } from "@/features/auth/admin-validation";
import {
	extractCombinedEventOcrDraft,
	extractEventOcrDrafts,
	getEventOcrStatus,
} from "@/features/data-management/event-ocr/service";
import type {
	EventOcrExtractionResult,
	EventOcrImageInput,
	EventOcrUsage,
} from "@/features/data-management/event-ocr/types";
import { NO_STORE_HEADERS } from "@/lib/http/cache-control";
import {
	EVENT_SHEET_OCR_JSON_BODY_LIMIT_BYTES,
	forbiddenNoStoreResponse,
	isSameOriginRequest,
	isWithinBodySizeLimit,
	tooLargeNoStoreResponse,
} from "@/lib/http/request-security";
import { NextRequest, NextResponse } from "next/server";

const MAX_OCR_IMAGES = 6;
const MAX_OCR_IMAGE_BASE64_BYTES = 5 * 1024 * 1024;

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const getAdminCredential = (request: NextRequest): string | null => {
	const direct = request.headers.get("x-admin-key");
	if (direct) return direct;

	const auth = request.headers.get("authorization");
	if (!auth) return null;
	const [scheme, token] = auth.split(" ");
	if (scheme?.toLowerCase() !== "bearer" || !token) return null;
	return token;
};

const isSupportedImageMimeType = (mimeType: string): boolean =>
	["image/png", "image/jpeg", "image/webp"].includes(mimeType);

const sumUsage = (
	results: EventOcrExtractionResult[],
): {
	promptTokenCount: number | null;
	candidatesTokenCount: number | null;
	totalTokenCount: number | null;
	imageBytes: number;
} => {
	const usages = results
		.map((result) => (result.success ? result.draft.usage : null))
		.filter((usage): usage is EventOcrUsage => Boolean(usage));
	const sumNullable = (
		key: "promptTokenCount" | "candidatesTokenCount" | "totalTokenCount",
	): number | null => {
		const values = usages
			.map((usage) => usage[key])
			.filter((value): value is number => typeof value === "number");
		return values.length > 0
			? values.reduce((sum, value) => sum + value, 0)
			: null;
	};
	return {
		promptTokenCount: sumNullable("promptTokenCount"),
		candidatesTokenCount: sumNullable("candidatesTokenCount"),
		totalTokenCount: sumNullable("totalTokenCount"),
		imageBytes: usages.reduce((sum, usage) => sum + usage.imageBytes, 0),
	};
};

const recordOcrUsageActivity = async (input: {
	mode: "combined" | "separate";
	provider: string;
	model: string;
	images: EventOcrImageInput[];
	results: EventOcrExtractionResult[];
}): Promise<void> => {
	const successCount = input.results.filter((result) => result.success).length;
	const failureCount = input.results.length - successCount;
	const usage = sumUsage(input.results);
	await recordAdminActivity({
		action: "event_sheet_ocr_extracted",
		category: "content",
		targetType: "event_sheet_ocr",
		targetLabel: "Event sheet OCR",
		summary: `OCR extracted ${successCount}/${input.results.length} suggestion${input.results.length === 1 ? "" : "s"} from ${input.images.length} image${input.images.length === 1 ? "" : "s"}`,
		metadata: {
			mode: input.mode,
			provider: input.provider,
			model: input.model,
			imageCount: input.images.length,
			resultCount: input.results.length,
			successCount,
			failureCount,
			promptTokenCount: usage.promptTokenCount,
			candidatesTokenCount: usage.candidatesTokenCount,
			totalTokenCount: usage.totalTokenCount,
			imageBytes: usage.imageBytes,
			sourceFileNames: input.images.map((image) => image.fileName),
			errors: input.results
				.filter((result) => !result.success)
				.map((result) => result.error)
				.slice(0, 3),
		},
		href: "/admin/content#event-sheet-editor",
		severity: failureCount > 0 ? "warning" : "info",
	});
};

const parseImage = (value: unknown): EventOcrImageInput | null => {
	if (!isPlainRecord(value)) return null;
	const id = typeof value.id === "string" ? value.id.trim() : "";
	const fileName =
		typeof value.fileName === "string" ? value.fileName.trim() : "";
	const mimeType =
		typeof value.mimeType === "string"
			? value.mimeType.trim().toLowerCase()
			: "";
	const base64 = typeof value.base64 === "string" ? value.base64.trim() : "";
	if (!id || !fileName || !isSupportedImageMimeType(mimeType) || !base64) {
		return null;
	}
	if (base64.length > MAX_OCR_IMAGE_BASE64_BYTES) {
		return null;
	}
	return { id, fileName, mimeType, base64 };
};

export async function GET(request: NextRequest) {
	const credential = getAdminCredential(request);
	if (!(await validateAdminKeyForApiRoute(request, credential))) {
		return NextResponse.json(
			{ success: false, error: "Unauthorized" },
			{ status: 401, headers: NO_STORE_HEADERS },
		);
	}

	return NextResponse.json(
		{
			success: true,
			...getEventOcrStatus(),
			maxImages: MAX_OCR_IMAGES,
			maxImageBytes: MAX_OCR_IMAGE_BASE64_BYTES,
		},
		{ headers: NO_STORE_HEADERS },
	);
}

export async function POST(request: NextRequest) {
	if (!isSameOriginRequest(request)) {
		return forbiddenNoStoreResponse();
	}
	if (!isWithinBodySizeLimit(request, EVENT_SHEET_OCR_JSON_BODY_LIMIT_BYTES)) {
		return tooLargeNoStoreResponse();
	}

	const credential = getAdminCredential(request);
	if (!(await validateAdminKeyForApiRoute(request, credential))) {
		return NextResponse.json(
			{ success: false, error: "Unauthorized" },
			{ status: 401, headers: NO_STORE_HEADERS },
		);
	}

	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return NextResponse.json(
			{ success: false, error: "Invalid JSON payload" },
			{ status: 400, headers: NO_STORE_HEADERS },
		);
	}

	if (!isPlainRecord(payload) || !Array.isArray(payload.images)) {
		return NextResponse.json(
			{ success: false, error: "Invalid OCR payload" },
			{ status: 400, headers: NO_STORE_HEADERS },
		);
	}

	if (payload.images.length === 0 || payload.images.length > MAX_OCR_IMAGES) {
		return NextResponse.json(
			{
				success: false,
				error: `Upload between 1 and ${MAX_OCR_IMAGES} images.`,
			},
			{ status: 400, headers: NO_STORE_HEADERS },
		);
	}

	const images = payload.images.map(parseImage);
	if (images.some((image) => image === null)) {
		return NextResponse.json(
			{
				success: false,
				error:
					"Each image must be PNG, JPEG, or WebP and under the OCR size limit.",
			},
			{ status: 400, headers: NO_STORE_HEADERS },
		);
	}

	const parsedImages = images as EventOcrImageInput[];
	const combineImages = payload.combineImages === true;
	const results = combineImages
		? [await extractCombinedEventOcrDraft(parsedImages)]
		: await extractEventOcrDrafts(parsedImages);
	const status = getEventOcrStatus();
	await recordOcrUsageActivity({
		mode: combineImages ? "combined" : "separate",
		provider: status.provider,
		model: status.model,
		images: parsedImages,
		results,
	});
	return NextResponse.json(
		{
			success: true,
			...status,
			mode: combineImages ? "combined" : "separate",
			results,
		},
		{ headers: NO_STORE_HEADERS },
	);
}
