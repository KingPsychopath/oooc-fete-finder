import {
	type Event,
	type EventExperienceCategory,
	getPriceMeta,
	getResolvedEventExperienceCategoryDefinition,
} from "@/features/events/types";
import type {
	PlanPreferenceInput,
	PlanRouteLeg,
	PlanSuggestionMode,
	SuggestedPlan,
} from "@/features/plans/types";

const EARTH_RADIUS_KM = 6371;
const MIN_ROUTE_START_GAP_MINUTES = 60;

const DEFAULT_PREFERENCES: Omit<PlanPreferenceInput, "date"> = {
	stopCount: 3,
	startPeriod: "anytime",
	vibes: [],
	travelTolerance: "balanced",
	budget: "any",
	mustIncludeEventKeys: [],
	preferSavedEvents: true,
};

interface EventSignals {
	savedEventKeys?: Iterable<string>;
	recentEventKeys?: Iterable<string>;
	calendarEventKeys?: Iterable<string>;
	preferredCategories?: Iterable<EventExperienceCategory>;
}

export interface BuildSuggestedPlansInput {
	events: Event[];
	date: string;
	preferences?: Partial<PlanPreferenceInput>;
	signals?: EventSignals;
	excludedEventKeys?: Iterable<string>;
	maxSuggestions?: number;
}

interface Candidate {
	event: Event;
	category: EventExperienceCategory | null;
	startMinutes: number | null;
	score: number;
	reasons: string[];
}

const normalizeKey = (value: string): string => value.trim().toLowerCase();

const toKeySet = (values: Iterable<string> | undefined): Set<string> =>
	new Set(Array.from(values ?? [], normalizeKey).filter(Boolean));

const parseTimeToMinutes = (value: string | undefined): number | null => {
	if (!value || value.toLowerCase() === "tbc") return null;
	const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
	if (!match) return null;
	const hours = Number.parseInt(match[1], 10);
	const minutes = Number.parseInt(match[2], 10);
	if (hours < 0 || hours > 29 || minutes < 0 || minutes > 59) return null;
	return hours * 60 + minutes;
};

const periodScore = (
	minutes: number | null,
	period: PlanPreferenceInput["startPeriod"],
): number => {
	if (period === "anytime" || minutes == null) return 0;
	if (period === "day")
		return minutes >= 10 * 60 && minutes < 18 * 60 ? 12 : -8;
	if (period === "evening")
		return minutes >= 17 * 60 && minutes < 22 * 60 ? 12 : -6;
	return minutes >= 21 * 60 ? 12 : -5;
};

const resolveBudgetBucket = (
	price: string | undefined,
): "free" | "low" | "paid" | "unknown" => {
	const priceMeta = getPriceMeta(price);
	if (priceMeta.kind === "free") return "free";
	if (priceMeta.minPrice === null) return "unknown";
	if (priceMeta.minPrice === 0 && priceMeta.maxPrice === 0) return "free";
	if (priceMeta.minPrice <= 15) return "low";
	return "paid";
};

export const distanceKmBetweenEvents = (
	left: Pick<Event, "coordinates">,
	right: Pick<Event, "coordinates">,
): number | null => {
	if (!left.coordinates || !right.coordinates) return null;
	const leftLat = (left.coordinates.lat * Math.PI) / 180;
	const rightLat = (right.coordinates.lat * Math.PI) / 180;
	const deltaLat =
		((right.coordinates.lat - left.coordinates.lat) * Math.PI) / 180;
	const deltaLng =
		((right.coordinates.lng - left.coordinates.lng) * Math.PI) / 180;
	const a =
		Math.sin(deltaLat / 2) ** 2 +
		Math.cos(leftLat) * Math.cos(rightLat) * Math.sin(deltaLng / 2) ** 2;
	return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const estimateTravelMinutes = (
	distanceKm: number | null,
): number | null => {
	if (distanceKm == null) return null;
	return Math.max(8, Math.round(distanceKm * 7 + 6));
};

const buildPreferenceInput = (
	date: string,
	preferences: Partial<PlanPreferenceInput> | undefined,
): PlanPreferenceInput => {
	const mustIncludeEventKeys = preferences?.mustIncludeEventKeys ?? [];
	return {
		...DEFAULT_PREFERENCES,
		...preferences,
		date,
		stopCount: Math.max(
			Math.min(Math.max(preferences?.stopCount ?? 3, 2), 4),
			mustIncludeEventKeys.length,
		),
		mustIncludeEventKeys,
		vibes: preferences?.vibes ?? [],
	};
};

const scoreCandidate = (
	event: Event,
	preferences: PlanPreferenceInput,
	signals: Required<
		Pick<
			EventSignals,
			"savedEventKeys" | "recentEventKeys" | "calendarEventKeys"
		>
	> & {
		savedEventKeys: Set<string>;
		recentEventKeys: Set<string>;
		calendarEventKeys: Set<string>;
		preferredCategories: Set<EventExperienceCategory>;
	},
): Candidate => {
	const eventKey = normalizeKey(event.eventKey);
	const category =
		getResolvedEventExperienceCategoryDefinition(event)?.key ?? null;
	const startMinutes = parseTimeToMinutes(event.time);
	const reasons: string[] = [];
	let score = 40;

	if (signals.savedEventKeys.has(eventKey)) {
		score += preferences.preferSavedEvents ? 28 : 14;
		reasons.push("saved");
	}
	if (signals.calendarEventKeys.has(eventKey)) {
		score += 18;
		reasons.push("calendar");
	}
	if (signals.recentEventKeys.has(eventKey)) {
		score += 9;
		reasons.push("recent");
	}
	if (category && preferences.vibes.includes(category)) {
		score += 18;
		reasons.push(category);
	}
	if (category && signals.preferredCategories.has(category)) {
		score += 10;
		reasons.push("matches activity");
	}
	if (event.isOOOCPick) {
		score += 8;
		reasons.push("OOOC pick");
	}
	if (event.socialProofSaveCount && event.socialProofSaveCount > 0) {
		score += Math.min(event.socialProofSaveCount, 10);
		reasons.push("popular");
	}

	const cost = resolveBudgetBucket(event.price);
	if (preferences.budget === "free") {
		score += cost === "free" ? 14 : -18;
	}
	if (preferences.budget === "low") {
		score += cost === "free" || cost === "low" ? 10 : -8;
	}

	score += periodScore(startMinutes, preferences.startPeriod);

	return { event, category, startMinutes, score, reasons };
};

const travelPenalty = (
	distanceKm: number | null,
	tolerance: PlanPreferenceInput["travelTolerance"],
): number => {
	if (distanceKm == null) return 5;
	const multiplier =
		tolerance === "close" ? 6 : tolerance === "balanced" ? 4 : 2;
	return Math.round(distanceKm * multiplier);
};

const createLegs = (events: Event[]): PlanRouteLeg[] =>
	events.slice(1).map((event, index) => {
		const previous = events[index];
		const distanceKm = previous
			? distanceKmBetweenEvents(previous, event)
			: null;
		return {
			fromEventKey: previous?.eventKey ?? "",
			toEventKey: event.eventKey,
			distanceKm: distanceKm == null ? null : Number(distanceKm.toFixed(2)),
			estimatedMinutes: estimateTravelMinutes(distanceKm),
		};
	});

const orderCandidates = (
	candidates: Candidate[],
	preferences: PlanPreferenceInput,
): Candidate[] => {
	const lockedKeys = new Set(
		preferences.mustIncludeEventKeys.map(normalizeKey),
	);
	const selected: Candidate[] = [];
	for (const candidate of candidates) {
		if (lockedKeys.has(normalizeKey(candidate.event.eventKey))) {
			selected.push(candidate);
		}
	}

	const hasCandidate = (candidate: Candidate): boolean =>
		selected.some(
			(item) =>
				normalizeKey(item.event.eventKey) ===
				normalizeKey(candidate.event.eventKey),
		);
	const hasBreathingRoom = (candidate: Candidate): boolean => {
		const candidateStartMinutes = candidate.startMinutes;
		return (
			candidateStartMinutes == null ||
			selected.every(
				(item) =>
					item.startMinutes == null ||
					Math.abs(candidateStartMinutes - item.startMinutes) >=
						MIN_ROUTE_START_GAP_MINUTES,
			)
		);
	};

	for (const candidate of candidates) {
		if (selected.length >= preferences.stopCount) break;
		if (hasCandidate(candidate) || !hasBreathingRoom(candidate)) {
			continue;
		}
		selected.push(candidate);
	}

	for (const candidate of candidates) {
		if (selected.length >= preferences.stopCount) break;
		if (hasCandidate(candidate)) continue;
		selected.push(candidate);
	}

	return selected.slice(0, preferences.stopCount).sort((left, right) => {
		if (left.startMinutes == null && right.startMinutes == null) {
			return right.score - left.score;
		}
		if (left.startMinutes == null) return 1;
		if (right.startMinutes == null) return -1;
		return left.startMinutes - right.startMinutes;
	});
};

const buildSuggestion = (
	mode: PlanSuggestionMode,
	title: string,
	candidates: Candidate[],
	preferences: PlanPreferenceInput,
): SuggestedPlan | null => {
	const ordered = orderCandidates(candidates, preferences);
	if (ordered.length < 2) return null;
	const events = ordered.map((candidate) => candidate.event);
	const legs = createLegs(events);
	const score =
		ordered.reduce((total, candidate) => total + candidate.score, 0) -
		legs.reduce(
			(total, leg) =>
				total + travelPenalty(leg.distanceKm, preferences.travelTolerance),
			0,
		);
	const savedCount = ordered.filter((candidate) =>
		candidate.reasons.includes("saved"),
	).length;
	const knownDistanceLegs = legs.filter((leg) => leg.distanceKm !== null);
	const routeReason =
		mode === "close"
			? "Minimizes direct distance between stops"
			: mode === "saved"
				? "Prioritizes events you saved"
				: mode === "vibe"
					? "Prioritizes your selected vibe"
					: "Best overall fit for your settings";
	const reasons = [
		routeReason,
		savedCount > 0
			? `${savedCount} saved event${savedCount === 1 ? "" : "s"}`
			: null,
		knownDistanceLegs.length > 0
			? `${knownDistanceLegs.length} direct distance gap${knownDistanceLegs.length === 1 ? "" : "s"}`
			: null,
		preferences.vibes.length > 0
			? `Matches ${preferences.vibes.join(", ")}`
			: null,
	].filter((reason): reason is string => Boolean(reason));

	return {
		id: `${mode}-${ordered.map((candidate) => candidate.event.eventKey).join("-")}`,
		title,
		date: preferences.date,
		mode,
		eventKeys: ordered.map((candidate) => candidate.event.eventKey),
		score,
		reasons,
		legs,
		preferences,
	};
};

export const buildSuggestedPlans = ({
	events,
	date,
	preferences: preferenceOverrides,
	signals = {},
	excludedEventKeys,
	maxSuggestions = 3,
}: BuildSuggestedPlansInput): SuggestedPlan[] => {
	const preferences = buildPreferenceInput(date, preferenceOverrides);
	const signalSets = {
		savedEventKeys: toKeySet(signals.savedEventKeys),
		recentEventKeys: toKeySet(signals.recentEventKeys),
		calendarEventKeys: toKeySet(signals.calendarEventKeys),
		preferredCategories: new Set(signals.preferredCategories ?? []),
	};
	const lockedKeys = new Set(
		preferences.mustIncludeEventKeys.map(normalizeKey),
	);
	const excludedKeys = toKeySet(excludedEventKeys);
	const eligible = events
		.filter((event) => event.date === date && event.eventKey)
		.filter((event) => {
			const key = normalizeKey(event.eventKey);
			return lockedKeys.has(key) || !excludedKeys.has(key);
		})
		.map((event) => scoreCandidate(event, preferences, signalSets))
		.sort((left, right) => {
			if (right.score !== left.score) return right.score - left.score;
			return left.event.name.localeCompare(right.event.name);
		});
	const isAllowedByBudget = (candidate: Candidate): boolean => {
		if (lockedKeys.has(normalizeKey(candidate.event.eventKey))) return true;
		const budgetBucket = resolveBudgetBucket(candidate.event.price);
		if (preferences.budget === "free") return budgetBucket === "free";
		if (preferences.budget === "low") {
			return budgetBucket === "free" || budgetBucket === "low";
		}
		return true;
	};
	const eligibleWithLocked = eligible.filter(
		(candidate) =>
			isAllowedByBudget(candidate) &&
			(lockedKeys.size === 0 ||
				lockedKeys.has(normalizeKey(candidate.event.eventKey)) ||
				candidate.score > 0),
	);

	const closeCandidates = [...eligibleWithLocked].sort((left, right) => {
		const leftDistance = eligibleWithLocked[0]
			? distanceKmBetweenEvents(eligibleWithLocked[0].event, left.event)
			: null;
		const rightDistance = eligibleWithLocked[0]
			? distanceKmBetweenEvents(eligibleWithLocked[0].event, right.event)
			: null;
		return (leftDistance ?? 99) - (rightDistance ?? 99);
	});
	const savedCandidates = eligibleWithLocked.filter((candidate) =>
		signalSets.savedEventKeys.has(normalizeKey(candidate.event.eventKey)),
	);
	const vibeCandidates =
		preferences.vibes.length > 0
			? eligibleWithLocked.filter(
					(candidate) =>
						candidate.category &&
						preferences.vibes.includes(candidate.category),
				)
			: eligibleWithLocked;

	const suggestions = [
		buildSuggestion("balanced", "Smart route", eligibleWithLocked, preferences),
		buildSuggestion(
			"close",
			"Low-travel route",
			closeCandidates.length >= 2 ? closeCandidates : eligibleWithLocked,
			{ ...preferences, travelTolerance: "close" },
		),
		savedCandidates.length >= 2
			? buildSuggestion("saved", "Saved-first route", savedCandidates, {
					...preferences,
					preferSavedEvents: true,
				})
			: null,
		preferences.vibes.length > 0 && vibeCandidates.length >= 2
			? buildSuggestion("vibe", "Vibe match route", vibeCandidates, preferences)
			: null,
	].filter((suggestion): suggestion is SuggestedPlan => suggestion !== null);

	const routeKeys = new Set<string>();
	const distinctSuggestions = suggestions.filter((suggestion) => {
		const routeKey = suggestion.eventKeys.map(normalizeKey).join("|");
		if (routeKeys.has(routeKey)) return false;
		routeKeys.add(routeKey);
		return true;
	});

	return distinctSuggestions.slice(0, maxSuggestions);
};
