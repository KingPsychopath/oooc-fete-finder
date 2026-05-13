"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { EventCard } from "@/features/events/components/EventCard";
import { useSavedEvents } from "@/features/events/components/saved-events-provider";
import { trackEventEngagement } from "@/features/events/engagement/client-tracking";
import { buildGenreFrequency } from "@/features/events/genre-preview";
import { ChevronDown } from "lucide-react";
import { FeaturedEventsHeader } from "./components/FeaturedEventsHeader";
import { FEATURED_EVENTS_CONFIG } from "./constants";
import { useFeaturedEvents } from "./hooks/use-featured-events";
import type { FeaturedEventsProps } from "./types";

/**
 * FeaturedEvents component displays a curated selection of events
 * Prioritizes manually featured events, then fills remaining slots with OOOC picks and regular events
 * Uses deterministic shuffling to avoid hydration errors
 */
export function FeaturedEvents({
	events,
	onEventClick,
	onScrollToAllEvents,
	socialProofDisplayModes,
	maxFeaturedEvents = FEATURED_EVENTS_CONFIG.MAX_FEATURED_EVENTS,
	dateRange,
	rotationContext,
}: FeaturedEventsProps) {
	const { featuredEvents, totalEventsCount, hasMoreEvents } = useFeaturedEvents(
		events,
		maxFeaturedEvents,
		dateRange,
		rotationContext,
	);
	const { isEventSaved } = useSavedEvents();
	if (featuredEvents.length === 0) {
		return null;
	}

	const genreFrequency = buildGenreFrequency(events);
	const browseAllLabel = `Browse All ${totalEventsCount} Event${totalEventsCount !== 1 ? "s" : ""}`;
	const handleSpotlightEventClick = (
		event: (typeof featuredEvents)[number],
	) => {
		trackEventEngagement({
			eventKey: event.eventKey,
			actionType: "click",
			source: `spotlight:${rotationContext.bucket}:${rotationContext.eventPhase}:${rotationContext.cadence}`,
		});
		onEventClick(event);
	};

	return (
		<Card className="ooo-site-card mb-8 overflow-hidden py-0">
			<CardContent className="px-4 py-5 sm:px-5">
				{/* Responsive grid: 1 col on mobile, 2 cols on tablet, 3 cols on desktop */}
				<div className="grid grid-cols-1 gap-4 md:grid-cols-4 md:[&>*:last-child:nth-child(odd)]:col-start-2 md:[&>*]:col-span-2 lg:grid-cols-3 lg:[&>*:last-child:nth-child(odd)]:col-start-auto lg:[&>*]:col-span-1">
					{featuredEvents.map((event) => (
						<EventCard
							key={event.eventKey || event.id}
							event={event}
							onClick={handleSpotlightEventClick}
							socialProofMode={socialProofDisplayModes.get(event.eventKey)}
							genreFrequency={genreFrequency}
							isSaved={isEventSaved(event.eventKey)}
						/>
					))}
				</div>
			</CardContent>
			<CardFooter className="flex flex-col items-stretch gap-3 border-border/60 bg-background/36 px-4 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between dark:bg-white/[0.025]">
				<FeaturedEventsHeader rotationContext={rotationContext} />
				{/* Show browse all button if there are more events than featured */}
				{hasMoreEvents && (
					<div className="sm:shrink-0">
						<Button
							variant="outline"
							onClick={onScrollToAllEvents}
							className="h-auto min-h-8 w-full whitespace-normal border-border/80 bg-background/65 px-3 py-2 text-center leading-tight text-foreground/85 hover:bg-accent sm:h-8 sm:w-auto sm:whitespace-nowrap"
						>
							{browseAllLabel}
							<ChevronDown className="h-4 w-4 ml-1" />
						</Button>
					</div>
				)}
			</CardFooter>
		</Card>
	);
}
