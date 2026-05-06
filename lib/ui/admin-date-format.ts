const ADMIN_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
	dateStyle: "short",
	timeStyle: "medium",
	timeZone: "Europe/London",
});

const ADMIN_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
	dateStyle: "short",
	timeZone: "Europe/London",
});

const ADMIN_TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
	timeStyle: "medium",
	timeZone: "Europe/London",
});

const getTime = (value: Date | number | string | null | undefined): number => {
	if (value == null) return Number.NaN;
	return value instanceof Date ? value.getTime() : new Date(value).getTime();
};

export const formatAdminDateTime = (
	value: Date | number | string | null | undefined,
	fallback = "Unknown time",
): string => {
	const time = getTime(value);
	if (!Number.isFinite(time)) return fallback;
	return ADMIN_DATE_TIME_FORMATTER.format(time);
};

export const formatAdminDate = (
	value: Date | number | string | null | undefined,
	fallback = "Unknown date",
): string => {
	const time = getTime(value);
	if (!Number.isFinite(time)) return fallback;
	return ADMIN_DATE_FORMATTER.format(time);
};

export const formatAdminTime = (
	value: Date | number | string | null | undefined,
	fallback = "Unknown time",
): string => {
	const time = getTime(value);
	if (!Number.isFinite(time)) return fallback;
	return ADMIN_TIME_FORMATTER.format(time);
};
