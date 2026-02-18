"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EventCard } from "@/features/events/components/EventCard";
import { FilterButton } from "@/features/events/components/FilterButton";
import type { Event } from "@/features/events/types";
import { Lock } from "lucide-react";
import Link from "next/link";
import { forwardRef } from "react";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

type AllEventsProps = {
	events: Event[];
	onEventClick: (event: Event) => void;
	onFilterClickAction: () => void;
	onAuthRequired: () => void;
	hasActiveFilters: boolean;
	activeFiltersCount: number;
	isAuthenticated: boolean;
	isAuthResolved: boolean;
	submissionsEnabled: boolean;
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
			submissionsEnabled,
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
					{submissionsEnabled ? (
						<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
							<Link
								href={`${basePath}/submit-event`}
								className="font-medium text-foreground underline-offset-4 transition-colors hover:underline"
							>
								Hosting something special? Put it on the map with the collective
								and submit your event →
							</Link>
						</p>
					) : (
						<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
							Host submissions are currently paused.
						</p>
					)}
				</CardHeader>
				<CardContent className="py-5">
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{visibleEvents.map((event) => (
							<EventCard key={event.id} event={event} onClick={onEventClick} />
						))}
					</div>

					{lockedEvents.length > 0 && (
						<div className="mt-6">
							<div
								className="relative cursor-pointer overflow-hidden rounded-[22px] border border-border/60"
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
											className="pointer-events-none select-none opacity-60 blur-[4px] saturate-[0.9]"
											aria-hidden="true"
										>
											<EventCard event={event} onClick={onEventClick} />
										</div>
									))}
								</div>
								<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(248,243,235,0.08)_0%,rgba(248,243,235,0)_46%),linear-gradient(to_bottom,rgba(20,16,13,0.08)_0%,rgba(20,16,13,0.44)_48%,rgba(20,16,13,0.7)_100%)]" />
								<div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4">
									<div className="pointer-events-auto w-full max-w-lg rounded-[24px] border p-6 text-center backdrop-blur-[10px] [border-color:color-mix(in_oklab,var(--border)_80%,rgba(255,255,255,0.16))] [background:linear-gradient(145deg,rgba(255,255,255,0.45)_10%,rgba(255,255,255,0)_68%),color-mix(in_oklab,var(--card)_88%,rgba(24,18,14,0.12))] [box-shadow:0_28px_58px_-36px_rgba(8,6,4,0.8),0_1px_0_rgba(255,255,255,0.36)_inset] dark:[border-color:color-mix(in_oklab,var(--border)_80%,rgba(255,255,255,0.2))] dark:[background:linear-gradient(145deg,rgba(255,255,255,0.14)_10%,rgba(255,255,255,0)_68%),color-mix(in_oklab,var(--card)_90%,rgba(13,10,8,0.5))]">
										<p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground/85">
											Out Of Office Collective
										</p>
										<div className="mx-auto mt-2 h-px w-16 bg-border/70" />
										<h3 className="mt-4 text-[clamp(1.45rem,4vw,2rem)] leading-none [font-family:var(--ooo-font-display)] font-light tracking-[0.02em] text-foreground">
											Free Your Vibe
										</h3>
										<p className="mt-3 text-sm leading-relaxed text-muted-foreground">
											Unlock {lockedEvents.length} more curated event
											{lockedEvents.length !== 1 ? "s" : ""} with quick email
											access.
										</p>
										<Button
											onClick={onAuthRequired}
											className="mt-5 h-9 rounded-full border border-border/70 bg-primary text-primary-foreground hover:bg-primary/90"
											size="sm"
										>
											<Lock className="mr-1.5 h-3.5 w-3.5" />
											Continue with email
										</Button>
									</div>
								</div>
							</div>
						</div>
					)}
				</CardContent>
			</Card>
		);
	},
);

AllEvents.displayName = "AllEvents";
