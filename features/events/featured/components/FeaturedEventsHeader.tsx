"use client";
import { trackNavigationClick } from "@/features/events/engagement/client-tracking";
import Link from "next/link";
import { FEATURED_EVENTS_CONFIG } from "../constants";

export function FeaturedEventsHeader() {
	return (
		<div className="flex flex-col">
			<Link
				href={FEATURED_EVENTS_CONFIG.FEATURE_PAGE_ROUTE}
				onClick={() =>
					trackNavigationClick({
						group: "homepage_link",
						label: "promote_event_spotlight",
					})
				}
				className="mt-1 text-xs leading-tight text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground sm:text-sm"
			>
				Get noticed by thousands more yearners by promoting{" "}
				<span className="whitespace-nowrap">your event →</span>
			</Link>
		</div>
	);
}
