import { NextRequest, NextResponse } from "next/server";
import { revokeAllAdminSessions } from "@/features/auth/admin-auth-token";
import { validateAdminKeyForApiRoute } from "@/features/auth/admin-validation";

export async function POST(request: NextRequest) {
	if (!(await validateAdminKeyForApiRoute(request))) {
		return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
	}

	try {
		const nextTokenVersion = await revokeAllAdminSessions();
		return NextResponse.json({
			success: true,
			nextTokenVersion,
			timestamp: new Date().toISOString(),
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
