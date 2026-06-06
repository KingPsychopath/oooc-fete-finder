"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTicketExchangeSession } from "./auth";
import {
	TICKET_EXCHANGE_CONTACT_METHODS,
	TICKET_EXCHANGE_REPORT_REASONS,
	TICKET_EXCHANGE_REQUIRED_CONTACT_METHOD_COUNT,
	TICKET_EXCHANGE_RULES_VERSION,
} from "./constants";
import { sendTicketExchangeInterestEmail } from "./email";
import { parseTicketExchangePriceLabel } from "./pricing";
import { getTicketExchangeReportReasonLabel } from "./reporting";
import { getTicketExchangeRepository } from "./repository";
import { assertUserActionAllowed } from "@/features/users/policy";
import { recordAdminActivity } from "@/features/admin/activity/record";
import {
	findTicketExchangeEventByKey,
	getTicketExchangeEvents,
	getTicketExchangePageModel,
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
	normalizeInstagramHandle,
	normalizeOptionalEmail,
	normalizeTicketExchangeText,
	normalizeWhatsAppNumber,
	normalizeXHandle,
	resolveExpiryDate,
	validateTicketExchangeDisplayName,
	validateTicketExchangeNote,
	validateTicketExchangePriceLabel,
	validateTicketExchangeQuantityLabel,
	validateTicketExchangeUserText,
} from "./utils";

const hasAcceptedCurrentTicketExchangeRules = (
	profile: {
		rulesAcceptedAt: string | null;
		rulesVersion: string | null;
	} | null,
): boolean =>
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
	await assertUserActionAllowed({
		userId: session.userId,
		email: session.email,
		scope: "all_user_actions",
	});
	const repository = getTicketExchangeRepository();
	if (!repository) {
		throw new Error("Ticket Exchange storage is not configured yet.");
	}
	return { session, repository };
};

const revalidateTicketExchange = (eventKey?: string | null) => {
	revalidatePath("/exchange");
	revalidatePath("/tickets");
	if (eventKey) {
		const encodedEventKey = encodeURIComponent(eventKey);
		revalidatePath(`/exchange/${encodedEventKey}`);
		revalidatePath(`/tickets/${encodedEventKey}`);
	}
};

const dataForSession = async (selectedEventKey?: string | null) => {
	const session = await getTicketExchangeSession();
	const model = await getTicketExchangePageModel({
		session,
		selectedEventKey,
	});
	return model.data;
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
			displayName: validateTicketExchangeDisplayName(input.displayName),
			alternateEmail: normalizeOptionalEmail(
				normalizeTicketExchangeText(input.alternateEmail, 160),
			),
			whatsappNumber: normalizeWhatsAppNumber(
				normalizeTicketExchangeText(input.whatsappNumber, 40),
			),
			instagramHandle: normalizeInstagramHandle(
				normalizeTicketExchangeText(input.instagramHandle, 60),
			),
			xHandle: normalizeXHandle(normalizeTicketExchangeText(input.xHandle, 60)),
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
		await assertUserActionAllowed({
			userId: session.userId,
			email: session.email,
			scope: "ticket_exchange.post",
		});
		const events = await getTicketExchangeEvents();
		const event = findTicketExchangeEventByKey(events, input.eventKey);
		if (!event) throw new Error("Choose a valid event.");

		const listingType = input.listingType === "looking" ? "looking" : "selling";
		const profile = await repository.getContactProfile(
			session.userId as string,
			session.email,
		);
		if (!profile) {
			throw new Error("Set up your contact details before posting.");
		}
		if (!hasAcceptedCurrentTicketExchangeRules(profile)) {
			throw new Error(
				"Accept the latest Ticket Exchange agreement before posting.",
			);
		}
		const contactMethods = normalizeContactMethods(input.contactMethods);
		const contactSnapshot = buildContactSnapshot(profile);
		if (
			contactMethods.length === 0 ||
			!hasContactForMethods(contactSnapshot, contactMethods)
		) {
			throw new Error(
				"Choose at least one contact method with details filled in.",
			);
		}
		if (
			countUsableContactMethods(contactSnapshot, contactMethods) <
			TICKET_EXCHANGE_REQUIRED_CONTACT_METHOD_COUNT
		) {
			throw new Error(
				"Choose at least two contact methods so people have a backup way to reach you.",
			);
		}

		const quantityLabel = validateTicketExchangeQuantityLabel(
			input.quantityLabel,
		);
		const priceLabel = validateTicketExchangePriceLabel(input.priceLabel);
		const parsedPrice = parseTicketExchangePriceLabel(priceLabel);
		await repository.createListing({
			eventKey: event.eventKey,
			eventSlug: event.slug,
			eventName: event.name,
			listingType,
			quantityLabel,
			priceLabel,
			priceAmountMinor: parsedPrice.amountMinor,
			priceCurrency: parsedPrice.currency,
			priceBasis: parsedPrice.basis,
			priceSource: parsedPrice.isFaceValue ? "face_value" : "user",
			note: validateTicketExchangeNote(input.note),
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
			error:
				error instanceof Error ? error.message : "Unable to create listing.",
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
		await assertUserActionAllowed({
			userId: session.userId,
			email: session.email,
			scope: "ticket_exchange.contact_unlock",
		});
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
			throw new Error(
				"Choose at least one contact method with details filled in.",
			);
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
	status: Extract<
		TicketExchangeListingStatus,
		"active" | "paused" | "resolved" | "removed"
	>;
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
		await assertUserActionAllowed({
			userId: session.userId,
			email: session.email,
			scope: "ticket_exchange.post",
		});
		const quantityLabel = validateTicketExchangeQuantityLabel(
			input.quantityLabel,
		);
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
			error:
				error instanceof Error ? error.message : "Unable to repost listing.",
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
		await assertUserActionAllowed({
			userId: session.userId,
			email: session.email,
			scope: "ticket_exchange.report",
		});
		const report = await repository.reportListing({
			listingId: normalizeTicketExchangeText(input.listingId, 80),
			reporterUserId: session.userId as string,
			reporterEmail: session.email as string,
			reason: reportReasonSchema.parse(input.reason),
			details: validateTicketExchangeUserText(
				input.details,
				300,
				"the report details",
			),
		});
		await recordAdminActivity({
			actorType: "system",
			actorLabel: "Ticket Exchange report",
			action: "ticket_exchange.report_created",
			category: "content",
			targetType: "ticket_exchange_report",
			targetId: report.reportId,
			targetLabel: report.eventName ?? report.listingId,
			summary: `Ticket Exchange report received: ${getTicketExchangeReportReasonLabel(input.reason)}`,
			metadata: {
				reportId: report.reportId,
				listingId: report.listingId,
				eventKey: report.eventKey,
				reporterUserId: session.userId,
				ownerUserId: report.ownerUserId,
				ownerEmail: report.ownerEmail,
				reason: input.reason,
				hasDetails: Boolean(input.details.trim()),
			},
			severity: "warning",
			href: "/admin/content#ticket-exchange-moderation",
		});
		revalidatePath("/admin");
		revalidatePath("/admin/content");
		revalidatePath("/admin/users");
		return {
			success: true,
			data: await dataForSession(input.selectedEventKey),
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error ? error.message : "Unable to report listing.",
		};
	}
}
