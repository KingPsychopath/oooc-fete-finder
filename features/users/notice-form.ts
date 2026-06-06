const ALLOWED_CTA_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

const BARE_DOMAIN_PATTERN =
	/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:[/?#].*)?$/i;

const LOCAL_PATH_PATTERN = /^\/(?!\/)/;

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
		return ALLOWED_CTA_PROTOCOLS.has(parsed.protocol) ? parsed.toString() : null;
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
