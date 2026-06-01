"use client";

import { Button } from "@/components/ui/button";
import EventStats from "@/features/events/components/EventStats";
import { useEventsSearchFilters } from "@/features/events/components/events-search-filters-provider";
import { trackNavigationClick } from "@/features/events/engagement/client-tracking";
import { FeaturedEvents } from "@/features/events/featured/FeaturedEvents";
import type { Event } from "@/features/events/types";
import Link from "next/link";
import { useMemo } from "react";

interface EventsDiscoverySummaryIslandProps {
	onEventClick: (event: Event) => void;
	onScrollToAllEvents: () => void;
}

export function EventsDiscoverySummaryIsland({
	onEventClick,
	onScrollToAllEvents,
}: EventsDiscoverySummaryIslandProps) {
	const {
		defaultDateRange,
		filteredEvents,
		handleOOOCPicksCalloutClick,
		hasAnyActiveFilters,
		selectedOOOCPicks,
		socialProofDisplayModes,
		spotlightRotationContext,
		spotlightEventsOrdered,
	} = useEventsSearchFilters();
	const ooocPicksInViewCount = useMemo(
		() => filteredEvents.filter((event) => event.isOOOCPick === true).length,
		[filteredEvents],
	);

	return (
		<>
			<section className="relative mb-10" aria-label="Introduction">
				<div
					className="pointer-events-none absolute inset-x-0 -top-24 h-80 bg-[radial-gradient(ellipse_at_14%_8%,rgba(240,182,104,0.18),transparent_68%),radial-gradient(ellipse_at_88%_18%,rgba(36,74,78,0.07),transparent_70%)] opacity-70 blur-2xl dark:opacity-55"
					aria-hidden="true"
				/>
				<div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)] lg:items-end">
					<div className="min-w-0">
						<p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
							Paris · Fête de la Musique
						</p>
						<h2
							className="mt-2 text-2xl font-light tracking-tight text-foreground sm:text-3xl"
							style={{ fontFamily: "var(--ooo-font-display)" }}
						>
							Discover events across the city
						</h2>
						<p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
							Explore live music and cultural events by arrondissement. Use the
							map and filters to find what’s on.
						</p>
						<Link
							href="/how-it-works"
							onClick={() =>
								trackNavigationClick({
									group: "homepage_link",
									label: "how_it_works_intro",
								})
							}
							className="mt-3 inline-flex flex-wrap items-baseline gap-x-1 text-sm font-medium text-foreground underline-offset-4 transition-colors hover:text-foreground/78 hover:underline"
						>
							<span>New here? See how Fête Finder</span>
							<span className="whitespace-nowrap">works →</span>
						</Link>
					</div>
					{ooocPicksInViewCount > 0 && (
						<div
							id="tour-oooc-picks"
							className="w-full rounded-xl border border-border/55 bg-card/46 p-3 shadow-[0_14px_30px_-30px_rgba(22,16,10,0.5)] backdrop-blur lg:justify-self-end dark:border-border/30 dark:bg-card/34"
						>
							<div className="flex items-center justify-between gap-3">
								<div className="min-w-0">
									<p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
										OOOC Picks
									</p>
									<p className="mt-1 text-xs leading-relaxed text-foreground/80">
										Short on time? Start with the community-curated favourites.
									</p>
								</div>
								<Button
									type="button"
									variant={selectedOOOCPicks ? "default" : "outline"}
									size="sm"
									onClick={handleOOOCPicksCalloutClick}
									className="h-8 shrink-0 rounded-full px-3 text-xs"
								>
									{selectedOOOCPicks ? "Showing Picks" : "Show Picks"}
								</Button>
							</div>
						</div>
					)}
				</div>
			</section>

			<FeaturedEvents
				events={spotlightEventsOrdered}
				onEventClick={onEventClick}
				onScrollToAllEvents={onScrollToAllEvents}
				socialProofDisplayModes={socialProofDisplayModes}
				dateRange={defaultDateRange}
				rotationContext={spotlightRotationContext}
			/>

			<EventStats
				filteredEvents={filteredEvents}
				hasActiveFilters={hasAnyActiveFilters}
			/>
		</>
	);
}
