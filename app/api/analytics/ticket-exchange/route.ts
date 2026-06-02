import { touchAuthenticatedUserContext } from "@/features/auth/user-context-touch";
import {
	USER_AUTH_COOKIE_NAME,
	getCanonicalUserSessionFromCookieHeader,
} from "@/features/auth/user-session-cookie";
import {
	TICKET_EXCHANGE_ANALYTICS_ACTIONS,
	TICKET_EXCHANGE_ANALYTICS_SURFACES,
} from "@/features/ticket-exchange/analytics-events";
import {
	checkTrackDiscoveryIpLimit,
	checkTrackDiscoverySessionLimit,
	extractClientIpFromHeaders,
} from "@/features/security/rate-limiter";
import {
	TRACKING_JSON_BODY_LIMIT_BYTES,
	acceptedNoStoreResponse,
	isJsonContentType,
	isSameOriginRequest,
	isWithinBodySizeLimit,
} from "@/lib/http/request-security";
import { log } from "@/lib/platform/logger";
import { getTicketExchangeAnalyticsRepository } from "@/lib/platform/postgres/ticket-exchange-analytics-repository";
import { z } from "zod";

const recordedAtSchema = z
	.string()
	.trim()
	.max(80)
	.refine((value) => !Number.isNaN(Date.parse(value)), "Invalid timestamp")
	.optional();

const ticketExchangeAnalyticsSchema = z.object({
	actionType: z.enum(TICKET_EXCHANGE_ANALYTICS_ACTIONS),
	sessionId: z.string().trim().max(120).optional(),
	eventKey: z.string().trim().max(220).optional(),
	listingId: z.string().trim().max(120).optional(),
	listingType: z.enum(["selling", "looking"]).optional(),
	listingStatus: z
		.enum(["active", "paused", "resolved", "expired", "removed"])
		.optional(),
	surface: z.enum(TICKET_EXCHANGE_ANALYTICS_SURFACES).optional(),
	detail: z.string().trim().max(160).optional(),
	path: z.string().trim().max(280).optional(),
	recordedAt: recordedAtSchema,
	clientContext: z
		.object({
			deviceClass: z.string().trim().max(40).nullable().optional(),
			platform: z.string().trim().max(40).nullable().optional(),
			browserFamily: z.string().trim().max(40).nullable().optional(),
			timezone: z.string().trim().max(80).nullable().optional(),
			locale: z.string().trim().max(40).nullable().optional(),
		})
		.optional(),
});

const ticketExchangeAnalyticsBatchSchema = z.object({
	events: z.array(ticketExchangeAnalyticsSchema).min(1).max(25),
});

export const runtime = "nodejs";

const accepted = acceptedNoStoreResponse;

const parseCookieByName = (
	cookieHeader: string | null,
	name: string,
): string | undefined => {
	if (!cookieHeader) return undefined;
	const segments = cookieHeader.split(";");
	for (const segment of segments) {
		const [rawKey, ...rawValueParts] = segment.trim().split("=");
		if (rawKey === name) {
			return rawValueParts.join("=");
		}
	}
	return undefined;
};

const isExchangePath = (path: string | undefined): boolean => {
	const value = (path ?? "").trim();
	return value === "/exchange" || value.startsWith("/exchange/");
};

export async function POST(request: Request) {
	if (!isSameOriginRequest(request)) {
		return accepted();
	}
	if (!isJsonContentType(request)) {
		return accepted();
	}
	if (!isWithinBodySizeLimit(request, TRACKING_JSON_BODY_LIMIT_BYTES)) {
		return accepted();
	}

	const repository = getTicketExchangeAnalyticsRepository();
	if (!repository) {
		return accepted();
	}

	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return accepted();
	}

	const parsed = ticketExchangeAnalyticsSchema.safeParse(payload);
	const parsedBatch = ticketExchangeAnalyticsBatchSchema.safeParse(payload);
	if (!parsed.success && !parsedBatch.success) {
		return accepted();
	}
	const events = parsed.success
		? [parsed.data]
		: parsedBatch.success
			? parsedBatch.data.events
			: [];
	const validEvents = events.filter((event) => isExchangePath(event.path));
	if (validEvents.length === 0) {
		return accepted();
	}

	const clientIp = extractClientIpFromHeaders(request.headers);
	const ipDecision = await checkTrackDiscoveryIpLimit(clientIp);
	if (ipDecision.reason === "limiter_unavailable" || !ipDecision.allowed) {
		return accepted();
	}

	const sessionIds = Array.from(
		new Set(
			validEvents
				.map((event) => event.sessionId?.trim())
				.filter((sessionId): sessionId is string => Boolean(sessionId)),
		),
	);
	for (const sessionId of sessionIds) {
		const sessionDecision = await checkTrackDiscoverySessionLimit(sessionId);
		if (
			sessionDecision.reason === "limiter_unavailable" ||
			!sessionDecision.allowed
		) {
			return accepted();
		}
	}

	const cookieHeader = request.headers.get("cookie");
	const userCookie = parseCookieByName(cookieHeader, USER_AUTH_COOKIE_NAME);
	const userSession = await getCanonicalUserSessionFromCookieHeader(userCookie);

	try {
		for (const body of validEvents) {
			await repository.recordAction({
				actionType: body.actionType,
				sessionId: body.sessionId ?? null,
				userId: userSession.userId,
				userEmail: userSession.userId ? userSession.email : null,
				eventKey: body.eventKey ?? null,
				listingId: body.listingId ?? null,
				listingType: body.listingType ?? null,
				listingStatus: body.listingStatus ?? null,
				surface: body.surface ?? null,
				detail: body.detail ?? null,
				path: body.path ?? null,
				isAuthenticated: userSession.isAuthenticated,
				deviceClass: body.clientContext?.deviceClass ?? null,
				platform: body.clientContext?.platform ?? null,
				browserFamily: body.clientContext?.browserFamily ?? null,
				timezone: body.clientContext?.timezone ?? null,
				locale: body.clientContext?.locale ?? null,
				recordedAt: body.recordedAt,
			});
		}
		if (userSession.isAuthenticated && validEvents.length > 0) {
			const latestContext = validEvents[validEvents.length - 1]?.clientContext;
			await touchAuthenticatedUserContext({
				userId: userSession.userId,
				email: userSession.email,
				clientContext: {
					deviceClass: latestContext?.deviceClass ?? null,
					platform: latestContext?.platform ?? null,
					browserFamily: latestContext?.browserFamily ?? null,
					timezone: latestContext?.timezone ?? null,
					locale: latestContext?.locale ?? null,
				},
			});
		}
	} catch (error) {
		log.warn("analytics", "Failed to record ticket exchange analytics", {
			error: error instanceof Error ? error.message : String(error),
		});
	}

	return accepted();
}
