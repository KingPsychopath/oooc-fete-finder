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
			<div className="flex items-center justify-between">
				<CardTitle>Featured Events</CardTitle>
				<Button
					variant="outline"
					size="sm"
					onClick={onScrollToAllEvents}
					className="text-sm"
				>
					View All {totalEventsCount} Events
					<ChevronDown className="h-4 w-4 ml-1" />
				</Button>
			</div>

			{/* CTA Message for Event Hosts */}
			<div className="mt-2">
				<Link
					href={FEATURED_EVENTS_CONFIG.FEATURE_PAGE_ROUTE}
					className="text-sm text-muted-foreground hover:underline hover:text-primary transition-colors"
				>
					{FEATURED_EVENTS_CONFIG.CTA_MESSAGE}
				</Link>
			</div>
		</div>
	);
}
