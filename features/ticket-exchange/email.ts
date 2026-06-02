import "server-only";

import { env } from "@/lib/config/env";

export const isTicketExchangeEmailEnabled = (): boolean =>
	env.TICKET_EXCHANGE_EMAIL_ENABLED === "true";

export const getTicketExchangeEmailConfig = () => ({
	enabled: isTicketExchangeEmailEnabled(),
	fromEmail:
		env.TICKET_EXCHANGE_FROM_EMAIL?.trim() ||
		"tickets@fete.outofofficecollective.co.uk",
	replyTo:
		env.TICKET_EXCHANGE_REPLY_TO?.trim() ||
		"tickets@outofofficecollective.co.uk",
});

export const sendTicketExchangeInterestEmail = async (): Promise<void> => {
	if (!isTicketExchangeEmailEnabled()) return;
	// Provider adapter intentionally left as a no-op until the email provider is
	// configured. The feature can call this now without changing product flow.
};

