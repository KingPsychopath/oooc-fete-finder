import {
	isoDatePartsToUTCDate,
	parseISODateParts,
} from "@/features/events/date-utils";

type EventStatsDateInput = {
	date?: string;
	day?: string;
};

export type EventStatsDateRange = {
	label: string;
	spanDays: number | null;
	earliestDate: string | null;
	latestDate: string | null;
};

export const getEventStatsDateRange = (
	events: EventStatsDateInput[],
): EventStatsDateRange => {
	if (events.length === 0) {
		return {
			label: "Dates TBD",
			spanDays: null,
			earliestDate: null,
			latestDate: null,
		};
	}

	const dates = events
		.map((event) => event.date)
		.filter((date): date is string => Boolean(date && parseISODateParts(date)))
		.sort();

	if (dates.length === 0) {
		return {
			label: "Dates TBD",
			spanDays: null,
			earliestDate: null,
			latestDate: null,
		};
	}

	const earliestDate = dates[0];
	const latestDate = dates[dates.length - 1];
	const earliestParts = parseISODateParts(earliestDate);
	const latestParts = parseISODateParts(latestDate);
	if (!earliestParts || !latestParts) {
		return {
			label: "Dates TBD",
			spanDays: null,
			earliestDate: null,
			latestDate: null,
		};
	}

	const earliestDateObj = isoDatePartsToUTCDate(earliestParts);
	const latestDateObj = isoDatePartsToUTCDate(latestParts);
	const spanDays = Math.max(
		0,
		Math.round(
			(latestDateObj.getTime() - earliestDateObj.getTime()) / 86_400_000,
		),
	);

	const formatDate = (date: Date) => ({
		day: date.getUTCDate(),
		month: date.toLocaleDateString("en-US", {
			month: "long",
			timeZone: "UTC",
		}),
		year: date.getUTCFullYear(),
	});

	const earliest = formatDate(earliestDateObj);
	const latest = formatDate(latestDateObj);

	if (earliest.month === latest.month && earliest.year === latest.year) {
		if (earliest.day === latest.day) {
			return {
				label: `${earliest.day} ${earliest.month} ${earliest.year}`,
				spanDays,
				earliestDate,
				latestDate,
			};
		}
		return {
			label: `${earliest.day}-${latest.day} ${earliest.month} ${earliest.year}`,
			spanDays,
			earliestDate,
			latestDate,
		};
	}

	if (earliest.year === latest.year) {
		return {
			label: `${earliest.month} ${earliest.day} - ${latest.month} ${latest.day}, ${earliest.year}`,
			spanDays,
			earliestDate,
			latestDate,
		};
	}

	return {
		label: `${earliest.month} ${earliest.day}, ${earliest.year} - ${latest.month} ${latest.day}, ${latest.year}`,
		spanDays,
		earliestDate,
		latestDate,
	};
};

export const getEventStatsUniqueDays = (
	events: EventStatsDateInput[],
): number =>
	new Set(
		events.map((event) => event.day).filter((day) => day && day !== "tbc"),
	).size;
