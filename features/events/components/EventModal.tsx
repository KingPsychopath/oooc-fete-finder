"use client";

import { ShareableImageGenerator } from "@/features/events/components/ShareableImageGenerator";
import type { ShareImageFormat } from "@/features/events/components/ShareableImageGenerator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { MapPreferenceSettings } from "@/features/maps/components/map-preference-settings";
import { MapSelectionModal } from "@/features/maps/components/map-selection-modal";
import { useMapPreference } from "@/features/maps/hooks/use-map-preference";
import type { MapProvider } from "@/features/maps/types";
import { openLocationInMaps } from "@/features/maps/utils/map-launcher";
import { useOutsideClick } from "@/hooks/useOutsideClick";
import { addToCalendar } from "@/features/events/calendar-utils";
import {
	type Event,
	MUSIC_GENRES,
	VENUE_TYPES,
	formatDayWithDate,
	formatPrice,
	formatVenueTypeIcons,
} from "@/features/events/types";
import {
	CalendarPlus,
	Clock,
	ExternalLink,
	MapPin,
	Music,
	Settings,
	Share,
	Star,
	Tag,
	User,
	X,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";

interface EventModalProps {
	event: Event | null;
	isOpen: boolean;
	onClose: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
	electronic:
		"bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
	"block-party":
		"bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
	afterparty: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
	club: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
	cruise: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
	outdoor:
		"bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
	cultural: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
};

const EventModal: React.FC<EventModalProps> = ({ event, isOpen, onClose }) => {
	const { mapPreference, setMapPreference, isLoaded } = useMapPreference();
	const [showMapSelection, setShowMapSelection] = useState(false);
	const [showMapSettings, setShowMapSettings] = useState(false);
	const [isSharing, setIsSharing] = useState(false);
	const [shareError, setShareError] = useState<string | null>(null);
	const [pendingLocationData, setPendingLocationData] = useState<{
		location: string;
		arrondissement?: number | "unknown";
	} | null>(null);

	const modalRef = useOutsideClick<HTMLDivElement>(() => {
		if (isOpen && !showMapSelection && !showMapSettings) {
			onClose();
		}
	});

	useEffect(() => {
		if (!isOpen) {
			setShowMapSelection(false);
			setShowMapSettings(false);
			setIsSharing(false);
			setShareError(null);
			setPendingLocationData(null);
		}
	}, [isOpen]);

	if (!isOpen || !event) return null;

	const handleOpenLocation = async (
		location: string,
		arrondissement?: number | "unknown",
	) => {
		if (!isLoaded) return;

		if (mapPreference === "ask") {
			setPendingLocationData({ location, arrondissement });
			setShowMapSelection(true);
		} else {
			await openLocationInMaps(location, arrondissement, mapPreference);
		}
	};

	const handleMapSelection = async (selectedProvider: MapProvider) => {
		if (pendingLocationData) {
			await openLocationInMaps(
				pendingLocationData.location,
				pendingLocationData.arrondissement,
				selectedProvider,
			);
			setPendingLocationData(null);
		}
		setShowMapSelection(false);
	};

	const handleSetMapPreference = (provider: MapProvider) => {
		setMapPreference(provider);
	};

	const getLinkButtonText = (url: string) => {
		if (!url || url === "#") {
			return "Link Coming Soon";
		}
		try {
			const parsed = new URL(url);
			return `View on ${parsed.hostname.replace("www.", "")}`;
		} catch {
			return "View Event Details";
		}
	};

	const allLinks = event.links && event.links.length > 0 ? event.links : [event.link];
	const primaryLink = allLinks[0];
	const secondaryLinks = allLinks.slice(1);
	const visibleGenres = event.genre?.slice(0, 4) || [];
	const extraGenreCount = Math.max(0, (event.genre?.length || 0) - visibleGenres.length);

	const getGenreColor = (genre: string) => {
		const genreInfo = MUSIC_GENRES.find((g) => g.key === genre);
		return genreInfo?.color || "bg-gray-100 text-gray-800";
	};

	const handleShareError = (message: string) => {
		setShareError(message || "Unable to generate share image.");
	};

	const shareImageGenerator = ShareableImageGenerator({
		event,
		onError: handleShareError,
	});

	const handleShareToStory = async (format: ShareImageFormat) => {
		setIsSharing(true);
		setShareError(null);
		try {
			await shareImageGenerator.generateImage(format);
		} finally {
			setIsSharing(false);
		}
	};

	const hasTime = Boolean(event.time && event.time !== "TBC");
	const hasEndTime = Boolean(event.endTime && event.endTime !== "TBC");
	const timeRange =
		hasTime ?
			hasEndTime ? `${event.time} - ${event.endTime}`
			: (event.time ?? "TBC")
		: "TBC";
	const venueTypeLabel =
		event.venueTypes && event.venueTypes.length > 0 ?
			event.venueTypes
				.map((vt) => VENUE_TYPES.find((v) => v.key === vt)?.label)
				.filter(Boolean)
				.join(" & ")
		: event.indoor ?
			"Indoor"
		: 	"Outdoor";
	const locationLabel =
		event.arrondissement === "unknown" ?
			"Location TBC"
		: 	`${event.arrondissement}e Arrondissement`;
	const priceLabel = formatPrice(event.price);
	const ageLabel = event.age || "All ages";

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]">
			<Card
				ref={modalRef}
				className="max-h-[90vh] w-full max-w-[38rem] overflow-y-auto rounded-[26px] border border-border/70 bg-card/95 shadow-[0_36px_90px_-52px_rgba(16,12,8,0.82)]"
			>
				<CardHeader className="pb-3">
					<div className="flex items-start justify-between gap-3">
						<div className="min-w-0 flex-1">
							<p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
								Out Of Office Collective
							</p>
							<div className="mt-1 flex flex-wrap items-center gap-2">
								<CardTitle className="break-words text-[clamp(1.4rem,3.8vw,2rem)] [font-family:var(--ooo-font-display)] font-light leading-tight">
									{event.name}
								</CardTitle>
								{event.isOOOCPick && <span className="text-yellow-500">🌟</span>}
							</div>
						</div>
						<Button
							variant="outline"
							size="icon"
							onClick={onClose}
							className="mt-0.5 h-11 w-11 shrink-0 self-start rounded-xl border-border/70 bg-background/70 hover:bg-accent"
						>
							<X className="h-5 w-5" />
						</Button>
					</div>

					<div className="mt-3 flex max-h-16 flex-wrap items-center gap-2 overflow-hidden sm:max-h-none">
						{event.isOOOCPick && (
							<Badge className="border-yellow-300 bg-yellow-400 text-black hover:bg-yellow-500">
								<Star className="mr-1 h-3.5 w-3.5 fill-current" />
								OOOC Pick
							</Badge>
						)}
						{event.category && (
							<Badge
								className={
									CATEGORY_COLORS[event.category] || "bg-gray-100 text-gray-800"
								}
							>
								<Tag className="mr-1 h-3 w-3" />
								{event.category}
							</Badge>
						)}
						{visibleGenres.map((genre) => (
							<Badge
								key={genre}
								className={`${getGenreColor(genre)} border border-white/20 dark:bg-opacity-25`}
							>
								<Music className="mr-1 h-3 w-3" />
								{genre}
							</Badge>
						))}
						{extraGenreCount > 0 && (
							<Badge variant="outline" className="border-border/70">
								+{extraGenreCount} more
							</Badge>
						)}
					</div>
				</CardHeader>

				<CardContent className="space-y-4 pt-0">
					<div className="grid gap-2 rounded-xl border border-border/70 bg-background/55 p-3 sm:grid-cols-2">
						<div className="min-h-[84px] rounded-lg border border-border/70 bg-background/80 px-3 py-2">
							<p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
								Date
							</p>
							<p className="mt-1 break-words text-sm font-medium">
								{formatDayWithDate(event.day, event.date)}
							</p>
						</div>
						<div className="min-h-[84px] rounded-lg border border-border/70 bg-background/80 px-3 py-2">
							<p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
								Time
							</p>
							<p className="mt-1 text-sm font-medium">{timeRange}</p>
						</div>
						<div className="min-h-[84px] rounded-lg border border-border/70 bg-background/80 px-3 py-2">
							<p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
								Venue Type
							</p>
							<p className="mt-1 text-sm font-medium">
								<span className="mr-1.5">{formatVenueTypeIcons(event)}</span>
								{venueTypeLabel}
							</p>
						</div>
						<div className="min-h-[84px] rounded-lg border border-border/70 bg-background/80 px-3 py-2">
							<p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
								Price
							</p>
							<p
								className={`mt-1 text-sm font-medium ${
									priceLabel === "Free" ?
										"text-green-600 dark:text-green-400"
									: 	"text-foreground"
								}`}
							>
								{priceLabel}
							</p>
						</div>
					</div>

					<div className="rounded-xl border border-border/70 bg-background/55 p-3">
						<div className="min-w-0">
							<div className="flex items-center justify-between gap-2">
								<div className="min-w-0 flex items-center gap-2">
									<MapPin className="h-4.5 w-4.5 shrink-0 text-muted-foreground" />
									<p className="truncate text-sm font-medium">{locationLabel}</p>
								</div>
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<Button
												variant="outline"
												size="sm"
												onClick={() => setShowMapSettings(!showMapSettings)}
												className="h-8 px-2 text-xs"
											>
												<Settings className="mr-1 h-3.5 w-3.5" />
												Map settings
											</Button>
										</TooltipTrigger>
										<TooltipContent>
											<p>Map preferences</p>
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
							</div>

							{event.location && event.location !== "TBA" ? (
								<button
									onClick={() =>
										handleOpenLocation(event.location!, event.arrondissement)
									}
									className="mt-2 ml-[1.625rem] min-h-[44px] break-words text-left text-sm text-muted-foreground transition-colors hover:text-primary hover:underline"
									title={`Open "${event.location}" in maps`}
								>
									{event.location}
								</button>
							) : (
								<Badge variant="outline" className="mt-2 ml-[1.625rem]">
									Location TBA
								</Badge>
							)}

							<div className="mt-2 ml-[1.625rem] flex items-center gap-2 text-xs text-muted-foreground">
								<User className="h-3.5 w-3.5" />
								<span>{ageLabel}</span>
							</div>
						</div>

						{showMapSettings && (
							<div className="mt-3 border-t border-border/60 pt-3">
								<MapPreferenceSettings
									compact={true}
									showTitle={false}
									className="w-full"
								/>
							</div>
						)}
					</div>

					{event.description && (
						<div className="rounded-xl border border-border/70 bg-background/55 p-3">
							<h4 className="mb-1.5 text-sm font-medium">Notes</h4>
							<p className="text-sm leading-relaxed text-muted-foreground">
								{event.description}
							</p>
						</div>
					)}

					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						<div
							className={`h-2 w-2 rounded-full ${
								event.verified ? "bg-green-500" : "bg-yellow-500"
							}`}
						/>
						<span>
							{event.verified ?
								"Verified event"
							: 	"Unverified - details may change"}
						</span>
					</div>

					<div className="space-y-2 border-t border-border/70 pt-4">
						{primaryLink && primaryLink !== "#" ? (
							<Button
								onClick={() =>
									window.open(primaryLink, "_blank", "noopener,noreferrer")
								}
								className="h-11 w-full"
								title={primaryLink}
							>
								<ExternalLink className="mr-2 h-4 w-4" />
								{getLinkButtonText(primaryLink)}
							</Button>
						) : (
							<Button disabled className="h-11 w-full">
								<Clock className="mr-2 h-4 w-4" />
								Link Coming Soon
							</Button>
						)}

						<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
							<Button
								variant="outline"
								onClick={() => addToCalendar(event)}
								className="h-11 border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-300 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
								title="Add event to your calendar"
							>
								<CalendarPlus className="mr-2 h-4 w-4" />
								Add to Calendar
							</Button>

							<div className="grid grid-cols-2 gap-2">
								<Button
									variant="outline"
									onClick={() => void handleShareToStory("portrait")}
									disabled={isSharing}
									className="h-11 border-0 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-600 hover:to-fuchsia-600"
									title="Generate Instagram story (portrait)"
								>
									<Share className="mr-2 h-4 w-4" />
									{isSharing ? "Generating..." : "Story"}
								</Button>
								<Button
									variant="outline"
									onClick={() => void handleShareToStory("landscape")}
									disabled={isSharing}
									className="h-11 border-border/70 bg-background/70 text-foreground hover:bg-accent"
									title="Generate social post (landscape)"
								>
									{isSharing ? "Generating..." : "Post"}
								</Button>
							</div>
						</div>
						{shareError && (
							<div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
								Unable to generate image right now. {shareError}
							</div>
						)}

						{secondaryLinks.length > 0 && (
							<div className="space-y-1">
								{secondaryLinks.map((link) => (
									<Button
										key={link}
										variant="outline"
										size="sm"
										onClick={() =>
											window.open(link, "_blank", "noopener,noreferrer")
										}
										className="w-full"
										title={link}
									>
										<ExternalLink className="mr-1 h-3 w-3" />
										{getLinkButtonText(link)}
									</Button>
								))}
							</div>
						)}

					</div>

					<div className="rounded-xl border border-border/70 bg-muted/35 p-3 text-xs text-muted-foreground">
						<p className="mb-1 font-medium">Event Information</p>
						<p>
							This information is preliminary. Please check the official event
							page for the most up-to-date details including exact location,
							timing, and any entry requirements.
						</p>
					</div>
				</CardContent>
			</Card>

			<MapSelectionModal
				isOpen={showMapSelection}
				onClose={() => {
					setShowMapSelection(false);
					setPendingLocationData(null);
				}}
				onSelect={handleMapSelection}
				onRememberPreference={handleSetMapPreference}
				title="Choose Map App"
				description="How would you like to open this location?"
			/>
		</div>
	);
};

export default EventModal;
