import { CopyEmailButton } from "@/components/CopyEmailButton";
import { ScrollToTopButton } from "@/components/ScrollToTopButton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { buildSiteUrl } from "@/lib/site-url";
import {
	generateOGMetadata,
	generatePresetOGImage,
} from "@/lib/social/og-utils";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = generateOGMetadata({
	title: "Privacy Policy",
	description:
		"How Out Of Office Collective handles attendee, host and partner data for Fête Finder.",
	ogImageUrl: generatePresetOGImage("privacy"),
	url: buildSiteUrl("/privacy"),
});

// Force static generation for this page
export const dynamic = "force-static";

export default function PrivacyPolicy() {
	return (
		<div className="min-h-screen bg-background">
			<main
				id="main-content"
				className="container mx-auto px-4 py-8 max-w-4xl"
				tabIndex={-1}
			>
				{/* Back Button */}
				<Link
					href="/"
					className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
				>
					<ArrowLeft className="h-4 w-4" />
					Back to Events
				</Link>

				<Card>
					<CardHeader>
						<h1 className="text-2xl font-medium leading-snug">
							Privacy Policy
						</h1>
						<p className="text-sm text-muted-foreground">
							Last updated: 1 June 2026
						</p>
					</CardHeader>
					<CardContent className="prose prose-sm max-w-none space-y-6">
						<section>
							<h2 className="text-lg font-semibold mb-3">What We Collect</h2>
							<ul className="list-disc pl-6 space-y-1 text-muted-foreground">
								<li>Name and email when you register</li>
								<li>
									First-party product activity (for example: event opens,
									outbound clicks, calendar saves, and genre preference signals)
								</li>
								<li>
									Coarse technical context such as device type, platform,
									browser family, timezone, and language/locale
								</li>
								<li>
									Technical security logs and rate-limiting data to protect the
									service
								</li>
								<li>
									Ticket Exchange contact details you choose to provide, such as
									email, WhatsApp number, Instagram handle, or Twitter handle
								</li>
								<li>
									Ticket Exchange listings, interest actions, reports, and
									contact-reveal audit records
								</li>
								<li>
									Ticket Exchange agreement acceptance timestamp and agreement
									version
								</li>
							</ul>
						</section>

						<section>
							<h2 className="text-lg font-semibold mb-3">
								How We Use Your Data
							</h2>
							<p className="text-muted-foreground mb-2">
								<strong>Legal basis:</strong> Consent and legitimate interest
								(you can withdraw consent for marketing at any time).
							</p>
							<ul className="list-disc pl-6 space-y-1 text-muted-foreground">
								<li>To provide personalized event recommendations</li>
								<li>To send event updates and OOOC community communications</li>
								<li>To improve our service and user experience</li>
								<li>
									To understand first-party audience patterns, such as which
									devices, timezones, and discovery behaviors are most common
								</li>
								<li>
									To provide anonymized, aggregated performance reporting to
									venue and promoter partners
								</li>
								<li>
									To operate Ticket Exchange, including showing selected contact
									details between listing owners and users who reply
								</li>
							</ul>
							<p className="text-sm text-muted-foreground mt-3">
								<strong>Unsubscribe:</strong> You can unsubscribe at any time
								via the unsubscribe link in emails, or by contacting us.
							</p>
						</section>

						<section>
							<h2 className="text-lg font-semibold mb-3">
								Data Storage & Security
							</h2>
							<ul className="list-disc pl-6 space-y-1 text-muted-foreground">
								<li>
									Your account and event engagement records are stored on our
									first-party infrastructure.
								</li>
								<li>
									When you register or sign in, recent first-party activity from
									the same browser session may be associated with your account
									so we can improve recommendations, analytics, and audience
									tools.
								</li>
								<li>
									We use access controls, token-protected partner reporting
									pages, and security monitoring.
								</li>
								<li>
									We retain data only as long as needed for service delivery,
									reporting, legal, and security obligations.
								</li>
								<li>
									Ticket Exchange contact details are not public on the site.
									When someone replies to a listing, the listing owner can see
									the replier&apos;s selected contact methods, and the replier
									can see the listing owner&apos;s selected contact methods.
								</li>
								<li>
									Expired, sold, found, paused, or removed listings do not
									accept new replies. Existing reply records may remain visible
									in the relevant user&apos;s activity view so users can follow
									up on contacts they already exchanged.
								</li>
								<li>
									We may store a browser-local reminder of the current Ticket
									Exchange agreement version, but your account record is the
									source of truth.
								</li>
							</ul>
						</section>

						<section>
							<h2 className="text-lg font-semibold mb-3">Your Rights</h2>
							<p className="text-muted-foreground">
								Under GDPR, you have the right to:
							</p>
							<ul className="list-disc pl-6 space-y-1 text-muted-foreground mt-2">
								<li>Access your personal data</li>
								<li>Correct inaccurate data</li>
								<li>Delete your data (right to be forgotten)</li>
								<li>Object to processing</li>
								<li>Data portability</li>
							</ul>
						</section>

						<section>
							<h2 className="text-lg font-semibold mb-3">Data Sharing</h2>
							<ul className="list-disc pl-6 space-y-1 text-muted-foreground">
								<li>We do not sell your personal data.</li>
								<li>
									We do not share partner-facing email lists or personally
									identifiable contact exports with venues or promoters.
								</li>
								<li>
									Partners only receive aggregated campaign performance metrics.
								</li>
								<li>
									Ticket Exchange users may see the contact methods you choose
									to share when you post a listing or reply to one. This sharing
									is limited to the specific listing relationship, not a public
									contact directory.
								</li>
							</ul>
						</section>

						<section>
							<h2 className="text-lg font-semibold mb-3">Cookies & Tracking</h2>
							<ul className="list-disc pl-6 space-y-1 text-muted-foreground">
								<li>
									We use first-party session cookies to keep you signed in and
									enable gated features.
								</li>
								<li>
									We use first-party event interaction tracking to improve
									search, discovery, recommendations, audience tools, and
									partner reporting.
								</li>
								<li>
									We do not collect precise GPS location for analytics. Coarse
									context such as timezone or locale may be used to understand
									how people use the service.
								</li>
								<li>
									We do not rely on third-party ad trackers for core analytics.
								</li>
							</ul>
						</section>

						<section>
							<h2 className="text-lg font-semibold mb-3">Contact Us</h2>
							<p className="text-muted-foreground">
								If you have any questions about this privacy policy or want to
								exercise your rights, please contact us at{" "}
								hello@outofofficecollective.co.uk
								<CopyEmailButton email="hello@outofofficecollective.co.uk" />
							</p>
						</section>

						<section>
							<h2 className="text-lg font-semibold mb-3">
								Changes to This Policy
							</h2>
							<p className="text-muted-foreground">
								We may update this privacy policy from time to time. Any changes
								will be posted on this page with an updated date.
							</p>
						</section>

						<div className="bg-muted/50 p-4 rounded-lg mt-8">
							<p className="text-sm text-muted-foreground">
								<strong>Simple Summary:</strong> We collect only what we need to
								run the platform, improve event discovery, and report campaign
								performance in aggregate. You can request access, correction, or
								deletion of your data at any time.
							</p>
						</div>
					</CardContent>
				</Card>
			</main>
			<ScrollToTopButton mobileDock="stacked-with-filter" />
		</div>
	);
}
