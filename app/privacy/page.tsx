import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { CopyEmailButton } from "@/components/CopyEmailButton";

// Force static generation for this page
export const dynamic = "force-static";

export default function PrivacyPolicy() {
	return (
		<div className="min-h-screen bg-background">
			<div className="container mx-auto px-4 py-8 max-w-4xl">
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
						<CardTitle className="text-2xl">Privacy Policy</CardTitle>
						<p className="text-sm text-muted-foreground">
							Last updated: 27 February 2026
						</p>
					</CardHeader>
					<CardContent className="prose prose-sm max-w-none space-y-6">
						<section>
							<h3 className="text-lg font-semibold mb-3">What We Collect</h3>
							<ul className="list-disc pl-6 space-y-1 text-muted-foreground">
								<li>Name and email when you register</li>
								<li>
									First-party product activity (for example: event opens,
									outbound clicks, calendar saves, and genre preference signals)
								</li>
								<li>
									Technical security logs and rate-limiting data to protect the
									service
								</li>
							</ul>
						</section>

						<section>
							<h3 className="text-lg font-semibold mb-3">
								How We Use Your Data
							</h3>
							<p className="text-muted-foreground mb-2">
								<strong>Legal basis:</strong> Consent and legitimate interest
								(you can withdraw consent for marketing at any time).
							</p>
							<ul className="list-disc pl-6 space-y-1 text-muted-foreground">
								<li>To provide personalized event recommendations</li>
								<li>To send event updates and OOOC community communications</li>
								<li>To improve our service and user experience</li>
								<li>
									To provide anonymized, aggregated performance reporting to
									venue and promoter partners
								</li>
							</ul>
							<p className="text-sm text-muted-foreground mt-3">
								<strong>Unsubscribe:</strong> You can unsubscribe at any time
								via the unsubscribe link in emails, or by contacting us.
							</p>
						</section>

						<section>
							<h3 className="text-lg font-semibold mb-3">
								Data Storage & Security
							</h3>
							<ul className="list-disc pl-6 space-y-1 text-muted-foreground">
								<li>
									Your account and event engagement records are stored on our
									first-party infrastructure.
								</li>
								<li>
									We use access controls, token-protected partner reporting pages,
									and security monitoring.
								</li>
								<li>
									We retain data only as long as needed for service delivery,
									reporting, legal, and security obligations.
								</li>
							</ul>
						</section>

						<section>
							<h3 className="text-lg font-semibold mb-3">Your Rights</h3>
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
							<h3 className="text-lg font-semibold mb-3">Data Sharing</h3>
							<ul className="list-disc pl-6 space-y-1 text-muted-foreground">
								<li>We do not sell your personal data.</li>
								<li>
									We do not share partner-facing email lists or personally
									identifiable contact exports with venues or promoters.
								</li>
								<li>
									Partners only receive aggregated campaign performance metrics.
								</li>
							</ul>
						</section>

						<section>
							<h3 className="text-lg font-semibold mb-3">
								Cookies & Tracking
							</h3>
							<ul className="list-disc pl-6 space-y-1 text-muted-foreground">
								<li>
									We use first-party session cookies to keep you signed in and
									enable gated features.
								</li>
								<li>
									We use first-party event interaction tracking to improve search,
									discovery, and partner reporting.
								</li>
								<li>
									We do not rely on third-party ad trackers for core analytics.
								</li>
							</ul>
						</section>

						<section>
							<h3 className="text-lg font-semibold mb-3">Contact Us</h3>
							<p className="text-muted-foreground">
								If you have any questions about this privacy policy or want to
								exercise your rights, please contact us at
								{" "}
								hello@outofofficecollective.co.uk
								<CopyEmailButton email="hello@outofofficecollective.co.uk" />
							</p>
						</section>

						<section>
							<h3 className="text-lg font-semibold mb-3">
								Changes to This Policy
							</h3>
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
			</div>
		</div>
	);
}
