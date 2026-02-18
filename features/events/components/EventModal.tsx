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
} from "@/features/events/types";
import {
	Building2,
	Calendar,
	CalendarPlus,
	Clock,
	Euro,
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
		"bg-purple-100 text-purple-800 dark:bg-purple-500/18 dark:text-purple-200 dark:border dark:border-purple-400/35",
	"block-party":
		"bg-green-100 text-green-800 dark:bg-green-500/18 dark:text-green-200 dark:border dark:border-green-400/35",
	afterparty:
		"bg-blue-100 text-blue-800 dark:bg-blue-500/18 dark:text-blue-200 dark:border dark:border-blue-400/35",
	club: "bg-pink-100 text-pink-800 dark:bg-pink-500/18 dark:text-pink-200 dark:border dark:border-pink-400/35",
	cruise: "bg-cyan-100 text-cyan-800 dark:bg-cyan-500/18 dark:text-cyan-200 dark:border dark:border-cyan-400/35",
	outdoor:
		"bg-emerald-100 text-emerald-800 dark:bg-emerald-500/18 dark:text-emerald-200 dark:border dark:border-emerald-400/35",
	cultural:
		"bg-amber-100 text-amber-800 dark:bg-amber-500/18 dark:text-amber-200 dark:border dark:border-amber-400/35",
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
		return (
			genreInfo?.color ||
			"bg-gray-100 text-gray-800 dark:bg-white/10 dark:text-gray-200 dark:border dark:border-white/15"
		);
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
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 backdrop-blur-[4px] sm:p-4">
			<Card
				ref={modalRef}
				className="max-h-[94vh] w-full max-w-[38rem] overflow-y-auto rounded-[22px] border border-border/80 bg-card/95 shadow-[0_36px_90px_-52px_rgba(0,0,0,0.9)] sm:max-h-[90vh] sm:rounded-[26px] dark:bg-[color-mix(in_oklab,var(--card)_90%,rgba(6,7,9,0.95))]"
			>
				<CardHeader className="pb-2 sm:pb-3">
					<div className="flex items-start justify-between gap-3">
						<div className="min-w-0 flex-1">
							<p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
								Out Of Office Collective
							</p>
							<div className="mt-1 flex flex-wrap items-center gap-2">
								<CardTitle className="break-words text-[clamp(1.25rem,3.5vw,1.9rem)] [font-family:var(--ooo-font-display)] font-light leading-tight">
									{event.name}
								</CardTitle>
								{event.isOOOCPick && (
									<Star className="h-4 w-4 fill-current text-yellow-500" />
								)}
							</div>
						</div>
						<Button
							variant="outline"
							size="icon"
							onClick={onClose}
							className="mt-0.5 h-10 w-10 shrink-0 self-start rounded-xl border-border/70 bg-background/70 hover:bg-accent dark:bg-white/5 dark:hover:bg-white/10"
						>
							<X className="h-5 w-5" />
						</Button>
					</div>

					<div className="mt-2 flex flex-wrap items-center gap-1.5">
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

				<CardContent className="space-y-3 pt-0">
					<div className="grid grid-cols-2 gap-1.5 rounded-xl border border-border/70 bg-background/55 p-2.5 dark:bg-white/[0.025] sm:p-3">
						<div className="rounded-lg border border-border/70 bg-background/80 px-2.5 py-2 dark:bg-white/[0.04]">
							<p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.11em] text-muted-foreground">
								<Calendar className="h-3.5 w-3.5" />
								<span>Date</span>
							</p>
							<p className="mt-0.5 break-words text-[13px] font-medium leading-snug sm:text-sm">
								{formatDayWithDate(event.day, event.date)}
							</p>
						</div>
						<div className="rounded-lg border border-border/70 bg-background/80 px-2.5 py-2 dark:bg-white/[0.04]">
							<p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.11em] text-muted-foreground">
								<Clock className="h-3.5 w-3.5" />
								<span>Time</span>
							</p>
							<p className="mt-0.5 text-[13px] font-medium sm:text-sm">{timeRange}</p>
						</div>
						<div className="rounded-lg border border-border/70 bg-background/80 px-2.5 py-2 dark:bg-white/[0.04]">
							<p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.11em] text-muted-foreground">
								<Euro className="h-3.5 w-3.5" />
								<span>Price</span>
							</p>
							<p
								className={`mt-0.5 text-[13px] font-medium sm:text-sm ${
									priceLabel === "Free" ?
										"text-green-600 dark:text-green-400"
									:	"text-foreground"
								}`}
							>
								{priceLabel}
							</p>
						</div>
						<div className="rounded-lg border border-border/70 bg-background/80 px-2.5 py-2 dark:bg-white/[0.04]">
							<p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.11em] text-muted-foreground">
								<User className="h-3.5 w-3.5" />
								<span>Age</span>
							</p>
							<p className="mt-0.5 text-[13px] font-medium sm:text-sm">{ageLabel}</p>
						</div>
						<div className="col-span-2 rounded-lg border border-border/70 bg-background/80 px-2.5 py-2 dark:bg-white/[0.04]">
							<p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.11em] text-muted-foreground">
								<Building2 className="h-3.5 w-3.5" />
								<span>Venue Type</span>
							</p>
							<p className="mt-0.5 text-[13px] font-medium sm:text-sm">{venueTypeLabel}</p>
						</div>
						<div className="col-span-2 rounded-lg border border-border/70 bg-background/80 px-2.5 py-2 dark:bg-white/[0.04]">
							<div className="flex items-start justify-between gap-2">
								<p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.11em] text-muted-foreground">
									<MapPin className="h-3.5 w-3.5" />
									<span>{locationLabel}</span>
								</p>
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<Button
												variant="outline"
												size="sm"
												onClick={() => setShowMapSettings(!showMapSettings)}
												className="h-6.5 px-2 text-[10px]"
											>
												<Settings className="mr-1 h-3 w-3" />
												Map
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
									className="mt-1.5 inline-flex min-h-[32px] w-full items-center justify-between rounded-md border border-border/70 bg-background/80 px-2.5 text-left text-sm text-primary underline-offset-4 transition-colors hover:bg-accent hover:underline dark:bg-white/[0.03] dark:hover:bg-white/[0.08]"
									title={`Open "${event.location}" in maps`}
								>
									<span className="truncate">{event.location}</span>
									<span className="ml-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.1em] text-primary">
										Open map
										<ExternalLink className="h-3 w-3" />
									</span>
								</button>
							) : (
								<Badge variant="outline" className="mt-1.5">
									Location TBA
								</Badge>
							)}
						</div>

						{showMapSettings && (
							<div className="col-span-2 mt-1 border-t border-border/60 pt-2.5">
								<MapPreferenceSettings
									compact={true}
									showTitle={false}
									className="w-full"
								/>
							</div>
						)}
					</div>

					{event.description && (
						<div className="rounded-xl border border-border/70 bg-background/55 p-2.5 dark:bg-white/[0.025] sm:p-3">
							<h4 className="mb-1 text-xs uppercase tracking-[0.12em] text-muted-foreground">
								Notes
							</h4>
							<p className="text-sm leading-relaxed text-muted-foreground">
								{event.description}
							</p>
						</div>
					)}

					<div className="flex items-center gap-2 text-[11px] text-muted-foreground">
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

					<div className="space-y-1.5 border-t border-border/70 pt-3">
						{primaryLink && primaryLink !== "#" ? (
							<Button
								onClick={() =>
									window.open(primaryLink, "_blank", "noopener,noreferrer")
								}
								className="h-10 w-full"
								title={primaryLink}
							>
								<ExternalLink className="mr-2 h-4 w-4" />
								{getLinkButtonText(primaryLink)}
							</Button>
						) : (
							<Button disabled className="h-10 w-full">
								<Clock className="mr-2 h-4 w-4" />
								Link Coming Soon
							</Button>
						)}

						<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
							<Button
								variant="outline"
								onClick={() => addToCalendar(event)}
								className="h-10 border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-300 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
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
									className="h-10 border-0 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-600 hover:to-fuchsia-600"
									title="Generate Instagram story (portrait)"
								>
									<Share className="mr-2 h-4 w-4" />
									{isSharing ? "Generating..." : "Story"}
								</Button>
								<Button
									variant="outline"
									onClick={() => void handleShareToStory("landscape")}
									disabled={isSharing}
									className="h-10 border-border/70 bg-background/70 text-foreground hover:bg-accent dark:bg-white/[0.03] dark:hover:bg-white/[0.08]"
									title="Generate social post (landscape)"
								>
									{isSharing ? "Generating..." : "Post"}
								</Button>
							</div>
						</div>
						{shareError && (
							<div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-400/45 dark:bg-amber-500/12 dark:text-amber-200">
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

					<div className="rounded-xl border border-border/70 bg-muted/35 p-2.5 text-[11px] text-muted-foreground dark:bg-white/[0.03] sm:p-3 sm:text-xs">
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
