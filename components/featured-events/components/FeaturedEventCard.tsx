"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, Star, Euro, Users } from "lucide-react";
import {
	getDayNightPeriod,
	formatPrice,
	formatAge,
	formatDayWithDate,
	formatVenueTypeIcons,
	MUSIC_GENRES,
	NATIONALITIES,
	type Event,
} from "@/types/events";

type FeaturedEventCardProps = {
	event: Event;
	onClick: (event: Event) => void;
};

export function FeaturedEventCard({ event, onClick }: FeaturedEventCardProps) {
	const handleClick = () => {
		onClick(event);
	};

	return (
		<div
			className={`p-4 border rounded-lg cursor-pointer transition-colors relative ${
				event.isOOOCPick === true
					? "border-yellow-400 bg-gradient-to-br from-yellow-50 to-amber-50 hover:from-yellow-100 hover:to-amber-100 dark:from-yellow-950 dark:to-amber-950 dark:hover:from-yellow-900 dark:hover:to-amber-900"
					: "hover:bg-muted/50"
			}`}
			onClick={handleClick}
		>
			{/* OOOC Pick Badge */}
			{event.isOOOCPick === true && (
				<div className="absolute -top-3 -right-3 bg-yellow-400 text-black text-xs font-bold rounded-full w-8 h-8 flex items-center justify-center shadow-md z-10 border-2 border-white dark:border-gray-900">
					<Star className="h-4 w-4 fill-current" />
				</div>
			)}

			{/* Featured Badge */}
			{event.isFeatured === true && (
				<div className="absolute -top-3 -left-3 bg-blue-500 text-white text-xs font-bold rounded-full w-8 h-8 flex items-center justify-center shadow-md z-10 border-2 border-white dark:border-gray-900">
					📌
				</div>
			)}

			{/* Header with proper overflow handling */}
			<div className="flex items-start justify-between gap-3 mb-2">
				<div className="flex items-center space-x-2 min-w-0 flex-1">
					<h3 className="font-semibold text-sm leading-tight truncate flex-1 min-w-0">
						{event.name}
					</h3>
					{event.isOOOCPick === true && (
						<span className="text-yellow-500 text-sm flex-shrink-0">
							🌟
						</span>
					)}
				</div>
				<Badge
					variant="outline"
					className="text-xs flex-shrink-0 ml-auto"
				>
					{event.arrondissement === "unknown"
						? "?"
						: `${event.arrondissement}e`}
				</Badge>
			</div>

			{/* Event details */}
			<div className="text-sm text-muted-foreground space-y-1">
				<div className="flex items-center space-x-1">
					<Clock className="h-3 w-3 flex-shrink-0" />
					<span className="truncate">
						{event.time || "TBC"}
						{event.endTime && event.time !== "TBC" && (
							<> - {event.endTime}</>
						)}{" "}
						• {formatDayWithDate(event.day, event.date)}
					</span>
					{event.time && getDayNightPeriod(event.time) && (
						<span className="flex-shrink-0">
							{getDayNightPeriod(event.time) === "day" ? "☀️" : "🌙"}
						</span>
					)}
				</div>
				{event.location && event.location !== "TBA" && (
					<div className="flex items-center space-x-1">
						<MapPin className="h-3 w-3 flex-shrink-0" />
						<span className="truncate flex-1 min-w-0">
							{event.location}
						</span>
						<span className="flex-shrink-0">
							{formatVenueTypeIcons(event)}
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
								: "text-gray-600 dark:text-gray-400"
						}`}
					>
						{formatPrice(event.price)}
					</span>
				</div>
				{/* Age Display */}
				{event.age && (
					<div className="flex items-center space-x-1">
						<Users className="h-3 w-3 flex-shrink-0" />
						<span className="text-xs font-medium text-gray-600 dark:text-gray-400">
							{formatAge(event.age)}
						</span>
					</div>
				)}
			</div>

			{/* Badges */}
			<div className="flex flex-wrap gap-1 mt-2">
				<Badge variant="secondary" className="text-xs">
					{event.type}
				</Badge>
				{event.nationality &&
					event.nationality.map((nationality) => (
						<Badge
							key={nationality}
							variant="outline"
							className="text-xs"
						>
							{NATIONALITIES.find((n) => n.key === nationality)?.flag}{" "}
							{
								NATIONALITIES.find((n) => n.key === nationality)
									?.shortCode
							}
						</Badge>
					))}
				{event.genre.slice(0, 2).map((genre) => (
					<Badge key={genre} variant="outline" className="text-xs">
						{MUSIC_GENRES.find((g) => g.key === genre)?.label || genre}
					</Badge>
				))}
			</div>
		</div>
	);
} 