"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
	TICKET_EXCHANGE_CONTACT_METHODS,
	TICKET_EXCHANGE_REQUIRED_CONTACT_METHOD_COUNT,
	TICKET_EXCHANGE_REPORT_REASONS,
	TICKET_EXCHANGE_RULES_VERSION,
} from "./constants";
import { sendTicketExchangeInterestEmail } from "./email";
import { getTicketExchangeSession } from "./auth";
import { getTicketExchangeRepository } from "./repository";
import {
	findTicketExchangeEvent,
	getTicketExchangeEvents,
	getTicketExchangePageData,
} from "./service";
import type {
	TicketExchangeActionResult,
	TicketExchangeContactMethod,
	TicketExchangeListingStatus,
	TicketExchangeListingType,
	TicketExchangeReportReason,
} from "./types";
import {
	buildContactSnapshot,
	countUsableContactMethods,
	hasContactForMethods,
	normalizeContactMethods,
	normalizeHandle,
	normalizeTicketExchangeText,
	resolveExpiryDate,
} from "./utils";

const hasAcceptedCurrentTicketExchangeRules = (profile: {
	rulesAcceptedAt: string | null;
	rulesVersion: string | null;
} | null): boolean =>
	Boolean(
		profile?.rulesAcceptedAt &&
			profile.rulesVersion === TICKET_EXCHANGE_RULES_VERSION,
	);

const contactMethodSchema = z.enum(TICKET_EXCHANGE_CONTACT_METHODS);
const reportReasonSchema = z.enum(TICKET_EXCHANGE_REPORT_REASONS);

const getAuthenticatedContext = async () => {
	const session = await getTicketExchangeSession();
	if (!session.isAuthenticated || !session.userId || !session.email) {
		throw new Error("Login is required to use Ticket Exchange.");
	}
	const repository = getTicketExchangeRepository();
	if (!repository) {
		throw new Error("Ticket Exchange storage is not configured yet.");
	}
	return { session, repository };
};

const revalidateTicketExchange = (eventKey?: string | null) => {
	revalidatePath("/tickets");
	if (eventKey) revalidatePath(`/tickets/${encodeURIComponent(eventKey)}`);
};

const dataForSession = async (selectedEventKey?: string | null) => {
	const session = await getTicketExchangeSession();
	return getTicketExchangePageData({
		userId: session.userId,
		userEmail: session.email,
		selectedEventKey,
	});
};

export async function saveTicketExchangeContactProfile(input: {
	displayName: string;
	alternateEmail: string;
	whatsappNumber: string;
	instagramHandle: string;
	xHandle: string;
	acceptRules: boolean;
	selectedEventKey?: string | null;
}): Promise<TicketExchangeActionResult> {
	try {
		const { session, repository } = await getAuthenticatedContext();
		await repository.upsertContactProfile({
			userId: session.userId as string,
			accountEmail: session.email as string,
			displayName: normalizeTicketExchangeText(input.displayName, 80),
			alternateEmail: normalizeTicketExchangeText(input.alternateEmail, 160)
				.toLowerCase(),
			whatsappNumber: normalizeTicketExchangeText(input.whatsappNumber, 40),
			instagramHandle: normalizeHandle(
				normalizeTicketExchangeText(input.instagramHandle, 60),
			),
			xHandle: normalizeHandle(normalizeTicketExchangeText(input.xHandle, 60)),
			acceptRules: Boolean(input.acceptRules),
		});
		revalidateTicketExchange();
		return {
			success: true,
			data: await dataForSession(input.selectedEventKey),
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unable to save profile.",
		};
	}
}

export async function createTicketExchangeListing(input: {
	eventKey: string;
	listingType: TicketExchangeListingType;
	quantityLabel: string;
	priceLabel: string;
	note: string;
	expiryHours: number;
	contactMethods: TicketExchangeContactMethod[];
}): Promise<TicketExchangeActionResult> {
	try {
		const { session, repository } = await getAuthenticatedContext();
		const events = await getTicketExchangeEvents();
		const event = findTicketExchangeEvent(events, input.eventKey);
		if (!event) throw new Error("Choose a valid event.");

		const listingType =
			input.listingType === "looking" ? "looking" : "selling";
		const profile = await repository.getContactProfile(
			session.userId as string,
			session.email,
		);
		if (!profile) {
			throw new Error("Set up your contact details before posting.");
		}
		if (!hasAcceptedCurrentTicketExchangeRules(profile)) {
			throw new Error("Accept the latest Ticket Exchange agreement before posting.");
		}
		const contactMethods = normalizeContactMethods(input.contactMethods);
		const contactSnapshot = buildContactSnapshot(profile);
		if (
			contactMethods.length === 0 ||
			!hasContactForMethods(contactSnapshot, contactMethods)
		) {
			throw new Error("Choose at least one contact method with details filled in.");
		}
		if (
			countUsableContactMethods(contactSnapshot, contactMethods) <
			TICKET_EXCHANGE_REQUIRED_CONTACT_METHOD_COUNT
		) {
			throw new Error(
				"Choose at least two contact methods so people have a backup way to reach you.",
			);
		}

		const quantityLabel = normalizeTicketExchangeText(input.quantityLabel, 80);
		if (!quantityLabel) throw new Error("Add the quantity or ticket need.");
		const priceLabel = normalizeTicketExchangeText(input.priceLabel, 80);
		if (listingType === "selling" && !priceLabel) {
			throw new Error("Add the ticket price before posting a selling listing.");
		}
		await repository.createListing({
			eventKey: event.eventKey,
			eventSlug: event.slug,
			eventName: event.name,
			listingType,
			quantityLabel,
			priceLabel,
			note: normalizeTicketExchangeText(input.note, 360),
			ownerUserId: session.userId as string,
			ownerEmail: session.email as string,
			contactMethods,
			contactSnapshot,
			expiresAt: resolveExpiryDate(input.expiryHours),
		});
		revalidateTicketExchange(event.eventKey);
		return {
			success: true,
			data: await dataForSession(event.eventKey),
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unable to create listing.",
		};
	}
}

export async function expressTicketExchangeInterest(input: {
	listingId: string;
	selectedEventKey?: string | null;
	contactMethods: TicketExchangeContactMethod[];
}): Promise<TicketExchangeActionResult> {
	try {
		const { session, repository } = await getAuthenticatedContext();
		const profile = await repository.getContactProfile(
			session.userId as string,
			session.email,
		);
		if (!profile) {
			throw new Error("Set up your contact details before sharing contact.");
		}
		if (!hasAcceptedCurrentTicketExchangeRules(profile)) {
			throw new Error(
				"Accept the latest Ticket Exchange agreement before sharing contact.",
			);
		}
		const contactMethods = contactMethodSchema
			.array()
			.parse(normalizeContactMethods(input.contactMethods));
		const contactSnapshot = buildContactSnapshot(profile);
		if (
			contactMethods.length === 0 ||
			!hasContactForMethods(contactSnapshot, contactMethods)
		) {
			throw new Error("Choose at least one contact method with details filled in.");
		}
		if (
			countUsableContactMethods(contactSnapshot, contactMethods) <
			TICKET_EXCHANGE_REQUIRED_CONTACT_METHOD_COUNT
		) {
			throw new Error(
				"Choose at least two contact methods so the other person has a backup way to reach you.",
			);
		}
		await repository.expressInterest({
			listingId: normalizeTicketExchangeText(input.listingId, 80),
			actorUserId: session.userId as string,
			actorEmail: session.email as string,
			contactMethods,
			contactSnapshot,
		});
		await sendTicketExchangeInterestEmail();
		revalidateTicketExchange();
		return {
			success: true,
			data: await dataForSession(input.selectedEventKey),
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error ? error.message : "Unable to register interest.",
		};
	}
}

export async function updateTicketExchangeListingStatus(input: {
	listingId: string;
	status: Extract<TicketExchangeListingStatus, "active" | "paused" | "resolved" | "removed">;
	selectedEventKey?: string | null;
}): Promise<TicketExchangeActionResult> {
	try {
		const { session, repository } = await getAuthenticatedContext();
		const status = z
			.enum(["active", "paused", "resolved", "removed"])
			.parse(input.status);
		await repository.updateListingStatus({
			listingId: normalizeTicketExchangeText(input.listingId, 80),
			ownerUserId: session.userId as string,
			status,
		});
		revalidateTicketExchange();
		return {
			success: true,
			data: await dataForSession(input.selectedEventKey),
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error ? error.message : "Unable to update listing.",
		};
	}
}

export async function repostTicketExchangeListing(input: {
	listingId: string;
	quantityLabel: string;
	expiryHours: number;
	selectedEventKey?: string | null;
}): Promise<TicketExchangeActionResult> {
	try {
		const { session, repository } = await getAuthenticatedContext();
		const quantityLabel = normalizeTicketExchangeText(input.quantityLabel, 80);
		if (!quantityLabel) throw new Error("Add the new quantity.");
		await repository.repostListing({
			listingId: normalizeTicketExchangeText(input.listingId, 80),
			ownerUserId: session.userId as string,
			quantityLabel,
			expiresAt: resolveExpiryDate(input.expiryHours),
		});
		revalidateTicketExchange();
		return {
			success: true,
			data: await dataForSession(input.selectedEventKey),
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unable to repost listing.",
		};
	}
}

export async function reportTicketExchangeListing(input: {
	listingId: string;
	reason: TicketExchangeReportReason;
	details: string;
	selectedEventKey?: string | null;
}): Promise<TicketExchangeActionResult> {
	try {
		const { session, repository } = await getAuthenticatedContext();
		await repository.reportListing({
			listingId: normalizeTicketExchangeText(input.listingId, 80),
			reporterUserId: session.userId as string,
			reason: reportReasonSchema.parse(input.reason),
			details: normalizeTicketExchangeText(input.details, 300),
		});
		return {
			success: true,
			data: await dataForSession(input.selectedEventKey),
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unable to report listing.",
		};
	}
}
