import { parseISODateParts } from "@/features/events/date-utils";
import { parseParisDateTimeInput } from "@/features/events/featured/paris-time";
import type { DateRangeFilter } from "@/features/events/filtering";
import type { Event } from "@/features/events/types";

export type EventLifecycleStatus =
	| "live"
	| "upcoming"
	| "recently-ended"
	| "past"
	| "unknown-date";

const DEFAULT_UNKNOWN_TIME_HOUR = 23;
const DEFAULT_UNKNOWN_TIME_MINUTE = 59;
const DEFAULT_EVENT_DURATION_MS = 2 * 60 * 60 * 1000;
const LIVE_TRAILING_BUFFER_MS = 90 * 60 * 1000;
const RECENTLY_ENDED_WINDOW_MS = 12 * 60 * 60 * 1000;

const padTimePart = (value: number): string => String(value).padStart(2, "0");

const parseTime = (rawTime: string | undefined): [number, number] | null => {
	const normalized = rawTime?.trim().toLowerCase() ?? "";
	if (!normalized || normalized === "tbc") return null;

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
	if (isPM && hours !== 12) hours += 12;
	if (isAM && hours === 12) hours = 0;
	return [hours, parsedMinutes];
};

const parseEventParisTime = (
	event: Pick<Event, "date">,
	time: [number, number],
): Date | null => {
	const [hours, minutes] = time;
	return parseParisDateTimeInput(
		`${event.date}T${padTimePart(hours)}:${padTimePart(minutes)}`,
	);
};

export const getEventLifecycleWindow = (
	event: Pick<Event, "date" | "time" | "endTime">,
): { startAt: Date; endAt: Date } | null => {
	if (!parseISODateParts(event.date)) return null;

	const parsedStartTime = parseTime(event.time);
	const startTime = parsedStartTime ?? [0, 0];
	const startAt = parseEventParisTime(event, startTime);
	if (!startAt) return null;

	const parsedEndTime = parseTime(event.endTime);
	if (!parsedStartTime) {
		const unknownTimeEndAt = parseEventParisTime(event, [
			DEFAULT_UNKNOWN_TIME_HOUR,
			DEFAULT_UNKNOWN_TIME_MINUTE,
		]);
		return unknownTimeEndAt ? { startAt, endAt: unknownTimeEndAt } : null;
	}

	if (!parsedEndTime) {
		return {
			startAt,
			endAt: new Date(startAt.getTime() + DEFAULT_EVENT_DURATION_MS),
		};
	}

	const parsedEndAt = parseEventParisTime(event, parsedEndTime);
	if (!parsedEndAt) return null;
	const endAt =
		parsedEndAt.getTime() <= startAt.getTime()
			? new Date(parsedEndAt.getTime() + 24 * 60 * 60 * 1000)
			: parsedEndAt;

	return { startAt, endAt };
};

export const getEventLifecycleStatus = (
	event: Pick<Event, "date" | "time" | "endTime">,
	referenceDate = new Date(),
): EventLifecycleStatus => {
	const window = getEventLifecycleWindow(event);
	if (!window) return "unknown-date";

	const nowMs = referenceDate.getTime();
	const startMs = window.startAt.getTime();
	const endMs = window.endAt.getTime();
	const liveUntilMs = endMs + LIVE_TRAILING_BUFFER_MS;
	const recentlyEndedUntilMs = endMs + RECENTLY_ENDED_WINDOW_MS;

	if (nowMs < startMs) return "upcoming";
	if (nowMs <= liveUntilMs) return "live";
	if (nowMs <= recentlyEndedUntilMs) return "recently-ended";
	return "past";
};

const isDateInsideRange = (
	event: Pick<Event, "date">,
	dateRange: DateRangeFilter,
): boolean => {
	if (!parseISODateParts(event.date)) return false;
	if (dateRange.from && event.date < dateRange.from) return false;
	if (dateRange.to && event.date > dateRange.to) return false;
	return true;
};

export const isEventDiscoverableByDefault = (
	event: Pick<Event, "date" | "time" | "endTime">,
	options: {
		dateRange: DateRangeFilter;
		referenceDate?: Date;
	},
): boolean => {
	const lifecycleStatus = getEventLifecycleStatus(
		event,
		options.referenceDate ?? new Date(),
	);
	if (lifecycleStatus !== "live" && lifecycleStatus !== "upcoming") {
		return false;
	}
	if (lifecycleStatus === "live") return true;
	return isDateInsideRange(event, options.dateRange);
};
