import {
	getCurrentTokenVersion,
	listAdminTokenSessions,
} from "@/features/auth/admin-auth-token";
import { validateAdminKeyForApiRoute } from "@/features/auth/admin-validation";
import { NO_STORE_HEADERS } from "@/lib/http/cache-control";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
	if (!(await validateAdminKeyForApiRoute(request))) {
		return NextResponse.json(
			{ success: false, error: "Unauthorized" },
			{ status: 401, headers: NO_STORE_HEADERS },
		);
	}

	try {
		const [sessions, currentTokenVersion] = await Promise.all([
			listAdminTokenSessions(),
			getCurrentTokenVersion(),
		]);

		return NextResponse.json(
			{
				success: true,
				count: sessions.length,
				sessions,
				currentTokenVersion,
				now: Math.floor(Date.now() / 1000),
			},
			{ headers: NO_STORE_HEADERS },
		);
	} catch (error) {
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500, headers: NO_STORE_HEADERS },
		);
	}
}
