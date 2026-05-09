import { getLiveEvents } from "@/features/data-management/runtime-service";
import { log } from "@/lib/platform/logger";
import { NextResponse } from "next/server";

export const revalidate = 3600;

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
				"Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
			},
		},
	);
}
