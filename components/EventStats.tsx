import React, { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { formatDayWithDate, type Event } from "@/types/events";

interface EventStatsProps {
	events: Event[];
	filteredEvents: Event[];
}

const EventStats: React.FC<EventStatsProps> = ({
	events,
	filteredEvents,
}) => {
	// Infer if filters are active by comparing array lengths
	const hasActiveFilters = filteredEvents.length !== events.length;

	// Calculate filtered arrondissements count (excluding unknown)
	const filteredArrondissementsCount = useMemo(() => {
		const arrondissements = new Set(
			filteredEvents
				.map((event) => event.arrondissement)
				.filter((arr) => arr !== "unknown")
		);
		return arrondissements.size;
	}, [filteredEvents]);

	// Calculate dynamic date range from events data
	const dateRange = useMemo(() => {
		if (events.length === 0) return "No events";

		// Get all dates and sort them
		const dates = events
			.map((event) => event.date)
			.filter((date) => date && date !== "2025-06-21") // Filter out default dates
			.sort();

		if (dates.length === 0) return "June 2025";

		const earliestDate = dates[0];
		const latestDate = dates[dates.length - 1];

		// Parse dates
		const earliestDateObj = new Date(earliestDate);
		const latestDateObj = new Date(latestDate);

		// Format the date range
		const formatDate = (date: Date) => {
			const day = date.getDate();
			const month = date.toLocaleDateString("en-US", { month: "long" });
			const year = date.getFullYear();
			return { day, month, year };
		};

		const earliest = formatDate(earliestDateObj);
		const latest = formatDate(latestDateObj);

		// If same month and year, show "19-22 June 2025"
		if (earliest.month === latest.month && earliest.year === latest.year) {
			if (earliest.day === latest.day) {
				return `${earliest.day} ${earliest.month} ${earliest.year}`;
			}
			return `${earliest.day}-${latest.day} ${earliest.month} ${earliest.year}`;
		}

		// If same year but different months, show "June 19 - July 22, 2025"
		if (earliest.year === latest.year) {
			return `${earliest.month} ${earliest.day} - ${latest.month} ${latest.day}, ${earliest.year}`;
		}

		// Different years, show full range
		return `${earliest.month} ${earliest.day}, ${earliest.year} - ${latest.month} ${latest.day}, ${latest.year}`;
	}, [events]);

	// Calculate unique days from events
	const uniqueDays = useMemo(() => {
		const days = new Set(
			events.map((event) => event.day).filter((day) => day !== "tbc"),
		);
		return days.size;
	}, [events]);

	return (
		<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
			{/* Events Count */}
			<Card>
				<CardContent className="p-4 text-center">
					<div className="text-2xl font-bold text-primary">
						{filteredEvents.length}
					</div>
					<div className="text-sm text-muted-foreground">
						Event{filteredEvents.length !== 1 ? "s" : ""}{" "}
						{hasActiveFilters ? "filtered" : "total"}
					</div>
				</CardContent>
			</Card>

			{/* Arrondissements Count */}
			<Card>
				<CardContent className="p-4 text-center">
					<div className="text-2xl font-bold text-primary">
						{filteredArrondissementsCount}
					</div>
					<div className="text-sm text-muted-foreground">
						Arrondissement{filteredArrondissementsCount !== 1 ? "s" : ""}{" "}
						{hasActiveFilters ? "with events" : "total"}
					</div>
				</CardContent>
			</Card>

			{/* Dynamic Date Range */}
			<Card>
				<CardContent className="p-4 text-center">
					<div className="text-2xl font-bold text-primary">
						{uniqueDays > 0 ? uniqueDays : "—"}
					</div>
					<div className="text-sm text-muted-foreground">
						{uniqueDays === 1 ? "Day" : "Days"} • {dateRange}
					</div>
				</CardContent>
			</Card>
		</div>
	);
};

export default EventStats;
