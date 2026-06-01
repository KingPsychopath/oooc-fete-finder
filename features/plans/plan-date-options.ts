import { getDefaultDateRangeForEvents } from "@/features/events/filtering";
import type { Event } from "@/features/events/types";

const isStrictISODate = (value: string | null | undefined): value is string =>
	typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

export const getPlanDateOptions = (
	events: Event[],
	referenceDate = new Date(),
): string[] => {
	const defaultRange = getDefaultDateRangeForEvents(events, referenceDate);
	const allDates = Array.from(
		new Set(events.map((event) => event.date).filter(isStrictISODate)),
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

	const countsByDate = new Map<string, number>();
	const visibleDates = new Set(dateOptions);
	for (const event of events) {
		if (!isStrictISODate(event.date) || !visibleDates.has(event.date)) {
			continue;
		}
		countsByDate.set(event.date, (countsByDate.get(event.date) ?? 0) + 1);
	}

	return (
		dateOptions.find((date) => (countsByDate.get(date) ?? 0) >= 3) ??
		dateOptions.find((date) => (countsByDate.get(date) ?? 0) >= 2) ??
		dateOptions[0] ??
		new Date().toISOString().slice(0, 10)
	);
};
