import { isAuthorizedTicketExchangeBotRequest } from "@/features/ticket-exchange/bot-auth";
import { getTicketExchangeRepository } from "@/features/ticket-exchange/repository";
import { NO_STORE_HEADERS } from "@/lib/http/cache-control";
import {
	DEFAULT_JSON_BODY_LIMIT_BYTES,
	forbiddenNoStoreResponse,
	isJsonContentType,
	isWithinBodySizeLimit,
	tooLargeNoStoreResponse,
} from "@/lib/http/request-security";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
	if (!isAuthorizedTicketExchangeBotRequest(request)) {
		return forbiddenNoStoreResponse();
	}
	if (!isJsonContentType(request)) {
		return NextResponse.json(
			{ success: false, error: "Expected JSON body" },
			{ status: 415, headers: NO_STORE_HEADERS },
		);
	}
	if (!isWithinBodySizeLimit(request, DEFAULT_JSON_BODY_LIMIT_BYTES)) {
		return tooLargeNoStoreResponse();
	}
	const repository = getTicketExchangeRepository();
	if (!repository) {
		return NextResponse.json(
			{ success: false, error: "Ticket Exchange storage is not configured" },
			{ status: 503, headers: NO_STORE_HEADERS },
		);
	}
	const body = (await request.json()) as { listingId?: string };
	const listingId = body.listingId?.trim();
	if (!listingId || listingId.length > 100) {
		return NextResponse.json(
			{ success: false, error: "Invalid listingId" },
			{ status: 400, headers: NO_STORE_HEADERS },
		);
	}
	await repository.markBotAnnouncement({ listingId });
	return NextResponse.json({ success: true }, { headers: NO_STORE_HEADERS });
}
