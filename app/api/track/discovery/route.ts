import {
	USER_AUTH_COOKIE_NAME,
	getUserSessionFromCookieHeader,
} from "@/features/auth/user-session-cookie";
import {
	checkTrackDiscoveryIpLimit,
	checkTrackDiscoverySessionLimit,
	extractClientIpFromHeaders,
} from "@/features/security/rate-limiter";
import { NO_STORE_HEADERS } from "@/lib/http/cache-control";
import { log } from "@/lib/platform/logger";
import { getDiscoveryAnalyticsRepository } from "@/lib/platform/postgres/discovery-analytics-repository";
import { NextResponse } from "next/server";
import { z } from "zod";

const discoveryTrackSchema = z.object({
	actionType: z.enum(["search", "filter_apply", "filter_clear"]),
	sessionId: z.string().trim().max(120).optional(),
	filterGroup: z.string().trim().max(80).optional(),
	filterValue: z.string().trim().max(120).optional(),
	searchQuery: z.string().trim().max(280).optional(),
	path: z.string().trim().max(280).optional(),
});

const KNOWN_FILTER_GROUPS = new Set([
	"date_range",
	"day_night",
	"arrondissement",
	"genre",
	"nationality",
	"venue_type",
	"venue_setting",
	"oooc_pick",
	"price_range",
	"age_range",
]);

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

export async function POST(request: Request) {
	const repository = getDiscoveryAnalyticsRepository();
	if (!repository) {
		return accepted();
	}

	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return accepted();
	}

	const parsed = discoveryTrackSchema.safeParse(payload);
	if (!parsed.success) {
		return accepted();
	}

	const clientIp = extractClientIpFromHeaders(request.headers);
	const ipDecision = await checkTrackDiscoveryIpLimit(clientIp);
	if (ipDecision.reason === "limiter_unavailable") {
		return accepted();
	}
	if (!ipDecision.allowed) {
		return accepted();
	}

	const cookieHeader = request.headers.get("cookie");
	const userCookie = parseCookieByName(cookieHeader, USER_AUTH_COOKIE_NAME);
	const userSession = getUserSessionFromCookieHeader(userCookie);
	const body = parsed.data;
	if (body.actionType === "filter_apply") {
		const filterGroup = (body.filterGroup ?? "").trim().toLowerCase();
		const filterValue = (body.filterValue ?? "").trim().toLowerCase();
		if (!KNOWN_FILTER_GROUPS.has(filterGroup) || filterValue.length === 0) {
			return accepted();
		}
	}
	if (body.actionType === "search") {
		const searchQuery = (body.searchQuery ?? "").trim().toLowerCase();
		if (searchQuery.length < 2) {
			return accepted();
		}
	}

	try {
		if (body.sessionId) {
			const sessionDecision = await checkTrackDiscoverySessionLimit(
				body.sessionId,
			);
			if (sessionDecision.reason === "limiter_unavailable") {
				return accepted();
			}
			if (!sessionDecision.allowed) {
				return accepted();
			}
		}

		await repository.recordAction({
			actionType: body.actionType,
			sessionId: body.sessionId ?? null,
			userEmail: userSession.email,
			filterGroup: body.filterGroup?.trim().toLowerCase() ?? null,
			filterValue: body.filterValue?.trim().toLowerCase() ?? null,
			searchQuery: body.searchQuery?.trim().toLowerCase() ?? null,
			path: body.path ?? null,
			isAuthenticated: userSession.isAuthenticated,
		});
	} catch (error) {
		log.warn("events.discovery-track", "Failed to record discovery analytics", {
			actionType: body.actionType,
			error: error instanceof Error ? error.message : "unknown",
		});
	}

	return accepted();
}
