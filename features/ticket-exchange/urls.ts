export const buildTicketExchangeEventPath = (event: {
	eventKey: string;
}): string => `/tickets/${encodeURIComponent(event.eventKey)}`;
