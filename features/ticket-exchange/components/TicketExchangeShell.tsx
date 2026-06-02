"use client";

import { AuthGatedControlsIsland } from "@/features/events/components/AuthGatedControlsIsland";
import { EventsOfflineProvider } from "@/features/events/components/events-offline-provider";
import type { SpotlightRotationContext } from "@/features/events/featured/selection";
import type { TicketExchangePageData } from "@/features/ticket-exchange/types";
import { TicketExchangeClient } from "./TicketExchangeClient";

export function TicketExchangeShell({
	initialData,
	spotlightRotationContext,
}: {
	initialData: TicketExchangePageData;
	spotlightRotationContext: SpotlightRotationContext;
}) {
	return (
		<EventsOfflineProvider initialEvents={initialData.events}>
			<AuthGatedControlsIsland spotlightRotationContext={spotlightRotationContext}>
				{() => <TicketExchangeClient initialData={initialData} />}
			</AuthGatedControlsIsland>
		</EventsOfflineProvider>
	);
}
