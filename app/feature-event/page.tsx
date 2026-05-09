import { CopyEmailButton } from "@/components/CopyEmailButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FEATURED_EVENTS_CONFIG } from "@/features/events/featured/constants";
import { getFeaturedProjection } from "@/features/events/featured/service";
import { generateOGMetadata, generatePresetOGImage } from "@/lib/social/og-utils";
import {
	ArrowRight,
	CircleHelp,
	Megaphone,
	ShieldCheck,
	TrendingUp,
} from "lucide-react";
import type { Metadata } from "next";
import { unstable_cache as cache } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";
import {
	FeatureEventRequestBuilder,
	type PromotionAddOn,
	type PromotionPackage,
} from "./FeatureEventRequestBuilder";
import { FeatureEventStatusSection } from "./FeatureEventStatusSection";

export const metadata: Metadata = {
	...generateOGMetadata({
		title: "Partner With OOOC | Fete Finder",
		description:
			"Request Spotlight and Promoted placements for Fete de la Musique 2026 in minutes.",
		ogImageUrl: generatePresetOGImage("feature-event"),
		url: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}${process.env.NEXT_PUBLIC_BASE_PATH || ""}/feature-event`,
	}),
	keywords: [
		"fete de la musique",
		"paris event promotion",
		"spotlight listing",
		"event sponsorship",
	],
};

export const revalidate = 3600;

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const contactEmail = "hello@outofofficecollective.co.uk";
const fallbackContactHref = `mailto:${contactEmail}?subject=OOOC%20Fete%202026%20-%20Partnership%20Inquiry`;
const mediaKitHref = `${basePath}/media-kit/OOOC-Fete-2026-Media-Kit.pdf`;
const ooocPressKitHref = `${basePath}/media-kit/OOOC-Press-Kit.pdf`;

const packages: PromotionPackage[] = [
	{
		id: "spotlight-standard",
		name: "Spotlight Standard",
		price: 80,
		priceLabel: "EUR 80",
		description: "Best for early-season bookings before peak June pricing.",
		includes: [
			"Above-the-fold Spotlight placement",
			"Pinned to top of relevant search results",
			"Featured map treatment",
			"WhatsApp community announcement included",
		],
		badge: "Only 3 Spotlight slots visible at once",
		tier: "spotlight",
	},
	{
		id: "spotlight-takeover",
		name: "Spotlight Takeover",
		price: 100,
		priceLabel: "EUR 100",
		description:
			"Premium placement for the final Fete push: June 15-20, 2026.",
		includes: [
			"All Spotlight Standard benefits",
			"Priority activation window (June 15-20, 2026)",
			"WhatsApp community announcement included",
			"Ideal for final-week urgency",
		],
		badge: "EUR 100 now. EUR 150 during peak week.",
		tier: "spotlight",
	},
	{
		id: "promoted-listing",
		name: "Promoted Listing",
		price: 40,
		priceLabel: "EUR 40",
		description: "Mid-tier visibility without full Spotlight placement.",
		includes: [
			"Promoted badge on event card",
			"Visual highlight in map event list",
			"Promoted label in list results",
		],
		tier: "promoted",
	},
];

const addOns: PromotionAddOn[] = [
	{
		id: "whatsapp-announcement",
		name: "WhatsApp Announcement Add-on",
		price: 50,
		priceLabel: "+ EUR 50",
		description:
			"Included with Spotlight packages, or add it to Promoted Listing.",
		reachHint: "Typically reaches 2,000+ community members.",
		includedWith: ["spotlight"],
	},
	{
		id: "newsletter-inclusion",
		name: "Newsletter Inclusion Add-on",
		price: 75,
		priceLabel: "+ EUR 75",
		description: "Editorial-style feature inside OOOC email newsletter.",
		reachHint: "Sent to 16,000 people.",
	},
];

const getFeaturedProjectionCached = cache(
	async () => getFeaturedProjection().catch(() => null),
	["feature-event-projection"],
	{ revalidate: 3600, tags: ["featured-events", "promoted-events"] },
);

async function SpotlightAvailabilityBadge() {
	const featuredProjection = await getFeaturedProjectionCached();
	const spotlightSlotsTotal = FEATURED_EVENTS_CONFIG.MAX_FEATURED_EVENTS;
	const spotlightActiveCount = featuredProjection?.active.length ?? 0;
	const spotlightSlotsLeft = Math.max(
		0,
		spotlightSlotsTotal - spotlightActiveCount,
	);

	return (
		<Badge
			className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.08em] ${
				spotlightSlotsLeft <= 1
					? "bg-rose-600 text-rose-50"
					: "bg-emerald-700 text-emerald-50"
			}`}
		>
			{spotlightSlotsLeft}/{spotlightSlotsTotal} spotlight slots left
		</Badge>
	);
}

function SpotlightAvailabilityBadgeFallback() {
	return (
		<Badge className="rounded-full bg-muted px-3 py-1 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
			Checking spotlight slots
		</Badge>
	);
}

function FeatureEventStatusSectionFallback() {
	return (
		<div
			className="rounded-2xl border border-border/80 bg-card p-6"
			aria-hidden="true"
		>
			<div className="h-3 w-36 animate-pulse rounded bg-muted/60" />
			<div className="mt-3 h-8 w-full max-w-sm animate-pulse rounded bg-muted/55" />
			<div className="mt-4 h-4 w-full max-w-xl animate-pulse rounded bg-muted/50" />
		</div>
	);
}

export default async function FeatureEventPage() {
	return (
		<>
			<main className="container mx-auto max-w-6xl px-4 py-8 pb-28 sm:py-10 sm:pb-12">
				<section className="rounded-2xl border border-border/80 bg-card/85 p-5 shadow-[0_8px_22px_rgba(18,14,10,0.14)] sm:p-8">
					<p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
						OOOC Partnerships
					</p>
					<h1
						className="mt-2 text-3xl font-light leading-tight tracking-tight text-foreground sm:text-4xl"
						style={{ fontFamily: "var(--ooo-font-display)" }}
					>
						Get your event discovered on Fete night
					</h1>
					<p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
						Reach people at the exact moment they decide where to go. Build a
						promotion request now, then we confirm activation by email.
					</p>
					<div className="mt-5 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
						<div className="rounded-xl border border-border/70 bg-background/70 p-3">
							<p className="text-muted-foreground">Peak views</p>
							<p className="mt-1 text-lg font-medium text-foreground">50,000</p>
						</div>
						<div className="rounded-xl border border-border/70 bg-background/70 p-3">
							<p className="text-muted-foreground">Registered users</p>
							<p className="mt-1 text-lg font-medium text-foreground">3,000+</p>
						</div>
						<div className="rounded-xl border border-border/70 bg-background/70 p-3">
							<p className="text-muted-foreground">
								WhatsApp community members
							</p>
							<p className="mt-1 text-lg font-medium text-foreground">2,000+</p>
						</div>
					</div>
					<div className="mt-6 flex flex-wrap items-center gap-3">
						<Button
							nativeButton={false}
							className="rounded-full border border-border bg-foreground px-5 text-background hover:bg-foreground/90"
							render={<a href="#promotion-request" />}
						>
							Build promotion request
						</Button>
						<Button
							nativeButton={false}
							variant="outline"
							className="rounded-full"
							render={
								<a
									href={mediaKitHref}
									target="_blank"
									rel="noopener noreferrer"
								/>
							}
						>
							Get Fete media kit
						</Button>
						<Button
							nativeButton={false}
							variant="outline"
							className="rounded-full"
							render={
								<a
									href={ooocPressKitHref}
									target="_blank"
									rel="noopener noreferrer"
								/>
							}
						>
							Get OOOC press kit
						</Button>
					</div>
					<p className="mt-3 text-xs text-muted-foreground">
						Request now, then we confirm fit, timing, and payment details before
						anything goes live.
					</p>
					<p className="mt-4 text-xs text-muted-foreground">
						No event yet? Why are you here.{"  "}
						<Link
							href={`${basePath}/submit-event`}
							className="text-foreground underline underline-offset-4 transition-colors hover:text-foreground/80"
						>
							Submit yours here.
						</Link>
					</p>
				</section>

				<section className="mt-6">
					<Suspense fallback={<FeatureEventStatusSectionFallback />}>
						<FeatureEventStatusSection />
					</Suspense>
				</section>

				<section
					id="promotion-request"
					className="mt-8"
					aria-label="Promotion request"
				>
					<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
						<Badge className="rounded-full border border-amber-700/20 bg-amber-500/15 px-3 py-1 text-[11px] uppercase tracking-[0.08em] text-amber-900 dark:text-amber-100">
							Prices increase June 15 to June 20
						</Badge>
						<Suspense fallback={<SpotlightAvailabilityBadgeFallback />}>
							<SpotlightAvailabilityBadge />
						</Suspense>
					</div>
					<FeatureEventRequestBuilder
						packages={packages}
						addOns={addOns}
						contactEmail={contactEmail}
					/>
				</section>

				<section
					className="mt-8 grid gap-4 md:grid-cols-2"
					aria-label="Add-ons and process"
				>
					<Card className="border border-border/80 bg-card">
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-lg font-medium">
								<ArrowRight className="h-4 w-4 text-muted-foreground" />
								How it works
							</CardTitle>
						</CardHeader>
						<CardContent>
							<ol className="space-y-4 text-sm">
								<li className="flex gap-3">
									<span className="w-5 font-medium text-muted-foreground">
										1.
									</span>
									<div>
										<p className="font-medium text-foreground">
											Choose package
										</p>
										<p className="mt-0.5 text-muted-foreground">
											Select Spotlight or Promoted based on your visibility
											goal.
										</p>
									</div>
								</li>
								<li className="flex gap-3">
									<span className="w-5 font-medium text-muted-foreground">
										2.
									</span>
									<div>
										<p className="font-medium text-foreground">
											Send your request
										</p>
										<p className="mt-0.5 text-muted-foreground">
											We receive your package, add-ons, event details, and
											estimated total in one clear message.
										</p>
									</div>
								</li>
								<li className="flex gap-3">
									<span className="w-5 font-medium text-muted-foreground">
										3.
									</span>
									<div>
										<p className="font-medium text-foreground">
											We activate and report back
										</p>
										<p className="mt-0.5 text-muted-foreground">
											After confirmation, your campaign is reviewed, scheduled,
											and activated in the booked tier with post-event ROI
											reporting once the promotion period ends.
										</p>
									</div>
								</li>
							</ol>
							<div className="mt-5 rounded-xl border border-border/70 bg-background/60 p-4 text-sm text-muted-foreground">
								<p className="flex items-center gap-2 font-medium text-foreground">
									<ShieldCheck className="h-4 w-4" />
									Post-event proof for partners
								</p>
								<p className="mt-1">
									Paid partners receive a private stats link with outbound
									clicks and calendar saves.
								</p>
							</div>
						</CardContent>
					</Card>

					<Card className="border border-border/80 bg-card">
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-lg font-medium">
								<Megaphone className="h-4 w-4 text-muted-foreground" />
								Not sure what to choose?
							</CardTitle>
						</CardHeader>
						<CardContent className="text-sm text-muted-foreground">
							<p>
								Spotlight is best when you want your event to be seen first.
								Promoted Listing is best when you want a lighter visibility lift
								without taking one of the top slots.
							</p>
							<p className="mt-3">
								Send the request even if you are unsure. We will recommend the
								best fit before confirming anything.
							</p>
						</CardContent>
					</Card>
				</section>

				<section className="mt-8" aria-label="FAQ">
					<Card className="border border-border/80 bg-card">
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-lg font-medium">
								<CircleHelp className="h-4 w-4 text-muted-foreground" />
								FAQ
							</CardTitle>
						</CardHeader>
						<CardContent className="grid gap-4 text-sm md:grid-cols-2">
							<div>
								<p className="font-medium text-foreground">
									Can I reserve now and run later?
								</p>
								<p className="mt-1 text-muted-foreground">
									Yes. After confirmation, your order enters the activation
									queue, then we confirm your exact go-live window before
									publishing.
								</p>
							</div>
							<div>
								<p className="font-medium text-foreground">
									Do you share your email list?
								</p>
								<p className="mt-1 text-muted-foreground">
									No. Partners receive aggregated performance stats only.
								</p>
							</div>
							<div>
								<p className="font-medium text-foreground">
									Do free events qualify?
								</p>
								<p className="mt-1 text-muted-foreground">
									Yes. Spotlight and Promoted work for both ticketed and free
									events.
								</p>
							</div>
							<div>
								<p className="font-medium text-foreground">
									Do I need a specific ticket platform?
								</p>
								<p className="mt-1 text-muted-foreground">
									No. We can link to Shotgun, RA, DICE, Eventbrite, or your own
									page.
								</p>
							</div>
						</CardContent>
					</Card>
				</section>

				<section className="mt-8 rounded-2xl border border-border/80 bg-card p-6 text-center">
					<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
						Final call
					</p>
					<h2 className="mt-2 text-2xl font-light text-foreground">
						Send a complete request in one message
					</h2>
					<p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
						Choose your package, add your details, and the builder formats
						everything for the OOOC team to confirm.
					</p>
					<div className="mt-5 flex flex-wrap items-center justify-center gap-3">
						<Button
							nativeButton={false}
							className="rounded-full border border-border bg-primary text-primary-foreground hover:bg-primary/90"
							render={<a href="#promotion-request" />}
						>
							Build request
						</Button>
						<Button
							nativeButton={false}
							variant="outline"
							className="rounded-full"
							render={<a href={fallbackContactHref} />}
						>
							Email us
						</Button>
					</div>
					<p className="mt-4 text-sm text-muted-foreground">
						{contactEmail}
						<CopyEmailButton email={contactEmail} />
					</p>
					<Link
						href={basePath || "/"}
						className="mt-5 inline-flex items-center gap-2 text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
					>
						<TrendingUp className="h-4 w-4" />
						Back to events
					</Link>
				</section>
			</main>
		</>
	);
}
