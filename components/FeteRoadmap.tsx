"use client";

import { Calendar, Clock, MapPin, Music, Users, Volume2, Star, Sparkles } from "lucide-react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ItineraryEvent {
	time: string;
	title: string;
	location?: string;
	type?: "drinks" | "brunch" | "meetup" | "music" | "party";
}

interface DaySchedule {
	day: string;
	date: string;
	events: ItineraryEvent[];
	color: string;
}

const itineraryData: DaySchedule[] = [
	{
		day: "Friday",
		date: "20th June",
		color: "from-pink-500 to-rose-600",
		events: [
			{
				time: "22:00",
				title: "Pre-drinks @ Zezei",
				type: "drinks",
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
			},
			{
				time: "16:00",
				title: "Genesis",
				type: "music",
			},
			{
				time: "18:00",
				title: "Hotel Zamara / Mondial",
				location: "Hotel Zamara / Mondial",
				type: "music",
			},
			{
				time: "19:00",
				title: "Spiritual Gangsta",
				type: "music",
			},
			{
				time: "22:00",
				title: "Sixtion x Recess x Everyday People",
				type: "party",
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
				location: "Bourse de Commerce",
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

export function FeteRoadmap() {
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
						{itineraryData.map((daySchedule, dayIndex) => (
							<AccordionItem
								key={daySchedule.day}
								value={`day-${dayIndex}`}
								className="border-0 rounded-2xl bg-white/95 backdrop-blur-sm shadow-xl overflow-hidden"
							>
								<AccordionTrigger className="px-8 py-6 text-left hover:no-underline group">
									<div className="flex items-center space-x-6 w-full">
										<div className="flex-shrink-0 relative">
											<div className={cn(
												"w-16 h-16 bg-gradient-to-br rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform",
												daySchedule.color
											)}>
												<Calendar className="h-8 w-8 text-white" />
											</div>
											<div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full animate-pulse"></div>
										</div>
										<div className="flex-grow">
											<h3 className="text-3xl font-bold text-gray-900 mb-1">
												{daySchedule.day}
											</h3>
											<p className="text-xl text-gray-600 font-medium">
												{daySchedule.date}
											</p>
										</div>
										<div className="flex items-center space-x-3">
											<Badge className={cn(
												"text-white font-bold px-4 py-2 text-sm",
												`bg-gradient-to-r ${daySchedule.color}`
											)}>
												{daySchedule.events.length} événement{daySchedule.events.length !== 1 ? "s" : ""}
											</Badge>
											<Music className="h-6 w-6 text-purple-600 group-hover:animate-spin" />
										</div>
									</div>
								</AccordionTrigger>
								<AccordionContent className="px-8 pb-8">
									<div className="space-y-4 pt-4">
										{daySchedule.events.map((event, eventIndex) => (
											<div
												key={eventIndex}
												className="relative group"
											>
												<div className="flex items-start space-x-5 p-6 bg-gradient-to-r from-gray-50 to-white rounded-xl border-l-4 border-purple-500 hover:shadow-lg transition-all duration-300 hover:from-purple-50 hover:to-pink-50">
													<div className="flex-shrink-0 pt-1">
														<div className={cn(
															"w-12 h-12 bg-gradient-to-br rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform",
															getEventBadgeColor(event.type)
														)}>
															{getEventIcon(event.type)}
														</div>
													</div>
													<div className="flex-grow">
														<div className="flex items-center space-x-4 mb-3">
															<div className="flex items-center space-x-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold px-4 py-2 rounded-full">
																<Clock className="h-4 w-4" />
																<span className="text-lg font-mono">{event.time}</span>
															</div>
															{event.type && (
																<Badge className={cn(
																	"font-semibold px-3 py-1 text-sm shadow-sm",
																	getEventBadgeColor(event.type)
																)}>
																	{event.type}
																</Badge>
															)}
														</div>
														<h4 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-purple-700 transition-colors">
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
												{/* Decorative element */}
												<div className="absolute -right-2 top-1/2 transform -translate-y-1/2 text-2xl opacity-20 group-hover:opacity-40 transition-opacity">
													🎵
												</div>
											</div>
										))}
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