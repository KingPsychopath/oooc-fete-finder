"use client";
import { trackNavigationClick } from "@/features/events/engagement/client-tracking";
import { Megaphone } from "lucide-react";
import Link from "next/link";
import { FEATURED_EVENTS_CONFIG } from "../constants";
import type { SpotlightRotationContext } from "../selection";

const getFeaturedEventsHeading = (
	rotationContext: SpotlightRotationContext,
): string => {
	if (rotationContext.eventPhase === "far") {
		return "Worth a look";
	}

	if (rotationContext.eventPhase === "event-week") {
		return "This week's favourites";
	}

	if (rotationContext.eventPhase === "event-eve") {
		if (rotationContext.bucket === "late") return "Tomorrow's late picks";
		if (rotationContext.bucket === "evening") return "Tomorrow night";
		return "Tomorrow's favourites";
	}

	if (rotationContext.bucket === "morning") return "Start here today";
	if (rotationContext.bucket === "afternoon") return "This afternoon's picks";
	if (rotationContext.bucket === "evening") return "Tonight's favourites";
	if (rotationContext.bucket === "late") return "Late-night picks";

	return "Today's favourites";
};

export function FeaturedEventsHeader({
	rotationContext,
}: {
	rotationContext: SpotlightRotationContext;
}) {
	const heading = getFeaturedEventsHeading(rotationContext);

	return (
		<div className="min-w-0" data-spotlight-phase={rotationContext.eventPhase}>
			<p className="mb-1 text-[11px] font-medium uppercase leading-tight tracking-[0.14em] text-muted-foreground">
				{heading}
			</p>
		</div>
	);
}

export function FeaturedEventsSpotlightLink() {
	return (
		<Link
			href={FEATURED_EVENTS_CONFIG.FEATURE_PAGE_ROUTE}
			onClick={() =>
				trackNavigationClick({
					group: "homepage_link",
					label: "promote_event_spotlight",
				})
			}
			className="inline-flex min-w-0 items-start text-left text-[13px] leading-tight text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground sm:items-center sm:text-sm sm:leading-snug"
		>
			<Megaphone
				className="mr-1.5 mt-0.5 hidden h-3.5 w-3.5 shrink-0 text-foreground/45 sm:inline-block"
				strokeWidth={1.8}
				aria-hidden="true"
			/>
			<span>
				Get noticed by thousands more yearners with a{" "}
				<span className="whitespace-nowrap">Spotlight placement →</span>
			</span>
		</Link>
	);
}
