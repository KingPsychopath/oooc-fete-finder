import "server-only";

import { getLiveEvents } from "@/features/data-management/runtime-service";
import type { Event } from "@/features/events/types";
import { isTicketExchangeEmailEnabled } from "./email";
import {
	type TicketExchangeRepository,
	getTicketExchangeRepository,
} from "./repository";
import type { TicketExchangePageData, TicketExchangeSummary } from "./types";

const buildEmptySummaries = (events: Event[]): TicketExchangeSummary[] =>
	events.map((event) => ({
		eventKey: event.eventKey,
		sellingCount: 0,
		lookingCount: 0,
		latestListingAt: null,
	}));

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
	const selectedEvent = findTicketExchangeEventByKey(
		events,
		selectedEventKey,
	);
	const canonicalSelectedEventKey = selectedEvent?.eventKey ?? null;
	const userId = session.userId ?? null;
	const userEmail = session.email ?? null;

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
		},
	};
};

export const getTicketExchangePageModel = async (
	input: TicketExchangePageModelInput,
): Promise<TicketExchangePageModel> => {
	const [events, repository] = await Promise.all([
		getTicketExchangeEvents(),
		Promise.resolve(getTicketExchangeRepository()),
	]);
	return createTicketExchangePageData({ ...input, events, repository });
};
