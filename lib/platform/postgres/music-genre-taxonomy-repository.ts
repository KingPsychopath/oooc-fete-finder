import "server-only";

import {
	DEFAULT_GENRE_ALIASES,
	DEFAULT_GENRE_TAXONOMY,
	type GenreTaxonomyDefinition,
	type GenreTaxonomySnapshot,
	getCustomGenreColor,
	normalizeGenreKey,
	toGenreLabel,
} from "@/features/events/genre-normalization";
import type { MusicGenre } from "@/features/events/types";
import type { Sql } from "postgres";
import { getPostgresClient } from "./postgres-client";

declare global {
	var __ooocFeteFinderMusicGenreTaxonomyRepository:
		| MusicGenreTaxonomyRepository
		| undefined;
}

type GenreRow = {
	key: string;
	label: string;
	color: string;
	is_default: boolean;
	is_active: boolean;
	sort_order: number;
};

type AliasRow = {
	alias: string;
	genre_key: string;
};

const DEFAULT_CUSTOM_COLOR = "bg-stone-500";
const TAXONOMY_READ_TIMEOUT_MS = 300;

const normalizeAlias = (value: string): string => normalizeGenreKey(value);

export class MusicGenreTaxonomyRepository {
	private readonly sql: Sql;
	private readonly ensureSchemaPromise: Promise<void>;

	constructor(sql: Sql) {
		this.sql = sql;
		this.ensureSchemaPromise = this.ensureSchema();
	}

	private async ensureSchema(): Promise<void> {
		await this.sql`
			CREATE TABLE IF NOT EXISTS app_music_genres (
				key TEXT PRIMARY KEY,
				label TEXT NOT NULL,
				color TEXT NOT NULL DEFAULT 'bg-stone-500',
				is_default BOOLEAN NOT NULL DEFAULT FALSE,
				is_active BOOLEAN NOT NULL DEFAULT TRUE,
				sort_order INTEGER NOT NULL DEFAULT 1000,
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)
		`;

		await this.sql`
			CREATE TABLE IF NOT EXISTS app_music_genre_aliases (
				alias TEXT PRIMARY KEY,
				genre_key TEXT NOT NULL REFERENCES app_music_genres(key) ON DELETE CASCADE,
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)
		`;

		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_music_genres_active_order
			ON app_music_genres (is_active, sort_order, label)
		`;

		await this.seedDefaultGenres();
	}

	private async ready(): Promise<void> {
		await this.ensureSchemaPromise;
	}

	private async seedDefaultGenres(): Promise<void> {
		const genreRows = DEFAULT_GENRE_TAXONOMY.genres.map((genre, index) => ({
			key: genre.key,
			label: genre.label,
			color: genre.color,
			is_default: true,
			is_active: genre.isActive !== false,
			sort_order: genre.sortOrder ?? index,
		}));

		if (genreRows.length > 0) {
			await this.sql`
				INSERT INTO app_music_genres ${this.sql(
					genreRows,
					"key",
					"label",
					"color",
					"is_default",
					"is_active",
					"sort_order",
				)}
				ON CONFLICT (key)
				DO UPDATE SET
					label = EXCLUDED.label,
					color = EXCLUDED.color,
					is_default = TRUE,
					sort_order = EXCLUDED.sort_order,
					updated_at = NOW()
			`;
		}

		const aliasRowsByAlias = new Map<
			string,
			{ alias: string; genre_key: string }
		>();
		for (const [alias, genreKey] of DEFAULT_GENRE_ALIASES) {
			const normalizedAlias = normalizeAlias(alias);
			if (!normalizedAlias) continue;
			aliasRowsByAlias.set(normalizedAlias, {
				alias: normalizedAlias,
				genre_key: genreKey,
			});
		}
		const aliasRows = Array.from(aliasRowsByAlias.values());

		if (aliasRows.length > 0) {
			await this.sql`
				INSERT INTO app_music_genre_aliases ${this.sql(
					aliasRows,
					"alias",
					"genre_key",
				)}
				ON CONFLICT (alias)
				DO UPDATE SET genre_key = EXCLUDED.genre_key
			`;
		}
	}

	async listTaxonomy(): Promise<GenreTaxonomySnapshot> {
		await this.ready();
		const [genreRows, aliasRows] = await Promise.all([
			this.sql<GenreRow[]>`
				SELECT key, label, color, is_default, is_active, sort_order
				FROM app_music_genres
				ORDER BY sort_order ASC, label ASC
			`,
			this.sql<AliasRow[]>`
				SELECT alias, genre_key
				FROM app_music_genre_aliases
				ORDER BY alias ASC
			`,
		]);

		const aliasesByGenre = new Map<string, string[]>();
		for (const row of aliasRows) {
			const aliases = aliasesByGenre.get(row.genre_key) ?? [];
			aliases.push(row.alias);
			aliasesByGenre.set(row.genre_key, aliases);
		}

		const reservedColors = new Set(
			genreRows
				.filter((row) => row.is_default || row.color !== DEFAULT_CUSTOM_COLOR)
				.map((row) => row.color),
		);
		const genres = genreRows.map((row): GenreTaxonomyDefinition => {
			const color =
				!row.is_default && row.color === DEFAULT_CUSTOM_COLOR
					? getCustomGenreColor(row.key, reservedColors)
					: row.color;
			reservedColors.add(color);
			return {
				key: row.key,
				label: row.label,
				color,
				isDefault: row.is_default,
				isActive: row.is_active,
				sortOrder: row.sort_order,
				aliases: aliasesByGenre.get(row.key) ?? [],
			};
		});

		return {
			genres,
			aliases: aliasRows.map((row) => ({
				alias: row.alias,
				genreKey: row.genre_key,
			})),
		};
	}

	async createCustomGenre(input: {
		label: string;
		aliases?: string[];
		color?: string;
	}): Promise<GenreTaxonomyDefinition> {
		await this.ready();
		const label = toGenreLabel(input.label);
		const key = normalizeGenreKey(label);
		if (!key) {
			throw new Error("Genre label is required");
		}

		const [sortOrderRows, colorRows] = await Promise.all([
			this.sql<Array<{ sort_order: number }>>`
				SELECT COALESCE(MAX(sort_order), 999) + 1 AS sort_order
				FROM app_music_genres
			`,
			this.sql<Array<{ color: string }>>`
				SELECT color
				FROM app_music_genres
				WHERE is_active = TRUE
			`,
		]);
		const sortOrder = sortOrderRows[0]?.sort_order ?? 1000;

		const rows = await this.sql<GenreRow[]>`
			INSERT INTO app_music_genres (
				key,
				label,
				color,
				is_default,
				is_active,
				sort_order
			)
			VALUES (
				${key},
				${label},
				${
					input.color ??
					getCustomGenreColor(
						key,
						colorRows.map((row) => row.color),
					)
				},
				FALSE,
				TRUE,
				${sortOrder}
			)
			ON CONFLICT (key)
			DO UPDATE SET
				label = EXCLUDED.label,
				is_active = TRUE,
				updated_at = NOW()
			RETURNING key, label, color, is_default, is_active, sort_order
		`;

		const aliases = Array.from(
			new Set([input.label, ...(input.aliases ?? [])].map(normalizeAlias)),
		).filter((alias) => alias.length > 0 && alias !== key);

		for (const alias of aliases) {
			await this.upsertAlias({ alias, genreKey: key });
		}

		const row = rows[0];
		return {
			key: row.key,
			label: row.label,
			color: row.color,
			isDefault: row.is_default,
			isActive: row.is_active,
			sortOrder: row.sort_order,
			aliases,
		};
	}

	async upsertAlias(input: {
		alias: string;
		genreKey: MusicGenre;
	}): Promise<void> {
		await this.ready();
		const alias = normalizeAlias(input.alias);
		if (!alias) {
			throw new Error("Alias is required");
		}

		await this.sql`
			INSERT INTO app_music_genre_aliases (alias, genre_key)
			VALUES (${alias}, ${input.genreKey})
			ON CONFLICT (alias)
			DO UPDATE SET genre_key = EXCLUDED.genre_key
		`;
	}
}

export const getMusicGenreTaxonomyRepository =
	(): MusicGenreTaxonomyRepository | null => {
		if (
			globalThis.__ooocFeteFinderMusicGenreTaxonomyRepository &&
			globalThis.__ooocFeteFinderMusicGenreTaxonomyRepository instanceof
				MusicGenreTaxonomyRepository
		) {
			return globalThis.__ooocFeteFinderMusicGenreTaxonomyRepository;
		}

		const sql = getPostgresClient();
		if (!sql) return null;

		const repository = new MusicGenreTaxonomyRepository(sql);
		globalThis.__ooocFeteFinderMusicGenreTaxonomyRepository = repository;
		return repository;
	};

export const loadGenreTaxonomySnapshot =
	async (): Promise<GenreTaxonomySnapshot> => {
		const repository = getMusicGenreTaxonomyRepository();
		if (!repository) return DEFAULT_GENRE_TAXONOMY;
		try {
			return await Promise.race([
				repository.listTaxonomy(),
				new Promise<GenreTaxonomySnapshot>((resolve) => {
					setTimeout(
						() => resolve(DEFAULT_GENRE_TAXONOMY),
						TAXONOMY_READ_TIMEOUT_MS,
					);
				}),
			]);
		} catch {
			return DEFAULT_GENRE_TAXONOMY;
		}
	};
