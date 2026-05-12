import { getEventShareEvent } from "@/lib/social/event-share-details";
import { log } from "@/lib/platform/logger";
import { NextResponse, type NextRequest } from "next/server";

const EVENT_DETAILS_CACHE_CONTROL =
	"public, max-age=0, s-maxage=3600, stale-while-revalidate=86400";
const EVENT_NOT_FOUND_CACHE_CONTROL =
	"public, max-age=0, s-maxage=3600, stale-while-revalidate=86400";
const SLOW_EVENT_DETAILS_API_MS = 500;

interface EventDetailsRouteContext {
	params: Promise<{
		eventKey: string;
	}>;
}

export async function GET(_request: NextRequest, context: EventDetailsRouteContext) {
	const startedAt = Date.now();
	const { eventKey } = await context.params;
	const event = await getEventShareEvent(eventKey);
	const durationMs = Date.now() - startedAt;
	if (durationMs >= SLOW_EVENT_DETAILS_API_MS) {
		log.warn("events-api", "Slow event detail response", {
			durationMs,
			eventKey,
			found: Boolean(event),
		});
	}

	if (!event) {
		return NextResponse.json(
			{ error: "Event not found" },
			{
				status: 404,
				headers: {
					"Cache-Control": EVENT_NOT_FOUND_CACHE_CONTROL,
				},
			},
		);
	}

	return NextResponse.json(
		{ event },
		{
			headers: {
				"Cache-Control": EVENT_DETAILS_CACHE_CONTROL,
			},
		},
	);
}
