import type { Event, MusicGenre } from "@/features/events/types";

export type GenreFrequency = Partial<Record<MusicGenre, number>>;

export interface GenrePreview {
	visibleGenres: MusicGenre[];
	hiddenGenreCount: number;
}

export const CARD_GENRE_PREVIEW_LIMIT = 3;

export function buildGenreFrequency(events: Event[]): GenreFrequency {
	const frequency: GenreFrequency = {};

	for (const event of events) {
		const uniqueGenres = new Set(event.genre);

		for (const genre of uniqueGenres) {
			frequency[genre] = (frequency[genre] ?? 0) + 1;
		}
	}

	return frequency;
}

export function getGenrePreview(
	genres: MusicGenre[],
	frequency: GenreFrequency = {},
	limit: number = CARD_GENRE_PREVIEW_LIMIT,
): GenrePreview {
	const uniqueGenres = genres.filter(
		(genre, index) => genres.indexOf(genre) === index,
	);

	if (limit <= 0 || uniqueGenres.length === 0) {
		return {
			visibleGenres: [],
			hiddenGenreCount: uniqueGenres.length,
		};
	}

	const rankedGenres = uniqueGenres
		.map((genre, index) => ({
			genre,
			index,
			score:
				genre === "other" ? Number.MAX_SAFE_INTEGER : (frequency[genre] ?? 0),
		}))
		.sort((first, second) => {
			if (first.score !== second.score) return first.score - second.score;
			return first.index - second.index;
		})
		.map((entry) => entry.genre);

	const visibleGenres = rankedGenres.slice(0, limit);

	return {
		visibleGenres,
		hiddenGenreCount: Math.max(0, uniqueGenres.length - visibleGenres.length),
	};
}
