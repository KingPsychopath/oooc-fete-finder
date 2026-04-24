import { Card, CardContent } from "@/components/ui/card";
import {
	getEventStatsDateRange,
	getEventStatsUniqueDays,
} from "@/features/events/event-stats-utils";
import { type Event } from "@/features/events/types";
import { clientLog } from "@/lib/platform/client-logger";
import React, { useEffect, useMemo } from "react";

interface EventStatsProps {
	events: Event[];
	filteredEvents: Event[];
}

const EventStats: React.FC<EventStatsProps> = ({ events, filteredEvents }) => {
	// Infer if filters are active by comparing array lengths
	const hasActiveFilters = filteredEvents.length !== events.length;

	// Calculate filtered arrondissements count (excluding unknown)
	const filteredArrondissementsCount = useMemo(() => {
		const arrondissements = new Set(
			filteredEvents
				.map((event) => event.arrondissement)
				.filter((arr) => arr !== "unknown"),
		);
		return arrondissements.size;
	}, [filteredEvents]);

	// Calculate dynamic date range from filtered events data
	const dateRangeStats = useMemo(
		() => getEventStatsDateRange(filteredEvents),
		[filteredEvents],
	);

	// Calculate unique days from events
	const uniqueDays = useMemo(
		() => getEventStatsUniqueDays(filteredEvents),
		[filteredEvents],
	);

	useEffect(() => {
		if (
			dateRangeStats.earliestDate &&
			dateRangeStats.latestDate &&
			dateRangeStats.spanDays !== null &&
			dateRangeStats.spanDays > 365
		) {
			clientLog.warn("events.stats", "Unexpectedly wide filtered date span", {
				filteredEventsCount: filteredEvents.length,
				earliestDate: dateRangeStats.earliestDate,
				latestDate: dateRangeStats.latestDate,
				spanDays: dateRangeStats.spanDays,
			});
		}
	}, [dateRangeStats, filteredEvents.length]);

	return (
		<div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
			{/* Events Count */}
			<Card className="ooo-site-card py-0">
				<CardContent className="p-4 text-center">
					<div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
						Events
					</div>
					<div className="mt-1 text-3xl [font-family:var(--ooo-font-display)] font-light text-foreground">
						{filteredEvents.length.toLocaleString()}
					</div>
					<div className="mt-1 text-sm text-muted-foreground">
						Event{filteredEvents.length !== 1 ? "s" : ""}{" "}
						{hasActiveFilters ? "filtered" : "total"}
					</div>
				</CardContent>
			</Card>

			{/* Arrondissements Count */}
			<Card className="ooo-site-card py-0">
				<CardContent className="p-4 text-center">
					<div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
						Coverage
					</div>
					<div className="mt-1 text-3xl [font-family:var(--ooo-font-display)] font-light text-foreground">
						{filteredArrondissementsCount}
					</div>
					<div className="mt-1 text-sm text-muted-foreground">
						Arrondissement{filteredArrondissementsCount !== 1 ? "s" : ""}{" "}
						{hasActiveFilters ? "with events" : "total"}
					</div>
				</CardContent>
			</Card>

			{/* Dynamic Date Range */}
			<Card className="ooo-site-card py-0">
				<CardContent className="p-4 text-center">
					<div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
						Date Span
					</div>
					<div className="mt-1 text-3xl [font-family:var(--ooo-font-display)] font-light text-foreground">
						{uniqueDays > 0 ? uniqueDays : "—"}
					</div>
					<div className="mt-1 text-sm text-muted-foreground">
						{uniqueDays === 1 ? "Day" : "Days"} • {dateRangeStats.label}
					</div>
				</CardContent>
			</Card>
		</div>
	);
};

export default EventStats;
