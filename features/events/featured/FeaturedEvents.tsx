"use client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSavedEvents } from "@/features/events/components/saved-events-provider";
import { trackEventEngagement } from "@/features/events/engagement/client-tracking";
import { toGenreLabel } from "@/features/events/genre-normalization";
import {
	formatRecentlyAddedLabel,
	isRecentlyAddedEvent,
} from "@/features/events/recently-added";
import {
	formatRecentlyUpdatedLabel,
	isRecentlyUpdatedEvent,
} from "@/features/events/recently-updated";
import {
	type Event,
	MUSIC_GENRES,
	NATIONALITIES,
	formatAge,
	formatDayWithDate,
	formatPrice,
	getEventDisplayDayNightPeriod,
	getEventLocationDisplay,
	getPartyEventTypeLabel,
	getPriceMeta,
} from "@/features/events/types";
import { useAppHaptics } from "@/hooks/useAppHaptics";
import { cn } from "@/lib/utils";
import {
	ArrowUpRight,
	BookmarkCheck,
	Building2,
	CalendarDays,
	ChevronDown,
	Clock,
	Crown,
	Euro,
	MapPin,
	Megaphone,
	Moon,
	Star,
	Sun,
	Trees,
	Users,
} from "lucide-react";
import {
	FeaturedEventsHeader,
	FeaturedEventsSpotlightLink,
} from "./components/FeaturedEventsHeader";
import { FEATURED_EVENTS_CONFIG } from "./constants";
import { useFeaturedEvents } from "./hooks/use-featured-events";
import type { FeaturedEventsProps } from "./types";

type SpotlightEventPanelProps = {
	event: Event;
	isDominant?: boolean;
	isSaved: boolean;
	onClick: (event: Event) => void;
};

function SpotlightEventPanel({
	event,
	isDominant = false,
	isSaved,
	onClick,
}: SpotlightEventPanelProps) {
	const visibleEventType = getPartyEventTypeLabel(event.type);
	const visibleGenres = event.genre.slice(0, 2);
	const hiddenGenreCount = Math.max(
		0,
		event.genre.length - visibleGenres.length,
	);
	const priceLabel = formatPrice(event.price);
	const priceMeta = getPriceMeta(event.price);
	const locationDisplay = getEventLocationDisplay(event);
	const areaLabel = locationDisplay.areaShortLabel;
	const cardLocationLabel =
		locationDisplay.state === "multiple-unlisted"
			? undefined
			: locationDisplay.cardLabel;
	const isFeaturedPlacement = event.isFeatured === true;
	const isOOOCPick = event.isOOOCPick === true;
	const isPromoted = event.isPromoted === true;
	const hasPlacementBadge = isFeaturedPlacement || isPromoted || isOOOCPick;
	const isNewlyAdded = isRecentlyAddedEvent(event);
	const isRecentlyUpdated = !isNewlyAdded && isRecentlyUpdatedEvent(event);
	const recentlyAddedLabel = formatRecentlyAddedLabel(event);
	const recentlyUpdatedLabel = formatRecentlyUpdatedLabel(event);
	const dayNightPeriod = getEventDisplayDayNightPeriod(event);
	const venueTypes =
		event.venueTypes && event.venueTypes.length > 0
			? [...new Set(event.venueTypes)]
			: [event.indoor ? "indoor" : "outdoor"];
	const hasNationalities = Boolean(event.nationality?.length);
	const statusSurfaceClassName = isFeaturedPlacement
		? "border-amber-300/22 shadow-[0_22px_52px_-58px_rgba(151,111,61,0.24),0_0_14px_-26px_rgba(255,221,148,0.22),inset_0_1px_0_rgba(255,255,255,0.46)] hover:border-amber-300/34 hover:shadow-[0_28px_60px_-60px_rgba(151,111,61,0.3),0_0_18px_-26px_rgba(255,221,148,0.28),inset_0_1px_0_rgba(255,255,255,0.52)] dark:border-amber-200/12 dark:shadow-[0_22px_52px_-58px_rgba(224,169,85,0.16),0_0_14px_-27px_rgba(255,218,145,0.1),inset_0_1px_0_rgba(255,255,255,0.045)]"
		: isPromoted
			? "border-[#315b5f]/16 shadow-[0_22px_52px_-60px_rgba(49,91,95,0.22),0_0_12px_-26px_rgba(123,207,209,0.15),inset_0_1px_0_rgba(255,255,255,0.42)] hover:border-[#315b5f]/26 hover:shadow-[0_28px_58px_-62px_rgba(49,91,95,0.28),0_0_16px_-26px_rgba(123,207,209,0.2),inset_0_1px_0_rgba(255,255,255,0.48)] dark:border-cyan-100/9 dark:shadow-[0_22px_52px_-60px_rgba(49,91,95,0.16),0_0_12px_-26px_rgba(103,202,205,0.1),inset_0_1px_0_rgba(255,255,255,0.04)]"
			: isOOOCPick
				? "border-amber-300/12 shadow-[0_20px_48px_-62px_rgba(151,111,61,0.18),inset_0_1px_0_rgba(255,255,255,0.42)] hover:border-amber-300/20 hover:shadow-[0_26px_54px_-62px_rgba(151,111,61,0.22),inset_0_1px_0_rgba(255,255,255,0.48)] dark:border-amber-200/8 dark:shadow-[0_20px_48px_-62px_rgba(224,169,85,0.1),inset_0_1px_0_rgba(255,255,255,0.035)]"
				: "border-border/22 shadow-[0_18px_46px_-60px_rgba(44,28,12,0.26),inset_0_1px_0_rgba(255,255,255,0.36)] hover:border-border/34 hover:shadow-[0_24px_52px_-62px_rgba(44,28,12,0.26),inset_0_1px_0_rgba(255,255,255,0.42)] dark:border-border/14 dark:shadow-[0_18px_46px_-60px_rgba(0,0,0,0.62),inset_0_1px_0_rgba(255,255,255,0.035)]";
	const statusGlowClassName = isFeaturedPlacement
		? "from-amber-100/16 via-amber-50/5"
		: isPromoted
			? "from-[#d7e7e6]/14 via-cyan-50/4"
			: isOOOCPick
				? "from-amber-100/10 via-amber-50/4"
				: "from-white/12 via-amber-50/4";
	const statusAccentClassName = isPromoted
		? "border-cyan-300/28 dark:border-cyan-100/16"
		: isOOOCPick
			? "border-amber-300/24 dark:border-amber-100/14"
			: isFeaturedPlacement
				? "border-amber-300/38 dark:border-amber-100/2"
				: "border-border/18 dark:border-border/12";
	const placementBadgeClassName = isFeaturedPlacement
		? "border-amber-400/30 bg-amber-400/12 text-amber-900 hover:bg-amber-400/12 dark:text-amber-100"
		: isPromoted
			? "border-[#213f43]/18 bg-[#213f43]/10 text-[#213f43] hover:bg-[#213f43]/10 dark:border-cyan-100/14 dark:bg-cyan-100/8 dark:text-cyan-100"
			: "border-amber-400/28 bg-amber-400/12 text-amber-900 hover:bg-amber-400/12 dark:text-amber-100";
	const PlacementBadgeIcon = isFeaturedPlacement
		? Crown
		: isPromoted
			? Megaphone
			: Star;
	return (
		<button
			type="button"
			onClick={() => onClick(event)}
			className={cn(
				"group relative flex min-h-[15rem] w-full flex-col overflow-hidden rounded-2xl border bg-card/58 p-4 text-left backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:bg-card/72 focus-visible:ring-2 focus-visible:ring-ring/60 dark:bg-card/42 dark:hover:bg-card/54",
				statusSurfaceClassName,
			)}
		>
			<div
				className="pointer-events-none absolute inset-0 rounded-2xl"
				aria-hidden="true"
			>
				<div className="absolute inset-0 rounded-2xl bg-[image:var(--ooo-grain-image)] bg-[length:220px_220px] opacity-[0.055] mix-blend-multiply dark:opacity-[0.04] dark:mix-blend-screen" />
				<div
					className={cn(
						"absolute inset-x-5 top-12 h-24 rounded-full bg-gradient-to-b to-transparent blur-2xl",
						statusGlowClassName,
					)}
				/>
				<div
					className={cn(
						"absolute -top-10 -right-10 h-32 w-32 rounded-full border-t border-r [mask-image:linear-gradient(135deg,transparent_0%,black_36%,black_62%,transparent_84%)]",
						statusAccentClassName,
					)}
				/>
				{isFeaturedPlacement && (
					<>
						<div className="absolute top-6 right-8 h-px w-12 rotate-[-18deg] bg-gradient-to-r from-transparent via-amber-100/64 to-transparent opacity-70 dark:via-amber-50/38" />
						<div className="absolute right-7 top-4 h-1 w-1 rounded-full bg-amber-100/76 shadow-[0_0_12px_3px_rgba(255,221,148,0.36)] dark:bg-amber-100/48 dark:shadow-[0_0_10px_3px_rgba(255,221,148,0.2)]" />
					</>
				)}
				{isPromoted && (
					<div className="absolute inset-y-5 left-0 w-px bg-gradient-to-b from-transparent via-cyan-300/36 to-transparent dark:via-cyan-100/18" />
				)}
				{isDominant && (
					<div className="absolute bottom-7 left-[70%] top-8 hidden border-l border-dashed border-foreground/22 lg:block dark:border-white/18" />
				)}
			</div>
			{hasPlacementBadge && (
				<Badge
					className={cn(
						"pointer-events-none absolute right-3 top-3 z-[2] flex h-8 w-8 rounded-full border p-0 shadow-none backdrop-blur transition-transform duration-300 group-hover:scale-105",
						placementBadgeClassName,
					)}
					aria-hidden="true"
				>
					<PlacementBadgeIcon
						className={cn("h-3 w-3", isOOOCPick && "fill-current")}
					/>
				</Badge>
			)}
			<div className="relative flex items-start justify-between gap-3">
				<div
					className={cn(
						"flex min-w-0 flex-wrap items-center gap-1.5",
						hasPlacementBadge && "pr-10",
					)}
				>
					{visibleEventType && (
						<Badge className="border border-border/55 bg-background/56 px-2 text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/72 shadow-none hover:bg-background/56">
							<Clock className="h-3 w-3" />
							{visibleEventType}
						</Badge>
					)}
					{isOOOCPick && (
						<Badge className="border border-amber-400/28 bg-amber-400/12 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-900 shadow-none hover:bg-amber-400/12 dark:text-amber-100">
							<Star className="h-3 w-3 fill-current" />
							OOOC Pick
						</Badge>
					)}
					{isPromoted && (
						<Badge className="border border-[#213f43]/18 bg-[#213f43]/10 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#213f43] shadow-none hover:bg-[#213f43]/10 dark:border-cyan-100/14 dark:bg-cyan-100/8 dark:text-cyan-100">
							<Megaphone className="h-3 w-3" />
							Promoted
						</Badge>
					)}
					{isSaved && (
						<Badge className="border border-emerald-500/24 bg-emerald-500/10 px-2 text-[10px] font-medium uppercase tracking-[0.12em] text-emerald-800 shadow-none hover:bg-emerald-500/10 dark:text-emerald-100">
							<BookmarkCheck className="h-3 w-3" />
							Saved
						</Badge>
					)}
					{isNewlyAdded && (
						<Badge
							className="border border-emerald-500/30 bg-emerald-500/10 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-800 shadow-none hover:bg-emerald-500/15 dark:text-emerald-200"
							title={recentlyAddedLabel}
						>
							New
						</Badge>
					)}
					{isRecentlyUpdated && (
						<Badge
							className="border border-sky-500/30 bg-sky-500/10 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-800 shadow-none hover:bg-sky-500/15 dark:text-sky-200"
							title={recentlyUpdatedLabel}
						>
							Updated
						</Badge>
					)}
				</div>
			</div>

			<div className="relative mt-5 flex flex-1 flex-col justify-between gap-5">
				<div className={cn(isDominant && "lg:w-[68%] lg:pr-4")}>
					<h3
						className={cn(
							"line-clamp-2 text-3xl leading-[0.98] [font-family:var(--ooo-font-display)] font-light tracking-[0.01em] text-foreground sm:text-4xl lg:text-[2.35rem]",
							isFeaturedPlacement &&
								"[text-shadow:0_1px_0_rgba(255,255,255,0.18)] dark:[text-shadow:0_1px_0_rgba(255,255,255,0.06)]",
						)}
					>
						{event.name}
					</h3>
					<div className="mt-4 grid gap-2 text-sm text-muted-foreground">
						<div className="flex min-w-0 items-center gap-2">
							<CalendarDays className="h-4 w-4 shrink-0 text-amber-800/70 dark:text-amber-100/60" />
							<span className="min-w-0 truncate">
								{formatDayWithDate(event.day, event.date)}
								{" · "}
								{event.time || "TBC"}
								{event.endTime && event.time !== "TBC" && (
									<> - {event.endTime}</>
								)}
							</span>
							{event.time && dayNightPeriod && (
								<span
									className="inline-flex shrink-0 items-center text-muted-foreground"
									title={
										dayNightPeriod === "day"
											? "Daytime and early evening"
											: "Late start or runs into the night"
									}
								>
									{dayNightPeriod === "day" ? (
										<Sun className="h-4 w-4" />
									) : (
										<Moon className="h-4 w-4" />
									)}
								</span>
							)}
						</div>
						{(cardLocationLabel || areaLabel) && (
							<div
								className={cn(
									"flex min-w-0 max-w-full items-center gap-2",
									isDominant && "lg:max-w-none",
								)}
							>
								<MapPin className="h-4 w-4 shrink-0 text-amber-800/70 dark:text-amber-100/60" />
								<span className="inline-flex min-w-0 flex-1 items-center gap-1.5">
									{cardLocationLabel && (
										<span className="min-w-0 truncate">
											{cardLocationLabel}
										</span>
									)}
									{cardLocationLabel && areaLabel && (
										<span className="shrink-0 text-muted-foreground/58">·</span>
									)}
									{areaLabel && (
										<span className="shrink-0 text-muted-foreground">
											{areaLabel}
										</span>
									)}
								</span>
								<span className="ml-auto inline-flex shrink-0 items-center gap-1 text-muted-foreground">
									{venueTypes.includes("indoor") && (
										<span title="Indoor event">
											<Building2 className="h-4 w-4" />
										</span>
									)}
									{venueTypes.includes("outdoor") && (
										<span title="Outdoor event">
											<Trees className="h-4 w-4" />
										</span>
									)}
								</span>
							</div>
						)}
						<div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
							<span className="inline-flex items-center gap-2">
								<Euro className="h-4 w-4 shrink-0 text-amber-800/70 dark:text-amber-100/60" />
								<span
									className={`text-xs font-medium ${
										priceMeta.kind === "free"
											? "text-green-600 dark:text-green-400"
											: priceMeta.kind === "free_option"
												? "text-amber-700 dark:text-amber-300"
												: "text-muted-foreground"
									}`}
								>
									{priceLabel}
								</span>
							</span>
							{event.age && (
								<span className="inline-flex items-center gap-2">
									<Users className="h-4 w-4 shrink-0 text-amber-800/70 dark:text-amber-100/60" />
									<span className="text-xs font-medium text-muted-foreground">
										{formatAge(event.age)}
									</span>
								</span>
							)}
						</div>
					</div>
				</div>

				<div className="flex flex-wrap items-center gap-1.5">
					{hasNationalities &&
						event.nationality?.map((nationality) => (
							<Badge
								key={nationality}
								variant="outline"
								className="border-border/50 bg-background/38 text-xs text-foreground/76"
							>
								{NATIONALITIES.find((n) => n.key === nationality)?.flag}{" "}
								{NATIONALITIES.find((n) => n.key === nationality)?.shortCode}
							</Badge>
						))}
					{visibleGenres.map((genre) => (
						<Badge
							key={genre}
							variant="outline"
							className="border-border/50 bg-background/38 text-xs text-foreground/76"
						>
							{MUSIC_GENRES.find((g) => g.key === genre)?.label ||
								toGenreLabel(genre)}
						</Badge>
					))}
					{hiddenGenreCount > 0 && (
						<Badge
							variant="outline"
							className="border-border/45 bg-background/28 text-xs text-muted-foreground"
						>
							+{hiddenGenreCount}
						</Badge>
					)}
					<span className="ml-auto hidden items-center gap-1 text-xs font-medium text-foreground/70 transition-colors group-hover:text-foreground sm:inline-flex">
						View details
						<ArrowUpRight className="h-3.5 w-3.5" />
					</span>
				</div>
			</div>
		</button>
	);
}

/**
 * FeaturedEvents component displays a curated selection of events
 * Prioritizes manually featured events, then fills remaining slots with OOOC picks and regular events
 * Uses deterministic shuffling to avoid hydration errors
 */
export function FeaturedEvents({
	events,
	onEventClick,
	onScrollToAllEvents,
	maxFeaturedEvents = FEATURED_EVENTS_CONFIG.MAX_FEATURED_EVENTS,
	dateRange,
	rotationContext,
}: FeaturedEventsProps) {
	const { featuredEvents, totalEventsCount, hasMoreEvents } = useFeaturedEvents(
		events,
		maxFeaturedEvents,
		dateRange,
		rotationContext,
	);
	const { isEventSaved } = useSavedEvents();
	const haptics = useAppHaptics();
	if (featuredEvents.length === 0) {
		return null;
	}

	const browseAllLabel = `Browse All ${totalEventsCount} Event${totalEventsCount !== 1 ? "s" : ""}`;
	const handleSpotlightEventClick = (
		event: (typeof featuredEvents)[number],
	) => {
		haptics.selection();
		trackEventEngagement({
			eventKey: event.eventKey,
			actionType: "click",
			source: `spotlight:${rotationContext.bucket}:${rotationContext.eventPhase}:${rotationContext.cadence}`,
		});
		onEventClick(event);
	};

	return (
		<section className="relative mb-10 overflow-visible border-t border-border/45 pt-6">
			<div className="pointer-events-none absolute inset-0" aria-hidden="true">
				<div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/22 to-transparent dark:via-amber-100/12" />
				<div className="absolute -top-10 left-0 h-32 w-1/2 bg-[radial-gradient(ellipse_at_12%_0%,rgba(240,182,104,0.09),transparent_70%)] blur-xl dark:opacity-60" />
			</div>
			<div className="relative">
				<div
					className="pointer-events-none absolute bottom-0 left-0 top-12 hidden w-8 items-center justify-center border-l border-border/24 lg:flex dark:border-border/14"
					aria-hidden="true"
				>
					<span className="-rotate-90 whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.28em] text-foreground/34 dark:text-foreground/28">
						Current favourites
					</span>
				</div>
				<div className="lg:pl-12">
					<div className="mb-5">
						<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
							<div className="min-w-0">
								<FeaturedEventsHeader rotationContext={rotationContext} />
								<div className="hidden sm:block">
									<FeaturedEventsSpotlightLink />
								</div>
							</div>
							{hasMoreEvents && (
								<div className="hidden sm:block sm:shrink-0">
									<Button
										variant="outline"
										onClick={() => {
											haptics.nudge();
											onScrollToAllEvents();
										}}
										className="h-auto min-h-8 w-full whitespace-normal rounded-full border-border/70 bg-background/55 px-3 py-2 text-center leading-tight text-foreground/85 hover:bg-accent sm:h-8 sm:w-auto sm:whitespace-nowrap"
									>
										{browseAllLabel}
										<ChevronDown className="ml-1 h-4 w-4" />
									</Button>
								</div>
							)}
						</div>
					</div>
					<div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,1fr)]">
						{featuredEvents.map((event, index) => (
							<SpotlightEventPanel
								key={event.eventKey || event.id}
								event={event}
								isDominant={index === 0}
								onClick={handleSpotlightEventClick}
								isSaved={isEventSaved(event.eventKey)}
							/>
						))}
					</div>
					<div className="mt-4 flex flex-col gap-3 sm:hidden">
						<FeaturedEventsSpotlightLink />
						{hasMoreEvents && (
							<div className="sm:shrink-0">
								<Button
									variant="outline"
									onClick={() => {
										haptics.nudge();
										onScrollToAllEvents();
									}}
									className="h-auto min-h-8 w-full whitespace-normal rounded-full border-border/70 bg-background/55 px-3 py-2 text-center leading-tight text-foreground/85 hover:bg-accent sm:h-8 sm:w-auto sm:whitespace-nowrap"
								>
									{browseAllLabel}
									<ChevronDown className="ml-1 h-4 w-4" />
								</Button>
							</div>
						)}
					</div>
				</div>
			</div>
		</section>
	);
}
