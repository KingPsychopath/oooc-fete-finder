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
		throw new Error("Enter a valid X/Twitter handle.");
	}
	return normalized;
};

export const normalizeTicketExchangeText = (
	value: unknown,
	maxLength: number,
): string =>
	typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maxLength) : "";

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
