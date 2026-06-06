import {
	USER_AUTH_COOKIE_NAME,
	getCanonicalUserSessionFromCookieHeader,
} from "@/features/auth/user-session-cookie";
import { getUserPolicyRepository } from "@/features/users/policy-repository";
import { NO_STORE_HEADERS } from "@/lib/http/cache-control";
import {
	DEFAULT_JSON_BODY_LIMIT_BYTES,
	forbiddenNoStoreResponse,
	isJsonContentType,
	isSameOriginRequest,
	isWithinBodySizeLimit,
} from "@/lib/http/request-security";
import { NextResponse } from "next/server";
import { z } from "zod";

const noticeReceiptSchema = z.object({
	noticeId: z.string().trim().min(1).max(120),
	action: z.enum(["read", "dismiss", "acknowledge"]),
});

const parseCookieByName = (
	cookieHeader: string | null,
	name: string,
): string | undefined => {
	if (!cookieHeader) return undefined;
	const segments = cookieHeader.split(";");
	for (const segment of segments) {
		const [rawKey, ...rawValueParts] = segment.trim().split("=");
		if (rawKey === name) return rawValueParts.join("=");
	}
	return undefined;
};

const getNoticeIdentity = async (request: Request) => {
	const cookieHeader = request.headers.get("cookie");
	const userCookie = parseCookieByName(cookieHeader, USER_AUTH_COOKIE_NAME);
	const session = await getCanonicalUserSessionFromCookieHeader(userCookie);
	return session.isAuthenticated
		? { userId: session.userId, email: session.email }
		: { userId: null, email: null };
};

export async function GET(request: Request) {
	const repository = getUserPolicyRepository();
	if (!repository) {
		return NextResponse.json(
			{ success: true, notices: [] },
			{ headers: NO_STORE_HEADERS },
		);
	}

	const identity = await getNoticeIdentity(request);
	const notices = await repository.listActivePublicNotices(identity);
	return NextResponse.json(
		{ success: true, notices },
		{ headers: NO_STORE_HEADERS },
	);
}

export async function POST(request: Request) {
	if (!isSameOriginRequest(request)) {
		return forbiddenNoStoreResponse();
	}
	if (!isJsonContentType(request)) {
		return NextResponse.json(
			{ success: false, error: "Unsupported media type" },
			{ status: 415, headers: NO_STORE_HEADERS },
		);
	}
	if (!isWithinBodySizeLimit(request, DEFAULT_JSON_BODY_LIMIT_BYTES)) {
		return NextResponse.json(
			{ success: false, error: "Invalid request" },
			{ status: 413, headers: NO_STORE_HEADERS },
		);
	}

	const repository = getUserPolicyRepository();
	if (!repository) {
		return NextResponse.json(
			{ success: false, error: "Notice storage unavailable" },
			{ status: 503, headers: NO_STORE_HEADERS },
		);
	}

	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return NextResponse.json(
			{ success: false, error: "Invalid JSON" },
			{ status: 400, headers: NO_STORE_HEADERS },
		);
	}

	const parsed = noticeReceiptSchema.safeParse(payload);
	if (!parsed.success) {
		return NextResponse.json(
			{ success: false, error: "Invalid notice receipt" },
			{ status: 400, headers: NO_STORE_HEADERS },
		);
	}

	const identity = await getNoticeIdentity(request);
	if (!identity.userId && !identity.email) {
		return NextResponse.json(
			{ success: true },
			{ status: 202, headers: NO_STORE_HEADERS },
		);
	}

	await repository.markNoticeReceipt({
		noticeId: parsed.data.noticeId,
		action: parsed.data.action,
		userId: identity.userId,
		email: identity.email,
	});
	return NextResponse.json(
		{ success: true },
		{ status: 202, headers: NO_STORE_HEADERS },
	);
}
