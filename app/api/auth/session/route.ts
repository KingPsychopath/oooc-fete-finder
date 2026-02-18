import { verifyAdminSessionFromRequest } from "@/features/auth/admin-auth-token";
import {
	USER_AUTH_COOKIE_NAME,
	getUserAuthCookieOptions,
	getUserSessionFromCookieHeader,
} from "@/features/auth/user-session-cookie";
import { NextRequest, NextResponse } from "next/server";

const NO_STORE_HEADERS = {
	"Cache-Control":
		"private, no-store, no-cache, max-age=0, must-revalidate, proxy-revalidate",
	Pragma: "no-cache",
	Expires: "0",
} as const;

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
