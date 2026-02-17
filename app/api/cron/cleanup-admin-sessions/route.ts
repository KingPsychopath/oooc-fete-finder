import { NextRequest, NextResponse } from "next/server";
import { cleanupExpiredAdminSessions } from "@/features/auth/admin-auth-token";

/**
 * Cron endpoint: delete admin session records that expired more than 7 days ago.
 * Secure with CRON_SECRET (Vercel sends Authorization: Bearer <CRON_SECRET>).
 */
export async function GET(request: NextRequest) {
	const secret = process.env.CRON_SECRET?.trim();
	const auth = request.headers.get("authorization");
	const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";

	if (!secret || token !== secret) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const deleted = await cleanupExpiredAdminSessions();
		return NextResponse.json({ ok: true, deleted });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		return NextResponse.json({ ok: false, error: message }, { status: 500 });
	}
}
