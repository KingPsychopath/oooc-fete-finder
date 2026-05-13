import { getLiveEvents } from "@/features/data-management/runtime-service";
import { NO_STORE_HEADERS } from "@/lib/http/cache-control";
import { log } from "@/lib/platform/logger";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SLOW_EVENTS_API_MS = 750;

export async function GET() {
	const startedAt = Date.now();
	const result = await getLiveEvents({
		includeEngagementProjection: false,
		bypassSourceCache: true,
	});
	const durationMs = Date.now() - startedAt;

	if (result.error) {
		log.warn("events-api", "Serving live events with data warning", {
			error: result.error,
			source: result.source,
		});
	}
	if (durationMs >= SLOW_EVENTS_API_MS) {
		log.warn("events-api", "Slow live events response", {
			durationMs,
			count: result.data.length,
			source: result.source,
			success: result.success,
		});
	}

	return NextResponse.json(
		{
			events: result.data,
			count: result.data.length,
			source: result.source,
		},
		{
			headers: NO_STORE_HEADERS,
		},
	);
}
