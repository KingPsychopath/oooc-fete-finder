import "server-only";

import { env } from "@/lib/config/env";

export const areTicketExchangeExamplesEnabled = (): boolean =>
	env.TICKET_EXCHANGE_EXAMPLES_ENABLED !== "false";
