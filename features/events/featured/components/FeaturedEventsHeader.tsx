"use client";
import { trackNavigationClick } from "@/features/events/engagement/client-tracking";
import { Megaphone } from "lucide-react";
import Link from "next/link";
import { FEATURED_EVENTS_CONFIG } from "../constants";

export function FeaturedEventsHeader() {
	return (
		<div className="min-w-0">
			<Link
				href={FEATURED_EVENTS_CONFIG.FEATURE_PAGE_ROUTE}
				onClick={() =>
					trackNavigationClick({
						group: "homepage_link",
						label: "promote_event_spotlight",
					})
				}
				className="inline-flex w-full items-center gap-1 text-left text-[13px] leading-tight text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground sm:w-auto sm:gap-1.5 sm:text-sm sm:leading-snug"
			>
				<Megaphone
					className="h-3 w-3 shrink-0 text-foreground/45 sm:h-3.5 sm:w-3.5"
					strokeWidth={1.8}
					aria-hidden="true"
				/>
				Get noticed by thousands more yearners with a Spotlight placement →
			</Link>
		</div>
	);
}
