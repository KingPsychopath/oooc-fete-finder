"use client";

import React, { forwardRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EventCard } from "@/components/event-card/EventCard";
import { FilterButton } from "@/components/FilterButton";
import type { Event } from "@/types/events";

type AllEventsProps = {
	events: Event[];
	onEventClick: (event: Event) => void;
	onFilterClickAction: () => void;
	hasActiveFilters: boolean;
	activeFiltersCount: number;
};

export const AllEvents = forwardRef<HTMLDivElement, AllEventsProps>(
	(
		{
			events,
			onEventClick,
			onFilterClickAction,
			hasActiveFilters,
			activeFiltersCount,
		},
		ref,
	) => {
		return (
			<Card ref={ref} className="mt-6">
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle className="flex items-center">
							All Events
							<Badge variant="outline" className="ml-2 text-xs">
								{events.length} event{events.length !== 1 ? "s" : ""}
							</Badge>
						</CardTitle>
						<FilterButton
							onClickAction={onFilterClickAction}
							hasActiveFilters={hasActiveFilters}
							activeFiltersCount={activeFiltersCount}
							className="lg:hidden"
						/>
					</div>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{events
							.filter((event) => event != null)
							.map((event) => (
								<EventCard
									key={event.id}
									event={event}
									onClick={onEventClick}
								/>
							))}
					</div>
				</CardContent>
			</Card>
		);
	},
);

AllEvents.displayName = "AllEvents";
