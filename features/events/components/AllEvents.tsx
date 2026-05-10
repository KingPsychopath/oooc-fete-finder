"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClearFiltersButton } from "@/features/events/components/ClearFiltersButton";
import { EventCard } from "@/features/events/components/EventCard";
import { FilterButton } from "@/features/events/components/FilterButton";
import { trackNavigationClick } from "@/features/events/engagement/client-tracking";
import { buildGenreFrequency } from "@/features/events/genre-preview";
import type { SocialProofDisplayMode } from "@/features/events/social-proof";
import type { Event } from "@/features/events/types";
import {
	BookmarkCheck,
	CalendarDays,
	LocateFixed,
	Lock,
	SearchX,
} from "lucide-react";
import Link from "next/link";
import { type ReactNode, forwardRef, useState } from "react";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

type EventSortMode = "upcoming" | "fresh-activity" | "nearby";
type PendingSavedMutationStatus = "idle" | "offline" | "retrying";

const eventSortOptions: {
	value: Exclude<EventSortMode, "nearby">;
	label: string;
	shortLabel: string;
}[] = [
	{ value: "upcoming", label: "Upcoming", shortLabel: "Upcoming" },
	{ value: "fresh-activity", label: "Fresh activity", shortLabel: "Fresh" },
];
const INITIAL_VISIBLE_EVENTS = 24;
const VISIBLE_EVENTS_INCREMENT = 24;

const getDistanceKm = (event: Event): number | null => {
	if (!("distanceKm" in event)) return null;
	const distanceKm = (event as Record<"distanceKm", unknown>).distanceKm;
	return typeof distanceKm === "number" && Number.isFinite(distanceKm)
		? distanceKm
		: null;
};

const formatProximityLabel = (event: Event): string | undefined => {
	const distanceKm = getDistanceKm(event);
	if (distanceKm === null) return undefined;
	if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m away`;
	return `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km away`;
};

type AllEventsProps = {
	events: Event[];
	onEventClick: (event: Event) => void;
	socialProofDisplayModes: Map<string, SocialProofDisplayMode>;
	sortMode: EventSortMode;
	onSortModeChange: (mode: EventSortMode) => void;
	onFilterClickAction: () => void;
	onClearFilters: () => void;
	onAuthRequired: () => void;
	hasActiveFilters: boolean;
	activeFiltersCount: number;
	isAuthenticated: boolean;
	isAuthResolved: boolean;
	nearbyEventsError: string | null;
	nearbyEventsStatus: string;
	nearbyMatchedEventsCount: number;
	onNearbyClick: () => void;
	isEventSaved: (eventKey: string) => boolean;
	savedEventsCount: number;
	pendingSavedMutationCount: number;
	pendingSavedMutationStatus: PendingSavedMutationStatus;
	showSavedOnly: boolean;
	onSavedOnlyChange: (showSavedOnly: boolean) => void;
	searchSlot?: ReactNode;
};

export const AllEvents = forwardRef<HTMLDivElement, AllEventsProps>(
	(
		{
			events,
			onEventClick,
			socialProofDisplayModes,
			sortMode,
			onSortModeChange,
			onFilterClickAction,
			onClearFilters,
			onAuthRequired,
			hasActiveFilters,
			activeFiltersCount,
			isAuthenticated,
			isAuthResolved,
			nearbyEventsError,
			nearbyEventsStatus,
			nearbyMatchedEventsCount,
			onNearbyClick,
			isEventSaved,
			savedEventsCount,
			pendingSavedMutationCount,
			pendingSavedMutationStatus,
			showSavedOnly,
			onSavedOnlyChange,
			searchSlot,
		},
		ref,
	) => {
		const safeEvents = events.filter((event) => event != null);
		const [visibleLimit, setVisibleLimit] = useState(INITIAL_VISIBLE_EVENTS);
		const genreFrequency = buildGenreFrequency(safeEvents);
		const shouldBlurHalf =
			isAuthResolved && !isAuthenticated && safeEvents.length > 2;
		const visibleEventsCount = shouldBlurHalf
			? Math.ceil(safeEvents.length / 2)
			: safeEvents.length;
		const allVisibleEvents = safeEvents.slice(0, visibleEventsCount);
		const visibleEvents = allVisibleEvents.slice(0, visibleLimit);
		const hasMoreVisibleEvents = visibleLimit < allVisibleEvents.length;
		const lockedEvents = shouldBlurHalf
			? safeEvents.slice(visibleEventsCount)
			: [];
		const sortModeControl = (
			<div
				className="inline-flex h-7 w-full items-center rounded-full border border-border/75 bg-background/62 p-0.5 shadow-[0_1px_0_rgba(255,255,255,0.55)_inset] sm:w-auto"
				aria-label="Sort events"
				role="group"
			>
				<span className="sr-only">Sort events</span>
				{eventSortOptions.map((option) => {
					const isSelected = option.value === sortMode;
					return (
						<button
							key={option.value}
							type="button"
							onClick={() => onSortModeChange(option.value)}
							aria-pressed={isSelected}
							className={`h-6 flex-1 rounded-full px-3 text-xs transition-colors max-[340px]:px-2 sm:flex-none ${
								isSelected
									? "bg-foreground text-background shadow-sm"
									: "text-muted-foreground hover:bg-accent hover:text-foreground"
							}`}
						>
							<span className="sm:hidden">{option.shortLabel}</span>
							<span className="hidden sm:inline">{option.label}</span>
						</button>
					);
				})}
			</div>
		);
		const filterButtonControl = (
			<FilterButton
				onClickAction={onFilterClickAction}
				hasActiveFilters={hasActiveFilters}
				activeFiltersCount={activeFiltersCount}
				className="h-7 min-h-7 w-full shrink-0 rounded-full px-3 text-xs sm:w-auto max-[340px]:px-0 [&_span[data-filter-label]]:max-[340px]:sr-only [&_svg]:max-[340px]:mr-0"
				size="sm"
			/>
		);
		const clearFiltersControl = hasActiveFilters ? (
			<ClearFiltersButton
				onClick={onClearFilters}
				className="h-7 shrink-0 px-3 max-[340px]:px-2"
			/>
		) : null;
		const isNearbyActive = sortMode === "nearby";
		const nearbyButtonControl = (
			<Button
				type="button"
				variant="outline"
				onClick={onNearbyClick}
				disabled={nearbyEventsStatus === "requesting"}
				aria-pressed={isNearbyActive}
				className={`h-7 w-full shrink-0 rounded-full px-3 text-xs sm:w-auto max-[340px]:px-0 ${
					isNearbyActive
						? "border-foreground bg-foreground text-background hover:bg-foreground/90"
						: "border-border/75 bg-background/70"
				}`}
				size="sm"
			>
				<LocateFixed className="mr-1.5 h-3.5 w-3.5 max-[340px]:mr-0" />
				<span className="max-[340px]:sr-only">
					{nearbyEventsStatus === "requesting" ? "Locating" : "Near me"}
				</span>
			</Button>
		);
		const savedButtonControl = (
			<Button
				type="button"
				variant="outline"
				onClick={() => onSavedOnlyChange(!showSavedOnly)}
				aria-pressed={showSavedOnly}
				className={`h-7 w-full shrink-0 rounded-full px-3 text-xs sm:w-auto max-[340px]:px-0 ${
					showSavedOnly
						? "border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800 dark:border-emerald-400 dark:bg-emerald-400 dark:text-emerald-950 dark:hover:bg-emerald-300"
						: "border-border/75 bg-background/70"
				}`}
				size="sm"
			>
				<BookmarkCheck className="mr-1.5 h-3.5 w-3.5 max-[340px]:mr-0" />
				<span className="max-[340px]:sr-only">
					Saved{savedEventsCount > 0 ? ` ${savedEventsCount}` : ""}
				</span>
			</Button>
		);

		return (
			<Card ref={ref} className="ooo-site-card mt-6 min-w-0 py-0 lg:mt-0">
				<CardHeader className="min-w-0 border-b border-border/70 py-5">
					<div className="flex min-w-0 flex-col gap-3">
						<div className="flex items-start justify-between gap-3">
							<div className="flex min-w-0 flex-col">
								<div className="flex items-center">
									<CardTitle className="flex items-center gap-2 text-2xl [font-family:var(--ooo-font-display)] font-light tracking-[0.01em]">
										<CalendarDays
											className="h-5.5 w-5.5 shrink-0 text-muted-foreground/75"
											strokeWidth={1.6}
										/>
										<span>Events</span>
									</CardTitle>
								</div>
							</div>
							<div className="hidden shrink-0 items-center gap-2 lg:flex">
								{savedButtonControl}
								{nearbyButtonControl}
								{sortModeControl}
							</div>
							<div className="hidden shrink-0 items-center gap-2 sm:flex lg:hidden">
								{clearFiltersControl}
								{filterButtonControl}
								{savedButtonControl}
								{nearbyButtonControl}
								{sortModeControl}
							</div>
						</div>
						<Link
							href={`${basePath}/submit-event`}
							onClick={() =>
								trackNavigationClick({
									group: "homepage_link",
									label: "submit_event_all_events",
								})
							}
							className="max-w-full text-xs leading-tight text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground sm:text-sm"
						>
							Hosting something special? Put it on the map with the collective
							and submit <span className="whitespace-nowrap">your event →</span>
						</Link>
						{searchSlot ? <div className="min-w-0 pt-1">{searchSlot}</div> : null}
						<div className="grid max-w-full min-w-0 grid-cols-2 items-center gap-2 sm:hidden">
							{clearFiltersControl}
							{filterButtonControl}
							{savedButtonControl}
							{nearbyButtonControl}
							{sortModeControl}
						</div>
						{showSavedOnly && (
							<p className="text-xs leading-relaxed text-muted-foreground">
								Showing events you saved on this device or account.
							</p>
						)}
						{pendingSavedMutationCount > 0 && (
							<p className="text-xs leading-relaxed text-muted-foreground">
								{pendingSavedMutationCount} saved change
								{pendingSavedMutationCount === 1 ? "" : "s"}{" "}
								{pendingSavedMutationStatus === "offline"
									? "will sync when you’re back online."
									: "will retry account sync shortly."}
							</p>
						)}
						{isNearbyActive || nearbyEventsError ? (
							<p className="text-xs leading-relaxed text-muted-foreground">
								{isNearbyActive
									? `Ordered by distance: ${nearbyMatchedEventsCount} event${
											nearbyMatchedEventsCount === 1 ? "" : "s"
										} with trusted coordinates nearest to ${
											nearbyEventsStatus === "active-last-known"
												? "your last known location"
												: "you"
										}${
											nearbyEventsStatus === "active-last-known"
												? " from this device."
												: "."
										}`
									: nearbyEventsError}
							</p>
						) : null}
					</div>
				</CardHeader>
				<CardContent className="py-5">
					{visibleEvents.length === 0 ? (
						<div className="rounded-xl border border-dashed border-border/80 bg-background/45 px-4 py-10 text-center">
							<div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-background/70 text-muted-foreground">
								<SearchX className="h-4 w-4" />
							</div>
							<h3 className="mt-4 text-lg [font-family:var(--ooo-font-display)] font-light text-foreground">
								{showSavedOnly
									? "No saved events in this view"
									: "No events match this view"}
							</h3>
							<p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
								{showSavedOnly
									? "Save events from their detail modal, or clear filters if your saved events are hidden."
									: "Try a broader search, remove a chip, or clear filters to bring the full list back."}
							</p>
							{showSavedOnly && (
								<Button
									type="button"
									variant="outline"
									onClick={() => onSavedOnlyChange(false)}
									className="mt-4 h-8 rounded-full px-4"
								>
									Show all events
								</Button>
							)}
							{hasActiveFilters && (
								<ClearFiltersButton
									onClick={onClearFilters}
									className="mt-4 h-8 rounded-full px-4"
								/>
							)}
						</div>
					) : (
						<div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
							{visibleEvents.map((event, index) => (
								<div
									key={event.id}
									id={index === 0 ? "tour-first-event-card" : undefined}
									className="h-full"
								>
									<EventCard
										event={event}
										onClick={onEventClick}
										socialProofMode={socialProofDisplayModes.get(
											event.eventKey,
										)}
										genreFrequency={genreFrequency}
										isSaved={isEventSaved(event.eventKey)}
										proximityLabel={
											isNearbyActive ? formatProximityLabel(event) : undefined
										}
									/>
								</div>
							))}
						</div>
					)}

					{hasMoreVisibleEvents && (
						<div className="mt-5 flex justify-center">
							<Button
								type="button"
								variant="outline"
								onClick={() =>
									setVisibleLimit((current) =>
										Math.min(
											current + VISIBLE_EVENTS_INCREMENT,
											allVisibleEvents.length,
										),
									)
								}
								className="h-9 rounded-full border-border/75 bg-background/70 px-4 text-sm"
							>
								Show more events
								<span className="ml-1 text-muted-foreground">
									({visibleEvents.length}/{allVisibleEvents.length})
								</span>
							</Button>
						</div>
					)}

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
								<div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
									{lockedEvents.map((event) => (
										<div
											key={event.id}
											className="pointer-events-none select-none opacity-60 blur-[4px] saturate-[0.9]"
											aria-hidden="true"
										>
											<EventCard
												event={event}
												onClick={onEventClick}
												socialProofMode={socialProofDisplayModes.get(
													event.eventKey,
												)}
												genreFrequency={genreFrequency}
												isSaved={isEventSaved(event.eventKey)}
											/>
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
