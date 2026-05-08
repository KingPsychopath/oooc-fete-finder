import { parseISODateParts } from "@/features/events/date-utils";
import type { DateRangeFilter } from "@/features/events/filtering";
import type { Event } from "@/features/events/types";
import { shouldDisplayFeaturedEvent } from "./utils/timestamp-utils";

interface SelectFeaturedEventsInput {
	events: Event[];
	maxFeaturedEvents: number;
	dateRange: DateRangeFilter;
	referenceDate?: Date;
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

const getHashFromSeed = (seed: string): number => {
	let hash = 0;
	for (let index = 0; index < seed.length; index++) {
		hash = (hash << 5) - hash + seed.charCodeAt(index);
		hash |= 0;
	}
	return hash;
};

const deterministicShuffle = <T>(array: T[], seed: string): T[] => {
	const shuffled = [...array];
	let hash = getHashFromSeed(seed);

	for (let index = shuffled.length - 1; index > 0; index--) {
		hash = (hash * 1664525 + 1013904223) >>> 0;
		const swapIndex = Math.floor((hash / 2 ** 32) * (index + 1));
		[shuffled[index], shuffled[swapIndex]] = [
			shuffled[swapIndex],
			shuffled[index],
		];
	}

	return shuffled;
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
}: SelectFeaturedEventsInput): Event[] => {
	const safeEvents = events.filter(Boolean);
	const seed = getSeedForDateSet(safeEvents, dateRange);
	const placementEvents: Event[] = [];
	const ooocPickEvents: Event[] = [];
	const regularEvents: Event[] = [];

	for (const event of safeEvents) {
		if (shouldDisplayFeaturedEvent(event) || event.isPromoted === true) {
			placementEvents.push(event);
			continue;
		}
		if (!isUpcomingFallbackEvent(event, referenceDate)) {
			continue;
		}
		if (event.isOOOCPick === true) {
			ooocPickEvents.push(event);
			continue;
		}
		regularEvents.push(event);
	}

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

	appendCandidates(deterministicShuffle(ooocPickEvents, `${seed}:oooc-picks`));
	appendCandidates(deterministicShuffle(regularEvents, `${seed}:regular`));
	appendCandidates(
		deterministicShuffle(
			[...placementEvents, ...ooocPickEvents, ...regularEvents],
			`${seed}:fill`,
		),
	);

	return selected;
};
