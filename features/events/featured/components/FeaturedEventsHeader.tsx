"use client";
import { trackNavigationClick } from "@/features/events/engagement/client-tracking";
import { Megaphone } from "lucide-react";
import Link from "next/link";
import { FEATURED_EVENTS_CONFIG } from "../constants";
import type { SpotlightRotationContext } from "../selection";

export function FeaturedEventsHeader({
	rotationContext,
}: {
	rotationContext: SpotlightRotationContext;
}) {
	return (
		<div className="min-w-0" data-spotlight-phase={rotationContext.eventPhase}>
			<p className="mb-1 text-[11px] font-medium uppercase leading-tight tracking-[0.14em] text-muted-foreground">
				Current favourites
			</p>
			<Link
				href={FEATURED_EVENTS_CONFIG.FEATURE_PAGE_ROUTE}
				onClick={() =>
					trackNavigationClick({
						group: "homepage_link",
						label: "promote_event_spotlight",
					})
				}
				className="inline w-full text-left text-[13px] leading-tight text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground sm:w-auto sm:text-sm sm:leading-snug"
			>
				<Megaphone
					className="mr-1 hidden h-3 w-3 shrink-0 align-[-0.125em] text-foreground/45 sm:mr-1.5 sm:inline-block sm:h-3.5 sm:w-3.5"
					strokeWidth={1.8}
					aria-hidden="true"
				/>
				Get noticed by thousands more yearners with a{" "}
				<span className="whitespace-nowrap">Spotlight placement →</span>
			</Link>
		</div>
	);
}
