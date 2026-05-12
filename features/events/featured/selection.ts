import { parseISODateParts } from "@/features/events/date-utils";
import type { DateRangeFilter } from "@/features/events/filtering";
import type { Event } from "@/features/events/types";
import { shouldDisplayFeaturedEvent } from "./utils/timestamp-utils";

interface SelectFeaturedEventsInput {
	events: Event[];
	maxFeaturedEvents: number;
	dateRange: DateRangeFilter;
	referenceDate?: Date;
	rotationDate?: string;
}

const DEFAULT_UNKNOWN_TIME_HOUR = 23;
const DEFAULT_UNKNOWN_TIME_MINUTE = 59;

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
	const dateParts = parseISODateParts(event.date);
	if (!dateParts) return true;

	const parsedTime = parseTime(event.time ?? "");
	const [hours, minutes] = parsedTime ?? [
		DEFAULT_UNKNOWN_TIME_HOUR,
		DEFAULT_UNKNOWN_TIME_MINUTE,
	];
	const startAt = new Date(
		dateParts.year,
		dateParts.month - 1,
		dateParts.day,
		hours,
		minutes,
		0,
		0,
	);

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

export const getParisSpotlightRotationDate = (
	referenceDate = new Date(),
): string => PARIS_DATE_FORMATTER.format(referenceDate);

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

const rankByDeterministicScore = (events: Event[], seed: string): Event[] => {
	return [...events].sort((left, right) => {
		const leftKey = getEventRankKey(left);
		const rightKey = getEventRankKey(right);
		const leftScore = getHashFromSeed(`${seed}:${leftKey}`) >>> 0;
		const rightScore = getHashFromSeed(`${seed}:${rightKey}`) >>> 0;
		if (leftScore !== rightScore) return leftScore - rightScore;
		return leftKey.localeCompare(rightKey);
	});
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
	rotationDate = getParisSpotlightRotationDate(referenceDate),
}: SelectFeaturedEventsInput): Event[] => {
	const safeEvents = events.filter(Boolean);
	const seed = `${getSeedForDateSet(safeEvents, dateRange)}:${rotationDate}`;
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
	const ooocPickEvents = fallbackEvents.filter(
		(event) => event.isOOOCPick === true,
	);
	const regularEvents = fallbackEvents.filter(
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
		rankByDeterministicScore(ooocPickEvents, `${seed}:oooc-picks`).slice(0, 1),
	);
	appendCandidates(rankByDeterministicScore(regularEvents, `${seed}:regular`));
	appendCandidates(
		rankByDeterministicScore(
			[...placementEvents, ...regularEvents, ...ooocPickEvents.slice(0, 1)],
			`${seed}:fill`,
		),
	);

	return selected;
};
