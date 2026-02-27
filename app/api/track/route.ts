import {
	USER_AUTH_COOKIE_NAME,
	getUserSessionFromCookieHeader,
} from "@/features/auth/user-session-cookie";
import { getLiveEvents } from "@/features/data-management/runtime-service";
import {
	EVENT_ENGAGEMENT_ACTIONS,
	type EventEngagementAction,
} from "@/features/events/engagement/types";
import {
	checkTrackEventIpLimit,
	checkTrackEventSessionLimit,
	extractClientIpFromHeaders,
} from "@/features/security/rate-limiter";
import { NO_STORE_HEADERS } from "@/lib/http/cache-control";
import { log } from "@/lib/platform/logger";
import { getEventEngagementRepository } from "@/lib/platform/postgres/event-engagement-repository";
import { NextResponse } from "next/server";
import { z } from "zod";

const trackPayloadSchema = z.object({
	eventKey: z.string().trim().min(1).max(220),
	actionType: z.enum(EVENT_ENGAGEMENT_ACTIONS),
	sessionId: z.string().trim().max(120).optional(),
	source: z.string().trim().max(80).optional(),
	path: z.string().trim().max(280).optional(),
});

export const runtime = "nodejs";

const accepted = () =>
	NextResponse.json(
		{ success: true },
		{ status: 202, headers: NO_STORE_HEADERS },
	);

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

let eventKeyCache: {
	expiresAtMs: number;
	keys: Set<string>;
} | null = null;

const EVENT_KEY_CACHE_TTL_MS = 5 * 60 * 1000;

const getKnownEventKeys = async (): Promise<Set<string> | null> => {
	const nowMs = Date.now();
	if (eventKeyCache && eventKeyCache.expiresAtMs > nowMs) {
		return eventKeyCache.keys;
	}

	const eventsResult = await getLiveEvents({
		includeFeaturedProjection: false,
		includeEngagementProjection: false,
	});
	if (!eventsResult.success) {
		return null;
	}

	const keys = new Set(
		eventsResult.data.map((event) => event.eventKey.toLowerCase()),
	);
	eventKeyCache = {
		expiresAtMs: nowMs + EVENT_KEY_CACHE_TTL_MS,
		keys,
	};
	return keys;
};

export async function POST(request: Request) {
	const repository = getEventEngagementRepository();
	if (!repository) {
		return accepted();
	}

	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return accepted();
	}

	const parsed = trackPayloadSchema.safeParse(payload);
	if (!parsed.success) {
		return accepted();
	}

	const body = parsed.data;
	const eventKey = body.eventKey.toLowerCase();
	const knownEventKeys = await getKnownEventKeys();
	if (!knownEventKeys || !knownEventKeys.has(eventKey)) {
		return accepted();
	}

	const clientIp = extractClientIpFromHeaders(request.headers);
	const ipDecision = await checkTrackEventIpLimit(clientIp);
	if (ipDecision.reason === "limiter_unavailable") {
		return accepted();
	}
	if (!ipDecision.allowed) {
		return accepted();
	}

	if (body.sessionId) {
		const sessionDecision = await checkTrackEventSessionLimit(body.sessionId);
		if (sessionDecision.reason === "limiter_unavailable") {
			return accepted();
		}
		if (!sessionDecision.allowed) {
			return accepted();
		}
	}

	const cookieHeader = request.headers.get("cookie");
	const userCookie = parseCookieByName(cookieHeader, USER_AUTH_COOKIE_NAME);
	const userSession = getUserSessionFromCookieHeader(userCookie);

	try {
		await repository.recordEventAction({
			eventKey,
			actionType: body.actionType as EventEngagementAction,
			sessionId: body.sessionId ?? null,
			source: body.source ?? null,
			path: body.path ?? null,
			isAuthenticated: userSession.isAuthenticated,
		});
	} catch (error) {
		log.warn("events.track", "Failed to record event engagement", {
			eventKey,
			actionType: body.actionType,
			error: error instanceof Error ? error.message : "unknown",
		});
	}

	return accepted();
}
