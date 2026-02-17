import { NextRequest, NextResponse } from "next/server";
import {
	USER_AUTH_COOKIE_NAME,
	getUserAuthCookieOptions,
	getUserSessionFromCookieHeader,
} from "@/features/auth/user-session-cookie";

export async function GET(request: NextRequest) {
	const session = getUserSessionFromCookieHeader(
		request.cookies.get(USER_AUTH_COOKIE_NAME)?.value,
	);
	return NextResponse.json({
		success: true,
		isAuthenticated: session.isAuthenticated,
		email: session.email,
	});
}

export async function DELETE() {
	const response = NextResponse.json({ success: true });
	response.cookies.set(USER_AUTH_COOKIE_NAME, "", {
		...getUserAuthCookieOptions(),
		maxAge: 0,
	});
	return response;
}
