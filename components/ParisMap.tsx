"use client";

import type React from "react";
import { useState } from "react";
import type { Event } from "@/types/events";
import { Badge } from "@/components/ui/badge";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { Star, Euro } from "lucide-react";
import { formatPrice } from "@/types/events";

interface ParisMapProps {
	events: Event[];
	onEventClick: (event: Event) => void;
	onArrondissementHover: (arrondissement: number | null) => void;
	hoveredArrondissement: number | null;
	selectedDay?: string;
}

// Simplified arrondissement positions for the map
const ARRONDISSEMENT_POSITIONS = {
	1: { x: 250, y: 200, width: 35, height: 28 },
	2: { x: 265, y: 165, width: 35, height: 28 },
	3: { x: 300, y: 175, width: 35, height: 32 },
	4: { x: 285, y: 210, width: 35, height: 28 },
	5: { x: 260, y: 245, width: 40, height: 32 },
	6: { x: 215, y: 245, width: 35, height: 32 },
	7: { x: 170, y: 210, width: 45, height: 38 },
	8: { x: 215, y: 140, width: 45, height: 38 },
	9: { x: 250, y: 120, width: 35, height: 32 },
	10: { x: 295, y: 130, width: 40, height: 32 },
	11: { x: 330, y: 175, width: 45, height: 38 },
	12: { x: 340, y: 220, width: 45, height: 42 },
	13: { x: 275, y: 285, width: 50, height: 42 },
	14: { x: 195, y: 285, width: 45, height: 38 },
	15: { x: 140, y: 250, width: 55, height: 48 },
	16: { x: 110, y: 175, width: 55, height: 65 },
	17: { x: 175, y: 110, width: 50, height: 42 },
	18: { x: 235, y: 90, width: 55, height: 42 },
	19: { x: 325, y: 100, width: 45, height: 38 },
	20: { x: 355, y: 145, width: 40, height: 48 },
};

const ParisMap: React.FC<ParisMapProps> = ({
	events,
	onEventClick,
	onArrondissementHover,
	hoveredArrondissement,
	selectedDay,
}) => {
	const [selectedArrondissement, setSelectedArrondissement] = useState<
		number | null
	>(null);

	const getEventsInArrondissement = (arrondissement: number) => {
		return events.filter(
			(event) =>
				event.arrondissement === arrondissement &&
				(!selectedDay || event.day === selectedDay),
		);
	};

	// Get events with unknown arrondissement
	const getUnknownEvents = () => {
		return events.filter(
			(event) =>
				event.arrondissement === "unknown" &&
				(!selectedDay || event.day === selectedDay),
		);
	};

	const getArrondissementColor = (arrondissement: number) => {
		const eventsInArr = getEventsInArrondissement(arrondissement);
		if (eventsInArr.length === 0) return "#f3f4f6";
		if (hoveredArrondissement === arrondissement) return "#3b82f6";
		if (eventsInArr.length >= 3) return "#ef4444";
		if (eventsInArr.length >= 2) return "#f59e0b";
		return "#10b981";
	};

	const getUnknownColor = () => {
		const unknownEvents = getUnknownEvents();
		if (unknownEvents.length === 0) return "#f3f4f6";
		if (hoveredArrondissement === -1) return "#3b82f6"; // Use -1 for unknown hover
		if (unknownEvents.length >= 3) return "#ef4444";
		if (unknownEvents.length >= 2) return "#f59e0b";
		return "#10b981";
	};

	const handleArrondissementClick = (arrondissement: number) => {
		setSelectedArrondissement(
			arrondissement === selectedArrondissement ? null : arrondissement,
		);
	};

	const handleUnknownClick = () => {
		setSelectedArrondissement(selectedArrondissement === -1 ? null : -1);
	};

	const handleKeyDown = (
		event: React.KeyboardEvent,
		arrondissement: number,
	) => {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			handleArrondissementClick(arrondissement);
		}
	};

	const handleUnknownKeyDown = (event: React.KeyboardEvent) => {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			handleUnknownClick();
		}
	};

	return (
		<div className="relative w-full h-[600px] bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 rounded-lg overflow-hidden">
			<TooltipProvider>
				<svg
					viewBox="0 0 500 400"
					className="w-full h-full"
					style={{ background: "transparent" }}
					role="img"
					aria-label="Interactive map of Paris arrondissements with event information"
				>
					{/* Seine River simplified */}
					<path
						d="M 50 220 Q 150 200 250 210 Q 350 220 450 230"
						stroke="#4fc3f7"
						strokeWidth="8"
						fill="none"
						opacity="0.6"
						aria-label="Seine River"
					/>

					{/* Arrondissements */}
					{Object.entries(ARRONDISSEMENT_POSITIONS).map(([arr, pos]) => {
						const arrondissement = Number.parseInt(arr);
						const eventsInArr = getEventsInArrondissement(arrondissement);
						const isSelected = selectedArrondissement === arrondissement;

						return (
							<Tooltip key={arrondissement}>
								<TooltipTrigger asChild>
									<g>
										<rect
											x={pos.x}
											y={pos.y}
											width={pos.width}
											height={pos.height}
											fill={getArrondissementColor(arrondissement)}
											stroke={isSelected ? "#1f2937" : "#6b7280"}
											strokeWidth={isSelected ? 3 : 1}
											rx="4"
											className="cursor-pointer transition-all duration-200 hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-primary"
											onMouseEnter={() => onArrondissementHover(arrondissement)}
											onMouseLeave={() => onArrondissementHover(null)}
											onClick={() => handleArrondissementClick(arrondissement)}
											onKeyDown={(e) => handleKeyDown(e, arrondissement)}
											tabIndex={0}
											role="button"
											aria-label={`${arrondissement}e arrondissement, ${eventsInArr.length} event${eventsInArr.length !== 1 ? "s" : ""}. Click to see details.`}
										/>
										<text
											x={pos.x + pos.width / 2}
											y={pos.y + pos.height / 2}
											textAnchor="middle"
											dominantBaseline="middle"
											className="text-xs font-bold fill-white pointer-events-none"
											style={{ textShadow: "1px 1px 2px rgba(0,0,0,0.5)" }}
										>
											{arrondissement}
										</text>
										{eventsInArr.length > 0 && (
											<circle
												cx={pos.x + pos.width - 8}
												cy={pos.y + 8}
												r="6"
												fill="#dc2626"
												stroke="white"
												strokeWidth="2"
												className="pointer-events-none"
											/>
										)}
										{eventsInArr.length > 0 && (
											<text
												x={pos.x + pos.width - 8}
												y={pos.y + 8}
												textAnchor="middle"
												dominantBaseline="middle"
												className="text-xs font-bold fill-white pointer-events-none"
											>
												{eventsInArr.length}
											</text>
										)}
									</g>
								</TooltipTrigger>
								<TooltipContent>
									<div className="p-3 max-w-[280px]">
										<div className="mb-2">
											<p className="font-semibold text-sm">
												{arrondissement}e Arrondissement
											</p>
											<p className="text-xs text-gray-600 dark:text-gray-300">
												{eventsInArr.length} event
												{eventsInArr.length !== 1 ? "s" : ""}
											</p>
										</div>
										{eventsInArr.length > 0 && (
											<div className="space-y-2">
												{/* Show events in a 2-column grid */}
												<div className="grid grid-cols-2 gap-1">
													{eventsInArr.slice(0, 4).map((event) => (
														<Badge
															key={event.id}
															variant="secondary"
															className="text-xs text-center truncate max-w-[120px] justify-center"
															title={event.name} // Show full name on hover
														>
															{event.name.length > 12 
																? `${event.name.substring(0, 12)}...` 
																: event.name
															}
														</Badge>
													))}
												</div>
												{eventsInArr.length > 4 && (
													<div className="text-center">
														<Badge variant="secondary" className="text-xs">
															+{eventsInArr.length - 4} more
														</Badge>
													</div>
												)}
												{eventsInArr.length <= 4 && eventsInArr.length > 0 && (
													<p className="text-xs text-gray-500 dark:text-gray-400 text-center italic">
														Click to see details
													</p>
												)}
											</div>
										)}
									</div>
								</TooltipContent>
							</Tooltip>
						);
					})}

					{/* Unknown location - small island */}
					{(() => {
						const unknownEvents = getUnknownEvents();
						const isSelected = selectedArrondissement === -1;

						if (unknownEvents.length === 0) return null;

						return (
							<Tooltip key="unknown">
								<TooltipTrigger asChild>
									<g>
										<ellipse
											cx={420}
											cy={350}
											rx={25}
											ry={15}
											fill={getUnknownColor()}
											stroke={isSelected ? "#1f2937" : "#6b7280"}
											strokeWidth={isSelected ? 3 : 1}
											className="cursor-pointer transition-all duration-200 hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-primary"
											onMouseEnter={() => onArrondissementHover(-1)}
											onMouseLeave={() => onArrondissementHover(null)}
											onClick={handleUnknownClick}
											onKeyDown={handleUnknownKeyDown}
											tabIndex={0}
											role="button"
											aria-label={`Unknown location, ${unknownEvents.length} event${unknownEvents.length !== 1 ? "s" : ""}. Click to see details.`}
										/>
										<text
											x={420}
											y={350}
											textAnchor="middle"
											dominantBaseline="middle"
											className="text-xs font-bold fill-white pointer-events-none"
											style={{ textShadow: "1px 1px 2px rgba(0,0,0,0.5)" }}
										>
											?
										</text>
										<circle
											cx={435}
											cy={340}
											r="6"
											fill="#dc2626"
											stroke="white"
											strokeWidth="2"
											className="pointer-events-none"
										/>
										<text
											x={435}
											y={340}
											textAnchor="middle"
											dominantBaseline="middle"
											className="text-xs font-bold fill-white pointer-events-none"
										>
											{unknownEvents.length}
										</text>
									</g>
								</TooltipTrigger>
								<TooltipContent>
									<div className="p-3 max-w-[280px]">
										<div className="mb-2">
											<p className="font-semibold text-sm">Unknown Location</p>
											<p className="text-xs text-gray-600 dark:text-gray-300">
												{unknownEvents.length} event
												{unknownEvents.length !== 1 ? "s" : ""} - Location TBD
											</p>
										</div>
										{unknownEvents.length > 0 && (
											<div className="space-y-2">
												{/* Show events in a 2-column grid */}
												<div className="grid grid-cols-2 gap-1">
													{unknownEvents.slice(0, 4).map((event) => (
														<Badge
															key={event.id}
															variant="secondary"
															className="text-xs text-center truncate max-w-[120px] justify-center"
															title={event.name} // Show full name on hover
														>
															{event.name.length > 12 
																? `${event.name.substring(0, 12)}...` 
																: event.name
															}
														</Badge>
													))}
												</div>
												{unknownEvents.length > 4 && (
													<div className="text-center">
														<Badge variant="secondary" className="text-xs">
															+{unknownEvents.length - 4} more
														</Badge>
													</div>
												)}
												{unknownEvents.length <= 4 && unknownEvents.length > 0 && (
													<p className="text-xs text-gray-500 dark:text-gray-400 text-center italic">
														Click to see details
													</p>
												)}
											</div>
										)}
									</div>
								</TooltipContent>
							</Tooltip>
						);
					})()}

					{/* Map title */}
					<text
						x="250"
						y="30"
						textAnchor="middle"
						className="text-lg font-bold fill-gray-800 dark:fill-gray-200"
					>
						Paris Arrondissements
					</text>

					{/* Legend */}
					<g transform="translate(20, 320)" aria-label="Map legend">
						<rect x="0" y="0" width="12" height="12" fill="#10b981" rx="2" />
						<text
							x="18"
							y="10"
							className="text-xs fill-gray-700 dark:fill-gray-300"
						>
							1 event
						</text>

						<rect x="0" y="20" width="12" height="12" fill="#f59e0b" rx="2" />
						<text
							x="18"
							y="30"
							className="text-xs fill-gray-700 dark:fill-gray-300"
						>
							2 events
						</text>

						<rect x="0" y="40" width="12" height="12" fill="#ef4444" rx="2" />
						<text
							x="18"
							y="50"
							className="text-xs fill-gray-700 dark:fill-gray-300"
						>
							3+ events
						</text>
					</g>
				</svg>

				{/* Event list for selected arrondissement */}
				{selectedArrondissement && (
					<div className="absolute bottom-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 max-w-sm">
						<div className="flex items-center justify-between mb-2">
							<h3 className="font-semibold">
								{selectedArrondissement === -1
									? "Unknown Location Events"
									: `${selectedArrondissement}e Arrondissement Events`}
							</h3>
							<button
								onClick={() => setSelectedArrondissement(null)}
								className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
								aria-label="Close event list"
							>
								✕
							</button>
						</div>
						<div className="space-y-2 max-h-40 overflow-y-auto">
							{(selectedArrondissement === -1
								? getUnknownEvents()
								: getEventsInArrondissement(selectedArrondissement)
							).map((event) => (
								<button
									key={event.id}
									className={`w-full text-left p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-primary relative ${
										event.isOOOCPick
											? "bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-950 dark:to-amber-950 border border-yellow-200 dark:border-yellow-800"
											: "bg-gray-50 dark:bg-gray-700"
									}`}
									onClick={() => onEventClick(event)}
									aria-label={`Event: ${event.name}, ${event.time}, ${event.day}`}
								>
									<div className="flex items-center justify-between">
										<div className="flex-1">
											<div className="flex items-center space-x-1">
												<p className="font-medium text-sm">{event.name}</p>
												{event.isOOOCPick && (
													<Star className="h-3 w-3 text-yellow-500 fill-current" />
												)}
											</div>
											<p className="text-xs text-gray-600 dark:text-gray-400">
												{event.time} • {event.day}
											</p>
											{/* Price display */}
											<div className="flex items-center space-x-1 mt-1">
												<Euro className="h-3 w-3 text-gray-400" />
												<span
													className={`text-xs ${
														formatPrice(event.price) === "Free"
															? "text-green-600 dark:text-green-400 font-medium"
															: "text-gray-500 dark:text-gray-400"
													}`}
												>
													{formatPrice(event.price)}
												</span>
											</div>
										</div>
										{event.isOOOCPick && (
											<span className="text-yellow-500 text-xs">🌟</span>
										)}
									</div>
								</button>
							))}
						</div>
					</div>
				)}
			</TooltipProvider>
		</div>
	);
};

export default ParisMap;
