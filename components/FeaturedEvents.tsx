"use client";

import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Clock, Star, Euro, Users, ChevronDown } from "lucide-react";
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

type FeaturedEventsProps = {
	events: Event[];
	onEventClick: (event: Event) => void;
	onScrollToAllEvents: () => void;
};

export function FeaturedEvents({
	events,
	onEventClick,
	onScrollToAllEvents,
}: FeaturedEventsProps) {
	// Get preview events: prioritize manually featured events, then OOOC picks with deterministic daily shuffle
	// Desktop: max 3 events, Mobile/tablet: max 2 events
	const previewEvents = useMemo(() => {
		// Deterministic shuffle function using date as seed for consistent server/client results
		const deterministicShuffle = <T,>(array: T[]): T[] => {
			const shuffled = [...array];
			const seed = new Date().toDateString(); // Same seed for entire day
			let hash = 0;
			for (let i = 0; i < seed.length; i++) {
				hash = ((hash << 5) - hash) + seed.charCodeAt(i);
				hash = hash & hash; // Convert to 32-bit integer
			}
			
			// Simple deterministic shuffle using the hash as seed
			for (let i = shuffled.length - 1; i > 0; i--) {
				hash = (hash * 1664525 + 1013904223) % Math.pow(2, 32); // Linear congruential generator
				const j = Math.floor((hash / Math.pow(2, 32)) * (i + 1));
				[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
			}
			
			return shuffled;
		};

		// First, get manually featured events
		const manuallyFeatured = events.filter(
			(event) => event != null && event.isFeatured === true,
		);

		// Get remaining event pools
		const oooPicksEvents = events.filter(
			(event) =>
				event != null && event.isOOOCPick === true && event.isFeatured !== true,
		);
		const regularEvents = events.filter(
			(event) =>
				event != null && event.isOOOCPick !== true && event.isFeatured !== true,
		);

		// Use deterministic shuffle for OOOC picks that aren't manually featured
		const shuffledOOOCPicks = deterministicShuffle(oooPicksEvents);

		// Build preview starting with manually featured events
		const preview = [...manuallyFeatured];

		// Calculate max events based on screen size - we'll show up to 3 and let CSS handle responsiveness
		const maxEvents = 3;
		const remainingSlots = maxEvents - preview.length;

		// Fill remaining slots with shuffled OOOC picks first
		const availableOOOCPicks = shuffledOOOCPicks.slice(0, remainingSlots);
		preview.push(...availableOOOCPicks);

		// If still need more events, add regular events
		if (preview.length < maxEvents) {
			const stillRemainingSlots = maxEvents - preview.length;
			preview.push(...regularEvents.slice(0, stillRemainingSlots));
		}

		// Safety check: filter out any undefined events
		const safePreview = preview.filter((event) => event != null);

		// Debug logging if we have issues
		if (safePreview.length !== preview.length) {
			console.warn(
				"Found undefined events in preview, filtered out:",
				preview.length - safePreview.length,
			);
		}

		return safePreview;
	}, [events]);

	return (
		<Card className="mb-6">
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle>Featured Events</CardTitle>
					<Button
						variant="outline"
						size="sm"
						onClick={onScrollToAllEvents}
						className="text-sm"
					>
						View All {events.length} Events
						<ChevronDown className="h-4 w-4 ml-1" />
					</Button>
				</div>
			</CardHeader>
			<CardContent>
				{/* Responsive grid: 1 col on mobile, 2 cols on tablet, 3 cols on desktop */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{previewEvents.map((event) => (
						<div
							key={event.id}
							className={`p-4 border rounded-lg cursor-pointer transition-colors relative ${
								event.isOOOCPick === true
									? "border-yellow-400 bg-gradient-to-br from-yellow-50 to-amber-50 hover:from-yellow-100 hover:to-amber-100 dark:from-yellow-950 dark:to-amber-950 dark:hover:from-yellow-900 dark:hover:to-amber-900"
									: "hover:bg-muted/50"
							}`}
							onClick={() => onEventClick(event)}
						>
							{/* OOOC Pick Badge */}
							{event.isOOOCPick === true && (
								<div className="absolute -top-3 -right-3 bg-yellow-400 text-black text-xs font-bold rounded-full w-8 h-8 flex items-center justify-center shadow-md z-10 border-2 border-white dark:border-gray-900">
									<Star className="h-4 w-4 fill-current" />
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
					))}
				</div>
				{events.length > 3 && (
					<div className="mt-4 text-center">
						<Button
							variant="secondary"
							onClick={onScrollToAllEvents}
							className="w-full sm:w-auto"
						>
							Browse All {events.length} Events
							<ChevronDown className="h-4 w-4 ml-1" />
						</Button>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
