export const CARD_TICKET_ACTIVITY_MAX_VISIBLE = 9;
export const CARD_TICKET_ACTIVITY_FRESH_WINDOW_HOURS = 6;

export type TicketActivityDisplayMode = "fresh" | "active";

type TicketActivityEvent = {
	eventKey: string;
	name: string;
	ticketExchangeSellingCount?: number;
	ticketExchangeLookingCount?: number;
	ticketExchangeLatestListingAt?: string | null;
};

const MS_PER_HOUR = 60 * 60 * 1000;

const getTicketActivityTotal = (event: TicketActivityEvent): number =>
	(event.ticketExchangeSellingCount ?? 0) +
	(event.ticketExchangeLookingCount ?? 0);

export const isTicketActivityFresh = (
	latestListingAt: string | null | undefined,
	now: Date = new Date(),
): boolean => {
	if (!latestListingAt) return false;
	const listedAtMs = new Date(latestListingAt).getTime();
	if (!Number.isFinite(listedAtMs)) return false;
	return (
		now.getTime() - listedAtMs <=
		CARD_TICKET_ACTIVITY_FRESH_WINDOW_HOURS * MS_PER_HOUR
	);
};

export const getTicketActivityDisplayModes = (
	events: TicketActivityEvent[],
	now: Date = new Date(),
): Map<string, TicketActivityDisplayMode> => {
	const eligibleEvents = events
		.filter((event) => getTicketActivityTotal(event) > 0)
		.sort((left, right) => {
			const leftLatest = new Date(
				left.ticketExchangeLatestListingAt ?? 0,
			).getTime();
			const rightLatest = new Date(
				right.ticketExchangeLatestListingAt ?? 0,
			).getTime();
			const latestDelta =
				(Number.isFinite(rightLatest) ? rightLatest : 0) -
				(Number.isFinite(leftLatest) ? leftLatest : 0);
			if (latestDelta !== 0) return latestDelta;

			const totalDelta =
				getTicketActivityTotal(right) - getTicketActivityTotal(left);
			if (totalDelta !== 0) return totalDelta;

			const nameOrder = left.name.localeCompare(right.name);
			if (nameOrder !== 0) return nameOrder;
			return left.eventKey.localeCompare(right.eventKey);
		})
		.slice(0, CARD_TICKET_ACTIVITY_MAX_VISIBLE);

	return new Map(
		eligibleEvents.map((event) => [
			event.eventKey,
			isTicketActivityFresh(event.ticketExchangeLatestListingAt, now)
				? "fresh"
				: "active",
		]),
	);
};

export const shouldShowTicketActivityBadge = (
	mode: TicketActivityDisplayMode | undefined,
	sellingCount: number,
	lookingCount: number,
): boolean => Boolean(mode && sellingCount + lookingCount > 0);

export const formatTicketActivityLabel = (
	sellingCount: number,
	lookingCount: number,
): string => {
	if (sellingCount > 0 && lookingCount > 0) {
		return `${sellingCount} selling · ${lookingCount} wanted`;
	}
	if (sellingCount > 0) {
		return sellingCount === 1
			? "Ticket available"
			: `${sellingCount} tickets available`;
	}
	return lookingCount === 1
		? "Someone wants tickets"
		: `${lookingCount} people want tickets`;
};
