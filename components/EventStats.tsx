import { Card, CardContent } from "@/components/ui/card";
import { type Event } from "@/types/events";
import React, { useMemo } from "react";

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

	// Calculate dynamic date range from events data
	const dateRange = useMemo(() => {
		if (events.length === 0) return "No events";

		// Get all dates and sort them
		const dates = events
			.map((event) => event.date)
			.filter((date) => {
				if (!date) return false; // Filter out empty/null dates
				// Test if the date string can be parsed into a valid date
				const testDate = new Date(date);
				return !isNaN(testDate.getTime()); // Only keep valid dates
			})
			.sort();

		if (dates.length === 0) return "June 2025";

		const earliestDate = dates[0];
		const latestDate = dates[dates.length - 1];

		// Parse dates (we know these are valid now)
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
						{uniqueDays === 1 ? "Day" : "Days"} • {dateRange}
					</div>
				</CardContent>
			</Card>
		</div>
	);
};

export default EventStats;
