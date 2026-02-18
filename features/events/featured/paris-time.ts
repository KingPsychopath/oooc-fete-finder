const PARIS_TIME_ZONE = "Europe/Paris";

const PARIS_FORMATTER = new Intl.DateTimeFormat("en-CA", {
	timeZone: PARIS_TIME_ZONE,
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
	hourCycle: "h23",
});

type ParisDateParts = {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
};

const toParisDateParts = (date: Date): ParisDateParts => {
	const parts = PARIS_FORMATTER.formatToParts(date);
	const read = (type: Intl.DateTimeFormatPartTypes): number => {
		const value = parts.find((part) => part.type === type)?.value;
		return Number.parseInt(value || "0", 10);
	};

	return {
		year: read("year"),
		month: read("month"),
		day: read("day"),
		hour: read("hour"),
		minute: read("minute"),
	};
};

const parseDateTimeLocalInput = (
	input: string,
): {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
} | null => {
	const match = input.trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
	if (!match) return null;

	const parsed = {
		year: Number.parseInt(match[1], 10),
		month: Number.parseInt(match[2], 10),
		day: Number.parseInt(match[3], 10),
		hour: Number.parseInt(match[4], 10),
		minute: Number.parseInt(match[5], 10),
	};

	if (
		parsed.month < 1 ||
		parsed.month > 12 ||
		parsed.day < 1 ||
		parsed.day > 31 ||
		parsed.hour > 23 ||
		parsed.minute > 59
	) {
		return null;
	}

	return parsed;
};

const comparePartsToTarget = (
	parts: ParisDateParts,
	target: {
		year: number;
		month: number;
		day: number;
		hour: number;
		minute: number;
	},
): number => {
	const currentMinutes = Date.UTC(
		parts.year,
		parts.month - 1,
		parts.day,
		parts.hour,
		parts.minute,
	);
	const targetMinutes = Date.UTC(
		target.year,
		target.month - 1,
		target.day,
		target.hour,
		target.minute,
	);
	return Math.round((targetMinutes - currentMinutes) / (1000 * 60));
};

/**
 * Parse a `datetime-local` string as Europe/Paris wall-clock time.
 */
export const parseParisDateTimeInput = (input: string): Date | null => {
	const target = parseDateTimeLocalInput(input);
	if (!target) return null;

	// Start with UTC guess and iteratively adjust to match Paris wall-clock parts.
	let timestamp = Date.UTC(
		target.year,
		target.month - 1,
		target.day,
		target.hour,
		target.minute,
	);

	for (let attempt = 0; attempt < 5; attempt += 1) {
		const parts = toParisDateParts(new Date(timestamp));
		const diffMinutes = comparePartsToTarget(parts, target);
		if (diffMinutes === 0) {
			return new Date(timestamp);
		}
		timestamp += diffMinutes * 60 * 1000;
	}

	const finalParts = toParisDateParts(new Date(timestamp));
	return comparePartsToTarget(finalParts, target) === 0
		? new Date(timestamp)
		: null;
};

export const toParisDateTimeLocalInput = (date: Date): string => {
	const parts = toParisDateParts(date);
	const pad = (value: number) => String(value).padStart(2, "0");
	return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
};

export const formatDateTimeInParis = (value: string): string => {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return new Intl.DateTimeFormat("en-GB", {
		timeZone: PARIS_TIME_ZONE,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).format(date);
};
