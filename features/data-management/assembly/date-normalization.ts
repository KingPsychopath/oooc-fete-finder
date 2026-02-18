import type { EventDay } from "@/features/events/types";
import type { CSVEventRow } from "../csv/parser";

const DAY_MAPPING: Record<number, EventDay> = {
	0: "sunday",
	1: "monday",
	2: "tuesday",
	3: "wednesday",
	4: "thursday",
	5: "friday",
	6: "saturday",
};

const MONTH_NAME_TO_NUMBER: Record<string, number> = {
	jan: 1,
	january: 1,
	feb: 2,
	february: 2,
	mar: 3,
	march: 3,
	apr: 4,
	april: 4,
	may: 5,
	jun: 6,
	june: 6,
	jul: 7,
	july: 7,
	aug: 8,
	august: 8,
	sep: 9,
	sept: 9,
	september: 9,
	oct: 10,
	october: 10,
	nov: 11,
	november: 11,
	dec: 12,
	december: 12,
};

export type DateNormalizationWarningType =
	| "ambiguous"
	| "invalid"
	| "inferred_year"
	| "unparseable";

export interface DateNormalizationWarning {
	type: DateNormalizationWarningType;
	detectedFormat: string;
	message: string;
	recommendedAction: string;
	potentialFormats?: {
		us: string;
		uk: string;
		iso: string;
	};
}

export interface DateNormalizationContext {
	inferredYear: number;
	referenceDate: Date;
	ambiguousNumericPolicy: "reject";
}

export interface NormalizeDateOptions {
	referenceDate?: Date;
}

export interface NormalizedEventDate {
	isoDate: string;
	day: EventDay;
	year: number | null;
	usedInferredYear: boolean;
	warning?: DateNormalizationWarning;
}

type DateParseResult =
	| {
			status: "success";
			day: number;
			month: number;
			year: number | null;
			detectedFormat: string;
	  }
	| {
			status: "ambiguous";
			detectedFormat: string;
			message: string;
			potentialFormats: {
				us: string;
				uk: string;
				iso: string;
			};
	  }
	| {
			status: "invalid" | "unparseable";
			detectedFormat: string;
			message: string;
	  };

const isValidYear = (value: number): boolean => value >= 1900 && value <= 2099;

const getMonthFromToken = (token: string): number | null => {
	const cleaned = token.toLowerCase().replace(/\.$/, "");
	return MONTH_NAME_TO_NUMBER[cleaned] ?? null;
};

const buildISODate = (year: number, month: number, day: number): string =>
	`${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;

const isValidCalendarDate = (
	year: number,
	month: number,
	day: number,
): boolean => {
	if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
		return false;
	}
	if (!isValidYear(year) || month < 1 || month > 12 || day < 1 || day > 31) {
		return false;
	}
	const date = new Date(Date.UTC(year, month - 1, day));
	return (
		date.getUTCFullYear() === year &&
		date.getUTCMonth() === month - 1 &&
		date.getUTCDate() === day
	);
};

const toEventDay = (year: number, month: number, day: number): EventDay => {
	const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
	return DAY_MAPPING[jsDay] ?? "tbc";
};

const normalizeDateInput = (value: string): string =>
	value
		.trim()
		.toLowerCase()
		.replace(/(\d)(st|nd|rd|th)\b/g, "$1")
		.replace(/,/g, " ")
		.replace(/\s+/g, " ");

const parseNumericDate = (
	leftPart: string,
	rightPart: string,
	yearPart: string | undefined,
	separator: "/" | "-",
	contextYear: number,
): DateParseResult => {
	const left = Number.parseInt(leftPart, 10);
	const right = Number.parseInt(rightPart, 10);
	if (!Number.isInteger(left) || !Number.isInteger(right)) {
		return {
			status: "unparseable",
			detectedFormat: "numeric",
			message: "Unable to parse numeric date values.",
		};
	}

	let explicitYear: number | null = null;
	if (yearPart !== undefined) {
		if (yearPart.length !== 4) {
			return {
				status: "invalid",
				detectedFormat: `numeric-${separator}`,
				message: "Numeric dates must use a four-digit year.",
			};
		}
		const parsedYear = Number.parseInt(yearPart, 10);
		if (!isValidYear(parsedYear)) {
			return {
				status: "invalid",
				detectedFormat: `numeric-${separator}`,
				message: "Date year is outside the supported range (1900-2099).",
			};
		}
		explicitYear = parsedYear;
	}

	const candidateYear = explicitYear ?? contextYear;
	const dayFirstValid = isValidCalendarDate(candidateYear, right, left);
	const monthFirstValid = isValidCalendarDate(candidateYear, left, right);

	if (dayFirstValid && monthFirstValid && left !== right) {
		const detectedFormat =
			yearPart === undefined ?
				`numeric-${separator}-without-year`
			:	`numeric-${separator}-with-year`;
		const usIso = buildISODate(candidateYear, left, right);
		const ukIso = buildISODate(candidateYear, right, left);
		return {
			status: "ambiguous",
			detectedFormat,
			message:
				"Ambiguous numeric date. Use YYYY-MM-DD or write the month name.",
			potentialFormats: {
				us: `${left.toString().padStart(2, "0")}/${right.toString().padStart(2, "0")}/${candidateYear} (ISO ${usIso})`,
				uk: `${left.toString().padStart(2, "0")}/${right.toString().padStart(2, "0")}/${candidateYear} (ISO ${ukIso})`,
				iso: "",
			},
		};
	}

	if (dayFirstValid) {
		return {
			status: "success",
			day: left,
			month: right,
			year: explicitYear,
			detectedFormat:
				yearPart === undefined ?
					`numeric-${separator}-day-first-without-year`
				:	`numeric-${separator}-day-first`,
		};
	}

	if (monthFirstValid) {
		return {
			status: "success",
			day: right,
			month: left,
			year: explicitYear,
			detectedFormat:
				yearPart === undefined ?
					`numeric-${separator}-month-first-without-year`
				:	`numeric-${separator}-month-first`,
		};
	}

	return {
		status: "invalid",
		detectedFormat: `numeric-${separator}`,
		message: "Numeric date is not a valid calendar date.",
	};
};

const parseDate = (rawDate: string, contextYear: number): DateParseResult => {
	const normalized = normalizeDateInput(rawDate);

	const isoMatch = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
	if (isoMatch) {
		const year = Number.parseInt(isoMatch[1], 10);
		const month = Number.parseInt(isoMatch[2], 10);
		const day = Number.parseInt(isoMatch[3], 10);
		return {
			status: "success",
			year,
			month,
			day,
			detectedFormat: "iso-8601",
		};
	}

	const yearFirstSlashMatch = normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
	if (yearFirstSlashMatch) {
		return {
			status: "success",
			year: Number.parseInt(yearFirstSlashMatch[1], 10),
			month: Number.parseInt(yearFirstSlashMatch[2], 10),
			day: Number.parseInt(yearFirstSlashMatch[3], 10),
			detectedFormat: "year-first-slash",
		};
	}

	const dayMonthWordMatch = normalized.match(
		/^(\d{1,2})\s+([a-z]+)\s*(\d{4})?$/,
	);
	if (dayMonthWordMatch) {
		const day = Number.parseInt(dayMonthWordMatch[1], 10);
		const month = getMonthFromToken(dayMonthWordMatch[2]);
		if (month === null) {
			return {
				status: "unparseable",
				detectedFormat: "day-month-text",
				message: "Month name was not recognized.",
			};
		}
		const year =
			dayMonthWordMatch[3] ? Number.parseInt(dayMonthWordMatch[3], 10) : null;
		return {
			status: "success",
			day,
			month,
			year,
			detectedFormat:
				year === null ? "day-month-text-without-year" : "day-month-text",
		};
	}

	const monthDayWordMatch = normalized.match(
		/^([a-z]+)\s+(\d{1,2})\s*(\d{4})?$/,
	);
	if (monthDayWordMatch) {
		const month = getMonthFromToken(monthDayWordMatch[1]);
		if (month === null) {
			return {
				status: "unparseable",
				detectedFormat: "month-day-text",
				message: "Month name was not recognized.",
			};
		}
		const day = Number.parseInt(monthDayWordMatch[2], 10);
		const year =
			monthDayWordMatch[3] ?
				Number.parseInt(monthDayWordMatch[3], 10)
			:	null;
		return {
			status: "success",
			day,
			month,
			year,
			detectedFormat:
				year === null ? "month-day-text-without-year" : "month-day-text",
		};
	}

	const slashNumericMatch = normalized.match(
		/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/,
	);
	if (slashNumericMatch) {
		return parseNumericDate(
			slashNumericMatch[1],
			slashNumericMatch[2],
			slashNumericMatch[3],
			"/",
			contextYear,
		);
	}

	const hyphenNumericMatch = normalized.match(
		/^(\d{1,2})-(\d{1,2})(?:-(\d{2,4}))?$/,
	);
	if (hyphenNumericMatch) {
		return parseNumericDate(
			hyphenNumericMatch[1],
			hyphenNumericMatch[2],
			hyphenNumericMatch[3],
			"-",
			contextYear,
		);
	}

	return {
		status: "unparseable",
		detectedFormat: "unknown",
		message: "Date format is not recognized.",
	};
};

const extractExplicitYear = (rawDate: string): number | null => {
	const normalized = normalizeDateInput(rawDate);
	const yearMatches = normalized.match(/\b(19|20)\d{2}\b/g);
	if (!yearMatches || yearMatches.length === 0) return null;
	const firstYear = Number.parseInt(yearMatches[0], 10);
	return isValidYear(firstYear) ? firstYear : null;
};

const selectInferredYear = (
	explicitYears: number[],
	referenceYear: number,
): number => {
	if (explicitYears.length === 0) return referenceYear;

	const counts = new Map<number, number>();
	for (const year of explicitYears) {
		counts.set(year, (counts.get(year) ?? 0) + 1);
	}

	const maxCount = Math.max(...counts.values());
	const topYears = Array.from(counts.entries())
		.filter(([, count]) => count === maxCount)
		.map(([year]) => year);

	if (topYears.length === 1) return topYears[0];

	topYears.sort((left, right) => {
		const leftDistance = Math.abs(left - referenceYear);
		const rightDistance = Math.abs(right - referenceYear);
		if (leftDistance !== rightDistance) return leftDistance - rightDistance;
		return right - left;
	});

	return topYears[0];
};

export const createDateNormalizationContext = (
	rows: CSVEventRow[],
	options: NormalizeDateOptions = {},
): DateNormalizationContext => {
	const referenceDate = options.referenceDate ?? new Date();
	const referenceYear = referenceDate.getUTCFullYear();

	const explicitYears = rows
		.map((row) => extractExplicitYear(row.date))
		.filter((year): year is number => year !== null);

	return {
		inferredYear: selectInferredYear(explicitYears, referenceYear),
		referenceDate,
		ambiguousNumericPolicy: "reject",
	};
};

export const normalizeCsvDate = (
	rawDate: string,
	context: DateNormalizationContext,
): NormalizedEventDate => {
	const trimmed = rawDate.trim();
	if (trimmed.length === 0) {
		return {
			isoDate: "",
			day: "tbc",
			year: null,
			usedInferredYear: false,
			warning: {
				type: "unparseable",
				detectedFormat: "empty",
				message: "Date value is empty.",
				recommendedAction: "Provide a valid event date in the Date column.",
			},
		};
	}

	const parsed = parseDate(trimmed, context.inferredYear);
	if (parsed.status !== "success") {
		if (parsed.status === "ambiguous") {
			return {
				isoDate: "",
				day: "tbc",
				year: null,
				usedInferredYear: false,
				warning: {
					type: "ambiguous",
					detectedFormat: parsed.detectedFormat,
					message: parsed.message,
					recommendedAction:
						"Use an unambiguous format like YYYY-MM-DD or month names.",
					potentialFormats: parsed.potentialFormats,
				},
			};
		}

		return {
			isoDate: "",
			day: "tbc",
			year: null,
			usedInferredYear: false,
			warning: {
				type: parsed.status,
				detectedFormat: parsed.detectedFormat,
				message: parsed.message,
				recommendedAction: "Correct the date format in the Date column.",
			},
		};
	}

	const year = parsed.year ?? context.inferredYear;
	const usedInferredYear = parsed.year === null;
	if (!isValidCalendarDate(year, parsed.month, parsed.day)) {
		return {
			isoDate: "",
			day: "tbc",
			year: null,
			usedInferredYear: false,
			warning: {
				type: "invalid",
				detectedFormat: parsed.detectedFormat,
				message: "Date is not a valid calendar date.",
				recommendedAction: "Correct the date to a valid day/month/year.",
			},
		};
	}

	const isoDate = buildISODate(year, parsed.month, parsed.day);
	const day = toEventDay(year, parsed.month, parsed.day);
	if (!usedInferredYear) {
		return {
			isoDate,
			day,
			year,
			usedInferredYear: false,
		};
	}

	return {
		isoDate,
		day,
		year,
		usedInferredYear: true,
		warning: {
			type: "inferred_year",
			detectedFormat: parsed.detectedFormat,
			message: `Year inferred as ${year}.`,
			recommendedAction:
				"Add an explicit year in the Date column for deterministic imports.",
			potentialFormats: {
				us: "",
				uk: "",
				iso: isoDate,
			},
		},
	};
};
