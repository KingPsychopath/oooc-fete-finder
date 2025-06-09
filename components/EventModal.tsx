"use client";

import type React from "react";
import { useRef } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	type Event,
	EVENT_DAYS,
	formatPrice,
	formatDayWithDate,
	formatVenueTypeIcons,
	MUSIC_GENRES,
	VENUE_TYPES,
} from "@/types/events";
import { useOutsideClick } from "@/lib/useOutsideClick";
import { ShareableImageGenerator } from "@/components/ShareableImageGenerator";

interface EventModalProps {
	event: Event | null;
	isOpen: boolean;
	onClose: () => void;
}

/**
 * Converts an integer to its ordinal form (1st, 2nd, 3rd, etc.).
 *
 * @param num - The number to convert to ordinal
 * @returns String with ordinal suffix (e.g., "1st", "2nd", "3rd", "4th")
 *
 * **Rules:**
 * - Numbers ending in 11, 12, 13 use "th" (11th, 12th, 13th)
 * - Numbers ending in 1 use "st" (1st, 21st, 31st)
 * - Numbers ending in 2 use "nd" (2nd, 22nd, 32nd)
 * - Numbers ending in 3 use "rd" (3rd, 23rd, 33rd)
 * - All others use "th" (4th, 5th, 6th, etc.)
 *
 * @example
 * ```tsx
 * getOrdinal(1)   // → "1st"
 * getOrdinal(2)   // → "2nd"
 * getOrdinal(3)   // → "3rd"
 * getOrdinal(11)  // → "11th"
 * getOrdinal(21)  // → "21st"
 * getOrdinal(103) // → "103rd"
 * ```
 */
const getOrdinal = (num: number): string => {
	const lastDigit = num % 10;
	const lastTwoDigits = num % 100;

	// Special cases for 11th, 12th, 13th
	if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
		return `${num}th`;
	}

	// Regular cases
	switch (lastDigit) {
		case 1:
			return `${num}st`;
		case 2:
			return `${num}nd`;
		case 3:
			return `${num}rd`;
		default:
			return `${num}th`;
	}
};

/**
 * Determines if a string is a valid URL or plain text location name.
 *
 * @param input - The string to analyze (could be URL or location name)
 * @returns Object with isUrl boolean and the processed value
 *
 * **Detection Logic:**
 * - Checks for common URL patterns (http://, https://, maps://, geo:)
 * - Validates URL structure using URL constructor
 * - Handles Google Sheets export edge cases
 *
 * @example
 * ```tsx
 * parseLocationInput("https://maps.google.com/...")
 * // → { isUrl: true, value: "https://maps.google.com/..." }
 *
 * parseLocationInput("Le Comptoir Général")
 * // → { isUrl: false, value: "Le Comptoir Général" }
 * ```
 */
const parseLocationInput = (
	input: string,
): { isUrl: boolean; value: string } => {
	if (!input || input === "TBA") {
		return { isUrl: false, value: input };
	}

	const trimmedInput = input.trim();

	// Check for URL patterns
	const urlPatterns = [
		/^https?:\/\//i, // http:// or https://
		/^maps:\/\//i, // maps:// (Apple Maps)
		/^geo:/i, // geo: (Android)
		/^www\./i, // www. (common shorthand)
	];

	const hasUrlPattern = urlPatterns.some((pattern) =>
		pattern.test(trimmedInput),
	);

	if (hasUrlPattern) {
		try {
			// For www. links, prepend https://
			const urlToTest = trimmedInput.startsWith("www.")
				? `https://${trimmedInput}`
				: trimmedInput;

			new URL(urlToTest);
			return { isUrl: true, value: urlToTest };
		} catch {
			// If URL parsing fails, treat as plain text
			return { isUrl: false, value: trimmedInput };
		}
	}

	// Additional check for Google Maps URLs that might not start with protocol
	if (
		trimmedInput.includes("google.com/maps") ||
		trimmedInput.includes("maps.google.com")
	) {
		try {
			const urlToTest = trimmedInput.startsWith("http")
				? trimmedInput
				: `https://${trimmedInput}`;
			new URL(urlToTest);
			return { isUrl: true, value: urlToTest };
		} catch {
			return { isUrl: false, value: trimmedInput };
		}
	}

	// Default: treat as plain text location name
	return { isUrl: false, value: trimmedInput };
};

/**
 * Opens a location in the most appropriate maps application based on the user's platform.
 * Handles both plain text location names and direct URLs.
 *
 * @param locationInput - The location string (venue name, address, or URL)
 * @param arrondissement - Optional arrondissement (number or "unknown") to append to plain text searches
 *
 * **Input Handling:**
 * - **URLs**: Opens directly in new tab (preserves Google Sheets hyperlinks)
 * - **Plain text**: Uses platform-specific maps integration with optional arrondissement context
 *
 * **Arrondissement Enhancement:**
 * - For plain text locations, appends "Location Name + 3rd arrondissement" for better search accuracy
 * - Only applies to plain text searches, not direct URLs
 * - Uses proper ordinal formatting (1st, 2nd, 3rd, etc.)
 *
 * **Platform Behavior:**
 * - **iOS/Mac**: Opens Apple Maps first, with intelligent fallback to Google Maps web only if Apple Maps fails to launch
 * - **Android**: Opens native Google Maps app using geo: protocol
 * - **Desktop/Web**: Opens Google Maps web interface with full API features
 *
 * **Accessibility:**
 * - Handles native app failures gracefully with web fallbacks
 * - Uses proper URL encoding for special characters and spaces
 * - Maintains consistent behavior across all platforms
 *
 * @example
 * ```tsx
 * // Plain text location with arrondissement
 * <button onClick={() => openLocationInMaps("Le Comptoir Général", 10)}>
 *   View Location  // Searches: "Le Comptoir Général 10th arrondissement"
 * </button>
 *
 * // Direct URL (arrondissement ignored)
 * <button onClick={() => openLocationInMaps("https://maps.google.com/...", 3)}>
 *   View Location  // Opens URL directly
 * </button>
 * ```
 */
const openLocationInMaps = (
	locationInput: string,
	arrondissement?: number | "unknown",
): void => {
	const { isUrl, value } = parseLocationInput(locationInput);

	if (!value || value === "TBA") return;

	// If it's already a URL, open it directly (ignore arrondissement)
	if (isUrl) {
		window.open(value, "_blank", "noopener,noreferrer");
		return;
	}

	// Handle plain text location names with platform-specific logic
	// Enhance search with arrondissement context for better accuracy
	let searchQuery = value;
	if (
		arrondissement &&
		arrondissement !== "unknown" &&
		typeof arrondissement === "number"
	) {
		const ordinalArrondissement = getOrdinal(arrondissement);
		searchQuery = `${value} ${ordinalArrondissement} arrondissement`;
	}

	const query = encodeURIComponent(searchQuery);
	const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
	const isMac = /Macintosh|Mac OS X/.test(navigator.userAgent);
	const isAndroid = /Android/.test(navigator.userAgent);

	if (isIOS || isMac) {
		// iOS/Mac: Try Apple Maps first, only fallback to Google Maps if Apple Maps fails
		const appleMapsUrl = `maps://maps.apple.com/?q=${query}`;
		
		// Track if user left the page (indicating Apple Maps opened successfully)
		let hasLeftPage = false;
		const handleVisibilityChange = () => {
			if (document.hidden) {
				hasLeftPage = true;
			}
		};
		
		// Listen for page visibility changes
		document.addEventListener('visibilitychange', handleVisibilityChange);
		
		// Attempt to open Apple Maps
		window.open(appleMapsUrl, "_blank", "noopener,noreferrer");
		
		// Only fallback to Google Maps if Apple Maps likely failed
		setTimeout(() => {
			document.removeEventListener('visibilitychange', handleVisibilityChange);
			
			// If user hasn't left page, Apple Maps likely failed to open
			if (!hasLeftPage) {
				window.open(
					`https://maps.google.com/?q=${query}`,
					"_blank",
					"noopener,noreferrer",
				);
			}
		}, 1500); // Increased timeout to give Apple Maps more time to launch
	} else if (isAndroid) {
		// Android: Use geo: protocol for native Google Maps
		const mapsUrl = `geo:0,0?q=${query}`;
		try {
			window.open(mapsUrl, "_blank", "noopener,noreferrer");
		} catch {
			// Fallback to web version if native app fails
			window.open(
				`https://www.google.com/maps/search/?api=1&query=${query}`,
				"_blank",
				"noopener,noreferrer",
			);
		}
	} else {
		// Desktop/Web: Use Google Maps web interface
		const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
		window.open(mapsUrl, "_blank", "noopener,noreferrer");
	}
};

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
	const modalRef = useOutsideClick<HTMLDivElement>(() => {
		if (isOpen) {
			onClose();
		}
	});

	if (!isOpen || !event) return null;

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
						<div className="text-sm">
							<div className="font-medium">
								{event.arrondissement === "unknown"
									? "Location TBC"
									: `${event.arrondissement}e Arrondissement`}
							</div>
							{event.location && event.location !== "TBA" && (
								<button
									onClick={() =>
										openLocationInMaps(event.location!, event.arrondissement)
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
		</div>
	);
};

export default EventModal;
