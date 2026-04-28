import { NO_STORE_HEADERS } from "@/lib/http/cache-control";
import { getPartnerActivationRepository } from "@/lib/platform/postgres/partner-activation-repository";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Cron endpoint: delete old dismissed internal partner reports.
 * Paid order records are retained unless an admin removes that behavior later.
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
		const repository = getPartnerActivationRepository();
		if (!repository) {
			return NextResponse.json(
				{ ok: false, error: "Postgres not configured" },
				{ status: 503, headers: NO_STORE_HEADERS },
			);
		}
		const deleted = await repository.cleanupDismissedInternalReports({
			olderThanDays: 90,
		});
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
