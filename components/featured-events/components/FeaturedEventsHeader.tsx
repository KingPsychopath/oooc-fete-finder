"use client";

import React from "react";
import Link from "next/link";
import { CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { FEATURED_EVENTS_CONFIG } from "../constants";

type FeaturedEventsHeaderProps = {
	totalEventsCount: number;
	onScrollToAllEvents: () => void;
};

export function FeaturedEventsHeader({
	totalEventsCount,
	onScrollToAllEvents,
}: FeaturedEventsHeaderProps) {
	return (
		<div>
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
				<div className="flex flex-col">
					<CardTitle>Featured Events</CardTitle>
					{/* CTA Message positioned close to heading like an underline */}
					<Link
						href={FEATURED_EVENTS_CONFIG.FEATURE_PAGE_ROUTE}
						className="text-xs sm:text-sm text-muted-foreground hover:underline hover:text-primary transition-colors mt-0.5 leading-tight"
					>
						{FEATURED_EVENTS_CONFIG.CTA_MESSAGE}
					</Link>
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={onScrollToAllEvents}
					className="text-sm shrink-0"
				>
					View All {totalEventsCount} Events
					<ChevronDown className="h-4 w-4 ml-1" />
				</Button>
			</div>
		</div>
	);
}
