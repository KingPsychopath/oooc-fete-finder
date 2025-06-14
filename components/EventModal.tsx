"use client";

import type React from "react";
import { useRef, useState, useEffect } from "react";
import {
	X,
	MapPin,
	Clock,
	ExternalLink,
	Calendar,
	Tag,
	Star,
	Euro,
	Music,
	User,
	Share,
	Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	type Event,
	EVENT_DAYS,
	formatPrice,
	formatDayWithDate,
	formatVenueTypeIcons,
	MUSIC_GENRES,
	VENUE_TYPES,
} from "@/types/events";
import { useOutsideClick } from "@/hooks/useOutsideClick";
import { ShareableImageGenerator } from "@/components/ShareableImageGenerator";
import { useMapPreference } from "@/features/map-preferences/hooks/use-map-preference";
import { openLocationInMaps } from "@/features/map-preferences/utils/map-launcher";
import { MapSelectionModal } from "@/features/map-preferences/components/map-selection-modal";
import { MapPreferenceSettings } from "@/features/map-preferences/components/map-preference-settings";
import type { MapProvider } from "@/features/map-preferences/types/map-preferences";

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
	const [pendingLocationData, setPendingLocationData] = useState<{
		location: string;
		arrondissement?: number | "unknown";
	} | null>(null);

	const modalRef = useOutsideClick<HTMLDivElement>(() => {
		// Only close EventModal if no overlays are open
		if (isOpen && !showMapSelection && !showMapSettings) {
			onClose();
		}
	});

	// Reset map selection state when EventModal closes
	useEffect(() => {
		if (!isOpen) {
			setShowMapSelection(false);
			setShowMapSettings(false);
			setPendingLocationData(null);
		}
	}, [isOpen]);

	if (!isOpen || !event) return null;

	// Handle map opening with preference support
	const handleOpenLocation = async (
		location: string,
		arrondissement?: number | "unknown"
	) => {
		if (!isLoaded) return; // Wait for preferences to load

		if (mapPreference === "ask") {
			// Show selection modal
			setPendingLocationData({ location, arrondissement });
			setShowMapSelection(true);
		} else {
			// Use preferred map directly
			await openLocationInMaps(location, arrondissement, mapPreference);
		}
	};

	// Handle map selection from modal
	const handleMapSelection = async (selectedProvider: MapProvider) => {
		if (pendingLocationData) {
			await openLocationInMaps(
				pendingLocationData.location,
				pendingLocationData.arrondissement,
				selectedProvider
			);
			setPendingLocationData(null);
		}
		setShowMapSelection(false);
	};

	// Handle setting new preference from modal
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

	// Helper to get all links (primary + secondary)
	const allLinks =
		event.links && event.links.length > 0 ? event.links : [event.link];
	const primaryLink = allLinks[0];
	const secondaryLinks = allLinks.slice(1);

	// Get genre color from MUSIC_GENRES
	const getGenreColor = (genre: string) => {
		const genreInfo = MUSIC_GENRES.find((g) => g.key === genre);
		return genreInfo?.color || "bg-gray-100 text-gray-800";
	};

	// Handle share image generation
	const handleShareError = (message: string) => {
		alert(`Unable to generate shareable image: ${message}. Please try again.`);
	};

	const shareImageGenerator = ShareableImageGenerator({
		event,
		onError: handleShareError,
	});

	return (
		<div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
			<Card
				ref={modalRef}
				className="w-full max-w-md max-h-[90vh] overflow-y-auto"
			>
				<CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
					<div className="flex-1">
						<div className="flex items-center space-x-2 mb-2">
							<CardTitle className="text-xl">{event.name}</CardTitle>
							{event.isOOOCPick && (
								<div className="flex items-center space-x-1">
									<span className="text-yellow-500">🌟</span>
									<Badge className="bg-yellow-400 text-black hover:bg-yellow-500">
										<Star className="h-3 w-3 mr-1 fill-current" />
										OOOC Pick
									</Badge>
								</div>
							)}
						</div>
						<div className="flex flex-wrap gap-2">
							{event.category && (
								<Badge
									className={
										CATEGORY_COLORS[event.category] ||
										"bg-gray-100 text-gray-800"
									}
								>
									<Tag className="h-3 w-3 mr-1" />
									{event.category}
								</Badge>
							)}
							{event.genre && event.genre.length > 0 && (
								<>
									{event.genre.map((genre) => (
										<Badge
											key={genre}
											className={`${getGenreColor(genre)} dark:bg-opacity-20`}
										>
											<Music className="h-3 w-3 mr-1" />
											{genre}
										</Badge>
									))}
								</>
							)}
						</div>
					</div>
					<Button
						variant="outline"
						size="icon"
						onClick={onClose}
						className="h-8 w-8"
					>
						<X className="h-4 w-4" />
					</Button>
				</CardHeader>

				<CardContent className="space-y-4">
					{/* Day and Time */}
					<div className="flex items-center space-x-2">
						<Calendar className="h-4 w-4 text-muted-foreground" />
						<span className="text-sm">
							{formatDayWithDate(event.day, event.date)}
							{event.time && event.time !== "TBC" && (
								<>
									{" "}
									at <span className="font-mono font-medium">{event.time}</span>
									{event.endTime && event.endTime !== "TBC" && (
										<>
											{" - "}
											<span className="font-mono font-medium">
												{event.endTime}
											</span>
										</>
									)}
								</>
							)}
							{event.time === "TBC" && (
								<Badge variant="outline" className="ml-2">
									Time TBC
								</Badge>
							)}
						</span>
					</div>

					{/* Location */}
					<div className="flex items-start space-x-2">
						<MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
						<div className="text-sm flex-1">
							<div className="font-medium flex items-center justify-between">
								<span>
									{event.arrondissement === "unknown"
										? "Location TBC"
										: `${event.arrondissement}e Arrondissement`}
								</span>
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<Button
												variant="ghost"
												size="icon"
												onClick={() => setShowMapSettings(!showMapSettings)}
												className="h-6 w-6 hover:bg-muted"
											>
												<Settings className="h-3 w-3" />
											</Button>
										</TooltipTrigger>
										<TooltipContent>
											<p>Map preferences</p>
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
							</div>
							{event.location && event.location !== "TBA" && (
								<button
									onClick={() =>
										handleOpenLocation(event.location!, event.arrondissement)
									}
									className="text-muted-foreground hover:text-primary hover:underline transition-colors text-left min-h-[44px] py-2 -my-2 pr-2 -mr-2 flex items-center"
									title={`Open "${event.location}" in maps`}
								>
									{event.location}
								</button>
							)}
							{(!event.location || event.location === "TBA") && (
								<Badge variant="outline" className="mt-1">
									Location TBA
								</Badge>
							)}
							
							{/* Map Settings Panel */}
							{showMapSettings && (
								<div className="mt-3 pt-3 border-t">
									<MapPreferenceSettings 
										compact={true} 
										showTitle={false}
										className="w-full"
									/>
								</div>
							)}
						</div>
					</div>

					{/* Venue Type */}
					{(event.venueTypes && event.venueTypes.length > 0) ||
					event.indoor !== undefined ? (
						<div className="flex items-center space-x-2">
							<div className="h-4 w-4 text-muted-foreground flex items-center justify-center text-sm">
								{formatVenueTypeIcons(event)}
							</div>
							<div className="text-sm">
								<span className="font-medium">
									{event.venueTypes && event.venueTypes.length > 0
										? event.venueTypes
												.map(
													(vt) => VENUE_TYPES.find((v) => v.key === vt)?.label,
												)
												.filter(Boolean)
												.join(" & ")
										: event.indoor
											? "Indoor"
											: "Outdoor"}{" "}
									Venue
								</span>
							</div>
						</div>
					) : null}

					{/* Price and Age */}
					<div className="flex items-center space-x-4">
						<div className="flex items-center space-x-2">
							<Euro className="h-4 w-4 text-muted-foreground" />
							<span
								className={`text-sm font-medium ${
									formatPrice(event.price) === "Free"
										? "text-green-600 dark:text-green-400"
										: "text-gray-900 dark:text-gray-100"
								}`}
							>
								{formatPrice(event.price)}
							</span>
						</div>
						{event.age && (
							<div className="flex items-center space-x-2">
								<User className="h-4 w-4 text-muted-foreground" />
								<span className="text-sm text-muted-foreground">
									{event.age}
								</span>
							</div>
						)}
					</div>

					{/* Description */}
					{event.description && (
						<div>
							<h4 className="font-medium mb-2">Notes</h4>
							<p className="text-sm text-muted-foreground">
								{event.description}
							</p>
						</div>
					)}

					{/* Verification Status */}
					<div className="flex items-center space-x-2">
						<div
							className={`w-2 h-2 rounded-full ${event.verified ? "bg-green-500" : "bg-yellow-500"}`}
						/>
						<span className="text-xs text-muted-foreground">
							{event.verified
								? "Verified event"
								: "Unverified - details may change"}
						</span>
					</div>

					{/* Actions */}
					<div className="flex flex-col space-y-2 pt-4 border-t">
						{primaryLink && primaryLink !== "#" ? (
							<Button
								onClick={() =>
									window.open(primaryLink, "_blank", "noopener,noreferrer")
								}
								className="w-full"
								title={primaryLink}
							>
								<ExternalLink className="h-4 w-4 mr-2" />
								{getLinkButtonText(primaryLink)}
							</Button>
						) : (
							<Button disabled className="w-full">
								<Clock className="h-4 w-4 mr-2" />
								Link Coming Soon
							</Button>
						)}

						{/* Share Button */}
						<Button
							variant="outline"
							onClick={shareImageGenerator.generateImage}
							className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 hover:from-purple-600 hover:to-pink-600"
						>
							<Share className="h-4 w-4 mr-2" />
							Share to Story
						</Button>

						{/* Secondary links as smaller buttons */}
						{secondaryLinks.length > 0 && (
							<div className="flex flex-col space-y-1">
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
										<ExternalLink className="h-3 w-3 mr-1" />
										{getLinkButtonText(link)}
									</Button>
								))}
							</div>
						)}
						<Button variant="outline" onClick={onClose} className="w-full">
							Close
						</Button>
					</div>

					{/* Data Notice */}
					<div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
						<p className="font-medium mb-1">Event Information</p>
						<p>
							This information is preliminary. Please check the official event
							page for the most up-to-date details including exact location,
							timing, and any entry requirements.
						</p>
					</div>
				</CardContent>
			</Card>

			{/* Map Selection Modal */}
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
