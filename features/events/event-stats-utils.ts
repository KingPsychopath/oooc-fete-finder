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
	suppressedOutlierYears?: number[];
};

const getSummaryDatesWithOutlierSuppression = (
	dates: string[],
): { summaryDates: string[]; suppressedOutlierYears: number[] } => {
	if (dates.length < 3) {
		return { summaryDates: dates, suppressedOutlierYears: [] };
	}

	const yearCounts = new Map<number, number>();
	for (const date of dates) {
		const parts = parseISODateParts(date);
		if (!parts) continue;
		yearCounts.set(parts.year, (yearCounts.get(parts.year) ?? 0) + 1);
	}

	if (yearCounts.size <= 1) {
		return { summaryDates: dates, suppressedOutlierYears: [] };
	}

	const sortedYearCounts = Array.from(yearCounts.entries()).sort((a, b) => {
		if (b[1] !== a[1]) return b[1] - a[1];
		return b[0] - a[0];
	});
	const [dominantYear, dominantCount] = sortedYearCounts[0];
	const dominantShare = dominantCount / dates.length;

	if (dominantCount < 2 || dominantShare < 0.6) {
		return { summaryDates: dates, suppressedOutlierYears: [] };
	}

	const suppressedOutlierYears = sortedYearCounts
		.filter(
			([year, count]) =>
				year !== dominantYear &&
				count === 1 &&
				Math.abs(year - dominantYear) >= 10,
		)
		.map(([year]) => year);

	if (suppressedOutlierYears.length === 0) {
		return { summaryDates: dates, suppressedOutlierYears: [] };
	}

	const suppressedYearSet = new Set(suppressedOutlierYears);
	const summaryDates = dates.filter((date) => {
		const parts = parseISODateParts(date);
		return parts ? !suppressedYearSet.has(parts.year) : false;
	});

	return summaryDates.length >= 2
		? { summaryDates, suppressedOutlierYears }
		: { summaryDates: dates, suppressedOutlierYears: [] };
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

	const { summaryDates, suppressedOutlierYears } =
		getSummaryDatesWithOutlierSuppression(dates);
	const earliestDate = summaryDates[0];
	const latestDate = summaryDates[summaryDates.length - 1];
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
				suppressedOutlierYears,
			};
		}
		return {
			label: `${earliest.day}-${latest.day} ${earliest.month} ${earliest.year}`,
			spanDays,
			earliestDate,
			latestDate,
			suppressedOutlierYears,
		};
	}

	if (earliest.year === latest.year) {
		return {
			label: `${earliest.month} ${earliest.day} - ${latest.month} ${latest.day}, ${earliest.year}`,
			spanDays,
			earliestDate,
			latestDate,
			suppressedOutlierYears,
		};
	}

	return {
		label: `${earliest.month} ${earliest.day}, ${earliest.year} - ${latest.month} ${latest.day}, ${latest.year}`,
		spanDays,
		earliestDate,
		latestDate,
		suppressedOutlierYears,
	};
};

export const getEventStatsUniqueDays = (
	events: EventStatsDateInput[],
): number =>
	new Set(
		events.map((event) => event.day).filter((day) => day && day !== "tbc"),
	).size;
