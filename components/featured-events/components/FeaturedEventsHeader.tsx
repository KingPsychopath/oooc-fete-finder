"use client";
import { CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { FEATURED_EVENTS_CONFIG } from "../constants";

export function FeaturedEventsHeader() {
	return (
		<div className="flex flex-col">
			<CardTitle>Featured Events</CardTitle>
			{/* CTA Message positioned close to heading like an underline */}
			<Link
				href={FEATURED_EVENTS_CONFIG.FEATURE_PAGE_ROUTE}
				className="text-xs sm:text-sm text-muted-foreground hover:underline hover:text-primary transition-colors mt-0.5 leading-tight text-balance"
				style={{ textWrap: "balance" }}
			>
				{FEATURED_EVENTS_CONFIG.CTA_MESSAGE}
			</Link>
		</div>
	);
}
