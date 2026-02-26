"use client";

import { Button } from "@/components/ui/button";
import { DEFAULT_SEARCH_EXAMPLES } from "@/features/events/search-defaults";
import type { Event } from "@/features/events/types";
import { Search, X } from "lucide-react";
import type React from "react";
import { useState } from "react";

type SearchBarProps = {
	onSearch: (query: string, results?: SearchResult[]) => void;
	placeholder?: string;
	className?: string;
	exampleSearches?: string[];
	events?: Event[];
	resultsCount?: number;
	showResultsCount?: boolean;
	resultsCountLabelMode?: "found" | "available";
};

type SearchResult = {
	event: Event;
	score: number;
	matchedFields: string[];
};

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
	eventArr: number | string,
	searchTerms: string[],
): boolean => {
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
	const target = targetText.toLowerCase();
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

/**
 * Performs intelligent fuzzy search across all event fields
 * Supports multiple search terms and partial matching
 */
const searchEvents = (events: Event[], query: string): SearchResult[] => {
	if (!query.trim() || !events || events.length === 0) return [];

	// Split query into individual search terms and clean them
	const searchTerms = query
		.toLowerCase()
		.split(/\s+/)
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
		if (event.location) {
			const locationScore = getMatchScore(event.location, searchTerms);
			if (locationScore > 0) {
				totalScore += 60 + locationScore;
				matchedFields.push("location");
			}
		}

		// PRIORITY 4: Genres (Score: 40 + match quality)
		if (event.genre && Array.isArray(event.genre)) {
			let genreScore = 0;
			const hasGenreMatch = event.genre.some((genre) => {
				const score = getMatchScore(genre, searchTerms);
				genreScore = Math.max(genreScore, score);
				return score > 0;
			});

			if (hasGenreMatch) {
				totalScore += 40 + genreScore;
				matchedFields.push("genre");
			}
		}

		// PRIORITY 5: Event Type (Score: 30 + match quality)
		if (event.type) {
			const typeScore = getMatchScore(event.type, searchTerms);
			if (typeScore > 0) {
				totalScore += 30 + typeScore;
				matchedFields.push("type");
			}
		}

		// PRIORITY 6: Description (Score: 20 + match quality)
		if (event.description) {
			const descScore = getMatchScore(event.description, searchTerms);
			if (descScore > 0) {
				totalScore += 20 + descScore;
				matchedFields.push("description");
			}
		}

		// PRIORITY 7: Time (Score: 15 + match quality)
		if (event.time) {
			const timeScore = getMatchScore(event.time, searchTerms);
			if (timeScore > 0) {
				totalScore += 15 + timeScore;
				matchedFields.push("time");
			}
		}

		// PRIORITY 8: Day (Score: 10 + match quality)
		if (event.day) {
			const dayScore = getMatchScore(event.day, searchTerms);
			if (dayScore > 0) {
				totalScore += 10 + dayScore;
				matchedFields.push("day");
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
	placeholder = "Search events...",
	className = "",
	exampleSearches = [...DEFAULT_SEARCH_EXAMPLES],
	events = [],
	resultsCount,
	showResultsCount = false,
	resultsCountLabelMode = "found",
}) => {
	const [query, setQuery] = useState("");

	/**
	 * Handles search input with real-time fuzzy matching
	 */
	const handleSearch = (value: string) => {
		setQuery(value);
		const results = searchEvents(events, value);
		onSearch(value, results);
	};

	/**
	 * Clears the search input and results
	 */
	const clearSearch = () => {
		setQuery("");
		onSearch("");
	};

	return (
		<div
			className={`relative rounded-xl border p-3 ooo-site-card-soft ${className}`}
		>
			{/* Search Input */}
			<div className="relative">
				<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
				<input
					type="text"
					value={query}
					onChange={(e) => handleSearch(e.target.value)}
					placeholder={placeholder}
					className="w-full rounded-full border border-border/75 bg-background/70 py-2 pr-10 pl-10 text-sm placeholder:text-muted-foreground/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent"
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
			<div
				className={`${showResultsCount ? "mt-2" : "mt-3"} flex flex-wrap gap-1.5`}
			>
				{exampleSearches.map((example) => (
					<Button
						key={example}
						variant="outline"
						size="sm"
						onClick={() => handleSearch(example)}
						className="text-xs px-3 py-1.5 h-auto rounded-full border-border/60 hover:border-border hover:bg-accent/50 transition-colors"
					>
						{example}
					</Button>
				))}
			</div>
		</div>
	);
};

export default SearchBar;
