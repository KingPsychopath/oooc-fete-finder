import { touchAuthenticatedUserContext } from "@/features/auth/user-context-touch";
import {
	USER_AUTH_COOKIE_NAME,
	getCanonicalUserSessionFromCookieHeader,
} from "@/features/auth/user-session-cookie";
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
import { getDiscoveryAnalyticsRepository } from "@/lib/platform/postgres/discovery-analytics-repository";
import { z } from "zod";

const recordedAtSchema = z
	.string()
	.trim()
	.max(80)
	.refine((value) => !Number.isNaN(Date.parse(value)), "Invalid timestamp")
	.optional();

const discoveryTrackSchema = z.object({
	actionType: z.enum([
		"search",
		"filter_apply",
		"filter_clear",
		"map_interaction",
		"sort_change",
		"location_request",
		"tour_interaction",
		"nav_click",
	]),
	sessionId: z.string().trim().max(120).optional(),
	filterGroup: z.string().trim().max(80).optional(),
	filterValue: z.string().trim().max(120).optional(),
	searchQuery: z.string().trim().max(280).optional(),
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
const discoveryTrackBatchSchema = z.object({
	events: z.array(discoveryTrackSchema).min(1).max(25),
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

const KNOWN_DISCOVERY_INTERACTION_GROUPS = new Set([
	"map_arrondissement",
	"map_cluster",
	"map_control",
	"sort_mode",
	"nearby",
	"tour",
	"homepage_link",
	"quick_action",
	"mobile_nav",
	"footer_link",
	"header_nav",
]);

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
	const parsedBatch = discoveryTrackBatchSchema.safeParse(payload);
	if (!parsed.success && !parsedBatch.success) {
		return accepted();
	}
	const events = parsed.success
		? [parsed.data]
		: parsedBatch.success
			? parsedBatch.data.events
			: [];
	if (events.length === 0) {
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

	const validEvents = events.filter((body) => {
		if (body.actionType === "filter_apply") {
			const filterGroup = (body.filterGroup ?? "").trim().toLowerCase();
			const filterValue = (body.filterValue ?? "").trim().toLowerCase();
			if (!KNOWN_FILTER_GROUPS.has(filterGroup) || filterValue.length === 0) {
				return false;
			}
		}
		if (body.actionType === "search") {
			const searchQuery = (body.searchQuery ?? "").trim().toLowerCase();
			if (searchQuery.length < 2) {
				return false;
			}
		}
		if (
			body.actionType === "map_interaction" ||
			body.actionType === "sort_change" ||
			body.actionType === "location_request" ||
			body.actionType === "tour_interaction" ||
			body.actionType === "nav_click"
		) {
			const filterGroup = (body.filterGroup ?? "").trim().toLowerCase();
			const filterValue = (body.filterValue ?? "").trim().toLowerCase();
			if (
				!KNOWN_DISCOVERY_INTERACTION_GROUPS.has(filterGroup) ||
				filterValue.length === 0
			) {
				return false;
			}
		}
		return true;
	});
	if (validEvents.length === 0) {
		return accepted();
	}

	try {
		const sessionIds = Array.from(
			new Set(
				validEvents
					.map((event) => event.sessionId?.trim())
					.filter((sessionId): sessionId is string => Boolean(sessionId)),
			),
		);
		for (const sessionId of sessionIds) {
			const sessionDecision = await checkTrackDiscoverySessionLimit(sessionId);
			if (sessionDecision.reason === "limiter_unavailable") {
				return accepted();
			}
			if (!sessionDecision.allowed) {
				return accepted();
			}
		}

		const cookieHeader = request.headers.get("cookie");
		const userCookie = parseCookieByName(cookieHeader, USER_AUTH_COOKIE_NAME);
		const userSession = await getCanonicalUserSessionFromCookieHeader(userCookie);
		for (const body of validEvents) {
			await repository.recordAction({
				actionType: body.actionType,
				sessionId: body.sessionId ?? null,
				userId: userSession.userId,
				userEmail: userSession.userId ? userSession.email : null,
				filterGroup: body.filterGroup?.trim().toLowerCase() ?? null,
				filterValue: body.filterValue?.trim().toLowerCase() ?? null,
				searchQuery: body.searchQuery?.trim().toLowerCase() ?? null,
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
		if (userSession.isAuthenticated) {
			const latestContext = validEvents[validEvents.length - 1]?.clientContext;
			await touchAuthenticatedUserContext({
				userId: userSession.userId,
				email: userSession.email,
				clientContext: latestContext,
			});
		}
	} catch (error) {
		log.warn("events.discovery-track", "Failed to record discovery analytics", {
			eventCount: validEvents.length,
			error: error instanceof Error ? error.message : "unknown",
		});
	}

	return accepted();
}
