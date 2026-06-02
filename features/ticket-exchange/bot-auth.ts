import "server-only";

import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/config/env";
import type { NextRequest } from "next/server";

const safeEqual = (left: string, right: string): boolean => {
	const leftBuffer = Buffer.from(left);
	const rightBuffer = Buffer.from(right);
	if (leftBuffer.length !== rightBuffer.length) return false;
	return timingSafeEqual(leftBuffer, rightBuffer);
};

export const isAuthorizedTicketExchangeBotRequest = (
	request: NextRequest,
): boolean => {
	const secret = env.TICKET_EXCHANGE_BOT_SECRET?.trim();
	if (!secret) return false;
	const headerSecret =
		request.headers.get("x-ticket-exchange-bot-secret")?.trim() ||
		request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
		"";
	return safeEqual(headerSecret, secret);
};

export const parseTicketExchangeBotLimit = (
	value: string | null,
	fallback = 10,
): number => {
	const parsed = Number.parseInt(value ?? `${fallback}`, 10);
	if (!Number.isFinite(parsed)) return fallback;
	return Math.min(20, Math.max(1, parsed));
};
