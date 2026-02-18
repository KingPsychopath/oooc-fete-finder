"use client";

import ParisMapLibre from "@/features/maps/components/ParisMapLibre";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Event } from "@/features/events/types";
import { ChevronDown, LocateFixed, MapPin } from "lucide-react";
import { useEffect, useState } from "react";

export type MapLoadStrategy = "immediate" | "expand" | "idle";

type EventsMapCardProps = {
	events: Event[];
	isExpanded: boolean;
	onToggleExpanded: () => void;
	onEventClick: (event: Event) => void;
	mapLoadStrategy?: MapLoadStrategy;
};

export function EventsMapCard({
	events,
	isExpanded,
	onToggleExpanded,
	onEventClick,
	mapLoadStrategy = "idle",
}: EventsMapCardProps) {
	const [hasMountedMap, setHasMountedMap] = useState(false);

	useEffect(() => {
		if (hasMountedMap) return;

		if (mapLoadStrategy === "immediate") {
			setHasMountedMap(true);
			return;
		}

		if (mapLoadStrategy === "expand") {
			if (isExpanded) {
				setHasMountedMap(true);
			}
			return;
		}

		if (isExpanded) {
			setHasMountedMap(true);
			return;
		}

		let cancelled = false;
		let idleId: number | null = null;
		let timeoutId: ReturnType<typeof setTimeout> | null = null;
		const mountPreview = () => {
			if (!cancelled) {
				setHasMountedMap(true);
			}
		};

		if (typeof window !== "undefined" && "requestIdleCallback" in window) {
			idleId = window.requestIdleCallback(mountPreview, { timeout: 1200 });
		} else {
			timeoutId = setTimeout(mountPreview, 700);
		}

		return () => {
			cancelled = true;
			if (
				idleId !== null &&
				typeof window !== "undefined" &&
				"cancelIdleCallback" in window
			) {
				window.cancelIdleCallback(idleId);
			}
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
		};
	}, [isExpanded, hasMountedMap, mapLoadStrategy]);

	const shouldRenderMap = hasMountedMap || isExpanded;

	return (
		<Card className="ooo-site-card py-0">
			<CardHeader className="border-b border-border/70 py-5 pb-4">
				<div className="space-y-4 sm:space-y-3">
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
								<Badge
									variant="outline"
									className="border-border/70 bg-background/52 text-xs"
								>
									MapLibre
								</Badge>
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
							<span className="px-2 text-xs text-muted-foreground">
								Explore:
							</span>
							<Button
								variant="secondary"
								size="sm"
								disabled
								className="text-xs h-7 px-3"
							>
								<LocateFixed className="mr-1 h-3.5 w-3.5" />
								Near me (soon)
							</Button>
						</div>
					</div>
				</div>
			</CardHeader>
			<CardContent className="px-3 py-5 pt-3 sm:px-6">
				<div
					className={`relative contain-layout motion-safe:transition-[height] motion-safe:duration-200 motion-safe:ease-out ${
						isExpanded ? "h-[600px]" : "h-24 sm:h-32"
					} overflow-hidden rounded-xl border border-border/65`}
				>
					<div className="w-full h-full">
						{shouldRenderMap ? (
							<ParisMapLibre events={events} onEventClick={onEventClick} />
						) : (
							<div className="flex h-full items-center justify-center bg-background/50 px-4 text-center">
								<p className="text-xs text-muted-foreground sm:text-sm">
									Map preview loading quietly. Expand to explore by
									arrondissement.
								</p>
							</div>
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
