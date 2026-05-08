import { isStrictISODate, parseISODateParts } from "@/features/events/date-utils";
import { isRecentlyAddedEvent } from "@/features/events/recently-added";
import { isRecentlyUpdatedEvent } from "@/features/events/recently-updated";
import type { Event } from "@/features/events/types";

type RegularEventSortTime = {
	hasDate: boolean;
	startAtMs: number;
};

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
	if (parsedHours < 0 || parsedHours > 23 || parsedMinutes < 0 || parsedMinutes > 59) {
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

const getRegularEventSortTime = (event: Event): RegularEventSortTime => {
	if (!isStrictISODate(event.date)) {
		return {
			hasDate: false,
			startAtMs: Number.NaN,
		};
	}

	const dateParts = parseISODateParts(event.date);
	if (!dateParts) {
		return {
			hasDate: false,
			startAtMs: Number.NaN,
		};
	}

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

	return {
		hasDate: true,
		startAtMs: startAt.getTime(),
	};
};

const compareNames = (left: Event, right: Event): number =>
	left.name.localeCompare(right.name) || left.id.localeCompare(right.id);

const FRESH_ACTIVITY_NEW_SCORE = 1_000_000;
const FRESH_ACTIVITY_UPDATED_SCORE = 700_000;
const FRESH_ACTIVITY_SAVE_SCORE = 1_000;
const FRESH_ACTIVITY_SAVE_CAP = 250;

const getFreshActivityScore = (event: Event, now: Date): number => {
	const newScore = isRecentlyAddedEvent(event, now)
		? FRESH_ACTIVITY_NEW_SCORE
		: 0;
	const updatedScore = isRecentlyUpdatedEvent(event, now)
		? FRESH_ACTIVITY_UPDATED_SCORE
		: 0;
	const saveScore =
		Math.min(event.socialProofSaveCount ?? 0, FRESH_ACTIVITY_SAVE_CAP) *
		FRESH_ACTIVITY_SAVE_SCORE;
	const changedTime = Date.parse(event.lastMeaningfulChangeAt ?? "");
	const firstSeenTime = Date.parse(event.firstSeenAt ?? "");
	const freshnessTime = Math.max(
		Number.isFinite(changedTime) ? changedTime : 0,
		Number.isFinite(firstSeenTime) ? firstSeenTime : 0,
	);
	return newScore + updatedScore + saveScore + Math.floor(freshnessTime / 86_400_000);
};

export const createRegularEventsComparator = (
	now: Date,
): ((left: Event, right: Event) => number) => {
	const nowMs = now.getTime();

	return (left, right) => {
		const leftSort = getRegularEventSortTime(left);
		const rightSort = getRegularEventSortTime(right);

		const leftHasDate = leftSort.hasDate;
		const rightHasDate = rightSort.hasDate;

		if (!leftHasDate && !rightHasDate) {
			return compareNames(left, right);
		}

		if (!leftHasDate) {
			return 1;
		}

		if (!rightHasDate) {
			return -1;
		}

		const leftUpcoming = leftSort.startAtMs >= nowMs;
		const rightUpcoming = rightSort.startAtMs >= nowMs;

		if (leftUpcoming !== rightUpcoming) {
			return leftUpcoming ? -1 : 1;
		}

		const dateCompare =
			leftSort.startAtMs === rightSort.startAtMs
				? 0
				: leftSort.startAtMs < rightSort.startAtMs
					? -1
					: 1;
		if (dateCompare !== 0) {
			return dateCompare;
		}

		return compareNames(left, right);
	};
};

export const createFreshActivityComparator = (
	now: Date,
): ((left: Event, right: Event) => number) => {
	const regularComparator = createRegularEventsComparator(now);

	return (left, right) => {
		const scoreDelta =
			getFreshActivityScore(right, now) - getFreshActivityScore(left, now);
		if (scoreDelta !== 0) return scoreDelta;
		return regularComparator(left, right);
	};
};
