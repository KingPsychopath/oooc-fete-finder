import { parseISODateParts } from "@/features/events/date-utils";
import type { DateRangeFilter } from "@/features/events/filtering";
import {
	type Event,
	getEventTemporalProfile,
	parsePrice,
} from "@/features/events/types";
import { parseParisDateTimeInput } from "./paris-time";
import { shouldDisplayFeaturedEvent } from "./utils/timestamp-utils";

export type SpotlightRotationBucket =
	| "daily"
	| "morning"
	| "afternoon"
	| "evening"
	| "late";
export type SpotlightRotationCadence = "daily" | "six-hour";
export type SpotlightEventPhase =
	| "far"
	| "event-week"
	| "event-eve"
	| "event-day";

export interface SpotlightRotationContext {
	rotationDate: string;
	rotationKey: string;
	bucket: SpotlightRotationBucket;
	cadence: SpotlightRotationCadence;
	eventPhase: SpotlightEventPhase;
	label: string;
	intentLabel: string;
}

interface SelectFeaturedEventsInput {
	events: Event[];
	maxFeaturedEvents: number;
	dateRange: DateRangeFilter;
	referenceDate?: Date;
	rotationDate?: string;
	rotationContext?: SpotlightRotationContext;
}

const DEFAULT_UNKNOWN_TIME_HOUR = 23;
const DEFAULT_UNKNOWN_TIME_MINUTE = 59;
const FETE_MONTH_DAY = "06-21";
const EVENT_WEEK_LEAD_DAYS = 7;
const EVENT_WEEK_TRAIL_DAYS = 1;
const SOON_WINDOW_HOURS = 4;
const NEAR_PEAK_WINDOW_DAYS = 2;
const MIN_NEAR_PEAK_CANDIDATES = 3;

const parseTime = (rawTime: string): [number, number] | null => {
	const normalized = rawTime.trim().toLowerCase();
	if (!normalized || normalized === "tbc") {
		return null;
	}

	const isAM = /\bam\b/.test(normalized);
	const isPM = /\bpm\b/.test(normalized);
	const cleaned = normalized.replace(/\s*(am|pm)\s*/g, "").trim();
	const [hoursText, minutesText = "0"] = cleaned.split(":");
	const parsedHours = Number.parseInt(hoursText, 10);
	const parsedMinutes = Number.parseInt(minutesText, 10);

	if (!Number.isFinite(parsedHours) || !Number.isFinite(parsedMinutes)) {
		return null;
	}
	if (
		parsedHours < 0 ||
		parsedHours > 23 ||
		parsedMinutes < 0 ||
		parsedMinutes > 59
	) {
		return null;
	}

	let hours = parsedHours;
	if (isPM && hours !== 12) {
		hours += 12;
	}
	if (isAM && hours === 12) {
		hours = 0;
	}

	return [hours, parsedMinutes];
};

const isUpcomingFallbackEvent = (
	event: Event,
	referenceDate: Date,
): boolean => {
	const startAt = getEventStartAt(event);
	if (!startAt) return true;
	const endAt = getEventEndAt(event);
	if (endAt && endAt.getTime() >= referenceDate.getTime()) return true;
	return startAt.getTime() >= referenceDate.getTime();
};

const getSeedForDateSet = (
	events: Event[],
	dateRange: DateRangeFilter,
): string => {
	if (dateRange.from || dateRange.to) {
		return `${dateRange.from ?? "any"}:${dateRange.to ?? "any"}`;
	}

	const eventDates = events
		.map((event) => event.date)
		.filter((date) => date.trim().length > 0)
		.sort();

	if (eventDates.length === 0) {
		return "all-dates";
	}

	return `${eventDates[0]}:${eventDates[eventDates.length - 1]}`;
};

const PARIS_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
	timeZone: "Europe/Paris",
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
});
const PARIS_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-CA", {
	timeZone: "Europe/Paris",
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
	hourCycle: "h23",
});

export const getParisSpotlightRotationDate = (
	referenceDate = new Date(),
): string => PARIS_DATE_FORMATTER.format(referenceDate);

const getParisDateTimeParts = (date: Date) => {
	const parts = PARIS_DATE_TIME_FORMATTER.formatToParts(date);
	const read = (type: Intl.DateTimeFormatPartTypes): number => {
		const value = parts.find((part) => part.type === type)?.value;
		return Number.parseInt(value || "0", 10);
	};
	return {
		year: read("year"),
		month: read("month"),
		day: read("day"),
		hour: read("hour"),
		minute: read("minute"),
	};
};

const getRotationYear = (
	dateRange: DateRangeFilter,
	rotationDate: string,
): string => {
	const fromYear = dateRange.from?.slice(0, 4);
	const toYear = dateRange.to?.slice(0, 4);
	if (fromYear && fromYear === toYear) return fromYear;
	return rotationDate.slice(0, 4);
};

const getUtcDayNumber = (isoDate: string): number | null => {
	const parts = parseISODateParts(isoDate);
	if (!parts) return null;
	return Math.floor(
		Date.UTC(parts.year, parts.month - 1, parts.day) / 86_400_000,
	);
};

const addDaysToIsoDate = (isoDate: string, days: number): string => {
	const parts = parseISODateParts(isoDate);
	if (!parts) return isoDate;
	const date = new Date(
		Date.UTC(parts.year, parts.month - 1, parts.day + days),
	);
	return date.toISOString().slice(0, 10);
};

const getDaysBetween = (
	leftIsoDate: string,
	rightIsoDate: string,
): number | null => {
	const left = getUtcDayNumber(leftIsoDate);
	const right = getUtcDayNumber(rightIsoDate);
	if (left == null || right == null) return null;
	return left - right;
};

const getEventPhase = (
	rotationDate: string,
	dateRange: DateRangeFilter,
): SpotlightEventPhase => {
	const feteDate = `${getRotationYear(dateRange, rotationDate)}-${FETE_MONTH_DAY}`;
	const daysFromFete = getDaysBetween(rotationDate, feteDate);
	if (daysFromFete == null) return "far";
	if (daysFromFete === 0) return "event-day";
	if (daysFromFete === -1) return "event-eve";
	if (
		daysFromFete >= -EVENT_WEEK_LEAD_DAYS &&
		daysFromFete <= EVENT_WEEK_TRAIL_DAYS
	) {
		return "event-week";
	}
	return "far";
};

const getBucketForParisHour = (
	hour: number,
): Exclude<SpotlightRotationBucket, "daily"> => {
	if (hour >= 6 && hour < 12) return "morning";
	if (hour >= 12 && hour < 18) return "afternoon";
	if (hour >= 18 && hour < 23) return "evening";
	return "late";
};

const BUCKET_LABELS: Record<SpotlightRotationBucket, string> = {
	daily: "Daily, Paris time",
	morning: "Morning, Paris time",
	afternoon: "Afternoon, Paris time",
	evening: "Evening, Paris time",
	late: "Late, Paris time",
};

const BUCKET_INTENT_LABELS: Record<SpotlightRotationBucket, string> = {
	daily: "fresh daily range-aware picks",
	morning: "early, outdoor, low-friction picks",
	afternoon: "citywide discovery and variety",
	evening: "peak music and soon-starting picks",
	late: "late-night, DJ, club, and indoor picks",
};

export const getSpotlightRotationContext = (
	input: {
		dateRange: DateRangeFilter;
		referenceDate?: Date;
	} = { dateRange: { from: null, to: null } },
): SpotlightRotationContext => {
	const referenceDate = input.referenceDate ?? new Date();
	const rotationDate = getParisSpotlightRotationDate(referenceDate);
	const parisParts = getParisDateTimeParts(referenceDate);
	const phaseDate =
		parisParts.hour < 6 ? addDaysToIsoDate(rotationDate, -1) : rotationDate;
	const eventPhase = getEventPhase(phaseDate, input.dateRange);
	const cadence: SpotlightRotationCadence =
		eventPhase === "far" ? "daily" : "six-hour";
	const bucket =
		cadence === "daily" ? "daily" : getBucketForParisHour(parisParts.hour);
	const rotationKey =
		cadence === "daily" ? rotationDate : `${rotationDate}:${bucket}`;

	return {
		rotationDate,
		rotationKey,
		bucket,
		cadence,
		eventPhase,
		label: BUCKET_LABELS[bucket],
		intentLabel: BUCKET_INTENT_LABELS[bucket],
	};
};

const getHashFromSeed = (seed: string): number => {
	let hash = 2166136261;
	for (let index = 0; index < seed.length; index++) {
		hash ^= seed.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
};

const getEventRankKey = (event: Event): string =>
	event.eventKey || event.id || event.name;

const getDeterministicScore = (seed: string, event: Event): number =>
	(getHashFromSeed(`${seed}:${getEventRankKey(event)}`) / 2 ** 32) * 1000;

const getEventStartAt = (event: Event): Date | null => {
	const dateParts = parseISODateParts(event.date);
	if (!dateParts) return null;
	const parsedTime = parseTime(event.time ?? "");
	const [hours, minutes] = parsedTime ?? [
		DEFAULT_UNKNOWN_TIME_HOUR,
		DEFAULT_UNKNOWN_TIME_MINUTE,
	];
	const pad = (value: number) => String(value).padStart(2, "0");
	return parseParisDateTimeInput(`${event.date}T${pad(hours)}:${pad(minutes)}`);
};

const getEventEndAt = (event: Event): Date | null => {
	const startAt = getEventStartAt(event);
	if (!startAt) return null;
	const parsedEndTime = parseTime(event.endTime ?? "");
	if (!parsedEndTime) {
		return new Date(startAt.getTime() + 2 * 60 * 60 * 1000);
	}
	const [hours, minutes] = parsedEndTime;
	const pad = (value: number) => String(value).padStart(2, "0");
	const parsedEndAt = parseParisDateTimeInput(
		`${event.date}T${pad(hours)}:${pad(minutes)}`,
	);
	if (!parsedEndAt) return null;
	if (parsedEndAt.getTime() <= startAt.getTime()) {
		return new Date(parsedEndAt.getTime() + 24 * 60 * 60 * 1000);
	}
	return parsedEndAt;
};

const includesAny = (event: Event, needles: readonly string[]): boolean => {
	const haystack = [
		event.name,
		event.description,
		event.location,
		...(event.genre ?? []),
		...(event.tags ?? []),
	]
		.filter(Boolean)
		.join(" ")
		.toLowerCase();
	return needles.some((needle) => haystack.includes(needle));
};

const HIGH_ENERGY_TERMS = [
	"dj",
	"club",
	"afterparty",
	"after party",
	"dancehall",
	"bashment",
	"shatta",
	"amapiano",
	"afrobeats",
	"house",
	"afro house",
	"electro",
	"garage",
	"reggaeton",
] as const;
const COMMUNITY_TERMS = [
	"community",
	"block party",
	"open air",
	"outdoor",
	"street",
	"parade",
	"family",
	"food",
	"market",
] as const;
const DAYTIME_TERMS = [
	"brunch",
	"family",
	"kids",
	"picnic",
	"workshop",
	"market",
	"day party",
] as const;
const LATE_TERMS = [
	"dj",
	"club",
	"afterparty",
	"after party",
	"late",
	"night",
	"indoor",
] as const;

const getMinutesUntilStart = (
	event: Event,
	referenceDate: Date,
): number | null => {
	const startAt = getEventStartAt(event);
	if (!startAt) return null;
	return Math.round((startAt.getTime() - referenceDate.getTime()) / 60_000);
};

const isEventActive = (event: Event, referenceDate: Date): boolean => {
	const startAt = getEventStartAt(event);
	const endAt = getEventEndAt(event);
	if (!startAt || !endAt) return false;
	const now = referenceDate.getTime();
	return startAt.getTime() <= now && now <= endAt.getTime();
};

const getTemporalRelevanceBoost = (
	event: Event,
	context: SpotlightRotationContext,
	referenceDate: Date,
): number => {
	if (context.eventPhase === "far") return 0;
	const startAt = getEventStartAt(event);
	if (!startAt) return 0;
	const daysAway =
		Math.abs(startAt.getTime() - referenceDate.getTime()) / 86_400_000;
	if (daysAway <= 0.5) return 260;
	if (daysAway <= 1) return 220;
	if (daysAway <= 2) return 160;
	if (daysAway <= 4) return 70;
	return -140;
};

const getStartsSoonBoost = (event: Event, referenceDate: Date): number => {
	if (isEventActive(event, referenceDate)) return 260;
	const minutesUntilStart = getMinutesUntilStart(event, referenceDate);
	if (minutesUntilStart == null) return 0;
	if (minutesUntilStart < 0) return -80;
	if (minutesUntilStart <= SOON_WINDOW_HOURS * 60) return 240;
	if (minutesUntilStart <= 8 * 60) return 140;
	if (minutesUntilStart <= 16 * 60) return 80;
	return 0;
};

const getBucketMoodBoost = (
	event: Event,
	bucket: SpotlightRotationBucket,
): number => {
	if (bucket === "daily") return 0;
	const profile = getEventTemporalProfile(event);
	const startMinutes = profile.startMinutes;
	const price = parsePrice(event.price);
	const isFreeOrLowCost = price != null && price <= 10;
	const isOutdoor = event.venueTypes?.includes("outdoor") || !event.indoor;
	const isIndoor = event.venueTypes?.includes("indoor") || event.indoor;

	if (bucket === "morning") {
		let boost = 0;
		if (
			startMinutes != null &&
			startMinutes >= 8 * 60 &&
			startMinutes < 15 * 60
		) {
			boost += 180;
		}
		if (isOutdoor) boost += 90;
		if (isFreeOrLowCost) boost += 80;
		if (includesAny(event, DAYTIME_TERMS)) boost += 120;
		return boost;
	}

	if (bucket === "afternoon") {
		let boost = 0;
		if (
			startMinutes != null &&
			startMinutes >= 12 * 60 &&
			startMinutes < 19 * 60
		) {
			boost += 160;
		}
		if (isOutdoor) boost += 100;
		if (includesAny(event, COMMUNITY_TERMS)) boost += 120;
		if (isFreeOrLowCost) boost += 40;
		return boost;
	}

	if (bucket === "evening") {
		let boost = 0;
		if (
			startMinutes != null &&
			startMinutes >= 17 * 60 &&
			startMinutes < 23 * 60
		) {
			boost += 190;
		}
		if (includesAny(event, HIGH_ENERGY_TERMS)) boost += 130;
		boost += Math.min(event.socialProofSaveCount ?? 0, 20) * 5;
		return boost;
	}

	let boost = 0;
	if (
		startMinutes != null &&
		(startMinutes >= 21 * 60 || startMinutes < 4 * 60)
	) {
		boost += 210;
	}
	if (profile.crossesMidnight || profile.primaryPeriod === "overnight") {
		boost += 120;
	}
	if (isIndoor) boost += 80;
	if (includesAny(event, LATE_TERMS)) boost += 150;
	return boost;
};

const getFreshnessBoost = (event: Event): number => {
	const saveBoost = Math.min(event.socialProofSaveCount ?? 0, 30) * 3;
	const historicalBoost =
		Math.min(event.socialProofHistoricalSaveCount ?? 0, 50) * 1.5;
	return saveBoost + historicalBoost;
};

const getRankedCandidates = (
	events: Event[],
	seed: string,
	context: SpotlightRotationContext,
	referenceDate: Date,
): Event[] => {
	return [...events].sort((left, right) => {
		const leftKey = getEventRankKey(left);
		const rightKey = getEventRankKey(right);
		const leftScore =
			getDeterministicScore(seed, left) -
			getTemporalRelevanceBoost(left, context, referenceDate) -
			getStartsSoonBoost(left, referenceDate) -
			getBucketMoodBoost(left, context.bucket) -
			getFreshnessBoost(left);
		const rightScore =
			getDeterministicScore(seed, right) -
			getTemporalRelevanceBoost(right, context, referenceDate) -
			getStartsSoonBoost(right, referenceDate) -
			getBucketMoodBoost(right, context.bucket) -
			getFreshnessBoost(right);
		if (leftScore !== rightScore) return leftScore - rightScore;
		return leftKey.localeCompare(rightKey);
	});
};

const getNearPeakCandidates = (
	events: Event[],
	context: SpotlightRotationContext,
	referenceDate: Date,
): Event[] => {
	if (context.eventPhase === "far") return events;
	const nearCandidates = events.filter((event) => {
		const startAt = getEventStartAt(event);
		if (!startAt) return false;
		const daysAway =
			Math.abs(startAt.getTime() - referenceDate.getTime()) / 86_400_000;
		return daysAway <= NEAR_PEAK_WINDOW_DAYS;
	});
	return nearCandidates.length >= MIN_NEAR_PEAK_CANDIDATES
		? nearCandidates
		: events;
};

const getPrimaryGenre = (event: Event): string => event.genre?.[0] ?? "";

const selectWithDiversity = (
	candidates: Event[],
	remainingSlots: number,
	selected: Event[],
): Event[] => {
	const picked: Event[] = [];

	const hasDuplicate = (
		candidate: Event,
		keySelector: (event: Event) => string | number | undefined,
	): boolean => {
		const value = keySelector(candidate);
		if (value == null || value === "") return false;
		return [...selected, ...picked].some(
			(event) => keySelector(event) === value,
		);
	};

	while (picked.length < remainingSlots && candidates.length > picked.length) {
		const unpicked = candidates.filter(
			(candidate) => !picked.includes(candidate),
		);
		const diverse =
			unpicked.find(
				(candidate) =>
					!hasDuplicate(candidate, (event) => event.location) &&
					!hasDuplicate(candidate, (event) => event.arrondissement) &&
					!hasDuplicate(candidate, getPrimaryGenre),
			) ??
			unpicked.find(
				(candidate) =>
					!hasDuplicate(candidate, (event) => event.location) &&
					!hasDuplicate(candidate, (event) => event.arrondissement),
			) ??
			unpicked.find(
				(candidate) => !hasDuplicate(candidate, (event) => event.location),
			) ??
			unpicked[0];
		if (!diverse) break;
		picked.push(diverse);
	}

	return picked;
};

const getStartTimeLadderCandidates = (
	candidates: Event[],
	context: SpotlightRotationContext,
	referenceDate: Date,
): Event[] => {
	if (
		context.eventPhase !== "event-day" &&
		context.eventPhase !== "event-eve"
	) {
		return candidates;
	}
	const soon = candidates.find((event) => {
		if (isEventActive(event, referenceDate)) return true;
		const minutesUntilStart = getMinutesUntilStart(event, referenceDate);
		return (
			minutesUntilStart != null &&
			minutesUntilStart >= 0 &&
			minutesUntilStart <= 4 * 60
		);
	});
	const later = candidates.find((event) => {
		if (event === soon) return false;
		const minutesUntilStart = getMinutesUntilStart(event, referenceDate);
		return (
			minutesUntilStart != null &&
			minutesUntilStart > 4 * 60 &&
			minutesUntilStart <= 16 * 60
		);
	});
	return [soon, later, ...candidates].filter(
		(event, index, array): event is Event =>
			Boolean(event) && array.indexOf(event) === index,
	);
};

const dedupeByEventKey = (events: Event[]): Event[] => {
	const seenEventKeys = new Set<string>();
	return events.filter((event) => {
		if (!event.eventKey) return true;
		if (seenEventKeys.has(event.eventKey)) return false;
		seenEventKeys.add(event.eventKey);
		return true;
	});
};

export const selectFeaturedEvents = ({
	events,
	maxFeaturedEvents,
	dateRange,
	referenceDate = new Date(),
	rotationDate,
	rotationContext,
}: SelectFeaturedEventsInput): Event[] => {
	const safeEvents = events.filter(Boolean);
	const context =
		rotationContext ??
		getSpotlightRotationContext({
			dateRange,
			referenceDate,
		});
	const seed = `${getSeedForDateSet(safeEvents, dateRange)}:${
		rotationDate ?? context.rotationKey
	}`;
	const placementEvents: Event[] = [];
	const upcomingFallbackEvents: Event[] = [];
	const archiveFallbackEvents: Event[] = [];

	for (const event of safeEvents) {
		if (shouldDisplayFeaturedEvent(event) || event.isPromoted === true) {
			placementEvents.push(event);
			continue;
		}
		archiveFallbackEvents.push(event);
		if (event.isOOOCPick === true) {
			if (isUpcomingFallbackEvent(event, referenceDate)) {
				upcomingFallbackEvents.push(event);
			}
			continue;
		}
		if (isUpcomingFallbackEvent(event, referenceDate)) {
			upcomingFallbackEvents.push(event);
		}
	}

	const fallbackEvents =
		upcomingFallbackEvents.length > 0
			? upcomingFallbackEvents
			: archiveFallbackEvents;
	const prioritizedFallbackEvents = getNearPeakCandidates(
		fallbackEvents,
		context,
		referenceDate,
	);
	const ooocPickEvents = prioritizedFallbackEvents.filter(
		(event) => event.isOOOCPick === true,
	);
	const regularEvents = prioritizedFallbackEvents.filter(
		(event) => event.isOOOCPick !== true,
	);
	const selected = dedupeByEventKey(placementEvents).slice(
		0,
		maxFeaturedEvents,
	);
	const seenEventKeys = new Set(
		selected.map((event) => event.eventKey).filter((key) => key.length > 0),
	);

	const appendCandidates = (candidates: Event[]) => {
		for (const candidate of candidates) {
			if (selected.length >= maxFeaturedEvents) return;
			if (candidate.eventKey && seenEventKeys.has(candidate.eventKey)) continue;
			selected.push(candidate);
			if (candidate.eventKey) {
				seenEventKeys.add(candidate.eventKey);
			}
		}
	};

	appendCandidates(
		getRankedCandidates(
			ooocPickEvents,
			`${seed}:oooc-picks`,
			context,
			referenceDate,
		).slice(0, 1),
	);
	const regularCandidates = getStartTimeLadderCandidates(
		getRankedCandidates(
			regularEvents,
			`${seed}:regular`,
			context,
			referenceDate,
		),
		context,
		referenceDate,
	);
	appendCandidates(
		selectWithDiversity(
			regularCandidates,
			maxFeaturedEvents - selected.length,
			selected,
		),
	);
	appendCandidates(
		getRankedCandidates(
			[...placementEvents, ...regularEvents, ...ooocPickEvents.slice(0, 1)],
			`${seed}:fill`,
			context,
			referenceDate,
		),
	);

	return selected;
};
