"use client";

import type React from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	type Event,
	EVENT_DAYS,
	formatPrice,
	formatDayWithDate,
	MUSIC_GENRES,
} from "@/types/events";
import { useOutsideClick } from "@/lib/useOutsideClick";

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
									? "Location TBD"
									: `${event.arrondissement}e Arrondissement`}
							</div>
							{event.location && event.location !== "TBA" && (
								<div className="text-muted-foreground">{event.location}</div>
							)}
							{event.address && (
								<div className="text-muted-foreground">{event.address}</div>
							)}
							{(!event.location || event.location === "TBA") && (
								<Badge variant="outline" className="mt-1">
									Location TBA
								</Badge>
							)}
						</div>
					</div>

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
							<h4 className="font-medium mb-2">About</h4>
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
