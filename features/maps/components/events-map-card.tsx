"use client";

import ParisMap from "@/features/maps/components/ParisMap";
import ParisMapLibre from "@/features/maps/components/ParisMapLibre";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Event } from "@/features/events/types";
import { ChevronDown, MapPin } from "lucide-react";

type EventsMapCardProps = {
	events: Event[];
	isExpanded: boolean;
	onToggleExpanded: () => void;
	useMapLibre: boolean;
	onMapTypeChange: (useMapLibre: boolean) => void;
	onEventClick: (event: Event) => void;
	hoveredArrondissement: number | null;
	onArrondissementHover: (arrondissement: number | null) => void;
};

export function EventsMapCard({
	events,
	isExpanded,
	onToggleExpanded,
	useMapLibre,
	onMapTypeChange,
	onEventClick,
	hoveredArrondissement,
	onArrondissementHover,
}: EventsMapCardProps) {
	return (
		<Card className="ooo-site-card py-0">
			<CardHeader className="border-b border-border/70 py-5 pb-4">
				<div className="space-y-3 sm:space-y-0">
					<div className="flex items-center justify-between">
						<CardTitle className="flex items-center space-x-2 flex-wrap">
							<div className="flex items-center space-x-2">
								<MapPin className="h-5 w-5 flex-shrink-0" />
								<span className="text-lg [font-family:var(--ooo-font-display)] font-light sm:text-2xl">
									Paris Event Map
								</span>
							</div>
							<div className="flex items-center space-x-1 mt-1 sm:mt-0">
								<Badge variant="secondary" className="text-xs">
									{events.length} event{events.length !== 1 ? "s" : ""}
								</Badge>
								{useMapLibre && (
									<Badge
										variant="outline"
										className="text-xs bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800"
									>
										Beta
									</Badge>
								)}
							</div>
						</CardTitle>
							<Button
								variant="ghost"
								size="sm"
								onClick={onToggleExpanded}
								className="ml-2 shrink-0 rounded-full border border-border/70 bg-background/65 text-muted-foreground hover:bg-accent hover:text-foreground"
							>
							<ChevronDown
								className={`h-4 w-4 mr-1 transition-transform transition-bouncy ${isExpanded ? "rotate-180" : "rotate-0"}`}
							/>
							<span className="text-sm hidden sm:inline">
								{isExpanded ? "Collapse" : "Expand"}
							</span>
						</Button>
					</div>

					<div className="flex justify-center sm:justify-end">
						<div className="flex items-center space-x-2 rounded-lg border border-border/70 bg-background/65 p-1">
							<span className="text-xs text-muted-foreground px-2">Map:</span>
							<Button
								variant={!useMapLibre ? "default" : "secondary"}
								size="sm"
								onClick={() => onMapTypeChange(false)}
								className="text-xs h-7 px-3"
							>
								Classic
							</Button>
							<Button
								variant={useMapLibre ? "default" : "secondary"}
								size="sm"
								onClick={() => onMapTypeChange(true)}
								className="text-xs h-7 px-3"
							>
								Beta
							</Button>
						</div>
					</div>
				</div>
			</CardHeader>
			<CardContent className="px-3 py-5 pt-3 sm:px-6">
				<div
					className={`relative transition-all duration-300 ease-in-out ${
						isExpanded ? "h-[600px]" : "h-24 sm:h-32"
					} overflow-hidden rounded-xl border border-border/65`}
				>
					<div className="w-full h-full">
						{useMapLibre ? (
							<ParisMapLibre
								events={events}
								onEventClick={onEventClick}
							/>
						) : (
							<ParisMap
								events={events}
								onEventClick={onEventClick}
								onArrondissementHover={onArrondissementHover}
								hoveredArrondissement={hoveredArrondissement}
							/>
						)}
					</div>
					{!isExpanded && (
						<div className="absolute inset-x-0 bottom-0 h-6 sm:h-8 bg-gradient-to-t from-card to-transparent pointer-events-none rounded-b-md" />
					)}
				</div>
			</CardContent>
		</Card>
	);
}
