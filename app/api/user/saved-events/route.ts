import {
	USER_AUTH_COOKIE_NAME,
	getCanonicalUserSessionFromCookieHeader,
} from "@/features/auth/user-session-cookie";
import { NO_STORE_HEADERS } from "@/lib/http/cache-control";
import {
	DEFAULT_JSON_BODY_LIMIT_BYTES,
	acceptedNoStoreResponse,
	isJsonContentType,
	isSameOriginRequest,
	isWithinBodySizeLimit,
} from "@/lib/http/request-security";
import { log } from "@/lib/platform/logger";
import { getUserEventRelationshipRepository } from "@/lib/platform/postgres/user-event-relationship-repository";
import { NextResponse } from "next/server";
import { z } from "zod";

const savedEventsSchema = z.object({
	eventKeys: z.array(z.string().trim().min(1).max(220)).max(200).optional(),
	eventKey: z.string().trim().min(1).max(220).optional(),
	isSaved: z.boolean().optional(),
	source: z.string().trim().max(80).optional(),
	idempotencyKey: z.string().trim().max(240).optional(),
});

export const runtime = "nodejs";

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

const getUserRelationshipId = async (
	request: Request,
): Promise<string | null> => {
	const cookieHeader = request.headers.get("cookie");
	const userCookie = parseCookieByName(cookieHeader, USER_AUTH_COOKIE_NAME);
	const userSession =
		await getCanonicalUserSessionFromCookieHeader(userCookie);
	if (!userSession.isAuthenticated || !userSession.userId || !userSession.email) {
		return null;
	}
	return userSession.userId;
};

export async function GET(request: Request) {
	const repository = getUserEventRelationshipRepository();
	const userId = await getUserRelationshipId(request);
	if (!repository || !userId) {
		return NextResponse.json(
			{ success: true, eventKeys: [] },
			{ headers: NO_STORE_HEADERS },
		);
	}

	try {
		const eventKeys = await repository.listEventKeysForUser({
			userId,
			relationshipType: "saved",
		});
		return NextResponse.json(
			{ success: true, eventKeys },
			{ headers: NO_STORE_HEADERS },
		);
	} catch (error) {
		log.warn("events.saved", "Failed to list saved events", {
			error: error instanceof Error ? error.message : "unknown",
		});
		return NextResponse.json(
			{ success: true, eventKeys: [] },
			{ headers: NO_STORE_HEADERS },
		);
	}
}

export async function POST(request: Request) {
	if (!isSameOriginRequest(request)) {
		return acceptedNoStoreResponse();
	}
	if (!isJsonContentType(request)) {
		return acceptedNoStoreResponse();
	}
	if (!isWithinBodySizeLimit(request, DEFAULT_JSON_BODY_LIMIT_BYTES)) {
		return acceptedNoStoreResponse();
	}

	const repository = getUserEventRelationshipRepository();
	const userId = await getUserRelationshipId(request);
	if (!repository || !userId) {
		return NextResponse.json(
			{ success: true },
			{ status: 202, headers: NO_STORE_HEADERS },
		);
	}

	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return NextResponse.json(
			{ success: true },
			{ status: 202, headers: NO_STORE_HEADERS },
		);
	}

	const parsed = savedEventsSchema.safeParse(payload);
	if (!parsed.success) {
		return NextResponse.json(
			{ success: true },
			{ status: 202, headers: NO_STORE_HEADERS },
		);
	}

	const eventKeys = parsed.data.eventKeys ?? [];
	if (parsed.data.eventKey) {
		eventKeys.push(parsed.data.eventKey);
	}
	const uniqueEventKeys = Array.from(
		new Set(
			eventKeys
				.map((eventKey) => eventKey.trim().toLowerCase())
				.filter((eventKey) => eventKey.length > 0),
		),
	);

	try {
		for (const eventKey of uniqueEventKeys) {
			if (parsed.data.isSaved === false) {
				await repository.deleteRelationship({
					userId,
					eventKey,
					relationshipType: "saved",
				});
			} else {
				await repository.upsertRelationship({
					userId,
					eventKey,
					relationshipType: "saved",
					source: parsed.data.source ?? "saved_events",
				});
			}
		}
	} catch (error) {
		log.warn("events.saved", "Failed to update saved events", {
			eventCount: uniqueEventKeys.length,
			hasIdempotencyKey: Boolean(parsed.data.idempotencyKey),
			error: error instanceof Error ? error.message : "unknown",
		});
	}

	return NextResponse.json(
		{ success: true },
		{ status: 202, headers: NO_STORE_HEADERS },
	);
}
