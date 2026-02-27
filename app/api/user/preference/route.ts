import {
	USER_AUTH_COOKIE_NAME,
	getUserSessionFromCookieHeader,
} from "@/features/auth/user-session-cookie";
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
	if (!parsed.success) {
		return accepted();
	}

	const clientIp = extractClientIpFromHeaders(request.headers);
	const ipDecision = await checkUserPreferenceIpLimit(clientIp);
	if (!ipDecision.allowed) {
		return accepted();
	}

	const genre = parsed.data.genre.toLowerCase() as MusicGenre;
	if (!allowedGenres.has(genre)) {
		return accepted();
	}

	const cookieHeader = request.headers.get("cookie");
	const userCookie = parseCookieByName(cookieHeader, USER_AUTH_COOKIE_NAME);
	const userSession = getUserSessionFromCookieHeader(userCookie);
	if (!userSession.isAuthenticated || !userSession.email) {
		return accepted();
	}

	try {
		await repository.incrementGenreScore({
			email: userSession.email,
			genre,
			incrementBy: parsed.data.incrementBy ?? 1,
		});
	} catch (error) {
		log.warn("events.genre-preference", "Failed to store genre preference", {
			genre,
			error: error instanceof Error ? error.message : "unknown",
		});
	}

	return accepted();
}
