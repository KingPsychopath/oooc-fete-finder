import {
	formatDayWithDate,
	formatLocationAreaLong,
	formatPrice,
} from "@/features/events/types";
import {
	type EventShareDetails,
	getEventShareEvent,
	getEventShareDetails,
} from "@/lib/social/event-share-details";
import {
	generateEventOGImage,
	generateOGMetadata,
} from "@/lib/social/og-utils";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { HomeHeader } from "../../../HomeHeader";
import { EventShareClient } from "./EventShareClient";
import { EventShareModalPreview } from "./EventShareModalPreview";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

type EventSharePageProps = {
	params: Promise<{ eventKey: string; slug?: string[] }>;
};

export const revalidate = 3600;

export async function generateStaticParams(): Promise<
	Array<{ eventKey: string; slug?: string[] }>
> {
	return [];
}

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

export default async function EventSharePage({ params }: EventSharePageProps) {
	const { eventKey } = await params;
	const event = await getEventShareEvent(eventKey);

	if (!event) {
		notFound();
	}

	return (
		<div className="ooo-site-shell">
			<HomeHeader />
			<main
				id="main-content"
				className="container mx-auto px-4 py-8"
				tabIndex={-1}
			>
				<EventShareModalPreview event={event} />
				<Suspense fallback={null}>
					<EventShareClient event={event} />
				</Suspense>
			</main>
		</div>
	);
}
