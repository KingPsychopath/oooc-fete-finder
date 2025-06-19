"use client";

import { Calendar, Clock, MapPin, Music, Users, Volume2, Star, Sparkles, PartyPopper } from "lucide-react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Event } from "@/types/events";

interface ScheduleEvent {
	time: string;
	title: string;
	type: string;
	location?: string;
	searchHint?: string; // Hidden property to help with exact event matching
	disableClick?: boolean; // Explicitly disable clickability even if event matches
}

interface DaySchedule {
	day: string;
	date: string;
	color: string;
	events: ScheduleEvent[];
}

interface FeteRoadmapProps {
	events?: Event[];
	onEventClick?: (event: Event) => void;
}

const getItineraryData = (): DaySchedule[] => [
	{
		day: "Friday",
		date: "20th June",
		color: "from-pink-500 to-rose-600",
		events: [
			{
				time: "22:00",
				title: "Pre-drinks @ Zezei",
				type: "drinks",
				searchHint: "Zesei",
			},
		],
	},
	{
		day: "Saturday",
		date: "21st June", 
		color: "from-purple-500 to-indigo-600",
		events: [
			{
				time: "12:00",
				title: "Brunch Meet-Up",
				type: "brunch",
			},
			{
				time: "14:00",
				title: "Damside",
				type: "music",
				searchHint: "Damside Block Party 🇫🇷x🇳🇱",
			},
			{
				time: "16:00",
				title: "Genesis",
				type: "music",
				searchHint: "Genesis", // No exact match in current data
			},
			{
				time: "18:00",
				title: "Hotel Zamara / Mondial",
				type: "music",
				searchHint: "Hotel Zamara",
			},
			{
				time: "19:00",
				title: "Spiritual Gangsta",
				type: "music",
				searchHint: "Spiritual Gangster", // Exact match to avoid confusion with other "gang" events
				disableClick: true,
			},
			{
				time: "22:00",
				title: "Sixtion x Recess x Everyday People",
				type: "party",
				searchHint: "Sixtion x Recess x Everyday People",
			},
		],
	},
	{
		day: "Sunday",
		date: "22nd June",
		color: "from-orange-500 to-red-500",
		events: [
			{
				time: "13:00",
				title: "Bourse de Commerce Meet-Up",
				type: "meetup",
			},
			{
				time: "15:00",
				title: "Lunch Meet-Up",
				type: "brunch",
			},
		],
	},
];



const getEventIcon = (type?: string) => {
	switch (type) {
		case "drinks":
			return <Users className="h-5 w-5 text-white" />;
		case "brunch":
			return <Users className="h-5 w-5 text-white" />;
		case "meetup":
			return <Users className="h-5 w-5 text-white" />;
		case "music":
			return <Volume2 className="h-5 w-5 text-white" />;
		case "party":
			return <Sparkles className="h-5 w-5 text-white" />;
		default:
			return <Music className="h-5 w-5 text-white" />;
	}
};

const getEventBadgeColor = (type?: string) => {
	switch (type) {
		case "drinks":
			return "bg-gradient-to-r from-pink-500 to-rose-500 text-white border-0";
		case "brunch":
			return "bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0";
		case "meetup":
			return "bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-0";
		case "music":
			return "bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0";
		case "party":
			return "bg-gradient-to-r from-purple-500 to-violet-500 text-white border-0";
		default:
			return "bg-gradient-to-r from-gray-500 to-slate-500 text-white border-0";
	}
};

// Enhanced fuzzy matching function with search hint support and day filtering
const findMatchingEvent = (event: ScheduleEvent, allEvents?: Event[], daySchedule?: DaySchedule): Event | null => {
	if (!allEvents) return null;

	// Map itinerary day names to EventDay types
	const dayMapping: Record<string, string[]> = {
		"Friday": ["friday"],
		"Saturday": ["saturday"], 
		"Sunday": ["sunday"],
	};

	// Get the allowed days for this event based on the itinerary day
	const allowedDays = daySchedule ? dayMapping[daySchedule.day] || [] : [];

	// Filter events by day first if we have day information
	const dayFilteredEvents = allowedDays.length > 0 
		? allEvents.filter(e => allowedDays.includes(e.day))
		: allEvents;

	// Normalize the search title
	const normalizeString = (str: string) => 
		str.toLowerCase()
			.replace(/[^a-z0-9\s]/g, '') // Remove special chars
			.replace(/\s+/g, ' ') // Normalize spaces
			.trim();

	// Use searchHint if available, otherwise fall back to title
	const searchText = event.searchHint || event.title;
	const searchTitle = normalizeString(searchText);
	
	// Try exact match with search hint first (highest priority) - within the correct day
	const exactMatch = dayFilteredEvents.find(e => normalizeString(e.name) === searchTitle);
	if (exactMatch) return exactMatch;

	// If searchHint was used and didn't match exactly, try original title - within the correct day
	if (event.searchHint) {
		const titleMatch = dayFilteredEvents.find(e => normalizeString(e.name) === normalizeString(event.title));
		if (titleMatch) return titleMatch;
	}

	// Try partial matches with stricter criteria - within the correct day
	const partialMatches = dayFilteredEvents.filter(e => {
		const eventName = normalizeString(e.name);
		
		// Strategy 1: Check if search text is contained in event name (more restrictive)
		if (eventName.includes(searchTitle)) {
			return true;
		}
		
		// Strategy 2: Check if event name is contained in search text (less likely to cause false matches)
		if (searchTitle.includes(eventName) && eventName.length >= 4) {
			return true;
		}
		
		// Strategy 3: Word-based matching with higher threshold
		const searchWords = searchTitle.split(' ').filter(w => w.length > 3); // Increased minimum word length
		const eventWords = eventName.split(' ').filter(w => w.length > 3);
		
		if (searchWords.length === 0 || eventWords.length === 0) return false;
		
		const matchingWords = searchWords.filter(sw => 
			eventWords.some(ew => ew === sw || (ew.includes(sw) && sw.length > 4) || (sw.includes(ew) && ew.length > 4))
		);
		
		// Require a higher percentage of words to match for more accuracy
		const threshold = Math.max(1, Math.ceil(Math.min(searchWords.length, eventWords.length) * 0.7)); // 70% match required
		return matchingWords.length >= threshold;
	});

	// Return the best partial match (prefer exact word matches over partial)
	if (partialMatches.length > 0) {
		return partialMatches.reduce((best, current) => {
			const bestName = normalizeString(best.name);
			const currentName = normalizeString(current.name);
			
			// Prioritize events with exact word matches
			const searchWords = searchTitle.split(' ').filter(w => w.length > 3);
			const bestExactMatches = searchWords.filter(w => bestName.split(' ').includes(w)).length;
			const currentExactMatches = searchWords.filter(w => currentName.split(' ').includes(w)).length;
			
			if (currentExactMatches > bestExactMatches) return current;
			if (bestExactMatches > currentExactMatches) return best;
			
			// If equal exact matches, prefer shorter names (more specific)
			return currentName.length < bestName.length ? current : best;
		});
	}

	return null;
};

export function FeteRoadmap({ events, onEventClick }: FeteRoadmapProps) {
	const itineraryData = getItineraryData();
	


	return (
		<div className="mb-12 relative">
			{/* Decorative musical notes */}
			<div className="absolute -top-4 -left-4 text-6xl opacity-10 text-purple-500 rotate-12 hidden md:block">
				♪
			</div>
			<div className="absolute -top-8 -right-8 text-4xl opacity-10 text-pink-500 -rotate-12 hidden md:block">
				♫
			</div>
			<div className="absolute top-1/2 -left-8 text-5xl opacity-10 text-orange-500 rotate-45 hidden lg:block">
				♬
			</div>
			
			<Card className="overflow-hidden bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-700 border-0 shadow-2xl relative">
				{/* Animated background pattern */}
				<div className="absolute inset-0 opacity-20">
					<div className="w-full h-full bg-repeat" style={{
						backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
					}} />
				</div>
				
				<CardHeader className="text-center pb-8 relative z-10">
					<div className="flex flex-col items-center space-y-6">
						<div className="text-center">
							<div className="flex items-center justify-center space-x-3 mb-4">
								<Music className="h-8 w-8 text-yellow-300 animate-bounce" />
								<h1 className="text-4xl md:text-5xl font-black text-white tracking-wider">
									OUT OF OFFICE
								</h1>
								<Music className="h-8 w-8 text-yellow-300 animate-bounce delay-150" />
							</div>
							<h2 className="text-3xl md:text-4xl font-bold text-white/90 mb-3 tracking-wide">
								COLLECTIVE
							</h2>
							<div className="relative">
								<p className="text-2xl md:text-3xl font-light italic text-yellow-300 drop-shadow-lg">
									Fête de la Musique
								</p>
								<Star className="absolute -top-2 -right-8 h-6 w-6 text-yellow-300 animate-pulse hidden md:block" />
							</div>
						</div>
						
						{/* Call to Action */}
						<div className="flex flex-col items-center space-y-4">
							<Button 
								size="lg"
								className="bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-gray-900 font-black text-xl px-8 py-4 rounded-full shadow-2xl hover:shadow-yellow-500/25 transition-all duration-300 hover:scale-105 border-0"
							>
								<PartyPopper className="h-6 w-6 mr-3 animate-bounce" />
								REJOIGNEZ-NOUS !
								<Sparkles className="h-6 w-6 ml-3 animate-pulse" />
							</Button>
							<p className="text-white/80 text-lg font-medium max-w-md text-center">
								Découvrez Paris avec nous pendant la Fête de la Musique
							</p>
						</div>
						
						<div className="bg-white/20 backdrop-blur-sm rounded-full px-6 py-3 border border-white/30">
							<div className="flex items-center space-x-3 text-white">
								<Calendar className="h-6 w-6" />
								<span className="text-xl font-bold tracking-wider">PROGRAMME</span>
								<Sparkles className="h-6 w-6 animate-pulse" />
							</div>
						</div>
					</div>
				</CardHeader>
				<CardContent className="px-6 pb-8 relative z-10">
					<Accordion type="multiple" className="w-full space-y-6">
						{itineraryData.map((daySchedule: DaySchedule, dayIndex: number) => (
							<AccordionItem
								key={daySchedule.day}
								value={`day-${dayIndex}`}
								className="border-0 rounded-2xl bg-white/95 backdrop-blur-sm shadow-xl overflow-hidden"
							>
								<AccordionTrigger className="px-4 sm:px-8 py-4 sm:py-6 text-left hover:no-underline group">
									{/* Mobile-first responsive layout */}
									<div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-6 w-full">
										{/* Top row on mobile: Icon + Title */}
										<div className="flex items-center space-x-4 sm:space-x-6">
											<div className="flex-shrink-0 relative">
												<div className={cn(
													"w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform",
													daySchedule.color
												)}>
													<Calendar className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
												</div>
												<div className="absolute -top-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 bg-yellow-400 rounded-full animate-pulse"></div>
											</div>
											<div className="flex-grow">
												<h3 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-0 sm:mb-1">
													{daySchedule.day}
												</h3>
												<p className="text-lg sm:text-xl text-gray-600 font-medium">
													{daySchedule.date}
												</p>
											</div>
										</div>
										
										{/* Bottom row on mobile: Badges */}
										<div className="flex items-center justify-start sm:justify-end space-x-2 sm:space-x-3 ml-16 sm:ml-0">
											<Badge className={cn(
												"text-white font-bold px-3 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm whitespace-nowrap",
												`bg-gradient-to-r ${daySchedule.color}`
											)}>
												{daySchedule.events.length} événement{daySchedule.events.length !== 1 ? "s" : ""}
											</Badge>
											<div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-purple-100 dark:bg-purple-900/20">
												<Music className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 group-hover:animate-spin transition-transform" />
											</div>
										</div>
									</div>
								</AccordionTrigger>
								<AccordionContent className="px-8 pb-8">
									<div className="space-y-4 pt-4">
										{daySchedule.events.map((event: ScheduleEvent, eventIndex: number) => {
											const matchingEvent = findMatchingEvent(event, events, daySchedule);
											const isClickable = matchingEvent && onEventClick && !event.disableClick;
											
											const handleEventClick = () => {
												if (isClickable && matchingEvent && onEventClick) {
													onEventClick(matchingEvent);
												}
											};

											return (
												<div
													key={eventIndex}
													className="relative group"
												>
													<div 
														className={cn(
															"flex flex-col sm:flex-row sm:items-start space-y-3 sm:space-y-0 sm:space-x-5 p-4 sm:p-6 bg-gradient-to-r from-gray-50 to-white rounded-xl border-l-4 border-purple-500 hover:shadow-lg transition-all duration-300 hover:from-purple-50 hover:to-pink-50",
															isClickable && "cursor-pointer hover:scale-[1.02] hover:shadow-xl"
														)}
														onClick={handleEventClick}
													>
														{/* Mobile: Stack vertically, Desktop: Side by side */}
														<div className="flex items-start space-x-4 sm:space-x-0">
															<div className="flex-shrink-0">
																<div className={cn(
																	"w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br rounded-lg sm:rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform overflow-hidden",
																	getEventBadgeColor(event.type)
																)}>
																	<div className="flex items-center justify-center w-full h-full">
																		{getEventIcon(event.type)}
																	</div>
																</div>
															</div>
															<div className="flex-grow sm:hidden">
																<h4 className={cn(
																	"text-lg font-bold text-gray-900 mb-1 group-hover:text-purple-700 transition-colors flex items-center gap-2",
																	isClickable && "text-purple-600"
																)}>
																	{event.title}
																</h4>
																{event.location && (
																	<div className="flex items-center space-x-2 text-gray-600 mb-2">
																		<MapPin className="h-4 w-4 text-purple-500" />
																		<span className="text-sm font-medium">{event.location}</span>
																	</div>
																)}
															</div>
														</div>
														
														<div className="flex-grow">
															{/* Mobile: Horizontal badges, Desktop: Maintain layout */}
															<div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-3">
																<div className="flex items-center space-x-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold px-3 py-1 sm:px-4 sm:py-2 rounded-full">
																	<Clock className="h-3 w-3 sm:h-4 sm:w-4" />
																	<span className="text-sm sm:text-lg font-mono">{event.time}</span>
																</div>
																{event.type && (
																	<Badge className={cn(
																		"font-semibold px-2 py-1 sm:px-3 sm:py-1 text-xs sm:text-sm shadow-sm",
																		getEventBadgeColor(event.type)
																	)}>
																		{event.type}
																	</Badge>
																)}
															</div>
															
															{/* Desktop title and location */}
															<div className="hidden sm:block">
																<h4 className={cn(
																	"text-xl font-bold text-gray-900 mb-2 group-hover:text-purple-700 transition-colors flex items-center gap-2",
																	isClickable && "text-purple-600"
																)}>
																	{event.title}
																</h4>
																{event.location && (
																	<div className="flex items-center space-x-2 text-gray-600">
																		<MapPin className="h-5 w-5 text-purple-500" />
																		<span className="text-base font-medium">{event.location}</span>
																	</div>
																)}
															</div>
														</div>
													</div>
												</div>
											);
										})}
									</div>
								</AccordionContent>
							</AccordionItem>
						))}
					</Accordion>
				</CardContent>
			</Card>
		</div>
	);
} 