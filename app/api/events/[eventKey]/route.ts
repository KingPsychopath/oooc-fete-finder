import { getEventShareEvent } from "@/lib/social/event-share-details";
import { NextResponse, type NextRequest } from "next/server";

export const revalidate = 3600;
const EVENT_DETAILS_CACHE_CONTROL =
	"public, max-age=0, s-maxage=60, stale-while-revalidate=300";
const EVENT_NOT_FOUND_CACHE_CONTROL =
	"public, max-age=0, s-maxage=60, stale-while-revalidate=300";

interface EventDetailsRouteContext {
	params: Promise<{
		eventKey: string;
	}>;
}

export async function GET(_request: NextRequest, context: EventDetailsRouteContext) {
	const { eventKey } = await context.params;
	const event = await getEventShareEvent(eventKey);

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
