import { getLiveEvents } from "@/features/data-management/runtime-service";
import { EventsClient } from "@/features/events/components/events-client";
import { getSpotlightRotationContext } from "@/features/events/featured/selection";
import { getDefaultDateRangeForEvents } from "@/features/events/filtering";
import { toHomepageEventPayload } from "@/features/events/homepage-event-payload";
import {
	getPopularSearchChipSignalsCached,
	getPublicSearchChipSettingsCached,
} from "@/features/events/search-chip-queries";
import { buildDynamicSearchChips } from "@/features/events/search-chips";
import { EventSubmissionSettingsStore } from "@/features/events/submissions/settings-store";
import type { MapLoadStrategy } from "@/features/maps/components/events-map-card";
import { getTicketExchangeSummariesForEvents } from "@/features/ticket-exchange/service";
import { env } from "@/lib/config/env";
import { log } from "@/lib/platform/logger";

interface HomeEventsSectionProps {
	mapLoadStrategy: MapLoadStrategy;
}

export async function HomeEventsSection({
	mapLoadStrategy,
}: HomeEventsSectionProps) {
	const [result, submissionSettings, searchChipSettings, popularSearchSignals] =
		await Promise.all([
			getLiveEvents({ includeEngagementProjection: false }),
			EventSubmissionSettingsStore.getPublicSettings().catch(
				(error: unknown) => {
					log.warn("home", "Unable to load event submission settings", {
						error: error instanceof Error ? error.message : String(error),
					});
					return {
						newEventsEnabled: true,
						eventUpdatesEnabled: true,
						updatedAt: new Date(0).toISOString(),
					};
				},
			),
			getPublicSearchChipSettingsCached(),
			getPopularSearchChipSignalsCached(),
		]);
	const ticketExchangeSummaries = await getTicketExchangeSummariesForEvents(
		result.data,
	).catch((error: unknown) => {
		log.warn("home", "Unable to load ticket exchange summaries", {
			error: error instanceof Error ? error.message : String(error),
		});
		return [];
	});
	const ticketExchangeSummaryByEventKey = new Map(
		ticketExchangeSummaries.map((summary) => [summary.eventKey, summary]),
	);
	const suppressedEventQueries: string[] = [];
	const homepageEvents = result.data.map((event) => {
		const summary = ticketExchangeSummaryByEventKey.get(event.eventKey);
		return toHomepageEventPayload({
			...event,
			ticketExchangeSellingCount: summary?.sellingCount ?? 0,
			ticketExchangeLookingCount: summary?.lookingCount ?? 0,
			ticketExchangeLatestListingAt: summary?.latestListingAt ?? null,
		});
	});
	const defaultDateRange = getDefaultDateRangeForEvents(homepageEvents);
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
	const spotlightRotationContext = getSpotlightRotationContext({
		dateRange: defaultDateRange,
	});
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
				initialEvents={homepageEvents}
				mapLoadStrategy={mapLoadStrategy}
				eventUpdateRequestsEnabled={submissionSettings.eventUpdatesEnabled}
				dynamicSearchChips={dynamicSearchChips}
				spotlightRotationContext={spotlightRotationContext}
			/>
		</>
	);
}
