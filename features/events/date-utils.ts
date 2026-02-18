export type ISODateParts = {
	year: number;
	month: number;
	day: number;
};

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const isValidCalendarDate = (
	year: number,
	month: number,
	day: number,
): boolean => {
	if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
		return false;
	}
	if (year < 1900 || year > 2099 || month < 1 || month > 12 || day < 1 || day > 31) {
		return false;
	}

	const candidate = new Date(Date.UTC(year, month - 1, day));
	return (
		candidate.getUTCFullYear() === year &&
		candidate.getUTCMonth() === month - 1 &&
		candidate.getUTCDate() === day
	);
};

export const parseISODateParts = (isoDate: string): ISODateParts | null => {
	const match = isoDate.trim().match(ISO_DATE_PATTERN);
	if (!match) return null;

	const year = Number.parseInt(match[1], 10);
	const month = Number.parseInt(match[2], 10);
	const day = Number.parseInt(match[3], 10);
	if (!isValidCalendarDate(year, month, day)) {
		return null;
	}

	return { year, month, day };
};

export const isStrictISODate = (value: string): boolean =>
	parseISODateParts(value) !== null;

export const isoDatePartsToUTCDate = (parts: ISODateParts): Date =>
	new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
