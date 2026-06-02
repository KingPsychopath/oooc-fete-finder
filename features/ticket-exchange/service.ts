import "server-only";

import { getLiveEvents } from "@/features/data-management/runtime-service";
import type { Event } from "@/features/events/types";
import { isTicketExchangeEmailEnabled } from "./email";
import { getTicketExchangeRepository } from "./repository";
import type { TicketExchangePageData, TicketExchangeSummary } from "./types";

const buildEmptySummaries = (events: Event[]): TicketExchangeSummary[] =>
	events.map((event) => ({
		eventKey: event.eventKey,
		sellingCount: 0,
		lookingCount: 0,
		latestListingAt: null,
	}));

export const getTicketExchangeEvents = async (): Promise<Event[]> => {
	const result = await getLiveEvents({ includeEngagementProjection: true });
	return result.data;
};

export const findTicketExchangeEvent = (
	events: Event[],
	value: string | null | undefined,
): Event | null => {
	const normalized = value?.trim().toLowerCase();
	if (!normalized) return null;
	return (
		events.find(
			(event) =>
				event.eventKey.toLowerCase() === normalized ||
				event.slug.toLowerCase() === normalized,
		) ?? null
	);
};

export const getTicketExchangePageData = async (input: {
	userId?: string | null;
	userEmail?: string | null;
	selectedEventKey?: string | null;
}): Promise<TicketExchangePageData> => {
	const events = await getTicketExchangeEvents();
	const selectedEvent = findTicketExchangeEvent(events, input.selectedEventKey);
	const selectedEventKey = selectedEvent?.eventKey ?? null;
	const repository = getTicketExchangeRepository();

	if (!repository) {
		return {
			events,
			selectedEventKey,
			profile: null,
			listings: [],
			summaries: buildEmptySummaries(events),
			isAuthenticated: Boolean(input.userId && input.userEmail),
			userEmail: input.userEmail ?? null,
			userId: input.userId ?? null,
			supported: false,
			emailEnabled: isTicketExchangeEmailEnabled(),
		};
	}

	const [profile, listings, storedSummaries] = await Promise.all([
		input.userId
			? repository.getContactProfile(input.userId, input.userEmail)
			: Promise.resolve(null),
		repository.listListings({
			userId: input.userId,
		}),
		repository.getSummaries(events.map((event) => event.eventKey)),
	]);
	const summaryByEventKey = new Map(
		storedSummaries.map((summary) => [summary.eventKey, summary]),
	);

	return {
		events,
		selectedEventKey,
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
		isAuthenticated: Boolean(input.userId && input.userEmail),
		userEmail: input.userEmail ?? null,
		userId: input.userId ?? null,
		supported: true,
		emailEnabled: isTicketExchangeEmailEnabled(),
	};
};
