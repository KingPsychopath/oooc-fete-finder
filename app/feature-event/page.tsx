import { CopyEmailButton } from "@/components/CopyEmailButton";
import Header from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FEATURED_EVENTS_CONFIG } from "@/features/events/featured/constants";
import { Calendar, CheckCircle, Euro, Star, Target } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FeatureEventHeader } from "./FeatureEventHeader";
import { FeatureEventStatusSection } from "./FeatureEventStatusSection";

export const metadata: Metadata = {
	title: "Feature Your Event | OOOC Fete Finder",
	description: `Get maximum visibility for your Paris event with our featured placement. Only €${FEATURED_EVENTS_CONFIG.FEATURE_PRICE} for ${FEATURED_EVENTS_CONFIG.FEATURE_DURATION_HOURS} hours of top placement.`,
	keywords: [
		"feature event",
		"paris events",
		"event promotion",
		"event marketing",
	],
};

export const dynamic = "force-dynamic";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

function FeatureEventStatusFallback() {
	return (
		<Card className="mb-8 border border-border bg-card ooo-admin-card-soft">
			<CardHeader className="space-y-4">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="space-y-1">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Feature Placement
						</p>
						<CardTitle className="ooo-feature-heading">
							Featured events status
						</CardTitle>
					</div>
					<Badge
						variant="outline"
						className="rounded-full border-foreground/20 bg-foreground px-3 py-1 text-[10px] font-medium uppercase tracking-[0.08em] text-background"
					>
						Loading
					</Badge>
				</div>
			</CardHeader>
			<CardContent>
				<p className="text-sm text-muted-foreground">
					Checking current featured placements...
				</p>
			</CardContent>
		</Card>
	);
}

export default function FeatureEventPage() {
	return (
		<div className="ooo-site-shell">
			<Suspense fallback={<Header />}>
				<FeatureEventHeader />
			</Suspense>
			<main className="ooo-feature-page container mx-auto px-4 py-10 max-w-3xl">
				{/* Editorial header */}
				<header className="mb-12">
					<h1 className="ooo-feature-title text-foreground mb-2">
						Feature your event
					</h1>
					<p className="text-muted-foreground text-base tracking-wide">
						Get maximum visibility for your event in Paris with our featured
						placement.
					</p>
					<div
						className="mt-6 h-px w-full max-w-[4rem]"
						style={{ backgroundColor: "var(--border)" }}
					/>
					<p className="mt-3 text-xs text-muted-foreground">
						No event yet? Why are you here.{" "}
						<Link
							href={`${basePath}/submit-event`}
							className="text-foreground underline underline-offset-4 transition-colors hover:text-foreground/80"
						>
							Submit yours here.
						</Link>
					</p>
				</header>

				<Suspense fallback={<FeatureEventStatusFallback />}>
					<FeatureEventStatusSection />
				</Suspense>

				<div className="grid md:grid-cols-2 gap-8 mb-10">
					<Card className="border border-border bg-card ooo-admin-card-soft">
						<CardHeader>
							<CardTitle className="ooo-feature-heading flex items-center gap-2">
								<Euro className="h-4 w-4 text-muted-foreground" />
								Pricing
							</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-2xl font-medium text-foreground mb-3">
								€{FEATURED_EVENTS_CONFIG.FEATURE_PRICE}
							</p>
							<p className="text-sm text-muted-foreground mb-5">
								One-time payment for{" "}
								{FEATURED_EVENTS_CONFIG.FEATURE_DURATION_HOURS} hours of
								featured placement.
							</p>
							<ul className="space-y-2.5 text-sm text-muted-foreground">
								<li className="flex items-start gap-2">
									<CheckCircle className="h-4 w-4 text-foreground/70 mt-0.5 flex-shrink-0" />
									<span>Top placement in Featured Events</span>
								</li>
								<li className="flex items-start gap-2">
									<CheckCircle className="h-4 w-4 text-foreground/70 mt-0.5 flex-shrink-0" />
									<span>Increased visibility on homepage and search</span>
								</li>
								<li className="flex items-start gap-2">
									<CheckCircle className="h-4 w-4 text-foreground/70 mt-0.5 flex-shrink-0" />
									<span>Featured badge on your event listing</span>
								</li>
							</ul>
						</CardContent>
					</Card>

					<Card className="border border-border bg-card ooo-admin-card-soft">
						<CardHeader>
							<CardTitle className="ooo-feature-heading flex items-center gap-2">
								<Star className="h-4 w-4 text-muted-foreground" />
								How it works
							</CardTitle>
						</CardHeader>
						<CardContent>
							<ol className="space-y-4 text-sm">
								<li className="flex gap-3">
									<span className="text-muted-foreground font-medium w-5">
										1
									</span>
									<div>
										<p className="font-medium text-foreground">
											Submit payment
										</p>
										<p className="text-muted-foreground mt-0.5">
											Pay €{FEATURED_EVENTS_CONFIG.FEATURE_PRICE} via our secure
											payment system.
										</p>
									</div>
								</li>
								<li className="flex gap-3">
									<span className="text-muted-foreground font-medium w-5">
										2
									</span>
									<div>
										<p className="font-medium text-foreground">Get featured</p>
										<p className="text-muted-foreground mt-0.5">
											Your event is featured within 2 hours of payment.
										</p>
									</div>
								</li>
								<li className="flex gap-3">
									<span className="text-muted-foreground font-medium w-5">
										3
									</span>
									<div>
										<p className="font-medium text-foreground">Stay featured</p>
										<p className="text-muted-foreground mt-0.5">
											Remain featured for{" "}
											{FEATURED_EVENTS_CONFIG.FEATURE_DURATION_HOURS} hours.
										</p>
									</div>
								</li>
							</ol>
						</CardContent>
					</Card>
				</div>

				<Card className="mb-10 border border-border bg-card ooo-admin-card-soft">
					<CardHeader>
						<CardTitle className="ooo-feature-heading flex items-center gap-2">
							<Target className="h-4 w-4 text-muted-foreground" />
							Why feature your event
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="grid sm:grid-cols-2 gap-8 text-sm">
							<div className="space-y-4">
								<div>
									<h4 className="font-medium text-foreground mb-1">
										Maximum visibility
									</h4>
									<p className="text-muted-foreground">
										Featured events appear at the top of our homepage and
										receive significantly more views than standard listings.
									</p>
								</div>
								<div>
									<h4 className="font-medium text-foreground mb-1">
										Mobile optimised
									</h4>
									<p className="text-muted-foreground">
										Your event is highlighted across all devices with clear
										badging.
									</p>
								</div>
							</div>
							<div className="space-y-4">
								<div>
									<h4 className="font-medium text-foreground mb-1">
										Quick activation
									</h4>
									<p className="text-muted-foreground">
										Your event is featured within 2 hours of payment
										confirmation.
									</p>
								</div>
								<div>
									<h4 className="font-medium text-foreground mb-1">
										Analytics
									</h4>
									<p className="text-muted-foreground">
										<span className="line-through">
											Track clicks and engagement during your feature period.
										</span>{" "}
										Coming soon.
									</p>
								</div>
							</div>
						</div>
					</CardContent>
				</Card>

				<Card className="mb-10 border border-border bg-card ooo-admin-card-soft">
					<CardHeader>
						<CardTitle className="ooo-feature-heading flex items-center gap-2">
							<Calendar className="h-4 w-4 text-muted-foreground" />
							Feature period details
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-3 text-sm">
							<div className="flex justify-between items-center">
								<span className="text-muted-foreground">Feature duration</span>
								<Badge variant="secondary" className="font-normal">
									{FEATURED_EVENTS_CONFIG.FEATURE_DURATION_HOURS} hours
								</Badge>
							</div>
							<div className="flex justify-between items-center">
								<span className="text-muted-foreground">
									Featured at a time
								</span>
								<Badge variant="secondary" className="font-normal">
									{FEATURED_EVENTS_CONFIG.MAX_FEATURED_EVENTS}
								</Badge>
							</div>
							<div className="flex justify-between items-center">
								<span className="text-muted-foreground">Rotation</span>
								<Badge variant="secondary" className="font-normal">
									Every {FEATURED_EVENTS_CONFIG.FEATURE_DURATION_HOURS} hours
								</Badge>
							</div>
							<div className="flex justify-between items-center">
								<span className="text-muted-foreground">Next slot</span>
								<Badge variant="outline" className="font-normal">
									When current period ends
								</Badge>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* CTA */}
				<footer className="text-center pt-4 pb-8">
					<Button
						size="lg"
						variant="default"
						className="border border-border bg-primary text-primary-foreground hover:bg-primary/90 rounded-sm font-medium"
						nativeButton={false}
						render={
							<a href="mailto:hello@outofofficecollective.co.uk?subject=Fete%20Finder:%20Feature%20My%20Event%20Inquiry%20[YOUR_EVENT_NAME_HERE]" />
						}
					>
						Feature my event — €{FEATURED_EVENTS_CONFIG.FEATURE_PRICE}
					</Button>
					<p className="text-sm text-muted-foreground mt-5">
						Or email us at hello@outofofficecollective.co.uk
						<CopyEmailButton email="hello@outofofficecollective.co.uk" />
					</p>
					<Link
						href="/"
						className="inline-block mt-6 text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors"
					>
						Back to events
					</Link>
				</footer>
			</main>
		</div>
	);
}
