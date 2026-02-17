import { NextRequest, NextResponse } from "next/server";
import { validateAdminKeyForApiRoute } from "@/features/auth/admin-validation";
import {
	getCurrentTokenVersion,
	listAdminTokenSessions,
} from "@/features/auth/admin-auth-token";

export async function GET(request: NextRequest) {
	if (!(await validateAdminKeyForApiRoute(request))) {
		return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
	}

	try {
		const [sessions, currentTokenVersion] = await Promise.all([
			listAdminTokenSessions(),
			getCurrentTokenVersion(),
		]);

		return NextResponse.json({
			success: true,
			count: sessions.length,
			sessions,
			currentTokenVersion,
			now: Math.floor(Date.now() / 1000),
		});
	} catch (error) {
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
