import { getLiveEvents } from "@/features/data-management/runtime-service";
import { EventsClient } from "@/features/events/components/events-client";
import { EventSubmissionSettingsStore } from "@/features/events/submissions/settings-store";
import type { MapLoadStrategy } from "@/features/maps/components/events-map-card";
import { env } from "@/lib/config/env";
import { log } from "@/lib/platform/logger";

interface HomeEventsSectionProps {
	mapLoadStrategy: MapLoadStrategy;
}

export async function HomeEventsSection({
	mapLoadStrategy,
}: HomeEventsSectionProps) {
	const [result, submissionSettings] = await Promise.all([
		getLiveEvents(),
		EventSubmissionSettingsStore.getPublicSettings().catch((error: unknown) => {
			log.warn("home", "Unable to load event submission settings", {
				error: error instanceof Error ? error.message : String(error),
			});
			return { enabled: true, updatedAt: new Date(0).toISOString() };
		}),
	]);
	const isRemoteMode = env.DATA_MODE === "remote";
	const isBackupFallback = isRemoteMode && result.source === "backup";
	const isLocalFallback = isRemoteMode && result.source === "local";

	if (result.error) {
		log.error("home", "Error loading events", { error: result.error });
	}

	return (
		<>
			{(isBackupFallback || isLocalFallback) && (
				<div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
					<strong>Note:</strong> Live Postgres data is currently unavailable.
					The app is serving{" "}
					{isBackupFallback ? "the latest event backup" : "local CSV fallback"}{" "}
					data until the store is restored.
				</div>
			)}
			<EventsClient
				initialEvents={result.data}
				mapLoadStrategy={mapLoadStrategy}
				eventSubmissionsEnabled={submissionSettings.enabled}
			/>
		</>
	);
}
