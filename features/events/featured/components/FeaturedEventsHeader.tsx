"use client";
import { CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { FEATURED_EVENTS_CONFIG } from "../constants";

export function FeaturedEventsHeader() {
	return (
		<div className="flex flex-col">
			<CardTitle className="text-2xl [font-family:var(--ooo-font-display)] font-light tracking-[0.01em]">
				Featured Events
			</CardTitle>
			{/* CTA Message positioned close to heading like an underline */}
			<Link
				href={FEATURED_EVENTS_CONFIG.FEATURE_PAGE_ROUTE}
				className="mt-1 text-xs leading-tight text-muted-foreground transition-colors hover:text-foreground hover:underline sm:text-sm"
				style={{ textWrap: "balance" }}
			>
				{FEATURED_EVENTS_CONFIG.CTA_MESSAGE}
			</Link>
		</div>
	);
}
