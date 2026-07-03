import "server-only";

import { getLiveEvents } from "@/features/data-management/runtime-service";
import type { Event } from "@/features/events/types";
import { isArchiveModeEnabled } from "@/lib/archive-mode";
import { areTicketExchangeExamplesEnabled } from "./config";
import { isTicketExchangeEmailEnabled } from "./email";
import { parseTicketExchangePriceLabel } from "./pricing";
import {
	type TicketExchangeRepository,
	getTicketExchangeRepository,
} from "./repository";
import type {
	TicketExchangeListingView,
	TicketExchangePageData,
	TicketExchangeSummary,
} from "./types";

const buildEmptySummaries = (events: Event[]): TicketExchangeSummary[] =>
	events.map((event) => ({
		eventKey: event.eventKey,
		sellingCount: 0,
		lookingCount: 0,
		latestListingAt: null,
	}));

const buildSummariesFromListings = (
	events: Event[],
	listings: TicketExchangeListingView[],
): TicketExchangeSummary[] => {
	const summaryByEventKey = new Map<string, TicketExchangeSummary>();
	for (const event of events) {
		summaryByEventKey.set(event.eventKey, {
			eventKey: event.eventKey,
			sellingCount: 0,
			lookingCount: 0,
			latestListingAt: null,
		});
	}
	for (const listing of listings) {
		if (listing.effectiveStatus !== "active") continue;
		const summary = summaryByEventKey.get(listing.eventKey);
		if (!summary) continue;
		if (listing.listingType === "selling") summary.sellingCount += 1;
		if (listing.listingType === "looking") summary.lookingCount += 1;
		if (
			!summary.latestListingAt ||
			listing.createdAt > summary.latestListingAt
		) {
			summary.latestListingAt = listing.createdAt;
		}
	}
	return events.map(
		(event) =>
			summaryByEventKey.get(event.eventKey) ?? {
				eventKey: event.eventKey,
				sellingCount: 0,
				lookingCount: 0,
				latestListingAt: null,
			},
	);
};

const buildArchiveDemoListings = (
	events: Event[],
	selectedEventKey: string | null,
): TicketExchangeListingView[] => {
	const sourceEvents = selectedEventKey
		? events.filter((event) => event.eventKey === selectedEventKey)
		: events.slice(0, 2);
	const now = Date.now();
	return sourceEvents.flatMap((event, index) => {
		const createdAt = new Date(
			now - (index + 1) * 45 * 60 * 1000,
		).toISOString();
		const expiresAt = new Date(
			now + (index + 1) * 24 * 60 * 60 * 1000,
		).toISOString();
		const sellingPrice = parseTicketExchangePriceLabel("Face value");
		const lookingPrice = parseTicketExchangePriceLabel("Flexible budget");
		return [
			{
				id: `demo-selling-${event.eventKey}`,
				eventKey: event.eventKey,
				eventSlug: event.slug,
				eventName: event.name,
				listingType: "selling",
				quantityLabel: "1 ticket available",
				priceLabel: "Face value",
				priceAmountMinor: sellingPrice.amountMinor,
				priceCurrency: sellingPrice.currency,
				priceBasis: sellingPrice.basis,
				priceSource: "face_value",
				note: "Demo listing. In archive mode, replies stay in this browser only.",
				status: "active",
				effectiveStatus: "active",
				ownerUserId: "demo-seller",
				ownerEmail: "seller@example.com",
				contactMethods: ["email", "instagram"],
				expiresAt,
				createdAt,
				updatedAt: createdAt,
				resolvedAt: null,
				interestCount: 0,
				isOwner: false,
				myInterest: null,
				interests: [],
			},
			{
				id: `demo-looking-${event.eventKey}`,
				eventKey: event.eventKey,
				eventSlug: event.slug,
				eventName: event.name,
				listingType: "looking",
				quantityLabel: "Looking for 2 tickets",
				priceLabel: "Flexible budget",
				priceAmountMinor: lookingPrice.amountMinor,
				priceCurrency: lookingPrice.currency,
				priceBasis: lookingPrice.basis,
				priceSource: "user",
				note: "Demo listing. Create your own test listing to see local owner tools.",
				status: "active",
				effectiveStatus: "active",
				ownerUserId: "demo-buyer",
				ownerEmail: "buyer@example.com",
				contactMethods: ["email", "x"],
				expiresAt,
				createdAt: new Date(now - (index + 1) * 30 * 60 * 1000).toISOString(),
				updatedAt: createdAt,
				resolvedAt: null,
				interestCount: 0,
				isOwner: false,
				myInterest: null,
				interests: [],
			},
		] satisfies TicketExchangeListingView[];
	});
};

interface TicketExchangeSessionSnapshot {
	userId?: string | null;
	email?: string | null;
}

interface TicketExchangePageModelInput {
	selectedEventKey?: string | null;
	session: TicketExchangeSessionSnapshot;
}

interface TicketExchangePageDataInput extends TicketExchangePageModelInput {
	events: Event[];
	repository: TicketExchangeRepository | null;
}

export interface TicketExchangePageModel {
	data: TicketExchangePageData;
	selectedEvent: Event | null;
}

export const getTicketExchangeEvents = async (): Promise<Event[]> => {
	const result = await getLiveEvents({
		includeFeaturedProjection: false,
		includeEngagementProjection: false,
	});
	return result.data;
};

export const getTicketExchangeSummariesForEvents = async (
	events: Event[],
): Promise<TicketExchangeSummary[]> => {
	if (events.length === 0) return [];
	if (isArchiveModeEnabled()) return buildEmptySummaries(events);
	const repository = getTicketExchangeRepository();
	if (!repository) return buildEmptySummaries(events);
	return repository.getSummaries(events.map((event) => event.eventKey));
};

export const findTicketExchangeEventByKey = (
	events: Event[],
	eventKey: string | null | undefined,
): Event | null => {
	const normalized = eventKey?.trim().toLowerCase();
	if (!normalized) return null;
	return (
		events.find((event) => event.eventKey.toLowerCase() === normalized) ?? null
	);
};

const createTicketExchangePageData = async ({
	events,
	repository,
	selectedEventKey,
	session,
}: TicketExchangePageDataInput): Promise<TicketExchangePageModel> => {
	const selectedEvent = findTicketExchangeEventByKey(events, selectedEventKey);
	const canonicalSelectedEventKey = selectedEvent?.eventKey ?? null;
	const userId = session.userId ?? null;
	const userEmail = session.email ?? null;
	const examplesEnabled = areTicketExchangeExamplesEnabled();

	if (isArchiveModeEnabled()) {
		const demoListings = buildArchiveDemoListings(
			events,
			canonicalSelectedEventKey,
		);
		return {
			selectedEvent,
			data: {
				events,
				selectedEventKey: canonicalSelectedEventKey,
				profile: null,
				listings: demoListings,
				summaries: buildSummariesFromListings(events, demoListings),
				isAuthenticated: true,
				userEmail: "demo@example.com",
				userId: "demo-user",
				supported: true,
				emailEnabled: false,
				examplesEnabled: false,
				mode: "demo",
				demoNotice:
					"Archive demo mode: listings, replies, and contact details stay in this browser only.",
			},
		};
	}

	if (!repository) {
		return {
			selectedEvent,
			data: {
				events,
				selectedEventKey: canonicalSelectedEventKey,
				profile: null,
				listings: [],
				summaries: buildEmptySummaries(events),
				isAuthenticated: Boolean(userId && userEmail),
				userEmail,
				userId,
				supported: false,
				emailEnabled: isTicketExchangeEmailEnabled(),
				examplesEnabled,
				mode: "live",
			},
		};
	}

	const [profile, listings, storedSummaries] = await Promise.all([
		userId
			? repository.getContactProfile(userId, userEmail)
			: Promise.resolve(null),
		repository.listListings({
			eventKey: canonicalSelectedEventKey,
			userId,
		}),
		repository.getSummaries(events.map((event) => event.eventKey)),
	]);
	const summaryByEventKey = new Map(
		storedSummaries.map((summary) => [summary.eventKey, summary]),
	);

	return {
		selectedEvent,
		data: {
			events,
			selectedEventKey: canonicalSelectedEventKey,
			profile,
			listings,
			summaries: events.map(
				(event) =>
					summaryByEventKey.get(event.eventKey) ?? {
						eventKey: event.eventKey,
						sellingCount: 0,
						lookingCount: 0,
						latestListingAt: null,
					},
			),
			isAuthenticated: Boolean(userId && userEmail),
			userEmail,
			userId,
			supported: true,
			emailEnabled: isTicketExchangeEmailEnabled(),
			examplesEnabled,
			mode: "live",
		},
	};
};

export const getTicketExchangePageModel = async (
	input: TicketExchangePageModelInput,
): Promise<TicketExchangePageModel> => {
	if (isArchiveModeEnabled()) {
		const events = await getTicketExchangeEvents();
		return createTicketExchangePageData({ ...input, events, repository: null });
	}

	const [events, repository] = await Promise.all([
		getTicketExchangeEvents(),
		Promise.resolve(getTicketExchangeRepository()),
	]);
	return createTicketExchangePageData({ ...input, events, repository });
};
