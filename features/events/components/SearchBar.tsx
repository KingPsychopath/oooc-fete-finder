"use client";

import { Button } from "@/components/ui/button";
import {
	getSearchableGenreText,
	normalizeSearchText,
} from "@/features/events/genre-normalization";
import type { SearchChip } from "@/features/events/search-chips";
import { DEFAULT_SEARCH_EXAMPLES } from "@/features/events/search-defaults";
import {
	type Event,
	type ParisArrondissement,
	formatLocationAreaLong,
	formatPrice,
	getEventDayNightPeriods,
	getEventLocationSearchText,
} from "@/features/events/types";
import { useAppHaptics } from "@/hooks/useAppHaptics";
import { Search, TrendingUp, X } from "lucide-react";
import type React from "react";
import { useState } from "react";

type SearchBarProps = {
	onSearch: (
		query: string,
		results?: SearchResult[],
		source?: SearchIntentSource,
	) => void;
	onSearchFocus?: () => void;
	placeholder?: string;
	className?: string;
	exampleSearches?: string[];
	events?: Event[];
	resultsCount?: number;
	showResultsCount?: boolean;
	resultsCountLabelMode?: "found" | "available";
	value?: string;
	dynamicChips?: SearchChip[];
	inputId?: string;
};

type SearchResult = {
	event: Event;
	score: number;
	matchedFields: string[];
};

export type SearchIntentSource = "input" | "curated_chip" | "popular_chip";

/**
 * Extracts arrondissement number from any format
 * Handles: "9", "9er", "9th", "9ème", "18th", etc.
 */
const extractArrondissementNumber = (text: string): number | null => {
	// Remove all spaces and normalize
	const cleaned = text.replace(/\s+/g, "").toLowerCase();

	// Match patterns: number optionally followed by suffix
	const patterns = [
		/^(\d{1,2})(?:th|er|ème|eme)?$/, // "9", "9th", "9er", "9ème"
		/(\d{1,2})(?:th|er|ème|eme)/, // Extract from longer strings
		/^(\d{1,2})$/, // Just the number
	];

	for (const pattern of patterns) {
		const match = cleaned.match(pattern);
		if (match) {
			const num = parseInt(match[1]);
			if (num >= 1 && num <= 20) {
				return num;
			}
		}
	}

	return null;
};

/**
 * Checks if text contains arrondissement match
 */
const matchesArrondissement = (
	eventArr: ParisArrondissement,
	searchTerms: string[],
): boolean => {
	if (
		searchTerms.some((term) =>
			normalizeSearchText(formatLocationAreaLong(eventArr)).includes(term),
		)
	) {
		return true;
	}

	const eventArrNum =
		typeof eventArr === "string" ? parseInt(eventArr) : eventArr;
	if (isNaN(eventArrNum)) return false;

	return searchTerms.some((term) => {
		const extractedNum = extractArrondissementNumber(term);
		return extractedNum === eventArrNum;
	});
};

/**
 * Scores how well search terms match against target text
 */
const getMatchScore = (targetText: string, searchTerms: string[]): number => {
	if (!targetText) return 0;
	const target = normalizeSearchText(targetText);
	let score = 0;

	searchTerms.forEach((term) => {
		if (target.includes(term)) {
			// Exact substring match
			score += term.length * 2;
		} else if (term.length > 2) {
			// Partial match for longer terms
			for (let i = 2; i <= term.length; i++) {
				if (target.includes(term.substring(0, i))) {
					score += i;
					break;
				}
			}
		}
	});

	return score;
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

/**
 * Performs intelligent fuzzy search across all event fields
 * Supports multiple search terms and partial matching
 */
const searchEvents = (events: Event[], query: string): SearchResult[] => {
	if (!query.trim() || !events || events.length === 0) return [];

	// Split query into individual search terms and clean them
	const searchTerms = (
		query.trim() ? normalizeSearchText(query).split(/\s+/) : []
	)
		.filter((term) => term.length > 0)
		.map((term) => term.trim());

	if (searchTerms.length === 0) return [];

	const results: SearchResult[] = [];

	events.forEach((event) => {
		let totalScore = 0;
		const matchedFields: string[] = [];

		// PRIORITY 1: Arrondissement (Score: 100 per match)
		if (matchesArrondissement(event.arrondissement, searchTerms)) {
			totalScore += 100;
			matchedFields.push("arrondissement");
		}

		// PRIORITY 2: Event Name (Score: 80 + match quality)
		if (event.name) {
			const nameScore = getMatchScore(event.name, searchTerms);
			if (nameScore > 0) {
				totalScore += 80 + nameScore;
				matchedFields.push("name");
			}
		}

		// PRIORITY 3: Location (Score: 60 + match quality)
		const locationSearchText = getEventLocationSearchText(event);
		if (locationSearchText) {
			const locationScore = getMatchScore(locationSearchText, searchTerms);
			if (locationScore > 0) {
				totalScore += 60 + locationScore;
				matchedFields.push("location");
			}
		}

		// PRIORITY 4: Genres (Score: 40 + match quality)
		if (event.genre && Array.isArray(event.genre)) {
			let genreScore = 0;
			const hasGenreMatch = event.genre.some((genre) => {
				const score = getMatchScore(getSearchableGenreText(genre), searchTerms);
				genreScore = Math.max(genreScore, score);
				return score > 0;
			});

			if (hasGenreMatch) {
				totalScore += 40 + genreScore;
				matchedFields.push("genre");
			}
		}

		// PRIORITY 5: Metadata tags (Score: 35 + match quality)
		if (event.tags && Array.isArray(event.tags)) {
			let tagScore = 0;
			const hasTagMatch = event.tags.some((tag) => {
				const score = getMatchScore(tag, searchTerms);
				tagScore = Math.max(tagScore, score);
				return score > 0;
			});

			if (hasTagMatch) {
				totalScore += 35 + tagScore;
				matchedFields.push("tags");
			}
		}

		// PRIORITY 6: Event Type (Score: 30 + match quality)
		if (event.type) {
			const typeScore = getMatchScore(event.type, searchTerms);
			if (typeScore > 0) {
				totalScore += 30 + typeScore;
				matchedFields.push("type");
			}
		}

		// PRIORITY 6.5: Price and day/night facets (Score: 28 + match quality)
		const priceScore = getMatchScore(formatPrice(event.price), searchTerms);
		if (priceScore > 0) {
			totalScore += 28 + priceScore;
			matchedFields.push("price");
		}
		for (const dayNightPeriod of getEventDayNightPeriods(event)) {
			const periodScore = getMatchScore(dayNightPeriod, searchTerms);
			if (periodScore > 0) {
				totalScore += 28 + periodScore;
				matchedFields.push("day/night");
			}
		}

		// PRIORITY 7: Description (Score: 20 + match quality)
		if (event.description) {
			const descScore = getMatchScore(event.description, searchTerms);
			if (descScore > 0) {
				totalScore += 20 + descScore;
				matchedFields.push("description");
			}
		}

		// PRIORITY 8: Time (Score: 15 + match quality)
		if (event.time) {
			const timeScore = getMatchScore(event.time, searchTerms);
			if (timeScore > 0) {
				totalScore += 15 + timeScore;
				matchedFields.push("time");
			}
		}

		// PRIORITY 9: Day (Score: 10 + match quality)
		if (event.day) {
			const dayScore = getMatchScore(event.day, searchTerms);
			if (dayScore > 0) {
				totalScore += 10 + dayScore;
				matchedFields.push("day");
			}
		}

		if (event.date) {
			const [, , dayRaw] = event.date.split("-");
			const dayOfMonth = Number.parseInt(dayRaw ?? "", 10);
			const dateText =
				Number.isFinite(dayOfMonth) && dayOfMonth > 0
					? `${event.date} ${dayOfMonth} ${dayOfMonth}${getOrdinalSuffix(dayOfMonth)}`
					: event.date;
			const dateScore = getMatchScore(dateText, searchTerms);
			if (dateScore > 0) {
				totalScore += 10 + dateScore;
				matchedFields.push("date");
			}
		}

		// Bonus: Multiple field matches (collaborative filtering)
		if (matchedFields.length > 1) {
			totalScore += matchedFields.length * 5;
		}

		// Only include events with meaningful matches
		if (totalScore > 0) {
			results.push({
				event,
				score: totalScore,
				matchedFields,
			});
		}
	});

	// Sort by score in descending order
	return results.sort((a, b) => b.score - a.score);
};

const SearchBar: React.FC<SearchBarProps> = ({
	onSearch,
	onSearchFocus,
	placeholder = "Search events...",
	className = "",
	exampleSearches = [...DEFAULT_SEARCH_EXAMPLES],
	events = [],
	resultsCount,
	showResultsCount = false,
	resultsCountLabelMode = "found",
	value,
	dynamicChips = [],
	inputId,
}) => {
	const haptics = useAppHaptics();
	const [internalQuery, setInternalQuery] = useState("");
	const isControlled = value !== undefined;
	const query = value ?? internalQuery;

	/**
	 * Handles search input with real-time fuzzy matching
	 */
	const handleSearch = (
		value: string,
		source: SearchIntentSource = "input",
	) => {
		if (!isControlled) {
			setInternalQuery(value);
		}
		const results = searchEvents(events, value);
		onSearch(value, results, source);
	};

	/**
	 * Clears the search input and results
	 */
	const clearSearch = () => {
		haptics.light();
		if (!isControlled) {
			setInternalQuery("");
		}
		onSearch("");
	};

	return (
		<div
			className={`relative min-w-0 overflow-hidden rounded-xl border border-border/55 bg-background/48 p-3 shadow-none backdrop-blur ${className}`}
		>
			{/* Search Input */}
			<div className="relative min-w-0">
				<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
				<input
					id={inputId}
					type="text"
					value={query}
					onChange={(e) => handleSearch(e.target.value)}
					onFocus={onSearchFocus}
					placeholder={placeholder}
					className="min-w-0 w-full rounded-full border border-border/75 bg-background/70 py-2 pr-10 pl-10 text-sm placeholder:text-muted-foreground/90 focus:outline-none focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-ring"
					aria-label={placeholder}
				/>
				{query && (
					<Button
						variant="ghost"
						size="sm"
						onClick={clearSearch}
						className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-muted"
						aria-label="Clear search"
					>
						<X className="h-3 w-3" />
					</Button>
				)}
			</div>

			{showResultsCount && typeof resultsCount === "number" && (
				<div className="mt-2 px-1">
					<p className="text-[11px] tracking-[0.04em] text-muted-foreground">
						<span className="font-medium text-foreground/80">
							{resultsCount.toLocaleString()}
						</span>{" "}
						event{resultsCount !== 1 ? "s" : ""} {resultsCountLabelMode}
					</p>
				</div>
			)}

			{/* Example Search Chips */}
			<div className={`${showResultsCount ? "mt-2" : "mt-3"} min-w-0`}>
				<div className="flex min-w-0 flex-wrap gap-1.5">
					{exampleSearches.map((example) => (
						<Button
							key={example}
							variant="outline"
							size="sm"
							onClick={() => {
								haptics.selection();
								handleSearch(example, "curated_chip");
							}}
							className="h-auto min-w-0 max-w-full rounded-full border-border/60 px-3 py-1.5 text-xs transition-colors hover:border-border hover:bg-accent/50"
						>
							<span className="truncate">{example}</span>
						</Button>
					))}
				</div>
			</div>
			{dynamicChips.length > 0 && (
				<div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5">
					<span className="inline-flex h-7 items-center rounded-full px-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
						Popular now
					</span>
					{dynamicChips.map((chip) => (
						<Button
							key={`popular-${chip.label}`}
							variant="outline"
							size="sm"
							onClick={() => {
								haptics.selection();
								handleSearch(chip.query, "popular_chip");
							}}
							className="h-auto min-w-0 max-w-full rounded-full border-amber-300/70 bg-amber-50/55 px-3 py-1.5 text-xs text-amber-950 transition-colors hover:border-amber-400 hover:bg-amber-100/70 sm:max-w-[13rem] dark:border-amber-500/45 dark:bg-amber-950/25 dark:text-amber-100"
							aria-label={`Popular now: ${chip.label}`}
							title="Based on recent anonymous searches"
						>
							<TrendingUp className="mr-1.5 h-3 w-3" aria-hidden="true" />
							<span className="truncate">{chip.label}</span>
						</Button>
					))}
				</div>
			)}
		</div>
	);
};

export default SearchBar;
