const ALLOWED_CTA_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);
const DEFAULT_NOTICE_EXPIRY_DAYS = 14;

const BARE_DOMAIN_PATTERN =
	/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:[/?#].*)?$/i;

const LOCAL_PATH_PATTERN = /^\/(?!\/)/;

const padDatePart = (value: number): string =>
	value.toString().padStart(2, "0");

export const toDateTimeLocalInputValue = (date: Date): string =>
	[
		date.getFullYear(),
		padDatePart(date.getMonth() + 1),
		padDatePart(date.getDate()),
	].join("-") +
	`T${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`;

export const getDefaultNoticeExpiresAtInputValue = (): string => {
	const expiresAt = new Date();
	expiresAt.setDate(expiresAt.getDate() + DEFAULT_NOTICE_EXPIRY_DAYS);
	return toDateTimeLocalInputValue(expiresAt);
};

export const normalizeNoticeCtaHref = (
	value: string | null | undefined,
): string | null => {
	const trimmed = typeof value === "string" ? value.trim() : "";
	if (!trimmed) return null;

	if (LOCAL_PATH_PATTERN.test(trimmed)) return trimmed;

	const href = BARE_DOMAIN_PATTERN.test(trimmed)
		? `https://${trimmed}`
		: trimmed;

	try {
		const parsed = new URL(href);
		return ALLOWED_CTA_PROTOCOLS.has(parsed.protocol)
			? parsed.toString()
			: null;
	} catch {
		return null;
	}
};

export const getNoticeCtaHrefError = (
	value: string | null | undefined,
): string | null => {
	const trimmed = typeof value === "string" ? value.trim() : "";
	if (!trimmed) return null;
	return normalizeNoticeCtaHref(trimmed)
		? null
		: "CTA link must be a site path, a web URL, an email link, or a phone link.";
};

export const getNoticeLifecycleError = (input: {
	requiresAck?: boolean;
	dismissible?: boolean;
	startsAt?: string | null;
	expiresAt?: string | null;
}): string | null => {
	const startsAt = typeof input.startsAt === "string" ? input.startsAt : "";
	const expiresAt = typeof input.expiresAt === "string" ? input.expiresAt : "";
	const startsAtMs = startsAt ? Date.parse(startsAt) : Date.now();
	const expiresAtMs = expiresAt ? Date.parse(expiresAt) : null;

	if (
		expiresAtMs != null &&
		Number.isFinite(expiresAtMs) &&
		Number.isFinite(startsAtMs) &&
		expiresAtMs <= startsAtMs
	) {
		return "Notice expiry must be after the start time.";
	}

	if (!input.requiresAck && input.dismissible === false && !expiresAt) {
		return "A notice without acknowledgement must be dismissible or have an expiry.";
	}

	return null;
};
