const commonEmailDomains = [
	"gmail.com",
	"yahoo.com",
	"hotmail.com",
	"outlook.com",
	"icloud.com",
	"protonmail.com",
	"aol.com",
	"msn.com",
	"live.com",
	"googlemail.com",
	"mail.com",
	"zoho.com",
	"me.com",
];

const suggestableEmailTlds = new Set([
	"com",
	"con",
	"net",
	"org",
	"co.uk",
	"com.au",
	"io",
	"co",
	"ca",
	"de",
	"uk",
	"fr",
	"it",
	"es",
	"au",
	"nz",
	"in",
	"us",
	"at",
	"be",
]);

export type StoredAuthProfile = {
	firstName: string;
	lastName: string;
	email: string;
};

export const normalizeEmailInput = (value: string): string =>
	value.replace(/\s*@\s*/g, "@").trim();

export const validateEmail = (rawEmail: string): boolean => {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(rawEmail);
};

export const validateName = (rawName: string): boolean => {
	const name = rawName.trim();
	return name.length >= 2;
};

export const sanitizeRecentProfile = (
	value: unknown,
): StoredAuthProfile | null => {
	if (!value || typeof value !== "object") return null;

	const profile = value as Partial<StoredAuthProfile>;
	const firstName =
		typeof profile.firstName === "string" ? profile.firstName.trim() : "";
	const lastName =
		typeof profile.lastName === "string" ? profile.lastName.trim() : "";
	const email =
		typeof profile.email === "string" ? profile.email.trim().toLowerCase() : "";
	if (!firstName || !lastName || !email) return null;
	if (!validateEmail(email)) return null;

	return { firstName, lastName, email };
};

const isLikelyTypoDomain = (domain: string): boolean => {
	const normalized = domain.toLowerCase();
	if (!normalized.includes(".") || normalized.length > 24) return false;

	const labels = normalized.split(".");
	if (labels.length > 3 || labels.some((label) => label.length === 0)) {
		return false;
	}

	const tldPair = labels.length >= 2 ? `${labels.at(-2)}.${labels.at(-1)}` : "";
	if (labels.length === 2 && suggestableEmailTlds.has(labels.at(-1) ?? "")) {
		return true;
	}

	if (
		(labels.length === 3 && suggestableEmailTlds.has(tldPair)) ||
		(labels.length === 3 &&
			suggestableEmailTlds.has(`${labels.at(-1) ?? ""}`) &&
			labels.at(-2) === "co")
	) {
		return true;
	}

	return false;
};

const calculateSuggestionConfidence = (
	domain: string,
	distance: number,
): boolean => {
	if (distance === 1) return true;
	if (distance > 2) return false;

	const hasDotty = domain.includes(".");
	const hasBusinessShape =
		domain.length >= 9 &&
		domain.length <= 20 &&
		hasDotty &&
		domain.includes(".");
	return distance === 2 ? hasBusinessShape : false;
};

const calculateLevenshteinDistance = (left: string, right: string): number => {
	if (left.length === 0) return right.length;
	if (right.length === 0) return left.length;

	const matrix: number[][] = Array.from({ length: left.length + 1 }, () =>
		Array.from({ length: right.length + 1 }, () => 0),
	);

	for (let i = 0; i <= left.length; i += 1) {
		matrix[i][0] = i;
	}
	for (let j = 0; j <= right.length; j += 1) {
		matrix[0][j] = j;
	}

	for (let i = 1; i <= left.length; i += 1) {
		for (let j = 1; j <= right.length; j += 1) {
			const cost = left[i - 1] === right[j - 1] ? 0 : 1;
			matrix[i][j] = Math.min(
				matrix[i - 1][j] + 1,
				matrix[i][j - 1] + 1,
				matrix[i - 1][j - 1] + cost,
			);
		}
	}

	return matrix[left.length][right.length];
};

export const buildSuggestedEmail = (rawEmail: string): string | null => {
	const normalized = normalizeEmailInput(rawEmail).toLowerCase();
	const atIndex = normalized.lastIndexOf("@");
	if (atIndex <= 0) return null;

	const localPart = normalized.slice(0, atIndex);
	const domainPart = normalized.slice(atIndex + 1);
	if (!localPart || !domainPart || !domainPart.includes(".")) return null;
	if (!isLikelyTypoDomain(domainPart)) return null;

	let bestDomain = "";
	let bestDistance = Number.POSITIVE_INFINITY;

	for (const domain of commonEmailDomains) {
		const distance = calculateLevenshteinDistance(domainPart, domain);
		if (distance < bestDistance) {
			bestDistance = distance;
			bestDomain = domain;
		}
	}

	if (!calculateSuggestionConfidence(domainPart, bestDistance)) return null;
	return `${localPart}@${bestDomain}`;
};

export const sanitizePastedEmail = (value: string): string => {
	const trimmed = value.trim();
	return normalizeEmailInput(
		trimmed
			.replace(/^[\s<([{"'`.,;:>)}]+/, "")
			.replace(/[\s<([{"'`.,;:>)}]+$/, ""),
	);
};
