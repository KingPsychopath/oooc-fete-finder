import { isAuthorizedTicketExchangeBotRequest } from "@/features/ticket-exchange/bot-auth";
import { getTicketExchangeRepository } from "@/features/ticket-exchange/repository";
import { NO_STORE_HEADERS } from "@/lib/http/cache-control";
import { NextRequest, NextResponse } from "next/server";

type ListingStatusRouteContext = {
	params: Promise<{ listingId: string }>;
};

export async function GET(
	request: NextRequest,
	{ params }: ListingStatusRouteContext,
) {
	if (!isAuthorizedTicketExchangeBotRequest(request)) {
		return NextResponse.json(
			{ success: false, error: "Forbidden" },
			{ status: 403, headers: NO_STORE_HEADERS },
		);
	}
	const rawParams = await params;
	const listingId = rawParams.listingId.trim();
	if (!listingId || listingId.length > 100) {
		return NextResponse.json(
			{ success: false, error: "Invalid listingId" },
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
	const announceable = await repository.isListingAnnounceableForBot({
		listingId,
	});
	return NextResponse.json(
		{ success: true, announceable },
		{ headers: NO_STORE_HEADERS },
	);
}
