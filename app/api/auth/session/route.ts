import { verifyAdminSessionFromRequest } from "@/features/auth/admin-auth-token";
import {
	USER_AUTH_COOKIE_NAME,
	getUserAuthCookieOptions,
	getUserSessionFromCookieHeader,
} from "@/features/auth/user-session-cookie";
import { NO_STORE_HEADERS } from "@/lib/http/cache-control";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
	const [session, adminSession] = await Promise.all([
		Promise.resolve(
			getUserSessionFromCookieHeader(
				request.cookies.get(USER_AUTH_COOKIE_NAME)?.value,
			),
		),
		verifyAdminSessionFromRequest(request),
	]);

	return NextResponse.json(
		{
			success: true,
			isAuthenticated: session.isAuthenticated,
			isAdminAuthenticated: Boolean(adminSession),
			email: session.email,
		},
		{
			headers: NO_STORE_HEADERS,
		},
	);
}

export async function DELETE() {
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
