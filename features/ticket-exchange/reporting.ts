import type { TicketExchangeReportReason } from "./types";

export const TICKET_EXCHANGE_REPORT_REASON_LABELS: Record<
	TicketExchangeReportReason,
	string
> = {
	scam: "Scam suspected",
	wrong_event: "Wrong event",
	misleading_price: "Misleading price",
	abusive_contact: "Abusive contact",
	spam: "Spam or duplicate",
	other: "Other",
};

export const getTicketExchangeReportReasonLabel = (
	reason: TicketExchangeReportReason | string,
): string =>
	TICKET_EXCHANGE_REPORT_REASON_LABELS[reason as TicketExchangeReportReason] ??
	reason
		.split("_")
		.map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
		.join(" ");
