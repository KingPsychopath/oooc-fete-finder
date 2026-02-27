import "server-only";

import type { MusicGenre } from "@/features/events/types";
import type { Sql } from "postgres";
import { getPostgresClient } from "./postgres-client";

declare global {
	var __ooocFeteFinderUserGenrePreferenceRepository:
		| UserGenrePreferenceRepository
		| undefined;
}

type SegmentRow = {
	email: string;
	score: number;
	last_seen_at: Date | string;
};

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export class UserGenrePreferenceRepository {
	private readonly sql: Sql;
	private readonly ensureSchemaPromise: Promise<void>;

	constructor(sql: Sql) {
		this.sql = sql;
		this.ensureSchemaPromise = this.ensureSchema();
	}

	private async ensureSchema(): Promise<void> {
		await this.sql`
			CREATE TABLE IF NOT EXISTS app_user_genre_preferences (
				email TEXT NOT NULL,
				genre TEXT NOT NULL,
				score INTEGER NOT NULL DEFAULT 0,
				first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				PRIMARY KEY (email, genre)
			)
		`;

		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_user_genre_preferences_genre_score
			ON app_user_genre_preferences (genre, score DESC, last_seen_at DESC)
		`;
	}

	private async ready(): Promise<void> {
		await this.ensureSchemaPromise;
	}

	async incrementGenreScore(input: {
		email: string;
		genre: MusicGenre;
		incrementBy?: number;
	}): Promise<void> {
		await this.ready();
		const incrementBy = Math.max(1, Math.min(10, input.incrementBy ?? 1));
		const email = normalizeEmail(input.email);
		await this.sql`
			INSERT INTO app_user_genre_preferences (
				email,
				genre,
				score,
				first_seen_at,
				last_seen_at
			)
			VALUES (
				${email},
				${input.genre},
				${incrementBy},
				NOW(),
				NOW()
			)
			ON CONFLICT (email, genre)
			DO UPDATE SET
				score = app_user_genre_preferences.score + ${incrementBy},
				last_seen_at = NOW()
		`;
	}

	async listSegmentByGenre(input: {
		genre: MusicGenre;
		minScore: number;
		limit: number;
	}): Promise<
		Array<{
			email: string;
			firstName: string;
			lastName: string;
			score: number;
			lastSeenAt: string;
		}>
	> {
		await this.ready();
		const safeMinScore = Math.max(1, Math.floor(input.minScore));
		const safeLimit = Math.max(1, Math.min(5000, Math.floor(input.limit)));
		const rows = await this.sql<SegmentRow[]>`
			SELECT
				email,
				score,
				last_seen_at
			FROM app_user_genre_preferences
			WHERE genre = ${input.genre}
				AND score >= ${safeMinScore}
			ORDER BY score DESC, last_seen_at DESC
			LIMIT ${safeLimit}
		`;
		return rows.map((row) => ({
			email: row.email,
			firstName: "",
			lastName: "",
			score: row.score,
			lastSeenAt:
				row.last_seen_at instanceof Date
					? row.last_seen_at.toISOString()
					: new Date(row.last_seen_at).toISOString(),
		}));
	}

	async listTopGenres(input: {
		limit: number;
	}): Promise<
		Array<{ genre: MusicGenre; totalScore: number; uniqueUsers: number }>
	> {
		await this.ready();
		const safeLimit = Math.max(1, Math.min(50, Math.floor(input.limit)));
		const rows = await this.sql<
			Array<{ genre: MusicGenre; totalScore: number; uniqueUsers: number }>
		>`
			SELECT
				genre,
				COALESCE(SUM(score), 0)::int AS "totalScore",
				COUNT(DISTINCT email)::int AS "uniqueUsers"
			FROM app_user_genre_preferences
			GROUP BY genre
			ORDER BY "totalScore" DESC, "uniqueUsers" DESC
			LIMIT ${safeLimit}
		`;
		return rows;
	}
}

export const getUserGenrePreferenceRepository =
	(): UserGenrePreferenceRepository | null => {
		if (
			globalThis.__ooocFeteFinderUserGenrePreferenceRepository &&
			globalThis.__ooocFeteFinderUserGenrePreferenceRepository instanceof
				UserGenrePreferenceRepository
		) {
			return globalThis.__ooocFeteFinderUserGenrePreferenceRepository;
		}

		const sql = getPostgresClient();
		if (!sql) return null;

		const repository = new UserGenrePreferenceRepository(sql);
		globalThis.__ooocFeteFinderUserGenrePreferenceRepository = repository;
		return repository;
	};
