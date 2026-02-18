import { EventsClient } from "@/features/events/components/events-client";
import type { MapLoadStrategy } from "@/features/maps/components/events-map-card";
import { EventsRuntimeManager } from "@/lib/cache/cache-manager";
import { env } from "@/lib/config/env";
import { log } from "@/lib/platform/logger";

interface HomeEventsSectionProps {
	mapLoadStrategy?: MapLoadStrategy;
}

export async function HomeEventsSection({
	mapLoadStrategy = "idle",
}: HomeEventsSectionProps = {}) {
	const result = await EventsRuntimeManager.getEvents();
	const isRemoteMode = env.DATA_MODE === "remote";
	const isLocalFallback = isRemoteMode && result.source === "local";

	if (result.error) {
		log.error("home", "Error loading events", { error: result.error });
	}

	return (
		<>
			{isLocalFallback && (
				<div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
					<strong>Note:</strong> Live Postgres data is currently unavailable.
					The app is serving local CSV fallback data until the store is
					restored.
				</div>
			)}
			<EventsClient
				initialEvents={result.data}
				mapLoadStrategy={mapLoadStrategy}
			/>
		</>
	);
}
