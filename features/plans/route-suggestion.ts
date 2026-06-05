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
	routeStartTime: null,
	anchoredStops: [],
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
	endMinutes: number | null;
	score: number;
	reasons: string[];
}

interface RouteStartIntent {
	kind: "anytime" | "period" | "exact";
	minMinutes: number | null;
	maxMinutes: number | null;
	targetMinutes: number | null;
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

const getRouteStartIntent = (
	preferences: PlanPreferenceInput,
): RouteStartIntent => {
	const exactStartMinutes = parseTimeToMinutes(
		preferences.routeStartTime ?? undefined,
	);
	if (exactStartMinutes !== null) {
		return {
			kind: "exact",
			minMinutes: exactStartMinutes,
			maxMinutes: null,
			targetMinutes: exactStartMinutes,
		};
	}

	if (preferences.startPeriod === "day") {
		return {
			kind: "period",
			minMinutes: 10 * 60,
			maxMinutes: 18 * 60,
			targetMinutes: 10 * 60,
		};
	}
	if (preferences.startPeriod === "evening") {
		return {
			kind: "period",
			minMinutes: 17 * 60,
			maxMinutes: 22 * 60,
			targetMinutes: 17 * 60,
		};
	}
	if (preferences.startPeriod === "late") {
		return {
			kind: "period",
			minMinutes: 21 * 60,
			maxMinutes: null,
			targetMinutes: 21 * 60,
		};
	}

	return {
		kind: "anytime",
		minMinutes: null,
		maxMinutes: null,
		targetMinutes: null,
	};
};

const isInStartWindow = (
	candidate: Candidate,
	intent: RouteStartIntent,
): boolean => {
	if (intent.kind === "anytime" || candidate.startMinutes === null) return true;
	if (intent.kind === "exact") {
		if (candidate.startMinutes >= (intent.targetMinutes ?? 0)) return true;
		return (
			candidate.endMinutes === null ||
			candidate.endMinutes >= (intent.targetMinutes ?? 0)
		);
	}
	return (
		candidate.startMinutes >= (intent.minMinutes ?? 0) &&
		(intent.maxMinutes === null || candidate.startMinutes < intent.maxMinutes)
	);
};

const startsAtOrAfterRouteStart = (
	candidate: Candidate,
	intent: RouteStartIntent,
): boolean => {
	if (intent.kind === "anytime" || candidate.startMinutes === null) return true;
	return candidate.startMinutes >= (intent.minMinutes ?? 0);
};

const routeStartScore = (
	candidate: Candidate,
	intent: RouteStartIntent,
): number => {
	if (intent.kind === "anytime") return 0;
	if (candidate.startMinutes === null) return -4;

	const target = intent.targetMinutes ?? intent.minMinutes ?? 0;
	if (intent.kind === "period") {
		if (isInStartWindow(candidate, intent)) {
			return (
				26 -
				Math.min(Math.floor(Math.abs(candidate.startMinutes - target) / 60), 8)
			);
		}
		return candidate.startMinutes < target ? -24 : -8;
	}

	if (candidate.startMinutes >= target) {
		return (
			30 - Math.min(Math.floor((candidate.startMinutes - target) / 30), 18)
		);
	}
	if (candidate.endMinutes !== null && candidate.endMinutes < target) {
		return -36;
	}
	return 18 - Math.min(Math.floor((target - candidate.startMinutes) / 60), 14);
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
			Math.min(Math.max(preferences?.stopCount ?? 3, 2), 5),
			mustIncludeEventKeys.length,
		),
		mustIncludeEventKeys,
		anchoredStops: preferences?.anchoredStops ?? [],
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
	const endMinutes = parseTimeToMinutes(event.endTime);
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

	return { event, category, startMinutes, endMinutes, score, reasons };
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

const findAvailableSlotIndex = (
	slots: Array<Candidate | null>,
	preferredIndex: number,
): number | null => {
	if (!slots[preferredIndex]) return preferredIndex;
	for (let index = preferredIndex + 1; index < slots.length; index += 1) {
		if (!slots[index]) return index;
	}
	for (let index = preferredIndex - 1; index >= 0; index -= 1) {
		if (!slots[index]) return index;
	}
	return null;
};

const getTimedNeighbor = (
	slots: Array<Candidate | null>,
	slotIndex: number,
	direction: -1 | 1,
): number | null => {
	for (
		let index = slotIndex + direction;
		index >= 0 && index < slots.length;
		index += direction
	) {
		const minutes = slots[index]?.startMinutes;
		if (minutes !== null && minutes !== undefined) return minutes;
	}
	return null;
};

const getSlotTimeBounds = (
	slots: Array<Candidate | null>,
	slotIndex: number,
	intent: RouteStartIntent,
): {
	lowerBound: number | null;
	upperBound: number | null;
	hasPreviousAnchor: boolean;
} => {
	const previousMinutes = getTimedNeighbor(slots, slotIndex, -1);
	const nextMinutes = getTimedNeighbor(slots, slotIndex, 1);
	const hasPreviousAnchor = previousMinutes !== null;
	let lowerBound = previousMinutes;
	let upperBound = nextMinutes;

	if (intent.kind !== "anytime" && intent.minMinutes !== null) {
		lowerBound =
			lowerBound === null
				? intent.minMinutes
				: Math.max(lowerBound, intent.minMinutes);
	}
	if (
		!hasPreviousAnchor &&
		intent.kind === "period" &&
		intent.maxMinutes !== null
	) {
		upperBound =
			upperBound === null
				? intent.maxMinutes
				: Math.min(upperBound, intent.maxMinutes);
	}

	return { lowerBound, upperBound, hasPreviousAnchor };
};

const fitsAnchoredSlot = (
	candidate: Candidate,
	slots: Array<Candidate | null>,
	slotIndex: number,
	intent: RouteStartIntent,
): boolean => {
	const { lowerBound, upperBound, hasPreviousAnchor } = getSlotTimeBounds(
		slots,
		slotIndex,
		intent,
	);
	if (lowerBound !== null && upperBound !== null && lowerBound > upperBound) {
		return false;
	}
	if (candidate.startMinutes === null) {
		return lowerBound === null && upperBound === null;
	}
	if (lowerBound !== null && candidate.startMinutes < lowerBound) {
		const canArriveAfterStart =
			!hasPreviousAnchor &&
			intent.kind === "exact" &&
			isInStartWindow(candidate, intent);
		if (!canArriveAfterStart) return false;
	}
	if (upperBound !== null && candidate.startMinutes > upperBound) {
		return false;
	}
	return true;
};

const hasBreathingRoomInSlots = (
	candidate: Candidate,
	slots: Array<Candidate | null>,
): boolean => {
	const candidateStartMinutes = candidate.startMinutes;
	return (
		candidateStartMinutes === null ||
		slots.every(
			(item) =>
				!item ||
				item.startMinutes === null ||
				Math.abs(candidateStartMinutes - item.startMinutes) >=
					MIN_ROUTE_START_GAP_MINUTES,
		)
	);
};

const orderAnchoredCandidates = (
	candidates: Candidate[],
	preferences: PlanPreferenceInput,
	intent: RouteStartIntent,
	lockedKeys: Set<string>,
): Candidate[] | null => {
	const anchors = preferences.anchoredStops
		.filter((stop) => lockedKeys.has(normalizeKey(stop.eventKey)))
		.slice()
		.sort((left, right) => left.stopOrder - right.stopOrder);
	if (anchors.length === 0) return null;

	const slots = new Array<Candidate | null>(preferences.stopCount).fill(null);
	for (const anchor of anchors) {
		const candidate = candidates.find(
			(item) =>
				normalizeKey(item.event.eventKey) === normalizeKey(anchor.eventKey),
		);
		if (!candidate) continue;
		const preferredIndex = Math.min(
			Math.max(anchor.stopOrder - 1, 0),
			slots.length - 1,
		);
		const slotIndex = findAvailableSlotIndex(slots, preferredIndex);
		if (slotIndex !== null) slots[slotIndex] = candidate;
	}

	const candidateRank = new Map(
		candidates.map((candidate, index) => [
			normalizeKey(candidate.event.eventKey),
			index,
		]),
	);
	const hasCandidate = (candidate: Candidate): boolean =>
		slots.some(
			(item) =>
				item &&
				normalizeKey(item.event.eventKey) ===
					normalizeKey(candidate.event.eventKey),
		);
	const compareForSlot =
		(slotIndex: number) =>
		(left: Candidate, right: Candidate): number => {
			const { lowerBound } = getSlotTimeBounds(slots, slotIndex, intent);
			const target = lowerBound ?? intent.targetMinutes ?? 0;
			const leftTime = left.startMinutes ?? 99 * 60;
			const rightTime = right.startMinutes ?? 99 * 60;
			return (
				Math.abs(leftTime - target) - Math.abs(rightTime - target) ||
				(candidateRank.get(normalizeKey(left.event.eventKey)) ?? 9999) -
					(candidateRank.get(normalizeKey(right.event.eventKey)) ?? 9999) ||
				left.event.name.localeCompare(right.event.name)
			);
		};
	const fillSlots = (input: {
		requireTimeFit: boolean;
		requireBreathingRoom: boolean;
	}) => {
		for (let slotIndex = 0; slotIndex < slots.length; slotIndex += 1) {
			if (slots[slotIndex]) continue;
			const candidate = candidates
				.filter((item) => !lockedKeys.has(normalizeKey(item.event.eventKey)))
				.filter((item) => !hasCandidate(item))
				.filter(
					(item) =>
						!input.requireTimeFit ||
						fitsAnchoredSlot(item, slots, slotIndex, intent),
				)
				.filter(
					(item) =>
						!input.requireBreathingRoom || hasBreathingRoomInSlots(item, slots),
				)
				.sort(compareForSlot(slotIndex))[0];
			if (candidate) slots[slotIndex] = candidate;
		}
	};

	fillSlots({ requireTimeFit: true, requireBreathingRoom: true });
	fillSlots({ requireTimeFit: true, requireBreathingRoom: false });
	fillSlots({ requireTimeFit: false, requireBreathingRoom: true });
	fillSlots({ requireTimeFit: false, requireBreathingRoom: false });

	return slots.filter((candidate): candidate is Candidate =>
		Boolean(candidate),
	);
};

const orderCandidates = (
	candidates: Candidate[],
	preferences: PlanPreferenceInput,
): Candidate[] => {
	const lockedKeys = new Set(
		preferences.mustIncludeEventKeys.map(normalizeKey),
	);
	const intent = getRouteStartIntent(preferences);
	const selected: Candidate[] = [];
	let intendedFirstKey: string | null = null;
	const anchoredOrder = orderAnchoredCandidates(
		candidates,
		preferences,
		intent,
		lockedKeys,
	);
	if (anchoredOrder) return anchoredOrder;

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
	const addCandidate = (candidate: Candidate): boolean => {
		if (selected.length >= preferences.stopCount || hasCandidate(candidate)) {
			return false;
		}
		selected.push(candidate);
		return true;
	};
	const compareByRouteOrder = (left: Candidate, right: Candidate): number => {
		if (left.startMinutes == null && right.startMinutes == null) {
			return right.score - left.score;
		}
		if (left.startMinutes == null) return 1;
		if (right.startMinutes == null) return -1;
		return left.startMinutes - right.startMinutes || right.score - left.score;
	};

	for (const candidate of candidates) {
		if (lockedKeys.has(normalizeKey(candidate.event.eventKey))) {
			addCandidate(candidate);
		}
	}

	if (intent.kind === "anytime") {
		for (const candidate of candidates) {
			if (selected.length >= preferences.stopCount) break;
			if (hasCandidate(candidate) || !hasBreathingRoom(candidate)) continue;
			addCandidate(candidate);
		}

		for (const candidate of candidates) {
			if (selected.length >= preferences.stopCount) break;
			if (hasCandidate(candidate)) continue;
			addCandidate(candidate);
		}

		return selected.slice(0, preferences.stopCount).sort(compareByRouteOrder);
	}

	const unlockedCandidates = candidates.filter(
		(candidate) => !lockedKeys.has(normalizeKey(candidate.event.eventKey)),
	);
	const scoreForFirstStop = (candidate: Candidate): number =>
		candidate.score + routeStartScore(candidate, intent);
	const compareByFirstStopFit = (left: Candidate, right: Candidate): number => {
		if (intent.kind === "period") {
			const leftInWindow = isInStartWindow(left, intent);
			const rightInWindow = isInStartWindow(right, intent);
			if (leftInWindow !== rightInWindow) return leftInWindow ? -1 : 1;
			return (
				(left.startMinutes ?? 99 * 60) - (right.startMinutes ?? 99 * 60) ||
				right.score - left.score ||
				left.event.name.localeCompare(right.event.name)
			);
		}
		return (
			scoreForFirstStop(right) - scoreForFirstStop(left) ||
			(left.startMinutes ?? 99 * 60) - (right.startMinutes ?? 99 * 60) ||
			left.event.name.localeCompare(right.event.name)
		);
	};
	const compareByFallbackScore = (left: Candidate, right: Candidate): number =>
		right.score - left.score ||
		(left.startMinutes ?? 99 * 60) - (right.startMinutes ?? 99 * 60) ||
		left.event.name.localeCompare(right.event.name);

	if (selected.length === 0) {
		const firstStop =
			unlockedCandidates
				.filter((candidate) => isInStartWindow(candidate, intent))
				.sort(compareByFirstStopFit)[0] ??
			unlockedCandidates.slice().sort(compareByFirstStopFit)[0];
		if (firstStop) {
			addCandidate(firstStop);
			intendedFirstKey = normalizeKey(firstStop.event.eventKey);
		}
	}

	const routeStartCandidates = unlockedCandidates
		.filter((candidate) => !hasCandidate(candidate))
		.filter((candidate) => startsAtOrAfterRouteStart(candidate, intent))
		.sort(compareByRouteOrder);
	const fallbackCandidates = unlockedCandidates
		.filter((candidate) => !hasCandidate(candidate))
		.sort(compareByFallbackScore);

	for (const candidate of routeStartCandidates) {
		if (selected.length >= preferences.stopCount) break;
		if (hasCandidate(candidate) || !hasBreathingRoom(candidate)) {
			continue;
		}
		addCandidate(candidate);
	}

	for (const candidate of fallbackCandidates) {
		if (selected.length >= preferences.stopCount) break;
		if (hasCandidate(candidate) || !hasBreathingRoom(candidate)) {
			continue;
		}
		addCandidate(candidate);
	}

	for (const candidate of [...routeStartCandidates, ...fallbackCandidates]) {
		if (selected.length >= preferences.stopCount) break;
		if (hasCandidate(candidate)) continue;
		addCandidate(candidate);
	}

	const ordered = selected
		.slice(0, preferences.stopCount)
		.sort(compareByRouteOrder);
	if (lockedKeys.size > 0 || !intendedFirstKey) {
		return ordered;
	}
	const intendedFirst = ordered.find(
		(candidate) => normalizeKey(candidate.event.eventKey) === intendedFirstKey,
	);
	if (!intendedFirst) return ordered;
	return [
		intendedFirst,
		...ordered.filter(
			(candidate) =>
				normalizeKey(candidate.event.eventKey) !== intendedFirstKey,
		),
	];
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
