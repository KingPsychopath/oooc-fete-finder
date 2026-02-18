"use client";
import { shouldDisplayFeaturedEvent } from "@/features/events/featured/utils/timestamp-utils";
import { Badge } from "@/components/ui/badge";
import { clientLog } from "@/lib/platform/client-logger";
import {
	type Event,
	MUSIC_GENRES,
	NATIONALITIES,
	formatAge,
	formatDayWithDate,
	formatPrice,
	getDayNightPeriod,
} from "@/features/events/types";
import {
	Building2,
	Clock,
	Crown,
	Euro,
	MapPin,
	Moon,
	Sparkles,
	Star,
	Sun,
	Trees,
	Users,
} from "lucide-react";

type EventCardProps = {
	event: Event;
	onClick: (event: Event) => void;
};

/**
 * Reusable EventCard component used across Featured Events and All Events
 * Implements the improved visual hierarchy with priority badge system
 */
export function EventCard({ event, onClick }: EventCardProps) {
	const handleClick = () => {
		if (!event || !onClick) {
			clientLog.warn("event-card", "Missing event or onClick handler");
			return;
		}
		onClick(event);
	};

	// Defensive check for event
	if (!event) {
		return null;
	}

	// Check if event should display as featured (with expiration logic)
	const isCurrentlyFeatured = shouldDisplayFeaturedEvent(event);
	const hasOOOCPick = event.isOOOCPick === true;
	const dayNightPeriod = getDayNightPeriod(event.time ?? "");
	const venueTypes =
		event.venueTypes && event.venueTypes.length > 0 ?
			[...new Set(event.venueTypes)]
		:	[event.indoor ? "indoor" : "outdoor"];

	const cardClasses = `group relative cursor-pointer rounded-xl border p-4 transition-all duration-300 hover:-translate-y-[1px] hover:shadow-lg ${
		isCurrentlyFeatured
			? "border-amber-300/75 bg-[linear-gradient(145deg,rgba(248,238,222,0.86),rgba(244,229,205,0.72))] dark:border-amber-500/40 dark:bg-[linear-gradient(145deg,rgba(65,49,30,0.45),rgba(47,36,24,0.32))]"
			: event.isOOOCPick === true
				? "border-border/90 bg-[linear-gradient(145deg,rgba(247,241,231,0.82),rgba(242,235,224,0.68))] dark:bg-[linear-gradient(145deg,rgba(52,41,31,0.36),rgba(42,33,26,0.28))]"
				: "border-border/85 bg-card/72 hover:bg-card/88"
	}`;

	return (
		<div className={cardClasses} onClick={handleClick}>
			{/* Priority Badge System - Featured takes precedence over OOOC Pick */}
			{isCurrentlyFeatured ? (
				<div className="absolute -top-2.5 -right-2.5 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-amber-200 bg-[linear-gradient(145deg,rgba(212,164,96,0.95),rgba(178,131,70,0.95))] text-sm shadow-lg dark:border-amber-500/40 dark:bg-[linear-gradient(145deg,rgba(184,140,79,0.85),rgba(141,100,49,0.88))]">
					<Sparkles className="h-4 w-4" />
				</div>
			) : hasOOOCPick ? (
				<div className="absolute -top-2.5 -right-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-amber-200/90 bg-[linear-gradient(145deg,rgba(242,219,176,0.95),rgba(221,196,148,0.95))] text-black shadow-md dark:border-amber-500/40 dark:bg-[linear-gradient(145deg,rgba(166,131,79,0.88),rgba(126,96,59,0.86))] dark:text-amber-100">
					<Star className="h-4 w-4 fill-current" />
				</div>
			) : null}

			{/* Header with proper overflow handling */}
			<div className="flex items-start justify-between gap-3 mb-2">
				<div className="flex items-center space-x-2 min-w-0 flex-1">
					<h3
						className={`min-w-0 flex-1 truncate text-sm leading-tight font-medium ${
							isCurrentlyFeatured
								? "text-foreground font-semibold"
								: ""
						}`}
					>
						{isCurrentlyFeatured && (
							<Crown className="mr-1 mb-0.5 inline h-3.5 w-3.5 text-amber-600 dark:text-amber-300" />
						)}
						{event.name}
						{/* Show OOOC star in title only when it doesn't have featured badge (since featured takes precedence in corner) */}
						{hasOOOCPick && !isCurrentlyFeatured && (
							<Star className="ml-1 mb-0.5 inline h-3.5 w-3.5 fill-current text-amber-500" />
						)}
					</h3>
				</div>
				<div className="flex items-center gap-1 flex-shrink-0 ml-auto">
					{/* Featured badge - show whenever event is currently featured, regardless of variant */}
					{isCurrentlyFeatured && (
						<Badge
							className={`border-0 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] ${
								hasOOOCPick
									? "bg-[linear-gradient(145deg,rgba(190,145,82,0.96),rgba(154,112,58,0.96))] text-amber-50"
									: "bg-[linear-gradient(145deg,rgba(204,159,93,0.96),rgba(167,122,67,0.96))] text-amber-50"
							}`}
						>
							<span className="inline-flex items-center gap-1">
								FEATURED
								{hasOOOCPick && <Star className="h-3 w-3 fill-current" />}
							</span>
						</Badge>
					)}
					<Badge variant="outline" className="text-xs">
						{event.arrondissement === "unknown"
							? "TBC"
							: `${event.arrondissement}e`}
					</Badge>
				</div>
			</div>

			{/* Event details */}
			<div className="text-sm text-muted-foreground space-y-1">
				<div className="flex items-center space-x-1">
					<Clock className="h-3 w-3 flex-shrink-0" />
					<span className="truncate">
						{event.time || "TBC"}
						{event.endTime && event.time !== "TBC" && <> - {event.endTime}</>} •{" "}
						{formatDayWithDate(event.day, event.date)}
					</span>
					{event.time && dayNightPeriod && (
						<span
							className="inline-flex flex-shrink-0 items-center text-muted-foreground"
							title={dayNightPeriod === "day" ? "Daytime event" : "Nighttime event"}
						>
							{dayNightPeriod === "day" ?
								<Sun className="h-3.5 w-3.5" />
							:	<Moon className="h-3.5 w-3.5" />}
						</span>
					)}
				</div>
				{event.location && event.location !== "TBA" && (
					<div className="flex items-center space-x-1">
						<MapPin className="h-3 w-3 flex-shrink-0" />
						<span className="truncate flex-1 min-w-0">{event.location}</span>
						<span className="inline-flex flex-shrink-0 items-center gap-1 text-muted-foreground">
							{venueTypes.includes("indoor") && (
								<span title="Indoor event">
									<Building2 className="h-3.5 w-3.5" />
								</span>
							)}
							{venueTypes.includes("outdoor") && (
								<span title="Outdoor event">
									<Trees className="h-3.5 w-3.5" />
								</span>
							)}
						</span>
					</div>
				)}
				{/* Price Display */}
				<div className="flex items-center space-x-1">
					<Euro className="h-3 w-3 flex-shrink-0" />
					<span
						className={`text-xs font-medium ${
							formatPrice(event.price) === "Free"
								? "text-green-600 dark:text-green-400"
								: "text-muted-foreground"
						}`}
					>
						{formatPrice(event.price)}
					</span>
				</div>
				{/* Age Display */}
				{event.age && (
					<div className="flex items-center space-x-1">
						<Users className="h-3 w-3 flex-shrink-0" />
						<span className="text-xs font-medium text-muted-foreground">
							{formatAge(event.age)}
						</span>
					</div>
				)}
			</div>

			{/* Badges */}
			<div className="flex flex-wrap gap-1 mt-2">
				<Badge variant="secondary" className="border border-border/70 bg-secondary/72 text-xs">
					{event.type}
				</Badge>
				{event.nationality &&
					event.nationality.map((nationality) => (
						<Badge key={nationality} variant="outline" className="border-border/75 bg-background/50 text-xs">
							{NATIONALITIES.find((n) => n.key === nationality)?.flag}{" "}
							{NATIONALITIES.find((n) => n.key === nationality)?.shortCode}
						</Badge>
					))}
				{event.genre.slice(0, 2).map((genre) => (
					<Badge key={genre} variant="outline" className="border-border/75 bg-background/50 text-xs">
						{MUSIC_GENRES.find((g) => g.key === genre)?.label || genre}
					</Badge>
				))}
			</div>
		</div>
	);
}
