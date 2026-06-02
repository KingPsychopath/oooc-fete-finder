import {
	isAuthorizedTicketExchangeBotRequest,
	parseTicketExchangeBotLimit,
} from "@/features/ticket-exchange/bot-auth";
import { getTicketExchangeRepository } from "@/features/ticket-exchange/repository";
import { NO_STORE_HEADERS } from "@/lib/http/cache-control";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
	if (!isAuthorizedTicketExchangeBotRequest(request)) {
		return NextResponse.json(
			{ success: false, error: "Forbidden" },
			{ status: 403, headers: NO_STORE_HEADERS },
		);
	}
	const repository = getTicketExchangeRepository();
	if (!repository) {
		return NextResponse.json(
			{ success: false, error: "Ticket Exchange storage is not configured" },
			{ status: 503, headers: NO_STORE_HEADERS },
		);
	}
	const limit = parseTicketExchangeBotLimit(
		request.nextUrl.searchParams.get("limit"),
	);
	const listings = await repository.getRecentListingsForBot(limit);
	return NextResponse.json(
		{
			success: true,
			listings: listings.map((listing) => ({
				id: listing.id,
				eventKey: listing.eventKey,
				eventSlug: listing.eventSlug,
				eventName: listing.eventName,
				listingType: listing.listingType,
				quantityLabel: listing.quantityLabel,
				priceLabel: listing.priceLabel,
				note: listing.note,
				expiresAt: listing.expiresAt,
				createdAt: listing.createdAt,
				url: `/tickets/${listing.eventSlug}`,
			})),
		},
		{ headers: NO_STORE_HEADERS },
	);
}
