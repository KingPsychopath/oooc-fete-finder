import { getDefaultDateRangeForEvents } from "@/features/events/filtering";
import type { Event } from "@/features/events/types";

const normalizePlanDateValue = (
	value: string | null | undefined,
): string | null => {
	if (typeof value !== "string") return null;
	const date = value.trim();
	return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
};

const DEFAULT_PLAN_DAY_OF_MONTH = "21";

export const getPlanDateOptions = (
	events: Event[],
	referenceDate = new Date(),
): string[] => {
	const defaultRange = getDefaultDateRangeForEvents(events, referenceDate);
	const allDates = Array.from(
		new Set(
			events
				.map((event) => normalizePlanDateValue(event.date))
				.filter((date): date is string => Boolean(date)),
		),
	).sort();
	const rangeStart = defaultRange.from;
	const rangeEnd = defaultRange.to;
	const currentRangeDates =
		rangeStart && rangeEnd
			? allDates.filter((date) => date >= rangeStart && date <= rangeEnd)
			: [];

	return currentRangeDates.length > 0 ? currentRangeDates : allDates;
};

export const getDefaultPlanDate = (
	events: Event[],
	referenceDate = new Date(),
): string => {
	const dateOptions = getPlanDateOptions(events, referenceDate);
	if (dateOptions.length === 0) return new Date().toISOString().slice(0, 10);
	const defaultDayOption = dateOptions.find(
		(date) => date.slice(-2) === DEFAULT_PLAN_DAY_OF_MONTH,
	);
	if (defaultDayOption) return defaultDayOption;

	const countsByDate = new Map<string, number>();
	const visibleDates = new Set(dateOptions);
	for (const event of events) {
		const date = normalizePlanDateValue(event.date);
		if (!date || !visibleDates.has(date)) {
			continue;
		}
		countsByDate.set(date, (countsByDate.get(date) ?? 0) + 1);
	}

	return (
		dateOptions.find((date) => (countsByDate.get(date) ?? 0) >= 3) ??
		dateOptions.find((date) => (countsByDate.get(date) ?? 0) >= 2) ??
		dateOptions[0] ??
		new Date().toISOString().slice(0, 10)
	);
};
