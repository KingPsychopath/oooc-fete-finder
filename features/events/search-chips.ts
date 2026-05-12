import {
	getSearchableGenreText,
	normalizeSearchText,
	toGenreLabel,
} from "@/features/events/genre-normalization";
import {
	EVENT_TYPES,
	type Event,
	MUSIC_GENRES,
	formatPrice,
	getEventDayNightPeriods,
} from "@/features/events/types";
import { shouldDisplayFeaturedEvent } from "./featured/utils/timestamp-utils";
import { DEFAULT_SEARCH_EXAMPLES } from "./search-defaults";

export type SearchChipSource = "static" | "popular";

export interface SearchChip {
	label: string;
	query: string;
	source: SearchChipSource;
	kind?: SearchChipCandidateKind;
}

export interface SearchChipSignal {
	query: string;
	count: number;
	recentCount?: number;
	lastSeenAt?: string;
}

type SearchChipCandidateKind = "facet" | "genre" | "event" | "venue" | "tag";

interface SearchChipCandidate {
	label: string;
	query: string;
	aliases: string[];
	resultCount: number;
	kind: SearchChipCandidateKind;
	isPaidPlacement?: boolean;
}

type MatchedCandidate = {
	candidate: SearchChipCandidate;
	score: number;
	confidence: number;
	totalCount: number;
};

const MAX_DYNAMIC_CHIPS = 4;
const MIN_SIGNAL_COUNT = 2;
const MIN_RESULT_COUNT = 1;
const MAX_PUBLIC_LABEL_LENGTH = 32;
const MAX_EVENT_LABEL_LENGTH = 24;
const MIN_EVENT_CHIPS = 2;

const SENSITIVE_PATTERNS = [
	/@/,
	/\b\d{3,}[\s.-]?\d{3,}\b/,
	/\bhttps?:\/\//,
	/\b[a-z0-9._%+-]+\s+at\s+[a-z0-9.-]+\s+dot\s+[a-z]{2,}\b/i,
] as const;

const BLOCKED_TERMS = new Set([
	"fuck",
	"shit",
	"bitch",
	"cunt",
	"nigger",
	"nigga",
	"porn",
	"sex",
	"nazi",
]);

const normalize = (value: string): string => normalizeSearchText(value);

const titleCase = (value: string): string =>
	value
		.split(/\s+/)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");

const shortenLabel = (value: string, maxLength: number): string => {
	const clean = value.replace(/\s+/g, " ").trim();
	if (clean.length <= maxLength) return clean;
	const slice = clean.slice(0, maxLength + 1);
	const lastSpaceIndex = slice.lastIndexOf(" ");
	const shortened =
		lastSpaceIndex >= 12
			? slice.slice(0, lastSpaceIndex)
			: clean.slice(0, maxLength);
	return `${shortened.trim()}...`;
};

const getOrdinalSuffix = (day: number): string => {
	const mod100 = day % 100;
	if (mod100 >= 11 && mod100 <= 13) return "th";
	switch (day % 10) {
		case 1:
			return "st";
		case 2:
			return "nd";
		case 3:
			return "rd";
		default:
			return "th";
	}
};

const getEventDayAliases = (event: Event): string[] => {
	const dateParts = event.date.split("-");
	const dayOfMonth = Number.parseInt(dateParts[2] ?? "", 10);
	if (!Number.isFinite(dayOfMonth) || dayOfMonth < 1) return [];
	return [String(dayOfMonth), `${dayOfMonth}${getOrdinalSuffix(dayOfMonth)}`];
};

const levenshteinDistance = (left: string, right: string): number => {
	if (left === right) return 0;
	if (left.length === 0) return right.length;
	if (right.length === 0) return left.length;
	const previous = Array.from(
		{ length: right.length + 1 },
		(_, index) => index,
	);
	const current = Array.from({ length: right.length + 1 }, () => 0);
	for (let i = 1; i <= left.length; i += 1) {
		current[0] = i;
		for (let j = 1; j <= right.length; j += 1) {
			const substitutionCost = left[i - 1] === right[j - 1] ? 0 : 1;
			current[j] = Math.min(
				previous[j] + 1,
				current[j - 1] + 1,
				previous[j - 1] + substitutionCost,
			);
		}
		for (let j = 0; j <= right.length; j += 1) {
			previous[j] = current[j];
		}
	}
	return previous[right.length];
};

const isSafePublicQuery = (query: string): boolean => {
	const normalized = normalize(query);
	if (normalized.length < 3) return false;
	if (normalized.length > 80) return false;
	if (SENSITIVE_PATTERNS.some((pattern) => pattern.test(query))) return false;
	const tokens = normalized.split(" ");
	return tokens.every((token) => !BLOCKED_TERMS.has(token));
};

const isEligibleEventCandidate = (event: Event): boolean => {
	if (event.detailsQuality === "blocking") return false;
	if (!event.location?.trim()) return false;
	if (!event.time?.trim() || event.time === "TBC") return false;
	if (!event.link?.trim()) return false;
	return true;
};

const addCandidate = (
	candidates: Map<string, SearchChipCandidate>,
	input: SearchChipCandidate,
): void => {
	const canonical = normalize(input.label);
	if (!canonical) return;
	const existing = candidates.get(canonical);
	if (!existing) {
		candidates.set(canonical, {
			...input,
			aliases: Array.from(
				new Set(input.aliases.map(normalize).filter(Boolean)),
			),
		});
		return;
	}
	existing.resultCount += input.resultCount;
	existing.aliases = Array.from(
		new Set([
			...existing.aliases,
			...input.aliases.map(normalize).filter(Boolean),
		]),
	);
};

const buildCandidates = (events: Event[]): SearchChipCandidate[] => {
	const candidates = new Map<string, SearchChipCandidate>();
	const genreLabelByKey = new Map<string, string>(
		MUSIC_GENRES.map((genre) => [genre.key, genre.label]),
	);

	const facetCounts = new Map<string, number>();
	const tagCounts = new Map<string, number>();
	const venueCounts = new Map<string, number>();
	const eventNameCounts = new Map<string, number>();
	const genreCounts = new Map<string, number>();

	for (const event of events) {
		if (normalize(formatPrice(event.price)) === "free") {
			facetCounts.set("Free", (facetCounts.get("Free") ?? 0) + 1);
		}
		for (const period of getEventDayNightPeriods(event)) {
			const label = period === "day" ? "Day" : "Night";
			facetCounts.set(label, (facetCounts.get(label) ?? 0) + 1);
		}
		facetCounts.set(
			titleCase(String(event.day)),
			(facetCounts.get(titleCase(String(event.day))) ?? 0) + 1,
		);
		facetCounts.set(event.type, (facetCounts.get(event.type) ?? 0) + 1);
		for (const dayAlias of getEventDayAliases(event)) {
			facetCounts.set(dayAlias, (facetCounts.get(dayAlias) ?? 0) + 1);
		}
		for (const genre of event.genre ?? []) {
			const label = genreLabelByKey.get(genre) ?? toGenreLabel(genre);
			genreCounts.set(label, (genreCounts.get(label) ?? 0) + 1);
		}
		for (const tag of event.tags ?? []) {
			const cleanTag = tag.replace(/\s+/g, " ").trim();
			if (cleanTag.length >= 3 && cleanTag.length <= MAX_PUBLIC_LABEL_LENGTH) {
				tagCounts.set(cleanTag, (tagCounts.get(cleanTag) ?? 0) + 1);
			}
		}
		const location = event.location?.replace(/\s+/g, " ").trim();
		if (
			location &&
			location.length >= 3 &&
			location.length <= MAX_PUBLIC_LABEL_LENGTH
		) {
			venueCounts.set(location, (venueCounts.get(location) ?? 0) + 1);
		}
		const name = event.name.replace(/\s+/g, " ").trim();
		if (
			name.length >= 3 &&
			isSafePublicQuery(name) &&
			isEligibleEventCandidate(event)
		) {
			eventNameCounts.set(name, (eventNameCounts.get(name) ?? 0) + 1);
		}
	}

	for (const [label, resultCount] of facetCounts) {
		addCandidate(candidates, {
			label,
			query: label,
			aliases: [label],
			resultCount,
			kind: "facet",
		});
	}
	for (const eventType of EVENT_TYPES) {
		const resultCount = facetCounts.get(eventType.label) ?? 0;
		if (resultCount > 0) {
			addCandidate(candidates, {
				label: eventType.label,
				query: eventType.label,
				aliases: [eventType.label, eventType.key],
				resultCount,
				kind: "facet",
			});
		}
	}
	for (const [label, resultCount] of genreCounts) {
		addCandidate(candidates, {
			label,
			query: label,
			aliases: [label, getSearchableGenreText(normalize(label))],
			resultCount,
			kind: "genre",
		});
	}
	for (const [label, resultCount] of tagCounts) {
		addCandidate(candidates, {
			label,
			query: label,
			aliases: [label],
			resultCount,
			kind: "tag",
		});
	}
	for (const [label, resultCount] of venueCounts) {
		addCandidate(candidates, {
			label,
			query: label,
			aliases: [label],
			resultCount,
			kind: "venue",
		});
	}
	for (const [eventName, resultCount] of eventNameCounts) {
		const event = events.find(
			(candidate) => candidate.name.trim() === eventName,
		);
		addCandidate(candidates, {
			label: shortenLabel(eventName, MAX_EVENT_LABEL_LENGTH),
			query: eventName,
			aliases: [eventName],
			resultCount,
			kind: "event",
			isPaidPlacement:
				event?.isPromoted === true ||
				(event ? shouldDisplayFeaturedEvent(event) : false),
		});
	}
	return [...candidates.values()].filter(
		(candidate) =>
			candidate.resultCount >= MIN_RESULT_COUNT &&
			candidate.label.length <= MAX_PUBLIC_LABEL_LENGTH &&
			isSafePublicQuery(candidate.label),
	);
};

const getKindScoreAdjustment = (kind: SearchChipCandidate["kind"]): number => {
	switch (kind) {
		case "facet":
			return 4;
		case "genre":
			return 3;
		case "tag":
			return 2;
		case "venue":
			return 0;
		case "event":
			return -1;
	}
};

const getMatchConfidence = (
	query: string,
	candidate: SearchChipCandidate,
): number => {
	const normalizedQuery = normalize(query);
	if (!normalizedQuery) return 0;
	const compactQuery = normalizedQuery.replace(/\s+/g, "");

	let best = 0;
	for (const alias of candidate.aliases) {
		const compactAlias = alias.replace(/\s+/g, "");
		if (!compactAlias) continue;
		if (normalizedQuery === alias || compactQuery === compactAlias) {
			best = Math.max(best, 1);
			continue;
		}
		if (alias.includes(normalizedQuery) || normalizedQuery.includes(alias)) {
			best = Math.max(best, 0.84);
			continue;
		}
		const minLength = Math.min(compactQuery.length, compactAlias.length);
		const maxLength = Math.max(compactQuery.length, compactAlias.length);
		if (minLength < 4) continue;
		const distance = levenshteinDistance(compactQuery, compactAlias);
		const ratio = maxLength === 0 ? 1 : distance / maxLength;
		if (distance <= 1 && ratio <= 0.22) best = Math.max(best, 0.78);
		if (minLength >= 7 && distance <= 2 && ratio <= 0.24) {
			best = Math.max(best, 0.72);
		}
	}
	return best;
};

export const buildStaticSearchChips = (): SearchChip[] =>
	DEFAULT_SEARCH_EXAMPLES.map((label) => ({
		label,
		query: label,
		source: "static",
	}));

export const buildDynamicSearchChips = (
	signals: SearchChipSignal[],
	events: Event[],
	options?: {
		maxChips?: number;
		staticQueries?: readonly string[];
		suppressedEventQueries?: readonly string[];
	},
): SearchChip[] => {
	const maxChips = Math.max(
		0,
		Math.min(options?.maxChips ?? MAX_DYNAMIC_CHIPS, 6),
	);
	if (maxChips === 0 || signals.length === 0 || events.length === 0) return [];

	const staticQueries = new Set(
		(options?.staticQueries ?? DEFAULT_SEARCH_EXAMPLES).map((query) =>
			normalize(query),
		),
	);
	const candidates = buildCandidates(events);
	const matches = new Map<string, MatchedCandidate>();
	const suppressedEventQueries = new Set(
		(options?.suppressedEventQueries ?? []).map((query) => normalize(query)),
	);

	for (const signal of signals) {
		if (signal.count < MIN_SIGNAL_COUNT || !isSafePublicQuery(signal.query))
			continue;
		for (const candidate of candidates) {
			const canonical = normalize(candidate.label);
			if (staticQueries.has(canonical)) continue;
			const confidence = getMatchConfidence(signal.query, candidate);
			if (confidence < 0.72) continue;
			const recentBoost = (signal.recentCount ?? 0) * 1.5;
			const resultQualityBoost = Math.min(candidate.resultCount, 8);
			const kindBoost = getKindScoreAdjustment(candidate.kind);
			const placementPenalty =
				candidate.kind === "event" && candidate.isPaidPlacement ? 8 : 0;
			const score =
				signal.count +
				recentBoost +
				resultQualityBoost +
				kindBoost +
				confidence * 6 -
				placementPenalty;
			const current = matches.get(canonical);
			if (!current || score > current.score) {
				matches.set(canonical, {
					candidate,
					score,
					confidence,
					totalCount: signal.count,
				});
			} else {
				current.totalCount += signal.count;
				current.score += signal.count * 0.3;
			}
		}
	}

	const rankedMatches = [...matches.values()].sort((left, right) => {
		if (right.score !== left.score) return right.score - left.score;
		if (right.totalCount !== left.totalCount)
			return right.totalCount - left.totalCount;
		return left.candidate.label.localeCompare(right.candidate.label);
	});
	const selected: MatchedCandidate[] = [];
	const targetEventChips = Math.min(MIN_EVENT_CHIPS, maxChips);
	for (const match of rankedMatches) {
		if (selected.length >= targetEventChips) break;
		if (match.candidate.kind !== "event") continue;
		if (suppressedEventQueries.has(normalize(match.candidate.query))) continue;
		selected.push(match);
	}
	if (selected.length < targetEventChips) {
		for (const match of rankedMatches) {
			if (selected.length >= targetEventChips) break;
			if (match.candidate.kind !== "event") continue;
			if (
				selected.some((item) => item.candidate.query === match.candidate.query)
			) {
				continue;
			}
			selected.push(match);
		}
	}
	for (const match of rankedMatches) {
		if (selected.length >= maxChips) break;
		if (
			selected.some((item) => item.candidate.label === match.candidate.label)
		) {
			continue;
		}
		if (
			match.candidate.kind === "event" &&
			suppressedEventQueries.has(normalize(match.candidate.query))
		) {
			continue;
		}
		selected.push(match);
	}
	for (const match of rankedMatches) {
		if (selected.length >= maxChips || selected.length > 0) break;
		if (match.candidate.kind !== "event") continue;
		if (
			selected.some((item) => item.candidate.label === match.candidate.label)
		) {
			continue;
		}
		selected.push(match);
	}

	return selected
		.sort((left, right) => {
			if (right.score !== left.score) return right.score - left.score;
			if (right.totalCount !== left.totalCount)
				return right.totalCount - left.totalCount;
			return left.candidate.label.localeCompare(right.candidate.label);
		})
		.map(({ candidate }) => ({
			label: candidate.label,
			query: candidate.query,
			source: "popular",
			kind: candidate.kind,
		}));
};
