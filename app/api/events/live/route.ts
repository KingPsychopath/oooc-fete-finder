import { getLiveEvents } from "@/features/data-management/runtime-service";
import { log } from "@/lib/platform/logger";
import { NextResponse } from "next/server";

const EVENTS_API_CACHE_CONTROL =
	"public, max-age=0, s-maxage=60, stale-while-revalidate=300";
const SLOW_EVENTS_API_MS = 750;

export async function GET() {
	const startedAt = Date.now();
	const result = await getLiveEvents();
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
			headers: {
				"Cache-Control": EVENTS_API_CACHE_CONTROL,
			},
		},
	);
}
