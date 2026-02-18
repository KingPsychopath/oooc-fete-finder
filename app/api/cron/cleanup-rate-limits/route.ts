import { cleanupAuthVerifyRateLimits } from "@/features/security/rate-limiter";
import { NO_STORE_HEADERS } from "@/lib/http/cache-control";
import { NextRequest, NextResponse } from "next/server";

/**
 * Cron endpoint: delete stale auth verify rate limit counters.
 * Secure with CRON_SECRET (Vercel sends Authorization: Bearer <CRON_SECRET>).
 */
export async function GET(request: NextRequest) {
	const secret = process.env.CRON_SECRET?.trim();
	const auth = request.headers.get("authorization");
	const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";

	if (!secret || token !== secret) {
		return NextResponse.json(
			{ error: "Unauthorized" },
			{ status: 401, headers: NO_STORE_HEADERS },
		);
	}

	try {
		const deleted = await cleanupAuthVerifyRateLimits();
		return NextResponse.json(
			{ ok: true, deleted },
			{ headers: NO_STORE_HEADERS },
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		return NextResponse.json(
			{ ok: false, error: message },
			{ status: 500, headers: NO_STORE_HEADERS },
		);
	}
}
