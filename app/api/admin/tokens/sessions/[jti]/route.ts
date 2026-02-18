import { revokeAdminSessionByJti } from "@/features/auth/admin-auth-token";
import { validateAdminKeyForApiRoute } from "@/features/auth/admin-validation";
import { NO_STORE_HEADERS } from "@/lib/http/cache-control";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
	params: Promise<{ jti: string }>;
};

export async function DELETE(request: NextRequest, context: RouteContext) {
	if (!(await validateAdminKeyForApiRoute(request))) {
		return NextResponse.json(
			{ success: false, error: "Unauthorized" },
			{ status: 401, headers: NO_STORE_HEADERS },
		);
	}

	const { jti } = await context.params;
	const cleanJti = decodeURIComponent(jti).trim();
	const revoked = await revokeAdminSessionByJti(cleanJti);
	if (!revoked) {
		return NextResponse.json(
			{ success: false, error: "Session not found or invalid jti" },
			{ status: 404, headers: NO_STORE_HEADERS },
		);
	}

	return NextResponse.json(
		{ success: true, jti: cleanJti },
		{ headers: NO_STORE_HEADERS },
	);
}
