"use client";

import React, { forwardRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EventCard } from "@/components/event-card/EventCard";
import type { Event } from "@/types/events";

type AllEventsProps = {
	events: Event[];
	onEventClick: (event: Event) => void;
};

export const AllEvents = forwardRef<HTMLDivElement, AllEventsProps>(
	({ events, onEventClick }, ref) => {
		return (
			<Card ref={ref} className="mt-6">
				<CardHeader>
					<CardTitle>All Events ({events.length})</CardTitle>
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
