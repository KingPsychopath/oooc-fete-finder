import { touchAuthenticatedUserContext } from "@/features/auth/user-context-touch";
import {
	USER_AUTH_COOKIE_NAME,
	getUserSessionFromCookieHeader,
} from "@/features/auth/user-session-cookie";
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
import { getEventSheetStoreRepository } from "@/lib/platform/postgres/event-sheet-store-repository";
import { getUserEventRelationshipRepository } from "@/lib/platform/postgres/user-event-relationship-repository";
import { NextResponse } from "next/server";
import { z } from "zod";

const trackPayloadSchema = z.object({
	eventKey: z.string().trim().min(1).max(220),
	actionType: z.enum(EVENT_ENGAGEMENT_ACTIONS),
	sessionId: z.string().trim().max(120).optional(),
	source: z.string().trim().max(80).optional(),
	path: z.string().trim().max(280).optional(),
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

const EVENT_KEY_CACHE_TTL_MS = 5 * 60 * 1000;

const eventKeyCache = new Map<string, number>();

const isKnownEventKey = async (eventKey: string): Promise<boolean | null> => {
	const nowMs = Date.now();
	const cachedExpiry = eventKeyCache.get(eventKey);
	if (cachedExpiry && cachedExpiry > nowMs) {
		return true;
	}

	const repository = getEventSheetStoreRepository();
	if (!repository) {
		return null;
	}

	try {
		const exists = await repository.hasEventKey(eventKey);
		if (exists) {
			eventKeyCache.set(eventKey, nowMs + EVENT_KEY_CACHE_TTL_MS);
		}
		return exists;
	} catch {
		return null;
	}
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
	const knownEventKey = await isKnownEventKey(eventKey);
	if (knownEventKey === false) {
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
			userId: userSession.userId,
			sessionId: body.sessionId ?? null,
			source: body.source ?? null,
			path: body.path ?? null,
			isAuthenticated: userSession.isAuthenticated,
			deviceClass: body.clientContext?.deviceClass ?? null,
			platform: body.clientContext?.platform ?? null,
			browserFamily: body.clientContext?.browserFamily ?? null,
			timezone: body.clientContext?.timezone ?? null,
			locale: body.clientContext?.locale ?? null,
		});
		if (body.actionType === "calendar_sync" && userSession.userId) {
			await getUserEventRelationshipRepository()?.upsertRelationship({
				userId: userSession.userId,
				eventKey,
				relationshipType: "calendar_added",
				source: body.source ?? "calendar_sync",
				notifyOnChanges: true,
			});
		}
		if (userSession.isAuthenticated) {
			await touchAuthenticatedUserContext({
				userId: userSession.userId,
				email: userSession.email,
				clientContext: body.clientContext,
			});
		}
	} catch (error) {
		log.warn("events.track", "Failed to record event engagement", {
			eventKey,
			actionType: body.actionType,
			error: error instanceof Error ? error.message : "unknown",
		});
	}

	return accepted();
}
