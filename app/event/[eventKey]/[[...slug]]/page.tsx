import { generateEventOGImage, generateOGMetadata } from "@/lib/social/og-utils";
import { DataManager } from "@/features/data-management/data-manager";
import { formatDayWithDate, formatPrice, type Event } from "@/features/events/types";
import type { Metadata } from "next";
import Link from "next/link";
import { EventShareRedirect } from "./EventShareRedirect";

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

const formatArrondissement = (value: Event["arrondissement"]): string => {
	if (value === "unknown") return "Paris";
	return `${value}e arrondissement`;
};

const formatTimeRange = (event: Event): string => {
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

const formatEventDate = (event: Event): string => {
	if (!event.date) return "";
	return formatDayWithDate(event.day, event.date);
};

const formatEventPrice = (event: Event): string => {
	const price = formatPrice(event.price);
	return price === "TBA" ? "" : price;
};

const buildShareDescription = (event: Event | null): string => {
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

const buildHomeEventPath = (eventKey: string, slug: string): string => {
	const params = new URLSearchParams();
	params.set("event", eventKey);
	if (slug) {
		params.set("slug", slug);
	}
	const normalizedBasePath = normalizeBasePath(basePath);
	const homePath = normalizedBasePath || "/";
	return `${homePath}?${params.toString()}`;
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
	const result = await DataManager.getEventsData({ populateCoordinates: false });
	const matchedEvent = result.success
		? result.data.find(
				(event) => event.eventKey.toLowerCase() === eventKey.trim().toLowerCase(),
			) || null
		: null;
	const eventTitle =
		matchedEvent?.name || (resolvedSlug ? toDisplayTitle(resolvedSlug) : fallbackTitle);
	const shareTitle = `${eventTitle} | Fête Finder`;
	const shareDescription = buildShareDescription(matchedEvent);
	const eventSharePath = buildEventSharePath(eventKey, resolvedSlug);
	const eventUrl = new URL(eventSharePath, siteUrl);
	const ogArrondissement = matchedEvent
		? formatArrondissement(matchedEvent.arrondissement)
		: undefined;
	const ogTime = matchedEvent ? formatTimeRange(matchedEvent) : undefined;
	const ogVenue = matchedEvent ? formatVenue(matchedEvent.location) : undefined;
	const ogDate = matchedEvent ? formatEventDate(matchedEvent) : undefined;
	const ogPrice = matchedEvent ? formatEventPrice(matchedEvent) : undefined;
	const ogGenres = matchedEvent?.genre?.slice(0, 3);

	return {
		...generateOGMetadata({
			title: shareTitle,
			description: shareDescription,
			ogImageUrl: generateEventOGImage({
				eventName: eventTitle,
				arrondissement: ogArrondissement,
				time: ogTime,
				venue: ogVenue,
				date: ogDate,
				price: ogPrice,
				genres: ogGenres,
			}),
			url: eventUrl.toString(),
			noIndex: true,
		}),
		alternates: {
			canonical: eventUrl.toString(),
		},
	};
}

export default async function EventSharePage({ params }: EventSharePageProps) {
	const { eventKey, slug } = await params;
	const resolvedSlug = getSlug(slug);
	const targetPath = buildHomeEventPath(eventKey, resolvedSlug);

	return (
		<div className="ooo-site-shell">
			<EventShareRedirect targetPath={targetPath} />
			<main className="container mx-auto max-w-2xl px-4 py-16">
				<section className="rounded-2xl border border-border/80 bg-card/90 p-6 sm:p-8">
					<p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
						Fete Finder
					</p>
					<h1
						className="mt-2 text-3xl font-light tracking-tight text-foreground sm:text-4xl"
						style={{ fontFamily: "var(--ooo-font-display)" }}
					>
						Opening event details
					</h1>
					<p className="mt-3 text-sm leading-relaxed text-muted-foreground">
						Redirecting to the live event modal on the homepage.
					</p>
					<Link
						href={targetPath}
						className="mt-5 inline-flex rounded-full border border-border/70 px-4 py-2 text-sm text-foreground transition-colors hover:bg-accent"
					>
						Open event now
					</Link>
				</section>
			</main>
		</div>
	);
}
