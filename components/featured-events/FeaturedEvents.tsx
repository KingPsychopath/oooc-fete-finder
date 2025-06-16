"use client";
import { EventCard } from "@/components/event-card/EventCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
	const { featuredEvents, totalEventsCount, hasMoreEvents } = useFeaturedEvents(
		events,
		maxFeaturedEvents,
	);

	return (
		<Card className="mb-6">
			<CardHeader>
				<FeaturedEventsHeader />
			</CardHeader>
			<CardContent>
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
							variant="secondary"
							onClick={onScrollToAllEvents}
							className="w-full sm:w-auto"
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
