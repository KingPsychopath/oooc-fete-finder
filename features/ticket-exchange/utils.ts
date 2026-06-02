import type { Event } from "@/features/events/types";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { z } from "zod";
import {
	TICKET_EXCHANGE_CONTACT_METHODS,
	TICKET_EXCHANGE_DEFAULT_EXPIRY_HOURS,
	TICKET_EXCHANGE_MAX_EXPIRY_HOURS,
} from "./constants";
import type {
	TicketExchangeContactMethod,
	TicketExchangeContactProfile,
	TicketExchangeContactSnapshot,
	TicketExchangeListingStatus,
} from "./types";

export const normalizeHandle = (value: string): string =>
	value.trim().replace(/^@+/, "");

export const normalizeOptionalEmail = (value: string): string => {
	const normalized = value.trim().toLowerCase();
	if (!normalized) return "";
	const parsed = z.email().safeParse(normalized);
	if (!parsed.success) {
		throw new Error("Enter a valid email address.");
	}
	return normalized;
};

export const normalizeWhatsAppNumber = (value: string): string => {
	const normalized = value.trim();
	if (!normalized) return "";
	const parsed = parsePhoneNumberFromString(normalized);
	if (!parsed?.isValid()) {
		throw new Error("Enter a valid WhatsApp number with country code.");
	}
	return parsed.number;
};

export const normalizeInstagramHandle = (value: string): string => {
	const normalized = normalizeHandle(value);
	if (!normalized) return "";
	if (
		!/^[A-Za-z0-9._]{1,30}$/.test(normalized) ||
		normalized.startsWith(".") ||
		normalized.endsWith(".") ||
		normalized.includes("..")
	) {
		throw new Error("Enter a valid Instagram handle.");
	}
	return normalized;
};

export const normalizeXHandle = (value: string): string => {
	const normalized = normalizeHandle(value);
	if (!normalized) return "";
	if (!/^[A-Za-z0-9_]{1,15}$/.test(normalized)) {
		throw new Error("Enter a valid Twitter handle.");
	}
	return normalized;
};

export const normalizeTicketExchangeText = (
	value: unknown,
	maxLength: number,
): string =>
	typeof value === "string"
		? value.trim().replace(/\s+/g, " ").slice(0, maxLength)
		: "";

export const TICKET_EXCHANGE_NOTE_LANGUAGE_ERROR =
	"Please remove offensive or abusive language from the note before posting.";

const NOTE_ABUSE_BLOCKLIST = [
	"fuck",
	"fucker",
	"fucked",
	"fucking",
	"shit",
	"shitty",
	"cunt",
	"bitch",
	"bitches",
	"bastard",
	"nigger",
	"nigga",
	"kike",
	"faggot",
	"fag",
	"tranny",
	"retard",
	"spastic",
	"paki",
	"chink",
	"gook",
	"coon",
	"dyke",
	"nazi",
] as const;

const LEETSPEAK_MAP: Record<string, string> = {
	"0": "o",
	"1": "i",
	"3": "e",
	"4": "a",
	"5": "s",
	"7": "t",
	"8": "b",
	"@": "a",
	"$": "s",
	"!": "i",
};

const normalizeLanguageScanText = (value: string): string =>
	value
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/gu, "")
		.toLowerCase()
		.replace(/[0134578@$!]/gu, (match) => LEETSPEAK_MAP[match] ?? match)
		.replace(/(.)\1{2,}/gu, "$1$1");

const compactLanguageScanText = (value: string): string =>
	normalizeLanguageScanText(value).replace(/[^a-z0-9]+/gu, "");

export const hasOffensiveTicketExchangeNoteLanguage = (
	value: string,
): boolean => {
	const compact = compactLanguageScanText(value);
	if (NOTE_ABUSE_BLOCKLIST.some((term) => compact.includes(term))) {
		return true;
	}

	const normalized = normalizeLanguageScanText(value);
	return /\b(?:kill\s+yourself|gas\s+(?:the\s+)?(?:jews|black|blacks|muslims|gays)|white\s+power|heil\s+hitler)\b/iu.test(
		normalized,
	);
};

export const validateTicketExchangeNote = (value: string): string => {
	const note = normalizeTicketExchangeText(value, 360);
	if (note && hasOffensiveTicketExchangeNoteLanguage(note)) {
		throw new Error(TICKET_EXCHANGE_NOTE_LANGUAGE_ERROR);
	}
	return note;
};

export const normalizeContactMethods = (
	value: unknown,
): TicketExchangeContactMethod[] => {
	const rawValues = Array.isArray(value) ? value : [];
	const allowed = new Set<string>(TICKET_EXCHANGE_CONTACT_METHODS);
	return [...new Set(rawValues)]
		.map((item) => (typeof item === "string" ? item.trim() : ""))
		.filter((item): item is TicketExchangeContactMethod => allowed.has(item));
};

export const getEffectiveListingStatus = (input: {
	status: TicketExchangeListingStatus;
	expiresAt: string;
}): TicketExchangeListingStatus => {
	if (input.status !== "active" && input.status !== "paused") {
		return input.status;
	}
	const expiresAtMs = new Date(input.expiresAt).getTime();
	if (Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now()) {
		return "expired";
	}
	return input.status;
};

export const buildContactSnapshot = (
	profile: TicketExchangeContactProfile,
): TicketExchangeContactSnapshot => ({
	displayName: profile.displayName,
	email: profile.alternateEmail || profile.accountEmail,
	whatsapp: profile.whatsappNumber,
	instagram: normalizeHandle(profile.instagramHandle),
	x: normalizeHandle(profile.xHandle),
});

export const filterContactSnapshot = (
	snapshot: TicketExchangeContactSnapshot,
	methods: TicketExchangeContactMethod[],
): TicketExchangeContactSnapshot => {
	const methodSet = new Set(methods);
	return {
		displayName: snapshot.displayName,
		email: methodSet.has("email") ? snapshot.email : "",
		whatsapp: methodSet.has("whatsapp") ? snapshot.whatsapp : "",
		instagram: methodSet.has("instagram") ? snapshot.instagram : "",
		x: methodSet.has("x") ? snapshot.x : "",
	};
};

export const hasContactForMethods = (
	snapshot: TicketExchangeContactSnapshot,
	methods: TicketExchangeContactMethod[],
): boolean =>
	methods.some((method) => {
		if (method === "email") return Boolean(snapshot.email);
		if (method === "whatsapp") return Boolean(snapshot.whatsapp);
		if (method === "instagram") return Boolean(snapshot.instagram);
		return Boolean(snapshot.x);
	});

export const countUsableContactMethods = (
	snapshot: TicketExchangeContactSnapshot,
	methods: TicketExchangeContactMethod[],
): number =>
	methods.filter((method) => {
		if (method === "email") return Boolean(snapshot.email);
		if (method === "whatsapp") return Boolean(snapshot.whatsapp);
		if (method === "instagram") return Boolean(snapshot.instagram);
		return Boolean(snapshot.x);
	}).length;

export const resolveExpiryDate = (rawHours: unknown): Date => {
	const parsed = Number.parseInt(String(rawHours ?? ""), 10);
	const hours = Number.isFinite(parsed)
		? Math.min(TICKET_EXCHANGE_MAX_EXPIRY_HOURS, Math.max(1, parsed))
		: TICKET_EXCHANGE_DEFAULT_EXPIRY_HOURS;
	return new Date(Date.now() + hours * 60 * 60 * 1000);
};

export const formatEventOptionLabel = (event: Event): string => {
	const date = event.date ? ` · ${event.date}` : "";
	const time = event.time && event.time !== "TBC" ? ` ${event.time}` : "";
	return `${event.name}${date}${time}`;
};
