"use client";
import { Badge } from "@/components/ui/badge";
import { shouldDisplayFeaturedEvent } from "@/features/events/featured/utils/timestamp-utils";
import { toGenreLabel } from "@/features/events/genre-normalization";
import {
	type GenreFrequency,
	getGenrePreview,
} from "@/features/events/genre-preview";
import { isRecentlyAddedEvent } from "@/features/events/recently-added";
import { isRecentlyUpdatedEvent } from "@/features/events/recently-updated";
import {
	type SocialProofDisplayMode,
	shouldShowSocialProofBadge,
} from "@/features/events/social-proof";
import {
	type DayNightPeriod,
	type Event,
	MUSIC_GENRES,
	NATIONALITIES,
	formatAge,
	formatDayWithDate,
	getEventExperienceCategoryDefinition,
	formatLocationAreaShort,
	formatPrice,
	getEventDisplayDayNightPeriod,
	getPriceMeta,
	getVisibleEventTypeLabel,
} from "@/features/events/types";
import { useAppHaptics } from "@/hooks/useAppHaptics";
import { clientLog } from "@/lib/platform/client-logger";
import {
	BookmarkCheck,
	Building2,
	Clock,
	Crown,
	Euro,
	Flame,
	LocateFixed,
	MapPin,
	Moon,
	Star,
	Sun,
	Tag,
	Trees,
	Users,
} from "lucide-react";

type EventCardProps = {
	event: Event;
	onClick: (event: Event) => void;
	socialProofMode?: SocialProofDisplayMode;
	genreFrequency?: GenreFrequency;
	isSaved?: boolean;
	proximityLabel?: string;
	preferredDayNightPeriods?: DayNightPeriod[];
};

/**
 * Reusable EventCard component used across Featured Events and All Events
 * Implements the improved visual hierarchy with priority badge system
 */
export function EventCard({
	event,
	onClick,
	socialProofMode,
	genreFrequency,
	isSaved = false,
	proximityLabel,
	preferredDayNightPeriods,
}: EventCardProps) {
	const haptics = useAppHaptics();
	const handleClick = () => {
		if (!event || !onClick) {
			clientLog.warn("event-card", "Missing event or onClick handler");
			return;
		}
		haptics.selection();
		onClick(event);
	};

	// Defensive check for event
	if (!event) {
		return null;
	}

	// Check if event should display as featured (with expiration logic)
	const isCurrentlyFeatured = shouldDisplayFeaturedEvent(event);
	const priceLabel = formatPrice(event.price);
	const priceMeta = getPriceMeta(event.price);
	const isCurrentlyPromoted = event.isPromoted === true;
	const isNewlyAdded = isRecentlyAddedEvent(event);
	const isRecentlyUpdated = !isNewlyAdded && isRecentlyUpdatedEvent(event);
	const hasOOOCPick = event.isOOOCPick === true;
	const eventCategoryDefinition = getEventExperienceCategoryDefinition(
		event.eventCategory,
	);
	const dayNightPeriod = getEventDisplayDayNightPeriod(
		event,
		preferredDayNightPeriods,
	);
	const visibleEventType = getVisibleEventTypeLabel(event.type);
	const headerEventTypeLabel =
		visibleEventType ?? (event.type === "Fete" ? "Fête" : null);
	const contextualPillLabel = eventCategoryDefinition?.key === "party"
		? headerEventTypeLabel
		: eventCategoryDefinition?.label;
	const shouldShowContextualPill = Boolean(contextualPillLabel);
	const contextualPillClassName = eventCategoryDefinition?.key === "party"
		? "border-border/70 bg-background/50 text-muted-foreground"
		: `${eventCategoryDefinition?.color ?? ""} hover:bg-background/60`;
	const contextualPillIcon = eventCategoryDefinition?.key === "party" ? (
		<Clock className="h-3 w-3" />
	) : (
		<Tag className="h-3 w-3" />
	);
	const categoryCardClasses =
		eventCategoryDefinition?.key === "activity"
			? "border-sky-300/24 bg-[linear-gradient(145deg,rgba(239,246,255,0.8),rgba(230,242,255,0.56))] hover:bg-[linear-gradient(145deg,rgba(240,247,255,0.9),rgba(233,246,255,0.64))] dark:border-sky-500/22 dark:bg-[linear-gradient(145deg,rgba(19,63,104,0.33),rgba(17,44,70,0.2))] dark:hover:bg-[linear-gradient(145deg,rgba(29,73,119,0.38),rgba(27,55,88,0.26))]"
			: eventCategoryDefinition?.key === "culture"
				? "border-violet-300/24 bg-[linear-gradient(145deg,rgba(248,245,255,0.8),rgba(238,232,250,0.56))] hover:bg-[linear-gradient(145deg,rgba(249,246,255,0.9),rgba(241,236,252,0.64))] dark:border-violet-500/22 dark:bg-[linear-gradient(145deg,rgba(57,43,90,0.28),rgba(39,30,66,0.2))] dark:hover:bg-[linear-gradient(145deg,rgba(73,53,106,0.34),rgba(51,39,81,0.28))]"
				: eventCategoryDefinition?.key === "food"
					? "border-emerald-300/24 bg-[linear-gradient(145deg,rgba(236,252,243,0.8),rgba(223,247,230,0.56))] hover:bg-[linear-gradient(145deg,rgba(239,253,246,0.9),rgba(230,250,236,0.64))] dark:border-emerald-500/22 dark:bg-[linear-gradient(145deg,rgba(30,74,51,0.28),rgba(23,58,39,0.2))] dark:hover:bg-[linear-gradient(145deg,rgba(35,90,62,0.34),rgba(27,67,45,0.26))]"
					: eventCategoryDefinition?.key === "wellness"
						? "border-amber-300/24 bg-[linear-gradient(145deg,rgba(255,250,236,0.8),rgba(255,243,220,0.56))] hover:bg-[linear-gradient(145deg,rgba(255,253,240,0.9),rgba(255,246,224,0.64))] dark:border-amber-500/22 dark:bg-[linear-gradient(145deg,rgba(84,64,30,0.28),rgba(63,46,17,0.2))] dark:hover:bg-[linear-gradient(145deg,rgba(95,72,32,0.34),rgba(73,53,22,0.26))]"
						: null;
	const socialProofSaveCount = event.socialProofSaveCount ?? 0;
	const socialProofHistoricalSaveCount =
		event.socialProofHistoricalSaveCount ?? 0;
	const savedLabel = socialProofSaveCount === 1 ? "person" : "people";
	const socialProofLabel =
		socialProofMode === "numeric"
			? `${socialProofSaveCount} ${savedLabel} saved this`
			: "People are saving this";
	const hasSocialProofBadge = shouldShowSocialProofBadge(
		socialProofMode,
		socialProofSaveCount,
		socialProofHistoricalSaveCount,
	);
	const areaLabel = formatLocationAreaShort(event.arrondissement);
	const { visibleGenres, hiddenGenreCount } = getGenrePreview(
		event.genre,
		genreFrequency,
	);
	const shouldFoldLastGenreIntoCount =
		hiddenGenreCount > 0 && visibleGenres.length > 1;
	const displayedGenres = shouldFoldLastGenreIntoCount
		? visibleGenres.slice(0, -1)
		: visibleGenres;
	const collapsedGenreCount =
		hiddenGenreCount + (shouldFoldLastGenreIntoCount ? 1 : 0);
	const hasMetadataBadges = Boolean(
		event.nationality?.length || displayedGenres.length || collapsedGenreCount,
	);
	const venueTypes =
		event.venueTypes && event.venueTypes.length > 0
			? [...new Set(event.venueTypes)]
			: [event.indoor ? "indoor" : "outdoor"];
	const cardClasses = `group relative h-full cursor-pointer rounded-xl border p-4 transition-all duration-300 hover:-translate-y-[1px] hover:shadow-lg ${
		isCurrentlyFeatured
			? "border-amber-300/48 bg-[linear-gradient(145deg,rgba(248,238,222,0.82),rgba(244,229,205,0.66))] shadow-[0_14px_30px_-29px_rgba(176,124,54,0.42)] dark:border-amber-500/24 dark:bg-[linear-gradient(145deg,rgba(65,49,30,0.38),rgba(47,36,24,0.28))] dark:shadow-[0_16px_34px_-31px_rgba(224,169,85,0.28)]"
			: event.isOOOCPick === true
				? "border-border/90 bg-[linear-gradient(145deg,rgba(247,241,231,0.82),rgba(242,235,224,0.68))] dark:bg-[linear-gradient(145deg,rgba(52,41,31,0.36),rgba(42,33,26,0.28))]"
				: isCurrentlyPromoted
					? "border-amber-500/45 bg-[linear-gradient(145deg,rgba(250,241,223,0.62),rgba(245,236,222,0.55))] dark:border-amber-600/45 dark:bg-[linear-gradient(145deg,rgba(80,60,36,0.34),rgba(58,43,27,0.28))]"
					: categoryCardClasses ??
						"border-border/85 bg-card/72 hover:bg-card/88"
	}`;

	return (
		<div className={cardClasses} onClick={handleClick}>
			{isCurrentlyFeatured && (
				<div
					className="pointer-events-none absolute inset-0 rounded-xl"
					aria-hidden="true"
				>
					<div className="absolute -top-5 -right-5 h-20 w-20 rounded-full border-t border-r border-amber-300/46 shadow-[8px_-8px_18px_-17px_rgba(177,121,45,0.68)] [mask-image:linear-gradient(135deg,transparent_0%,black_38%,black_62%,transparent_82%)] dark:border-amber-300/24 dark:shadow-[8px_-8px_18px_-17px_rgba(245,196,116,0.42)]" />
					<div className="absolute top-3 right-10 h-px w-9 rotate-[-18deg] bg-gradient-to-r from-transparent via-amber-200/60 to-transparent opacity-65 dark:via-amber-100/42" />
				</div>
			)}
			{/* Priority corner marker. Labels remain in the header row for readability. */}
			{isCurrentlyFeatured ? (
				<div className="absolute -top-2.5 -right-2.5 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-amber-200 bg-[linear-gradient(145deg,rgba(212,164,96,0.95),rgba(178,131,70,0.95))] text-sm shadow-lg dark:border-amber-500/40 dark:bg-[linear-gradient(145deg,rgba(184,140,79,0.85),rgba(141,100,49,0.88))]">
					<Crown className="h-4 w-4" />
				</div>
			) : hasOOOCPick ? (
				<div className="absolute -top-2.5 -right-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-amber-200/90 bg-[linear-gradient(145deg,rgba(242,219,176,0.95),rgba(221,196,148,0.95))] text-black shadow-md dark:border-amber-500/40 dark:bg-[linear-gradient(145deg,rgba(166,131,79,0.88),rgba(126,96,59,0.86))] dark:text-amber-100">
					<Star className="h-4 w-4 fill-current" />
				</div>
			) : null}

			{isSaved && !isCurrentlyFeatured && !hasOOOCPick && (
				<div
					className="absolute -top-2.5 -right-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-emerald-200/90 bg-emerald-50 text-emerald-700 shadow-md dark:border-emerald-500/40 dark:bg-emerald-950 dark:text-emerald-200"
					title="Saved event"
					aria-hidden="true"
				>
					<BookmarkCheck className="h-4 w-4" />
				</div>
			)}
			{/* Header with proper overflow handling */}
			<div className="mb-2 space-y-2">
				<div className="flex items-start justify-between gap-3">
					<div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
						{shouldShowContextualPill && contextualPillLabel && (
							<Badge
								variant="outline"
								className={`max-w-full px-2 text-[10px] font-semibold uppercase tracking-[0.12em] shadow-none hover:bg-background/60 ${contextualPillClassName}`}
							>
								<span className="inline-flex items-center gap-1">
									{contextualPillIcon}
									{contextualPillLabel}
								</span>
							</Badge>
						)}
						{!isCurrentlyFeatured && !isCurrentlyPromoted && hasOOOCPick && (
							<Badge className="border border-amber-400/28 bg-amber-400/12 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-900 shadow-none hover:bg-amber-400/12 dark:text-amber-100">
								<span className="inline-flex items-center gap-1">
									<Star className="h-3 w-3 fill-current" />
									OOOC Pick
								</span>
							</Badge>
						)}
						{isSaved && (
							<Badge className="max-w-full border border-emerald-500/30 bg-emerald-500/10 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-800 shadow-none hover:bg-emerald-500/15 dark:text-emerald-200">
								<span className="inline-flex items-center gap-1">
									<BookmarkCheck className="h-3 w-3" />
									Saved
								</span>
							</Badge>
						)}
						{isNewlyAdded && (
							<Badge className="max-w-full border border-emerald-500/30 bg-emerald-500/10 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-800 shadow-none hover:bg-emerald-500/15 dark:text-emerald-200">
								New
							</Badge>
						)}
						{isRecentlyUpdated && (
							<Badge className="max-w-full border border-sky-500/30 bg-sky-500/10 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-800 shadow-none hover:bg-sky-500/15 dark:text-sky-200">
								Updated
							</Badge>
						)}
					</div>
					<Badge
						variant="outline"
						className="max-w-[5rem] shrink-0 truncate border-border/70 bg-background/50 text-xs"
					>
						{areaLabel}
					</Badge>
				</div>
				<h3
					className={`min-w-0 truncate text-sm leading-tight font-medium ${
						isCurrentlyFeatured ? "text-foreground font-semibold" : ""
					}`}
				>
					{event.name}
				</h3>
			</div>

			{/* Event details */}
			<div className="text-sm text-muted-foreground space-y-1">
				<div className="flex items-center space-x-1">
					<Clock className="h-3 w-3 flex-shrink-0" />
					<span className="truncate">
						{formatDayWithDate(event.day, event.date)}
						{" • "}
						{event.time || "TBC"}
						{event.endTime && event.time !== "TBC" && <> - {event.endTime}</>}
					</span>
					{event.time && dayNightPeriod && (
						<span
							className="inline-flex flex-shrink-0 items-center text-muted-foreground"
							title={
								dayNightPeriod === "day"
									? "Daytime and early evening"
									: "Late start or runs into the night"
							}
						>
							{dayNightPeriod === "day" ? (
								<Sun className="h-3.5 w-3.5" />
							) : (
								<Moon className="h-3.5 w-3.5" />
							)}
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
				{proximityLabel && (
					<div className="flex items-center space-x-1 text-sky-800 dark:text-sky-200">
						<LocateFixed className="h-3 w-3 flex-shrink-0" />
						<span className="truncate text-xs font-medium">
							{proximityLabel}
						</span>
					</div>
				)}
				{/* Price Display */}
				<div className="flex items-center space-x-1">
					<Euro className="h-3 w-3 flex-shrink-0" />
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
			{hasMetadataBadges && (
				<div className="flex flex-wrap gap-1 mt-2">
					{event.nationality &&
						event.nationality.map((nationality) => (
							<Badge
								key={nationality}
								variant="outline"
								className="border-border/75 bg-background/50 text-xs"
							>
								{NATIONALITIES.find((n) => n.key === nationality)?.flag}{" "}
								{NATIONALITIES.find((n) => n.key === nationality)?.shortCode}
							</Badge>
						))}
					{displayedGenres.map((genre) => (
						<Badge
							key={genre}
							variant="outline"
							className="border-border/75 bg-background/50 text-xs"
						>
							{MUSIC_GENRES.find((g) => g.key === genre)?.label ||
								toGenreLabel(genre)}
						</Badge>
					))}
					{collapsedGenreCount > 0 && (
						<Badge
							variant="outline"
							className="border-border/75 bg-background/50 text-xs text-muted-foreground"
							title={`${collapsedGenreCount} more genre${
								collapsedGenreCount === 1 ? "" : "s"
							} in details`}
						>
							+{collapsedGenreCount}
						</Badge>
					)}
				</div>
			)}
			{hasSocialProofBadge && (
				<div className="mt-2 inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-800 dark:text-amber-200">
					<Flame className="h-3 w-3" />
					{socialProofLabel}
				</div>
			)}
		</div>
	);
}
