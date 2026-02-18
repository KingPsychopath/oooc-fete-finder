"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EventCard } from "@/features/events/components/EventCard";
import { FilterButton } from "@/features/events/components/FilterButton";
import type { Event } from "@/features/events/types";
import { Lock } from "lucide-react";
import { forwardRef } from "react";

type AllEventsProps = {
	events: Event[];
	onEventClick: (event: Event) => void;
	onFilterClickAction: () => void;
	onAuthRequired: () => void;
	hasActiveFilters: boolean;
	activeFiltersCount: number;
	isAuthenticated: boolean;
	isAuthResolved: boolean;
};

export const AllEvents = forwardRef<HTMLDivElement, AllEventsProps>(
	(
		{
			events,
			onEventClick,
			onFilterClickAction,
			onAuthRequired,
			hasActiveFilters,
			activeFiltersCount,
			isAuthenticated,
			isAuthResolved,
		},
		ref,
	) => {
		const safeEvents = events.filter((event) => event != null);
		const shouldBlurHalf =
			isAuthResolved && !isAuthenticated && safeEvents.length > 2;
		const visibleEventsCount = shouldBlurHalf
			? Math.ceil(safeEvents.length / 2)
			: safeEvents.length;
		const visibleEvents = safeEvents.slice(0, visibleEventsCount);
		const lockedEvents = shouldBlurHalf
			? safeEvents.slice(visibleEventsCount)
			: [];

		return (
			<Card ref={ref} className="ooo-site-card mt-6 py-0">
				<CardHeader className="border-b border-border/70 py-5">
					<div className="flex items-center justify-between">
						<CardTitle className="flex items-center text-2xl [font-family:var(--ooo-font-display)] font-light tracking-[0.01em]">
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
				<CardContent className="py-5">
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{visibleEvents.map((event) => (
							<EventCard key={event.id} event={event} onClick={onEventClick} />
						))}
					</div>

					{lockedEvents.length > 0 && (
						<div className="mt-6 space-y-4">
							<div className="rounded-xl border border-border/70 bg-background/58 p-4">
								<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
									<div className="space-y-1">
										<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
											Member Access
										</p>
										<p className="text-sm leading-relaxed text-muted-foreground">
											Unlock {lockedEvents.length} more event
											{lockedEvents.length !== 1 ? "s" : ""} to browse the full
											curated list.
										</p>
									</div>
									<Button
										onClick={onAuthRequired}
										className="h-9 rounded-full"
										size="sm"
									>
										<Lock className="mr-1.5 h-3.5 w-3.5" />
										Continue with email
									</Button>
								</div>
							</div>

							<div
								className="relative cursor-pointer"
								onClick={onAuthRequired}
								onKeyDown={(event) => {
									if (event.key === "Enter" || event.key === " ") {
										event.preventDefault();
										onAuthRequired();
									}
								}}
								role="button"
								tabIndex={0}
								aria-label="Authenticate to view remaining events"
							>
								<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
									{lockedEvents.map((event) => (
										<div
											key={event.id}
											className="pointer-events-none select-none opacity-78 blur-[2.5px]"
											aria-hidden="true"
										>
											<EventCard event={event} onClick={onEventClick} />
										</div>
									))}
								</div>
								<div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-b from-background/10 via-background/20 to-background/55" />
							</div>
						</div>
					)}
				</CardContent>
			</Card>
		);
	},
);

AllEvents.displayName = "AllEvents";
