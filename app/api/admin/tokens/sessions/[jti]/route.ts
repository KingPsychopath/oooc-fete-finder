import { NextRequest, NextResponse } from "next/server";
import { revokeAdminSessionByJti } from "@/lib/admin/admin-auth-token";
import { validateAdminKeyForApiRoute } from "@/lib/admin/admin-validation";

type RouteContext = {
	params: Promise<{ jti: string }>;
};

export async function DELETE(request: NextRequest, context: RouteContext) {
	if (!(await validateAdminKeyForApiRoute(request))) {
		return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
	}

	const { jti } = await context.params;
	const cleanJti = decodeURIComponent(jti).trim();
	const revoked = await revokeAdminSessionByJti(cleanJti);
	if (!revoked) {
		return NextResponse.json(
			{ success: false, error: "Session not found or invalid jti" },
			{ status: 404 },
		);
	}

	return NextResponse.json({ success: true, jti: cleanJti });
}
