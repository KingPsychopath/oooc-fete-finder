import { getLiveEvents } from "@/features/data-management/runtime-service";
import { EventsClient } from "@/features/events/components/events-client";
import {
	getPopularSearchChipSignalsCached,
	getPublicSearchChipSettingsCached,
} from "@/features/events/search-chip-queries";
import { SearchChipSettingsStore } from "@/features/events/search-chip-settings-store";
import { buildDynamicSearchChips } from "@/features/events/search-chips";
import { EventSubmissionSettingsStore } from "@/features/events/submissions/settings-store";
import type { MapLoadStrategy } from "@/features/maps/components/events-map-card";
import { env } from "@/lib/config/env";
import { log } from "@/lib/platform/logger";

interface HomeEventsSectionProps {
	mapLoadStrategy: MapLoadStrategy;
	initialSelectedEventKey?: string;
}

export async function HomeEventsSection({
	mapLoadStrategy,
	initialSelectedEventKey,
}: HomeEventsSectionProps) {
	const [
		result,
		submissionSettings,
		searchChipSettings,
		popularSearchSignals,
		suppressedEventQueries,
	] = await Promise.all([
		getLiveEvents(),
		EventSubmissionSettingsStore.getPublicSettings().catch((error: unknown) => {
			log.warn("home", "Unable to load event submission settings", {
				error: error instanceof Error ? error.message : String(error),
			});
			return {
				newEventsEnabled: true,
				eventUpdatesEnabled: true,
				updatedAt: new Date(0).toISOString(),
			};
		}),
		getPublicSearchChipSettingsCached(),
		getPopularSearchChipSignalsCached(),
		SearchChipSettingsStore.getSuppressedEventQueries().catch(() => []),
	]);
	const isRemoteMode = env.DATA_MODE === "remote";
	const isBackupFallback = isRemoteMode && result.source === "backup";
	const isLocalFallback = isRemoteMode && result.source === "local";
	const dynamicSearchChips =
		searchChipSettings.dynamicChipsEnabled && result.data.length > 0
			? buildDynamicSearchChips(popularSearchSignals, result.data, {
					maxChips: searchChipSettings.maxDynamicChips,
					suppressedEventQueries,
				})
			: [];
	if (dynamicSearchChips.length > 0) {
		void SearchChipSettingsStore.recordEventChipSelection(
			dynamicSearchChips
				.filter((chip) => chip.kind === "event")
				.map((chip) => chip.query),
		);
	}

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
				initialSelectedEventKey={initialSelectedEventKey}
				eventUpdateRequestsEnabled={submissionSettings.eventUpdatesEnabled}
				dynamicSearchChips={dynamicSearchChips}
			/>
		</>
	);
}
