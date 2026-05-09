import { getEventShareEvent } from "@/lib/social/event-share-details";
import { NextResponse, type NextRequest } from "next/server";

export const revalidate = 3600;

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
					"Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
				},
			},
		);
	}

	return NextResponse.json(
		{ event },
		{
			headers: {
				"Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
			},
		},
	);
}
