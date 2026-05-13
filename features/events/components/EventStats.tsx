import { Card, CardContent } from "@/components/ui/card";
import {
	getEventStatsDateRange,
	getEventStatsUniqueDays,
} from "@/features/events/event-stats-utils";
import { type Event, isNumberedArrondissement } from "@/features/events/types";
import { clientLog } from "@/lib/platform/client-logger";
import { CalendarDays, MapPinned, Ticket } from "lucide-react";
import React, { useEffect, useMemo } from "react";

interface EventStatsProps {
	filteredEvents: Event[];
	hasActiveFilters: boolean;
}

const EventStats: React.FC<EventStatsProps> = ({
	filteredEvents,
	hasActiveFilters,
}) => {
	const eventCount = filteredEvents.length;
	const eventCountLabel = hasActiveFilters ? "filtered" : "in view";
	const coverageLabel = hasActiveFilters ? "with matching events" : "in view";

	// Calculate filtered arrondissements count (excluding unknown)
	const filteredArrondissementsCount = useMemo(() => {
		const arrondissements = new Set(
			filteredEvents
				.map((event) => event.arrondissement)
				.filter(isNumberedArrondissement),
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

	const statCardClassName =
		"ooo-ticket-stat-card relative overflow-hidden border-border/55 bg-card/52 py-0 shadow-none backdrop-blur transition-colors hover:bg-card/66 dark:border-[#f0b668]/12 dark:bg-[linear-gradient(145deg,rgba(240,182,104,0.06),rgba(255,255,255,0.035)_58%,rgba(255,255,255,0.018))] dark:shadow-[0_16px_38px_-34px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.055)]";
	const statIconClassName =
		"flex h-8 w-8 items-center justify-center rounded-full border border-amber-500/18 bg-amber-500/8 text-amber-800 dark:border-amber-300/16 dark:bg-amber-300/8 dark:text-amber-100";
	const statGlint = (
		<div
			className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/45 to-transparent dark:via-amber-200/28"
			aria-hidden="true"
		/>
	);
	const ticketNotches = (
		<div
			className="pointer-events-none absolute inset-y-0 left-0"
			aria-hidden="true"
		>
			<div className="absolute inset-y-3 left-14 border-l border-dashed border-amber-900/18 opacity-80 dark:border-amber-100/14" />
		</div>
	);

	return (
		<div className="mb-8 grid grid-cols-1 gap-3 md:grid-cols-3">
			{/* Events Count */}
			<Card className={statCardClassName}>
				{statGlint}
				{ticketNotches}
				<CardContent className="relative z-[1] flex items-center gap-5 p-3 sm:p-4">
					<div className={statIconClassName}>
						<Ticket className="h-4 w-4" strokeWidth={1.7} />
					</div>
					<div className="min-w-0">
						<div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
							Events
						</div>
						<div className="mt-0.5 text-3xl leading-none [font-family:var(--ooo-font-display)] font-light text-foreground">
							{eventCount.toLocaleString()}
						</div>
						<div className="mt-1 truncate text-sm text-muted-foreground">
							Event{eventCount !== 1 ? "s" : ""} {eventCountLabel}
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Arrondissements Count */}
			<Card className={statCardClassName}>
				{statGlint}
				{ticketNotches}
				<CardContent className="relative z-[1] flex items-center gap-5 p-3 sm:p-4">
					<div className={statIconClassName}>
						<MapPinned className="h-4 w-4" strokeWidth={1.7} />
					</div>
					<div className="min-w-0">
						<div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
							Coverage
						</div>
						<div className="mt-0.5 text-3xl leading-none [font-family:var(--ooo-font-display)] font-light text-foreground">
							{filteredArrondissementsCount}
						</div>
						<div className="mt-1 truncate text-sm text-muted-foreground">
							Arrondissement{filteredArrondissementsCount !== 1 ? "s" : ""}{" "}
							{coverageLabel}
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Dynamic Date Range */}
			<Card className={statCardClassName}>
				{statGlint}
				{ticketNotches}
				<CardContent className="relative z-[1] flex items-center gap-5 p-3 sm:p-4">
					<div className={statIconClassName}>
						<CalendarDays className="h-4 w-4" strokeWidth={1.7} />
					</div>
					<div className="min-w-0">
						<div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
							Date Span
						</div>
						<div className="mt-0.5 text-3xl leading-none [font-family:var(--ooo-font-display)] font-light text-foreground">
							{uniqueDays > 0 ? uniqueDays : "—"}
						</div>
						<div className="mt-1 truncate text-sm text-muted-foreground">
							{uniqueDays === 1 ? "Day" : "Days"} • {dateRangeStats.label}
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
};

export default EventStats;
