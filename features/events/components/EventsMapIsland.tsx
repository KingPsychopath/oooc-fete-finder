"use client";

import { useOnlineStatus } from "@/components/offline-indicator";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEventsSearchFilters } from "@/features/events/components/events-search-filters-provider";
import type { Event } from "@/features/events/types";
import type { MapLoadStrategy } from "@/features/maps/components/events-map-card";
import { clientLog } from "@/lib/platform/client-logger";
import { MapPin } from "lucide-react";
import {
	Component,
	Suspense,
	lazy,
	type ErrorInfo,
	type ReactNode,
} from "react";

const EventsMapCard = lazy(async () => {
	const module = await import("@/features/maps/components/events-map-card");
	return { default: module.EventsMapCard };
});

const NoopSuspenseFallback = (
	<span className="sr-only" aria-hidden="true">
		Loading
	</span>
);

interface EventsMapIslandProps {
	isExpanded: boolean;
	mapLoadStrategy: MapLoadStrategy;
	onEventClick: (event: Event) => void;
	onMapIntent: () => void;
	onToggleExpanded: () => void;
}

interface EventsMapErrorBoundaryProps {
	children: ReactNode;
	eventsCount: number;
	isOnline: boolean;
}

interface EventsMapErrorBoundaryState {
	hasError: boolean;
}

class EventsMapErrorBoundary extends Component<
	EventsMapErrorBoundaryProps,
	EventsMapErrorBoundaryState
> {
	state: EventsMapErrorBoundaryState = { hasError: false };

	static getDerivedStateFromError(): EventsMapErrorBoundaryState {
		return { hasError: true };
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		clientLog.warn("events-map", "Events map failed to render", {
			componentStack: errorInfo.componentStack,
			error: error.message,
		});
	}

	render() {
		if (this.state.hasError) {
			return (
				<EventsMapFallback
					eventsCount={this.props.eventsCount}
					isOnline={this.props.isOnline}
				/>
			);
		}

		return this.props.children;
	}
}

function EventsMapFallback({
	eventsCount,
	isOnline,
}: {
	eventsCount: number;
	isOnline: boolean;
}) {
	return (
		<Card className="ooo-site-card py-0">
			<CardHeader className="border-b border-border/70 py-5 pb-4">
				<CardTitle className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
					<div className="flex items-center space-x-2">
						<MapPin className="h-5 w-5 flex-shrink-0" />
						<span className="text-lg [font-family:var(--ooo-font-display)] font-light sm:text-2xl">
							Paris Event Map
						</span>
					</div>
					<Badge variant="secondary" className="text-xs">
						{eventsCount} event{eventsCount !== 1 ? "s" : ""}
					</Badge>
				</CardTitle>
			</CardHeader>
			<CardContent className="px-3 py-5 pt-3 sm:px-6">
				<div className="flex min-h-48 items-center justify-center rounded-xl border border-border/65 bg-background/58 px-4 text-center">
					<div className="max-w-md">
						<p className="text-sm font-medium text-foreground">
							Map temporarily unavailable
						</p>
						<p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
							{isOnline
								? "Event browsing, search, and filters are still available below."
								: "You are offline. Saved event browsing, search, and filters are still available below."}
						</p>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

export function EventsMapIsland({
	isExpanded,
	mapLoadStrategy,
	onEventClick,
	onMapIntent,
	onToggleExpanded,
}: EventsMapIslandProps) {
	const {
		activeFiltersCount,
		filteredEvents,
		hasAnyActiveFilters,
		toggleFilterPanel,
	} = useEventsSearchFilters();
	const isOnline = useOnlineStatus();

	return (
		<div id="event-map" className="scroll-mt-6 mb-8 relative z-10 sm:scroll-mt-28">
			<EventsMapErrorBoundary
				eventsCount={filteredEvents.length}
				isOnline={isOnline}
			>
				<Suspense fallback={NoopSuspenseFallback}>
					<EventsMapCard
						events={filteredEvents}
						isExpanded={isExpanded}
						onToggleExpanded={onToggleExpanded}
						onEventClick={onEventClick}
						mapLoadStrategy={mapLoadStrategy}
						onFilterClick={toggleFilterPanel}
						onMapIntent={onMapIntent}
						hasActiveFilters={hasAnyActiveFilters}
						activeFiltersCount={activeFiltersCount}
					/>
				</Suspense>
			</EventsMapErrorBoundary>
		</div>
	);
}
