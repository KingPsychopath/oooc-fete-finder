const HAS_SCHEME_PATTERN = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//;
const IPV4_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$/;

const isValidIpv4 = (hostname: string): boolean => {
	if (!IPV4_PATTERN.test(hostname)) return false;
	return hostname.split(".").every((segment) => {
		const value = Number(segment);
		return Number.isInteger(value) && value >= 0 && value <= 255;
	});
};

const hasValidHostname = (hostname: string): boolean => {
	if (!hostname) return false;
	if (hostname === "localhost") return true;
	if (hostname.includes(".")) return true;
	if (isValidIpv4(hostname)) return true;
	return hostname.includes(":");
};

const toUrlCandidate = (value: string): string => {
	const normalized = value.trim();
	if (!normalized) return "";
	if (HAS_SCHEME_PATTERN.test(normalized)) return normalized;
	if (normalized.startsWith("//")) return `https:${normalized}`;
	return `https://${normalized}`;
};

export const normalizeProofLink = (value: string): string | null => {
	const candidate = toUrlCandidate(value);
	if (!candidate) return null;

	try {
		const parsed = new URL(candidate);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
			return null;
		}
		if (!hasValidHostname(parsed.hostname)) {
			return null;
		}
		return parsed.toString();
	} catch {
		return null;
	}
};
