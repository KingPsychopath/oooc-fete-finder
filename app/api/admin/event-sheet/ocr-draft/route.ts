import { validateAdminKeyForApiRoute } from "@/features/auth/admin-validation";
import {
	extractCombinedEventOcrDraft,
	extractEventOcrDrafts,
	getEventOcrStatus,
} from "@/features/data-management/event-ocr/service";
import type { EventOcrImageInput } from "@/features/data-management/event-ocr/types";
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
	return NextResponse.json(
		{
			success: true,
			...getEventOcrStatus(),
			mode: combineImages ? "combined" : "separate",
			results,
		},
		{ headers: NO_STORE_HEADERS },
	);
}
