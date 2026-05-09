import { touchAuthenticatedUserContext } from "@/features/auth/user-context-touch";
import {
	USER_AUTH_COOKIE_NAME,
	getUserSessionFromCookieHeader,
} from "@/features/auth/user-session-cookie";
import { resolveMusicGenre } from "@/features/events/genre-normalization";
import { MUSIC_GENRES, type MusicGenre } from "@/features/events/types";
import {
	checkUserPreferenceIpLimit,
	extractClientIpFromHeaders,
} from "@/features/security/rate-limiter";
import { NO_STORE_HEADERS } from "@/lib/http/cache-control";
import { log } from "@/lib/platform/logger";
import { getUserGenrePreferenceRepository } from "@/lib/platform/postgres/user-genre-preference-repository";
import { NextResponse } from "next/server";
import { z } from "zod";

const genrePreferenceSchema = z.object({
	genre: z.string().trim().min(1).max(60),
	incrementBy: z.number().int().min(1).max(10).optional(),
	recordedAt: z.string().trim().max(80).optional(),
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
const genrePreferenceBatchSchema = z.object({
	events: z.array(genrePreferenceSchema).min(1).max(25),
});

const allowedGenres = new Set<MusicGenre>(
	MUSIC_GENRES.map((genre) => genre.key),
);

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
	const repository = getUserGenrePreferenceRepository();
	if (!repository) {
		return accepted();
	}

	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return accepted();
	}

	const parsed = genrePreferenceSchema.safeParse(payload);
	const parsedBatch = genrePreferenceBatchSchema.safeParse(payload);
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
	const ipDecision = await checkUserPreferenceIpLimit(clientIp);
	if (ipDecision.reason === "limiter_unavailable") {
		return accepted();
	}
	if (!ipDecision.allowed) {
		return accepted();
	}

	const validEvents: Array<(typeof events)[number] & { genre: MusicGenre }> = [];
	for (const event of events) {
		const genre = resolveMusicGenre(event.genre);
		if (!genre || !allowedGenres.has(genre)) continue;
		validEvents.push({ ...event, genre });
	}
	if (validEvents.length === 0) {
		return accepted();
	}

	const cookieHeader = request.headers.get("cookie");
	const userCookie = parseCookieByName(cookieHeader, USER_AUTH_COOKIE_NAME);
	const userSession = getUserSessionFromCookieHeader(userCookie);
	if (!userSession.isAuthenticated || !userSession.email) {
		return accepted();
	}

	try {
		for (const event of validEvents) {
			await repository.incrementGenreScore({
				email: userSession.email,
				userId: userSession.userId,
				genre: event.genre,
				incrementBy: event.incrementBy ?? 1,
			});
		}
		const latestContext = validEvents[validEvents.length - 1]?.clientContext;
		await touchAuthenticatedUserContext({
			userId: userSession.userId,
			email: userSession.email,
			clientContext: latestContext,
		});
	} catch (error) {
		log.warn("events.genre-preference", "Failed to store genre preference", {
			eventCount: validEvents.length,
			error: error instanceof Error ? error.message : "unknown",
		});
	}

	return accepted();
}
