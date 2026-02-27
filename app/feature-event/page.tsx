import { CopyEmailButton } from "@/components/CopyEmailButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	ArrowRight,
	CheckCircle,
	CircleHelp,
	Megaphone,
	ShieldCheck,
	Star,
	TrendingUp,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { FEATURED_EVENTS_CONFIG } from "@/features/events/featured/constants";
import { getFeaturedProjection } from "@/features/events/featured/service";
import { FeatureEventHeader } from "./FeatureEventHeader";
import { FeatureEventStatusSection } from "./FeatureEventStatusSection";

type Package = {
	name: string;
	priceLabel: string;
	description: string;
	includes: string[];
	badge?: string;
	tier: "spotlight" | "promoted";
	stripeUrl: string | undefined;
};

type AddOn = {
	name: string;
	priceLabel: string;
	description: string;
	reachHint?: string;
	stripeUrl: string | undefined;
};

export const metadata: Metadata = {
	title: "Partner With OOOC | Fete Finder",
	description:
		"Book Spotlight and Promoted placements for Fete de la Musique 2026 in minutes via Stripe Payment Links.",
	keywords: [
		"fete de la musique",
		"paris event promotion",
		"spotlight listing",
		"event sponsorship",
	],
};

export const dynamic = "force-dynamic";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const contactEmail = "hello@outofofficecollective.co.uk";
const fallbackContactHref = `mailto:${contactEmail}?subject=OOOC%20Fete%202026%20-%20Partnership%20Inquiry`;
const mediaKitHref = `${basePath}/media-kit/OOOC-Fete-2026-Media-Kit.pdf`;

const packages: Package[] = [
	{
		name: "Spotlight Standard",
		priceLabel: "EUR 80",
		description: "Best for early-season bookings before peak June pricing.",
		includes: [
			"Above-the-fold Spotlight placement",
			"Pinned to top of relevant search results",
			"Featured map treatment",
		],
		badge: "Only 3 Spotlight slots visible at once",
		tier: "spotlight",
		stripeUrl: process.env.NEXT_PUBLIC_STRIPE_LINK_SPOTLIGHT_STANDARD,
	},
	{
		name: "Spotlight Takeover",
		priceLabel: "EUR 150",
		description:
			"Reserve now for premium placement from June 15 to June 20, 2026.",
		includes: [
			"All Spotlight Standard benefits",
			"Priority activation window (June 15-20, 2026)",
			"Ideal for final-week urgency",
		],
		badge: "Reserve now for peak week",
		tier: "spotlight",
		stripeUrl: process.env.NEXT_PUBLIC_STRIPE_LINK_SPOTLIGHT_TAKEOVER,
	},
	{
		name: "Promoted Listing",
		priceLabel: "EUR 40",
		description: "Mid-tier visibility without full Spotlight placement.",
		includes: [
			"Promoted badge on event card",
			"Visual highlight in map event list",
			"Promoted label in list results",
		],
		tier: "promoted",
		stripeUrl: process.env.NEXT_PUBLIC_STRIPE_LINK_PROMOTED,
	},
];

const addOns: AddOn[] = [
	{
		name: "WhatsApp Announcement Add-on",
		priceLabel: "+ EUR 50",
		description: "Admin channel mention to high-intent community members.",
		reachHint: "Typically reaches 1,000-2,000 community members.",
		stripeUrl: process.env.NEXT_PUBLIC_STRIPE_LINK_ADDON_WHATSAPP,
	},
	{
		name: "Newsletter Inclusion Add-on",
		priceLabel: "+ EUR 75",
		description: "Editorial-style feature inside OOOC email newsletter.",
		reachHint: "Sent to 2,000+ registered subscribers and growing weekly.",
		stripeUrl: process.env.NEXT_PUBLIC_STRIPE_LINK_ADDON_NEWSLETTER,
	},
];

function StripeOrContactButton({
	url,
	label,
	className,
}: {
	url: string | undefined;
	label: string;
	className?: string;
}) {
	const href = url && url.trim().length > 0 ? url : fallbackContactHref;
	const isExternal = href.startsWith("http");

	return (
		<Button
			nativeButton={false}
			className={className}
			render={
				<a
					href={href}
					target={isExternal ? "_blank" : undefined}
					rel={isExternal ? "noopener noreferrer" : undefined}
				/>
			}
		>
			{label}
		</Button>
	);
}

export default async function FeatureEventPage() {
	const featuredProjection = await getFeaturedProjection().catch(() => null);
	const spotlightSlotsTotal = FEATURED_EVENTS_CONFIG.MAX_FEATURED_EVENTS;
	const spotlightActiveCount = featuredProjection?.active.length ?? 0;
	const spotlightSlotsLeft = Math.max(
		0,
		spotlightSlotsTotal - spotlightActiveCount,
	);

	return (
		<div className="ooo-site-shell">
			<FeatureEventHeader />
			<main className="container mx-auto max-w-6xl px-4 py-10 pb-28 sm:pb-12">
				<section className="rounded-2xl border border-border/80 bg-card/85 p-6 shadow-[0_8px_22px_rgba(18,14,10,0.14)] sm:p-8">
					<p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
						OOOC Partnerships
					</p>
					<h1
						className="mt-2 text-3xl font-light tracking-tight text-foreground sm:text-4xl"
						style={{ fontFamily: "var(--ooo-font-display)" }}
					>
						Get your event discovered on Fete night
					</h1>
					<p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
						Reach people at the exact moment they decide where to go. Book your
						placement now and activate fast.
					</p>
					<div className="mt-5 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
						<div className="rounded-xl border border-border/70 bg-background/70 p-3">
							<p className="text-muted-foreground">Peak views</p>
							<p className="mt-1 text-lg font-medium text-foreground">30,000</p>
						</div>
						<div className="rounded-xl border border-border/70 bg-background/70 p-3">
							<p className="text-muted-foreground">Registered users</p>
							<p className="mt-1 text-lg font-medium text-foreground">2,000+</p>
						</div>
						<div className="rounded-xl border border-border/70 bg-background/70 p-3">
							<p className="text-muted-foreground">
								WhatsApp community members
							</p>
							<p className="mt-1 text-lg font-medium text-foreground">
								1,000-2,000
							</p>
						</div>
					</div>
					<div className="mt-6 flex flex-wrap items-center gap-3">
						<StripeOrContactButton
							url={process.env.NEXT_PUBLIC_STRIPE_LINK_SPOTLIGHT_STANDARD}
							label="Book placement now"
							className="rounded-full border border-border bg-foreground px-5 text-background hover:bg-foreground/90"
						/>
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
							Get media kit
						</Button>
					</div>
					<p className="mt-3 text-xs text-muted-foreground">
						After payment, your order enters our activation queue and is
						reviewed by the OOOC team before going live.
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
					<FeatureEventStatusSection />
				</section>

				<section className="mt-8" aria-label="Partnership packages">
					<div className="mb-4 flex items-center justify-between gap-3">
						<div>
							<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
								Core offers
							</p>
							<h2 className="mt-1 text-2xl font-light text-foreground">
								Choose a package and pay in one click
							</h2>
							<p className="mt-1 text-xs text-muted-foreground">
								Spotlight Standard and Spotlight Takeover share the same 3-slot
								Spotlight inventory.
							</p>
						</div>
						<div className="flex flex-wrap items-center justify-end gap-2">
							<Badge className="rounded-full border border-amber-700/20 bg-amber-500/15 px-3 py-1 text-[11px] uppercase tracking-[0.08em] text-amber-900 dark:text-amber-100">
								Prices increase June 15 to June 20
							</Badge>
							<Badge
								className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.08em] ${
									spotlightSlotsLeft <= 1
										? "bg-rose-600 text-rose-50"
										: "bg-emerald-700 text-emerald-50"
								}`}
							>
								{spotlightSlotsLeft}/{spotlightSlotsTotal} spotlight slots left
							</Badge>
						</div>
					</div>
					<div className="grid gap-4 md:grid-cols-3">
						{packages.map((pkg) => (
							<Card
								key={pkg.name}
								className={
									pkg.tier === "spotlight"
										? "border border-amber-700/30 bg-amber-50/30"
										: "border border-border/80 bg-card"
								}
							>
								<CardHeader className="space-y-2">
									<CardTitle className="flex items-center gap-2 text-lg font-medium">
										<Star className="h-4 w-4 text-muted-foreground" />
										{pkg.name}
									</CardTitle>
									<p className="text-2xl font-medium text-foreground">
										{pkg.priceLabel}
									</p>
									<p className="text-sm text-muted-foreground">
										{pkg.description}
									</p>
									{pkg.badge ? (
										<Badge
											variant="outline"
											className="w-fit rounded-full text-[10px] uppercase tracking-[0.08em]"
										>
											{pkg.badge}
										</Badge>
									) : null}
								</CardHeader>
								<CardContent>
									<ul className="space-y-2 text-sm text-muted-foreground">
										{pkg.includes.map((line) => (
											<li key={line} className="flex items-start gap-2">
												<CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-foreground/70" />
												<span>{line}</span>
											</li>
										))}
									</ul>
									<StripeOrContactButton
										url={pkg.stripeUrl}
										label={`Pay for ${pkg.name}`}
										className={
											pkg.tier === "spotlight"
												? "mt-6 w-full rounded-full border border-amber-900/15 bg-amber-900/85 text-amber-50 hover:bg-amber-900"
												: "mt-6 w-full rounded-full border border-border bg-primary text-primary-foreground hover:bg-primary/90"
										}
									/>
								</CardContent>
							</Card>
						))}
					</div>
				</section>

				<section
					className="mt-8 grid gap-4 md:grid-cols-2"
					aria-label="Add-ons and process"
				>
					<Card className="border border-border/80 bg-card">
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-lg font-medium">
								<Megaphone className="h-4 w-4 text-muted-foreground" />
								Add-ons
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							{addOns.map((addOn) => (
								<div
									key={addOn.name}
									className="rounded-xl border border-border/70 bg-background/60 p-4"
								>
									<div className="flex items-start justify-between gap-3">
										<div>
											<p className="font-medium text-foreground">
												{addOn.name}
											</p>
											<p className="mt-1 text-sm text-muted-foreground">
												{addOn.description}
											</p>
											{addOn.reachHint ? (
												<p className="mt-1 text-xs text-muted-foreground/90">
													{addOn.reachHint}
												</p>
											) : null}
										</div>
										<Badge variant="outline" className="rounded-full">
											{addOn.priceLabel}
										</Badge>
									</div>
									<StripeOrContactButton
										url={addOn.stripeUrl}
										label="Book add-on"
										className="mt-4 rounded-full border border-amber-900/20 bg-amber-900/90 text-amber-50 hover:bg-amber-900 dark:border-amber-300/25 dark:bg-amber-500/20 dark:text-amber-100 dark:hover:bg-amber-500/28"
									/>
								</div>
							))}
						</CardContent>
					</Card>

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
											Pay via Stripe
										</p>
										<p className="mt-0.5 text-muted-foreground">
											Apple Pay, Google Pay, and cards supported in seconds.
										</p>
									</div>
								</li>
								<li className="flex gap-3">
									<span className="w-5 font-medium text-muted-foreground">
										3.
									</span>
									<div>
										<p className="font-medium text-foreground">
											We activate your placement
										</p>
										<p className="mt-0.5 text-muted-foreground">
											After payment, your order is reviewed, scheduled, and
											activated in the booked tier with post-event ROI
											reporting.
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
									Yes. After payment, your order enters the activation queue,
									then we confirm your exact go-live window before publishing.
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
						Close and collect payment in one message
					</h2>
					<p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
						Choose your package, pay in minutes, and we activate your campaign
						fast with confirmation by email.
					</p>
					<div className="mt-5 flex flex-wrap items-center justify-center gap-3">
						<StripeOrContactButton
							url={process.env.NEXT_PUBLIC_STRIPE_LINK_SPOTLIGHT_STANDARD}
							label="Book Spotlight"
							className="rounded-full border border-border bg-primary text-primary-foreground hover:bg-primary/90"
						/>
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
						href={`${basePath}/`}
						className="mt-5 inline-flex items-center gap-2 text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
					>
						<TrendingUp className="h-4 w-4" />
						Back to events
					</Link>
				</section>
			</main>

			<div className="fixed inset-x-0 bottom-0 z-50 border-t border-border/80 bg-card/95 p-3 backdrop-blur md:hidden">
				<StripeOrContactButton
					url={process.env.NEXT_PUBLIC_STRIPE_LINK_SPOTLIGHT_STANDARD}
					label="Book Spotlight"
					className="h-11 w-full rounded-full border border-border bg-foreground text-background hover:bg-foreground/90"
				/>
			</div>
		</div>
	);
}
