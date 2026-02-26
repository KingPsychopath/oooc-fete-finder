"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EventCard } from "@/features/events/components/EventCard";
import { useMediaQuery } from "@/hooks/useMediaQuery";
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
	maxFeaturedEvents = FEATURED_EVENTS_CONFIG.MAX_FEATURED_EVENTS,
}: FeaturedEventsProps) {
	const isTabletTwoColumnRange = useMediaQuery(
		"(min-width: 768px) and (max-width: 1023px)",
	);
	const responsiveMaxFeaturedEvents = isTabletTwoColumnRange
		? 4
		: maxFeaturedEvents;
	const { featuredEvents, totalEventsCount, hasMoreEvents } = useFeaturedEvents(
		events,
		responsiveMaxFeaturedEvents,
	);

	return (
		<Card className="ooo-site-card mb-6 py-0">
			<CardHeader className="border-b border-border/70 py-5">
				<FeaturedEventsHeader />
			</CardHeader>
			<CardContent className="py-5">
				{/* Responsive grid: 1 col on mobile, 2 cols on tablet, 3 cols on desktop */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{featuredEvents.map((event) => (
						<EventCard key={event.id} event={event} onClick={onEventClick} />
					))}
				</div>

				{/* Show browse all button if there are more events than featured */}
				{hasMoreEvents && (
					<div className="mt-4 text-center">
						<Button
							variant="outline"
							onClick={onScrollToAllEvents}
							className="w-full border-border/80 bg-background/65 text-foreground/85 hover:bg-accent sm:w-auto"
						>
							Browse All {totalEventsCount} Events
							<ChevronDown className="h-4 w-4 ml-1" />
						</Button>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
