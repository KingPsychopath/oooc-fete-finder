import { getLiveEvents } from "@/features/data-management/runtime-service";
import { log } from "@/lib/platform/logger";
import { NextResponse } from "next/server";

export const revalidate = 3600;
const EVENTS_API_CACHE_CONTROL =
	"public, max-age=0, s-maxage=60, stale-while-revalidate=300";

export async function GET() {
	const result = await getLiveEvents();

	if (result.error) {
		log.warn("events-api", "Serving live events with data warning", {
			error: result.error,
			source: result.source,
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
