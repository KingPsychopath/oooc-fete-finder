export const buildTicketExchangeEventPath = (event: {
	eventKey: string;
}): string => `/exchange/${encodeURIComponent(event.eventKey)}`;
