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

const CUSTOM_GENRE_COLORS = [
	"bg-teal-600",
	"bg-teal-700",
	"bg-cyan-600",
	"bg-cyan-700",
	"bg-sky-600",
	"bg-sky-700",
	"bg-blue-600",
	"bg-blue-700",
	"bg-indigo-600",
	"bg-indigo-700",
	"bg-violet-600",
	"bg-violet-700",
	"bg-fuchsia-600",
	"bg-fuchsia-700",
	"bg-pink-600",
	"bg-pink-700",
	"bg-rose-600",
	"bg-rose-700",
	"bg-red-600",
	"bg-red-700",
	"bg-orange-600",
	"bg-orange-700",
	"bg-amber-600",
	"bg-amber-700",
	"bg-lime-600",
	"bg-lime-700",
	"bg-emerald-600",
	"bg-emerald-700",
] as const;

const stripDiacritics = (value: string): string =>
	value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

const applyGenrePhraseReplacements = (value: string): string =>
	value
		.replace(/\br\s*&\s*b\b/g, "rnb")
		.replace(/\br\s+and\s+b\b/g, "rnb")
		.replace(/\bafro[\s-]*house\b/g, "afro house")
		.replace(/\bafro[\s-]*trap\b/g, "afrotrap")
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
	["francophone party", "francophone"],
	["francais", "francophone"],
	["français", "francophone"],
	["french", "francophone"],
	["mainstream", "pop"],
	["commercial", "pop"],
	["techno", "electro"],
	["electronic", "electro"],
	["edm", "electro"],
	["trance", "electro"],
	["dubstep", "electro"],
	["alt", "alternative"],
	["indie", "alternative"],
	["alternative rock", "alternative"],
	["dance music", "dance"],
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
			if (part === "edm") return "EDM";
			if (part === "francais") return "Français";
			if (part === "rnb") return "R&B";
			if (part === "uk") return "UK";
			if (part === "fr") return "FR";
			return part.charAt(0).toUpperCase() + part.slice(1);
		})
		.join(" ");

export const isRedundantGenreAlias = (
	alias: string,
	genreKey: MusicGenre,
): boolean => {
	const normalizedAlias = normalizeSearchText(alias);
	if (!normalizedAlias) return true;
	return (
		normalizedAlias === normalizeSearchText(genreKey) ||
		normalizedAlias === normalizeSearchText(toGenreLabel(genreKey))
	);
};

export const getCustomGenreColor = (
	value: string,
	reservedColors?: Iterable<string>,
): string => {
	const normalized = normalizeGenreKey(value);
	let hash = 0;
	for (let index = 0; index < normalized.length; index += 1) {
		hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0;
	}
	const offset = hash % CUSTOM_GENRE_COLORS.length;
	const reserved = new Set(reservedColors ?? []);
	for (let index = 0; index < CUSTOM_GENRE_COLORS.length; index += 1) {
		const color =
			CUSTOM_GENRE_COLORS[(offset + index) % CUSTOM_GENRE_COLORS.length];
		if (!reserved.has(color)) return color;
	}
	return CUSTOM_GENRE_COLORS[offset];
};

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
	})).filter((alias) => !isRedundantGenreAlias(alias.alias, alias.genreKey)),
};

const buildGenreAliasMap = (
	taxonomy: GenreTaxonomySnapshot = DEFAULT_GENRE_TAXONOMY,
): Map<string, MusicGenre> => {
	const entries: Array<[string, MusicGenre]> = [];
	const activeGenreKeys = new Set<MusicGenre>();
	for (const genre of taxonomy.genres) {
		if (genre.isActive === false) continue;
		activeGenreKeys.add(genre.key);
		entries.push([genre.key, genre.key], [genre.label, genre.key]);
		for (const alias of genre.aliases ?? []) {
			entries.push([alias, genre.key]);
		}
	}
	for (const alias of taxonomy.aliases) {
		if (!activeGenreKeys.has(alias.genreKey)) continue;
		if (isRedundantGenreAlias(alias.alias, alias.genreKey)) continue;
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
