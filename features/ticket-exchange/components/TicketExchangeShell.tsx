"use client";

import type { TicketExchangePageData } from "@/features/ticket-exchange/types";
import { TicketExchangeClient } from "./TicketExchangeClient";

export function TicketExchangeShell({
	initialData,
}: {
	initialData: TicketExchangePageData;
}) {
	return (
		<TicketExchangeClient
			key={initialData.selectedEventKey ?? "all"}
			initialData={initialData}
		/>
	);
}
