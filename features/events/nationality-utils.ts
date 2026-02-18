import type { Nationality } from "./types";

const FLAG_PAIR_REGEX = /[\u{1f1e6}-\u{1f1ff}]{2}/gu;
const TOKEN_SPLIT_REGEX = /[\/&+,\s]+/;

const ISO_TO_NATIONALITY: Record<string, Nationality> = {
	GB: "UK",
	UK: "UK",
	FR: "FR",
	CA: "CA",
	NL: "NL",
};

const TEXT_TO_NATIONALITY: Record<string, Nationality> = {
	gb: "UK",
	uk: "UK",
	britain: "UK",
	british: "UK",
	"united kingdom": "UK",
	fr: "FR",
	france: "FR",
	french: "FR",
	ca: "CA",
	canada: "CA",
	canadian: "CA",
	nl: "NL",
	netherlands: "NL",
	dutch: "NL",
};

const asIsoFromFlag = (flag: string): string | null => {
	const codePoints = Array.from(flag).map((char) => char.codePointAt(0) ?? 0);
	if (codePoints.length !== 2) return null;
	const letters = codePoints.map((codePoint) => {
		const offset = codePoint - 0x1f1e6;
		if (offset < 0 || offset > 25) return null;
		return String.fromCharCode(65 + offset);
	});
	if (letters.some((letter) => letter === null)) return null;
	return letters.join("");
};

const tokenizeText = (value: string): string[] => {
	return value
		.toLowerCase()
		.replace(/[()]/g, " ")
		.split(TOKEN_SPLIT_REGEX)
		.map((token) => token.trim())
		.filter((token) => token.length > 0);
};

export const parseSupportedNationalities = (
	rawValue: string | null | undefined,
): {
	codes: Nationality[];
	unsupportedTokens: string[];
} => {
	const value = String(rawValue ?? "").trim();
	if (!value) {
		return { codes: [], unsupportedTokens: [] };
	}

	const codes: Nationality[] = [];
	const unsupportedTokens: string[] = [];

	const pushCode = (code: Nationality): void => {
		if (!codes.includes(code)) {
			codes.push(code);
		}
	};

	const flags = value.match(FLAG_PAIR_REGEX) ?? [];
	for (const flag of flags) {
		const iso = asIsoFromFlag(flag);
		if (!iso) continue;
		const mapped = ISO_TO_NATIONALITY[iso];
		if (mapped) {
			pushCode(mapped);
		} else if (!unsupportedTokens.includes(iso)) {
			unsupportedTokens.push(iso);
		}
	}

	const lowered = value.toLowerCase();
	for (const [text, mapped] of Object.entries(TEXT_TO_NATIONALITY)) {
		if (lowered.includes(text)) {
			pushCode(mapped);
		}
	}

	for (const token of tokenizeText(value)) {
		const mapped = TEXT_TO_NATIONALITY[token];
		if (mapped) {
			pushCode(mapped);
			continue;
		}

		const upper = token.toUpperCase();
		if (ISO_TO_NATIONALITY[upper]) {
			pushCode(ISO_TO_NATIONALITY[upper]);
			continue;
		}

		if (/^[A-Z]{2,3}$/.test(upper) && !unsupportedTokens.includes(upper)) {
			unsupportedTokens.push(upper);
		}
	}

	return { codes, unsupportedTokens };
};
