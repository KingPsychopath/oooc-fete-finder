import {
	isAuthorizedTicketExchangeBotRequest,
	parseTicketExchangeBotLimit,
} from "@/features/ticket-exchange/bot-auth";
import { formatDayWithDate } from "@/features/events/types";
import { getTicketExchangeRepository } from "@/features/ticket-exchange/repository";
import {
	findTicketExchangeEventByKey,
	getTicketExchangeEvents,
} from "@/features/ticket-exchange/service";
import { buildTicketExchangeEventPath } from "@/features/ticket-exchange/urls";
import { NO_STORE_HEADERS } from "@/lib/http/cache-control";
import { NextRequest, NextResponse } from "next/server";

const formatTicketExchangeBotEventDateLabel = (
	event: ReturnType<typeof findTicketExchangeEventByKey>,
): string => {
	if (!event) return "";
	const dateLabel = formatDayWithDate(event.day, event.date);
	const timeLabel = event.time && event.time !== "TBC" ? event.time : "";
	return [dateLabel, timeLabel].filter(Boolean).join(" · ");
};

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
	const [listings, events] = await Promise.all([
		repository.getRecentListingsForBot(limit),
		getTicketExchangeEvents(),
	]);
	return NextResponse.json(
		{
			success: true,
			listings: listings.map((listing) => {
				const event = findTicketExchangeEventByKey(events, listing.eventKey);
				return {
					id: listing.id,
					eventKey: listing.eventKey,
					eventSlug: listing.eventSlug,
					eventName: listing.eventName,
					eventDateLabel: formatTicketExchangeBotEventDateLabel(event),
					listingType: listing.listingType,
					quantityLabel: listing.quantityLabel,
					priceLabel: listing.priceLabel,
					note: listing.note,
					expiresAt: listing.expiresAt,
					createdAt: listing.createdAt,
					url: buildTicketExchangeEventPath(listing),
				};
			}),
		},
		{ headers: NO_STORE_HEADERS },
	);
}
