import { revokeAllAdminSessions } from "@/features/auth/admin-auth-token";
import { validateAdminKeyForApiRoute } from "@/features/auth/admin-validation";
import { NO_STORE_HEADERS } from "@/lib/http/cache-control";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
	if (!(await validateAdminKeyForApiRoute(request))) {
		return NextResponse.json(
			{ success: false, error: "Unauthorized" },
			{ status: 401, headers: NO_STORE_HEADERS },
		);
	}

	try {
		const nextTokenVersion = await revokeAllAdminSessions();
		return NextResponse.json(
			{
				success: true,
				nextTokenVersion,
				timestamp: new Date().toISOString(),
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
