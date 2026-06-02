import { getTicketExchangeRepository } from "@/features/ticket-exchange/repository";
import { NO_STORE_HEADERS } from "@/lib/http/cache-control";
import { NextRequest, NextResponse } from "next/server";

type SummaryRouteContext = {
	params: Promise<{ eventKey: string }>;
};

export async function GET(
	_request: NextRequest,
	{ params }: SummaryRouteContext,
) {
	const rawParams = await params;
	const eventKey = rawParams.eventKey.trim();
	if (!eventKey || eventKey.length > 160) {
		return NextResponse.json(
			{ success: false, error: "Invalid event key" },
			{ status: 400, headers: NO_STORE_HEADERS },
		);
	}
	const repository = getTicketExchangeRepository();
	if (!repository) {
		return NextResponse.json(
			{ success: false, error: "Ticket Exchange storage is not configured" },
			{ status: 503, headers: NO_STORE_HEADERS },
		);
	}
	const summaries = await repository.getSummaries([eventKey]);
	return NextResponse.json(
		{
			success: true,
			summary: summaries[0] ?? {
				eventKey,
				sellingCount: 0,
				lookingCount: 0,
				latestListingAt: null,
			},
		},
		{ headers: NO_STORE_HEADERS },
	);
}
