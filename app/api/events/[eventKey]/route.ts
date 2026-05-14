import { NO_STORE_HEADERS } from "@/lib/http/cache-control";
import { log } from "@/lib/platform/logger";
import { getEventShareEvent } from "@/lib/social/event-share-details";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SLOW_EVENT_DETAILS_API_MS = 500;

interface EventDetailsRouteContext {
	params: Promise<{
		eventKey: string;
	}>;
}

export async function GET(
	_request: NextRequest,
	context: EventDetailsRouteContext,
) {
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
				headers: NO_STORE_HEADERS,
			},
		);
	}

	return NextResponse.json(
		{ event },
		{
			headers: NO_STORE_HEADERS,
		},
	);
}
