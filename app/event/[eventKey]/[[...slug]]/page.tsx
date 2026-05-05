import {
	formatDayWithDate,
	formatLocationAreaLong,
	formatPrice,
} from "@/features/events/types";
import {
	type EventShareDetails,
	getEventShareDetails,
} from "@/lib/social/event-share-details";
import {
	generateEventOGImage,
	generateOGMetadata,
} from "@/lib/social/og-utils";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { HomeEventsSection } from "../../../HomeEventsSection";
import { HomeEventsSectionLoading } from "../../../HomeEventsSectionLoading";
import { HomeHeader } from "../../../HomeHeader";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

type EventSharePageProps = {
	params: Promise<{ eventKey: string; slug?: string[] }>;
};

const decodePathSegment = (value: string): string => {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
};

const toDisplayTitle = (value: string): string => {
	const normalized = decodePathSegment(value).replace(/[-_]+/g, " ").trim();
	if (!normalized) return "Event";
	return normalized
		.split(/\s+/)
		.map((segment) => segment[0]?.toUpperCase() + segment.slice(1))
		.join(" ");
};

const normalizeBasePath = (value: string): string => {
	if (!value || value === "/") return "";
	return value.endsWith("/") ? value.slice(0, -1) : value;
};

const getSlug = (value: string[] | undefined): string =>
	Array.isArray(value) && value.length > 0 ? value[0] || "" : "";

const formatArrondissement = (
	value: EventShareDetails["arrondissement"],
): string => {
	if (value === "unknown") return "Paris";
	if (typeof value === "number") return `${value}e arrondissement`;
	return formatLocationAreaLong(value);
};

const formatTimeRange = (event: EventShareDetails): string => {
	const hasStart = Boolean(event.time && event.time !== "TBC");
	const hasEnd = Boolean(event.endTime && event.endTime !== "TBC");
	if (hasStart && hasEnd) return `${event.time} - ${event.endTime}`;
	if (hasStart) return event.time || "";
	return "";
};

const formatVenue = (value: string | undefined): string => {
	if (!value) return "";
	const cleaned = value.trim();
	if (!cleaned || cleaned.toUpperCase() === "TBA") return "";
	return cleaned;
};

const formatEventDate = (event: EventShareDetails): string => {
	if (!event.date) return "";
	return formatDayWithDate(event.day, event.date);
};

const formatEventPrice = (event: EventShareDetails): string => {
	const price = formatPrice(event.price);
	return price === "TBA" ? "" : price;
};

const buildShareDescription = (event: EventShareDetails | null): string => {
	if (!event) {
		return "Event details from Fête Finder by Out Of Office Collective. View location, time, and nearby picks.";
	}

	const parts: string[] = [formatArrondissement(event.arrondissement)];
	const eventDate = formatEventDate(event);
	if (eventDate) parts.push(eventDate);
	const timeRange = formatTimeRange(event);
	if (timeRange) parts.push(timeRange);
	const venue = formatVenue(event.location);
	if (venue) parts.push(venue);
	const price = formatEventPrice(event);
	if (price) parts.push(price);

	return `${parts.join(" · ")}. Event details by Out Of Office Collective.`;
};

const buildEventSharePath = (eventKey: string, slug: string): string => {
	const encodedKey = encodeURIComponent(eventKey);
	const encodedSlug = slug ? `/${encodeURIComponent(slug)}` : "";
	const normalizedBasePath = normalizeBasePath(basePath);
	return `${normalizedBasePath}/event/${encodedKey}${encodedSlug}`;
};

export async function generateMetadata({
	params,
}: EventSharePageProps): Promise<Metadata> {
	const { eventKey, slug } = await params;
	const resolvedSlug = getSlug(slug);
	const fallbackTitle = toDisplayTitle(eventKey);
	const matchedEvent = await getEventShareDetails(eventKey);
	const eventTitle =
		matchedEvent?.name ||
		(resolvedSlug ? toDisplayTitle(resolvedSlug) : fallbackTitle);
	const shareTitle = `${eventTitle} | Fête Finder`;
	const shareDescription = buildShareDescription(matchedEvent);
	const eventSharePath = buildEventSharePath(
		matchedEvent?.eventKey || eventKey,
		matchedEvent?.slug || resolvedSlug,
	);
	const eventUrl = new URL(eventSharePath, siteUrl);

	return {
		...generateOGMetadata({
			title: shareTitle,
			description: shareDescription,
			ogImageUrl: generateEventOGImage({
				eventKey,
			}),
			url: eventUrl.toString(),
			noIndex: true,
		}),
		title: eventTitle,
		alternates: {
			canonical: eventUrl.toString(),
		},
	};
}

export default function EventSharePage() {
	const homeMapLoadStrategy: "immediate" | "expand" | "idle" = "expand";

	return (
		<div className="ooo-site-shell">
			<HomeHeader />
			<main
				id="main-content"
				className="container mx-auto px-4 py-8"
				tabIndex={-1}
			>
				<section className="mb-8" aria-label="Introduction">
					<p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
						Paris · Fête de la Musique
					</p>
					<h2
						className="mt-2 text-2xl font-light tracking-tight text-foreground sm:text-3xl"
						style={{ fontFamily: "var(--ooo-font-display)" }}
					>
						Discover events across the city
					</h2>
					<p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
						Explore live music and cultural events by arrondissement. Use the
						map and filters to find what’s on.
					</p>
					<Link
						href="/how-it-works"
						className="mt-3 inline-flex text-sm font-medium text-foreground underline-offset-4 transition-colors hover:text-foreground/78 hover:underline"
					>
						New here? See how Fête Finder works →
					</Link>
					<div className="mt-6 border-t border-border" role="presentation" />
				</section>
				<Suspense fallback={<HomeEventsSectionLoading />}>
					<HomeEventsSection mapLoadStrategy={homeMapLoadStrategy} />
				</Suspense>
			</main>
		</div>
	);
}
