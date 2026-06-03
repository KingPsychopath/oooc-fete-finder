import { verifyAdminSessionFromRequest } from "@/features/auth/admin-auth-token";
import {
	USER_AUTH_COOKIE_NAME,
	getCanonicalUserSessionFromCookieHeader,
	getUserAuthCookieOptions,
} from "@/features/auth/user-session-cookie";
import { NO_STORE_HEADERS } from "@/lib/http/cache-control";
import {
	forbiddenNoStoreResponse,
	isSameOriginRequest,
} from "@/lib/http/request-security";
import { log } from "@/lib/platform/logger";
import { getUserRepository } from "@/lib/platform/postgres/user-repository";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
	const [session, adminSession] = await Promise.all([
		getCanonicalUserSessionFromCookieHeader(
			request.cookies.get(USER_AUTH_COOKIE_NAME)?.value,
		),
		verifyAdminSessionFromRequest(request),
	]);
	if (session.isAuthenticated) {
		try {
			await getUserRepository()?.touchContext({
				userId: session.userId,
				email: session.email,
			});
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Unknown last-seen touch error";
			log.warn("auth-session", "Failed to update user last-seen timestamp", {
				message,
			});
		}
	}

	return NextResponse.json(
		{
			success: true,
			isAuthenticated: session.isAuthenticated,
			isAdminAuthenticated: Boolean(adminSession),
			email: session.email,
			userId: session.userId,
		},
		{
			headers: NO_STORE_HEADERS,
		},
	);
}

export async function DELETE(request?: NextRequest) {
	if (request && !isSameOriginRequest(request)) {
		return forbiddenNoStoreResponse();
	}

	const response = NextResponse.json(
		{ success: true },
		{
			headers: NO_STORE_HEADERS,
		},
	);
	response.cookies.set(USER_AUTH_COOKIE_NAME, "", {
		...getUserAuthCookieOptions(),
		maxAge: 0,
	});
	return response;
}
