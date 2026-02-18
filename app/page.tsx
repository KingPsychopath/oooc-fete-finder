import Header from "@/components/Header";
import { generateEventOGImage } from "@/lib/social/og-utils";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { HomeEventsSection } from "./HomeEventsSection";
import { HomeHeader } from "./HomeHeader";

// Keep ISR short to limit stale windows when data changes.
export const revalidate = 300; // 5 minutes in seconds
const homeMapLoadStrategy: "immediate" | "expand" | "idle" = "expand";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

type HomeMetadataProps = {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const firstString = (value: string | string[] | undefined): string | null => {
	if (typeof value === "string") {
		return value;
	}
	if (Array.isArray(value) && value.length > 0) {
		return value[0] ?? null;
	}
	return null;
};

const toDisplayTitle = (value: string): string => {
	const normalized = value.replace(/[-_]+/g, " ").trim();
	if (!normalized) return "Event";
	return normalized
		.split(/\s+/)
		.map((segment) => segment[0]?.toUpperCase() + segment.slice(1))
		.join(" ");
};

export async function generateMetadata({
	searchParams,
}: HomeMetadataProps): Promise<Metadata> {
	const resolvedSearchParams = await searchParams;
	const eventId = firstString(resolvedSearchParams.event);
	if (!eventId) {
		return {};
	}

	const slug = firstString(resolvedSearchParams.slug);
	const eventTitle = toDisplayTitle(slug ?? "");
	const shareTitle = `${eventTitle} | Fête Finder`;
	const shareDescription =
		"Event details from Fête Finder by Out Of Office Collective. View location, time, and nearby picks.";
	const ogImageUrl = generateEventOGImage({
		eventName: eventTitle,
	});
	const eventUrl = new URL("/", siteUrl);
	eventUrl.searchParams.set("event", eventId);
	if (slug) {
		eventUrl.searchParams.set("slug", slug);
	}

	return {
		title: shareTitle,
		description: shareDescription,
		openGraph: {
			type: "website",
			url: eventUrl.toString(),
			title: shareTitle,
			description: shareDescription,
			images: [
				{
					url: ogImageUrl,
					width: 1200,
					height: 630,
					alt: shareTitle,
					type: "image/png",
				},
			],
		},
		twitter: {
			card: "summary_large_image",
			title: shareTitle,
			description: shareDescription,
			images: [{ url: ogImageUrl, alt: shareTitle }],
		},
	};
}

function HomeEventsFallback() {
	return (
		<div className="space-y-6" aria-hidden="true">
			<div className="mb-8 flex min-h-[120px] items-center justify-center rounded-xl border border-border bg-card/60 px-4">
				<div className="h-10 w-full max-w-md animate-pulse rounded-md bg-muted/60" />
			</div>

			<div className="rounded-xl border border-border bg-card/60 p-5">
				<div className="mb-4 h-6 w-44 animate-pulse rounded bg-muted/60" />
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
					<div className="h-44 animate-pulse rounded-lg bg-muted/55" />
					<div className="h-44 animate-pulse rounded-lg bg-muted/55" />
					<div className="hidden h-44 animate-pulse rounded-lg bg-muted/55 lg:block" />
				</div>
			</div>

			<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
				<div className="h-28 animate-pulse rounded-xl border border-border bg-card/60" />
				<div className="h-28 animate-pulse rounded-xl border border-border bg-card/60" />
				<div className="h-28 animate-pulse rounded-xl border border-border bg-card/60" />
			</div>

			<div className="rounded-xl border border-border bg-card/60 p-5">
				<div className="mb-4 h-6 w-48 animate-pulse rounded bg-muted/60" />
				<div className="h-24 animate-pulse rounded-lg border border-border bg-muted/50" />
			</div>

			<div className="min-h-[400px] rounded-xl border border-border bg-card/60 p-5">
				<div className="mb-3 h-6 w-40 animate-pulse rounded bg-muted/60" />
				<div className="h-[320px] animate-pulse rounded-lg bg-muted/50" />
			</div>

			<div className="rounded-xl border border-border bg-card/60 p-5">
				<div className="mb-4 h-6 w-32 animate-pulse rounded bg-muted/60" />
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
					<div className="h-44 animate-pulse rounded-lg bg-muted/55" />
					<div className="h-44 animate-pulse rounded-lg bg-muted/55" />
					<div className="hidden h-44 animate-pulse rounded-lg bg-muted/55 lg:block" />
				</div>
			</div>
		</div>
	);
}

export default function Home() {
	return (
		<div className="ooo-site-shell">
			<Suspense fallback={<Header />}>
				<HomeHeader />
			</Suspense>
			<main
				id="main-content"
				className="container mx-auto px-4 py-8"
				tabIndex={-1}
			>
				{/* Editorial intro — design system: section label + display heading + divider */}
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
					<div className="mt-6 border-t border-border" role="presentation" />
				</section>
				<section className="mb-8 rounded-xl border border-border bg-card/70 px-4 py-5 sm:px-6">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div>
							<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
								Event Hosts
							</p>
							<p className="mt-1 text-sm text-foreground">
								Running an event? Submit it for admin review.
							</p>
						</div>
						<Link
							href={`${basePath}/submit-event`}
							className="inline-flex h-10 items-center rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
						>
							Submit Your Event
						</Link>
					</div>
				</section>

				<Suspense fallback={<HomeEventsFallback />}>
					<HomeEventsSection mapLoadStrategy={homeMapLoadStrategy} />
				</Suspense>
			</main>
		</div>
	);
}
