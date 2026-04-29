import {
	MUSIC_GENRES,
	type MusicGenre,
	type MusicGenreDefinition,
} from "@/features/events/types";

export type GenreTaxonomyDefinition = MusicGenreDefinition;

export interface GenreTaxonomySnapshot {
	genres: GenreTaxonomyDefinition[];
	aliases: Array<{
		alias: string;
		genreKey: MusicGenre;
	}>;
}

const stripDiacritics = (value: string): string =>
	value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

const applyGenrePhraseReplacements = (value: string): string =>
	value
		.replace(/\br\s*&\s*b\b/g, "rnb")
		.replace(/\br\s+and\s+b\b/g, "rnb")
		.replace(/\bafro[\s-]*house\b/g, "afro house")
		.replace(/\bhip[\s-]*hop\b/g, "hip hop")
		.replace(/\bukg\b/g, "uk garage")
		.replace(/\b3\s*step\b/g, "3-step")
		.replace(/\bslow\s*jams\b/g, "slow jams");

export const normalizeGenreInputText = (value: string): string =>
	applyGenrePhraseReplacements(stripDiacritics(value.toLowerCase()))
		.replace(/\s+/g, " ")
		.trim();

export const normalizeSearchText = (value: string): string =>
	normalizeGenreInputText(value)
		.replace(/-/g, " ")
		.replace(/[^\p{L}\p{N}\s-]+/gu, " ")
		.replace(/\s+/g, " ")
		.trim();

export const DEFAULT_GENRE_ALIASES: Array<[string, MusicGenre]> = [
	["amapiano", "amapiano"],
	["afrobeats", "afrobeats"],
	["afrotrap", "afrotrap"],
	["afro trap", "afrotrap"],
	["francophone", "francophone"],
	["francophone party", "francophone"],
	["francais", "francophone"],
	["français", "francophone"],
	["french", "francophone"],
	["soca", "soca"],
	["pop", "pop"],
	["mainstream", "pop"],
	["commercial", "pop"],
	["bashment", "bashment"],
	["hip hop", "hip hop"],
	["hiphop", "hip hop"],
	["hip-hop", "hip hop"],
	["r&b", "r&b"],
	["rnb", "r&b"],
	["soul", "r&b"],
	["shatta", "shatta"],
	["dancehall", "dancehall"],
	["reggaeton", "reggaeton"],
	["baile funk", "baile funk"],
	["house", "house"],
	["techno", "house"],
	["disco", "disco"],
	["afro house", "afro house"],
	["afrohouse", "afro house"],
	["afro-house", "afro house"],
	["afo house", "afro house"],
	["slow jams", "slow jams"],
	["slowjams", "slow jams"],
	["3-step", "3-step"],
	["3step", "3-step"],
	["electro", "electro"],
	["electronic", "electro"],
	["edm", "electro"],
	["trance", "electro"],
	["dubstep", "electro"],
	["funk", "funk"],
	["rap", "rap"],
	["trap", "trap"],
	["uk drill", "uk drill"],
	["uk garage", "uk garage"],
	["bouyon", "bouyon"],
	["zouk", "zouk"],
	["coupé-décalé", "coupé-décalé"],
	["coupe-decale", "coupé-décalé"],
	["coupe decale", "coupé-décalé"],
	["urban fr", "urban fr"],
	["kompa", "kompa"],
	["afro", "afro"],
	["gqom", "gqom"],
	["alternative", "alternative"],
	["alt", "alternative"],
	["indie", "alternative"],
	["alternative rock", "alternative"],
	["dance", "dance"],
	["dance music", "dance"],
	["bachata", "bachata"],
	["batida", "batida"],
	["edits", "edits"],
	["reggae", "reggae"],
	["salsa", "salsa"],
	["other", "other"],
];

export const normalizeGenreKey = (value: string): MusicGenre =>
	normalizeSearchText(value)
		.replace(/[^a-z0-9\s-]+/g, "")
		.replace(/\s+/g, " ")
		.trim();

export const toGenreLabel = (value: string): string =>
	normalizeGenreInputText(value)
		.split(" ")
		.filter(Boolean)
		.map((part) => {
			if (part === "rnb") return "R&B";
			if (part === "uk") return "UK";
			if (part === "fr") return "FR";
			return part.charAt(0).toUpperCase() + part.slice(1);
		})
		.join(" ");

export const DEFAULT_GENRE_TAXONOMY: GenreTaxonomySnapshot = {
	genres: MUSIC_GENRES.map((genre, index) => ({
		...genre,
		isDefault: true,
		isActive: true,
		sortOrder: index,
	})),
	aliases: DEFAULT_GENRE_ALIASES.map(([alias, genreKey]) => ({
		alias,
		genreKey,
	})),
};

const buildGenreAliasMap = (
	taxonomy: GenreTaxonomySnapshot = DEFAULT_GENRE_TAXONOMY,
): Map<string, MusicGenre> => {
	const entries: Array<[string, MusicGenre]> = [];
	for (const genre of taxonomy.genres) {
		if (genre.isActive === false) continue;
		entries.push([genre.key, genre.key], [genre.label, genre.key]);
		for (const alias of genre.aliases ?? []) {
			entries.push([alias, genre.key]);
		}
	}
	for (const alias of taxonomy.aliases) {
		entries.push([alias.alias, alias.genreKey]);
	}
	return new Map(
		entries
			.map(([alias, genre]) => [normalizeSearchText(alias), genre] as const)
			.filter(([alias]) => alias.length > 0),
	);
};

const genreAliasMap = buildGenreAliasMap();

export const GENRE_ALIAS_ENTRIES = Array.from(genreAliasMap.entries()).sort(
	(left, right) => right[0].length - left[0].length,
);

export const getGenreAliasEntries = (
	taxonomy?: GenreTaxonomySnapshot,
): Array<[string, MusicGenre]> =>
	Array.from(buildGenreAliasMap(taxonomy).entries()).sort(
		(left, right) => right[0].length - left[0].length,
	);

export const resolveMusicGenre = (
	value: string,
	taxonomy?: GenreTaxonomySnapshot,
): MusicGenre | null => {
	const normalized = normalizeSearchText(value);
	if (normalized.length === 0) return null;
	return (
		(taxonomy ? buildGenreAliasMap(taxonomy) : genreAliasMap).get(normalized) ??
		null
	);
};

export const getSearchableGenreText = (value: string): string => {
	const resolved = resolveMusicGenre(value);
	return normalizeSearchText(resolved ?? value);
};
