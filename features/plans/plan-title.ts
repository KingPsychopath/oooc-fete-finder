const MAX_PLAN_TITLE_LENGTH = 60;
const CONTROL_OR_INVISIBLE_PATTERN =
	/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g;
const URL_PATTERN =
	/(https?:\/\/|www\.|(?:^|[\s])[\w.-]+\.(?:com|net|org|co|io|app|uk|fr|ly|me|site|xyz)\b)/i;
const EMAIL_PATTERN = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i;
const PHONE_PATTERN = /(?:\+?\d[\d\s().-]{6,}\d)/;
const RESERVED_IDENTITY_PATTERN =
	/\b(oooc|out\s*of\s*office|official|admin|moderator|staff)\b/i;
const REPEATED_CHARACTER_PATTERN = /(.)\1{7,}/u;
const REPEATED_PUNCTUATION_PATTERN = /[!?._-]{6,}/;

const WEEKDAY_LABELS = [
	"Sun",
	"Mon",
	"Tue",
	"Wed",
	"Thu",
	"Fri",
	"Sat",
] as const;
const MONTH_LABELS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
] as const;

export type PlanTitleValidationResult =
	| { success: true; title: string }
	| { success: false; error: string };

export const normalizePlanTitle = (value: string): string =>
	value
		.normalize("NFKC")
		.replace(CONTROL_OR_INVISIBLE_PATTERN, "")
		.replace(/\s+/g, " ")
		.trim();

export const validatePlanTitle = (value: string): PlanTitleValidationResult => {
	const title = normalizePlanTitle(value);
	if (!title) {
		return { success: false, error: "Name the route before saving." };
	}
	if (title.length > MAX_PLAN_TITLE_LENGTH) {
		return {
			success: false,
			error: `Route names can be up to ${MAX_PLAN_TITLE_LENGTH} characters.`,
		};
	}
	if (URL_PATTERN.test(title) || EMAIL_PATTERN.test(title)) {
		return {
			success: false,
			error: "Route names cannot include links or email addresses.",
		};
	}
	if (PHONE_PATTERN.test(title)) {
		return {
			success: false,
			error: "Route names cannot include phone numbers.",
		};
	}
	if (RESERVED_IDENTITY_PATTERN.test(title)) {
		return {
			success: false,
			error: "Use a personal route name, not an official or admin label.",
		};
	}
	if (
		REPEATED_CHARACTER_PATTERN.test(title) ||
		REPEATED_PUNCTUATION_PATTERN.test(title)
	) {
		return {
			success: false,
			error: "Route names cannot use repeated characters or punctuation.",
		};
	}
	return { success: true, title };
};

export const sanitizePlanTitleForStorage = (
	value: string,
	fallback: string,
): string => {
	const result = validatePlanTitle(value);
	return result.success ? result.title : fallback;
};

export const formatPublicPlanTitle = (date: string): string => {
	const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!match) return "Shared route";
	const year = Number.parseInt(match[1], 10);
	const monthIndex = Number.parseInt(match[2], 10) - 1;
	const day = Number.parseInt(match[3], 10);
	const parsed = new Date(Date.UTC(year, monthIndex, day));
	if (
		parsed.getUTCFullYear() !== year ||
		parsed.getUTCMonth() !== monthIndex ||
		parsed.getUTCDate() !== day
	) {
		return "Shared route";
	}
	return `Route for ${WEEKDAY_LABELS[parsed.getUTCDay()]} ${day} ${MONTH_LABELS[monthIndex]}`;
};
