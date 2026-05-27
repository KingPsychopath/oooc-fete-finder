import { NextResponse } from "next/server";
import { NO_STORE_HEADERS } from "./cache-control";

export const DEFAULT_JSON_BODY_LIMIT_BYTES = 32 * 1024;
export const EVENT_SUBMISSION_JSON_BODY_LIMIT_BYTES = 64 * 1024;
export const EVENT_SHEET_JSON_BODY_LIMIT_BYTES = 256 * 1024;
export const EVENT_SHEET_OCR_JSON_BODY_LIMIT_BYTES = 16 * 1024 * 1024;
export const TRACKING_JSON_BODY_LIMIT_BYTES = 16 * 1024;

const getHeaderHost = (headers: Pick<Headers, "get">): string =>
	(headers.get("x-forwarded-host") || headers.get("host") || "")
		.trim()
		.toLowerCase();

const getRequestProtocol = (request: Request): string => {
	const protocol = (
		request.headers.get("x-forwarded-proto") ||
		request.headers.get("x-forwarded-protocol") ||
		new URL(request.url).protocol.replace(":", "")
	)
		.split(",")[0]
		?.trim()
		.toLowerCase();
	return protocol === "http" ? "http" : "https";
};

export const isSameOriginRequest = (request: Request): boolean => {
	const secFetchSite = request.headers
		.get("sec-fetch-site")
		?.trim()
		.toLowerCase();
	if (secFetchSite === "cross-site") return false;

	const origin = request.headers.get("origin")?.trim();
	if (!origin) return true;

	const host = getHeaderHost(request.headers);
	if (!host) return false;

	try {
		const parsedOrigin = new URL(origin);
		return (
			parsedOrigin.host.toLowerCase() === host &&
			parsedOrigin.protocol.replace(":", "") === getRequestProtocol(request)
		);
	} catch {
		return false;
	}
};

export const isJsonContentType = (request: Request): boolean => {
	const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
	return contentType.includes("application/json");
};

export const isWithinBodySizeLimit = (
	request: Request,
	limitBytes: number,
): boolean => {
	const contentLength = request.headers.get("content-length");
	if (!contentLength) return true;
	const parsedLength = Number.parseInt(contentLength, 10);
	return Number.isFinite(parsedLength) && parsedLength <= limitBytes;
};

export const acceptedNoStoreResponse = (): NextResponse =>
	NextResponse.json(
		{ success: true },
		{ status: 202, headers: NO_STORE_HEADERS },
	);

export const forbiddenNoStoreResponse = (): NextResponse =>
	NextResponse.json(
		{ success: false, error: "Forbidden" },
		{ status: 403, headers: NO_STORE_HEADERS },
	);

export const tooLargeNoStoreResponse = (): NextResponse =>
	NextResponse.json(
		{ success: false, error: "Request body too large" },
		{ status: 413, headers: NO_STORE_HEADERS },
	);
