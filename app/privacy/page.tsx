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
							Last updated: 10 June 2025
						</p>
					</CardHeader>
					<CardContent className="prose prose-sm max-w-none space-y-6">
						<section>
							<h3 className="text-lg font-semibold mb-3">What We Collect</h3>
							<p className="text-muted-foreground">
								We collect your email address when you choose to access our
								filtering and search features. This is the only personal
								information we collect.
							</p>
						</section>

						<section>
							<h3 className="text-lg font-semibold mb-3">
								How We Use Your Data
							</h3>
							<p className="text-muted-foreground mb-2">
								<strong>Legal basis:</strong> Consent (you can withdraw this anytime by unsubscribing or contacting us)
							</p>
							<ul className="list-disc pl-6 space-y-1 text-muted-foreground">
								<li>To provide personalized event recommendations</li>
								<li>
									To add your email to our mailing list for event updates and
									notifications about future OOOC events,
								</li>
								<li>
									To send you updates about future Fête de la Musique events
								</li>
								<li>To improve our service and user experience</li>
								<li>To build our community of music event enthusiasts</li>
							</ul>
							<p className="text-sm text-muted-foreground mt-3">
								<strong>Unsubscribe:</strong> You can unsubscribe from emails at any time using the unsubscribe link in any email we send you, or by contacting us directly.
							</p>
						</section>

						<section>
							<h3 className="text-lg font-semibold mb-3">
								Data Storage & Security
							</h3>
							<p className="text-muted-foreground">
								Your email is stored securely and will be kept for up to 2 years
								after collection. We use industry-standard security measures to
								protect your information.
							</p>
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
							<p className="text-muted-foreground">
								We do not sell, trade, or share your email address with third
								parties. Your information stays with us and is used solely for
								the purposes described above.
							</p>
						</section>

						<section>
							<h3 className="text-lg font-semibold mb-3">Cookies</h3>
							<p className="text-muted-foreground">
								We store your email locally in your browser to remember your
								authentication status. This data remains on your device and can
								be cleared by logging out or clearing your browser data.
							</p>
						</section>

						<section>
							<h3 className="text-lg font-semibold mb-3">Contact Us</h3>
							<p className="text-muted-foreground">
								If you have any questions about this privacy policy or want to
								exercise your rights, please contact us at hello@outofofficecollective.co.uk
								<CopyEmailButton email="hello@outofofficecollective.co.uk" />
							</p>
							<p className="text-sm text-muted-foreground mt-2">
								You can also reach us through our main website or social media channels.
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
								<strong>Simple Summary:</strong> We only collect your email to
								send you event updates. We keep it secure, don't share it, and
								you can ask us to delete it anytime.
							</p>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
