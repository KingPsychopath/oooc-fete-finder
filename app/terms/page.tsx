import { CopyEmailButton } from "@/components/CopyEmailButton";
import { ScrollToTopButton } from "@/components/ScrollToTopButton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TICKET_EXCHANGE_RULES_VERSION } from "@/features/ticket-exchange/constants";
import { buildSiteUrl } from "@/lib/site-url";
import {
	generateOGMetadata,
	generatePresetOGImage,
} from "@/lib/social/og-utils";
import type { Metadata } from "next";
import { TermsBackLink } from "./TermsBackLink";

export const metadata: Metadata = generateOGMetadata({
	title: "Terms",
	description:
		"Terms for using Fete Finder and the OOOC Ticket Exchange community board.",
	ogImageUrl: generatePresetOGImage("privacy"),
	url: buildSiteUrl("/terms"),
});

export const dynamic = "force-static";

export default function TermsPage() {
	return (
		<div className="min-h-screen bg-background">
			<main
				id="main-content"
				className="container mx-auto max-w-4xl px-4 py-8"
				tabIndex={-1}
			>
				<TermsBackLink />

				<Card>
					<CardHeader>
						<h1 className="text-2xl font-medium leading-snug">Terms</h1>
						<p className="text-sm text-muted-foreground">
							Last updated: 1 June 2026
						</p>
						<p className="text-sm text-muted-foreground">
							Ticket Exchange agreement version: {TICKET_EXCHANGE_RULES_VERSION}
						</p>
					</CardHeader>
					<CardContent className="prose prose-sm max-w-none space-y-6">
						<section>
							<h2 className="mb-3 text-lg font-semibold">Ticket Exchange</h2>
							<p className="text-muted-foreground">
								Ticket Exchange is a community noticeboard. OOOC does not sell,
								verify, transfer, hold, reserve, guarantee, or process payment
								for tickets. Any payment, transfer, refund, or dispute is
								handled directly between users.
							</p>
							<p className="mt-3 text-muted-foreground">
								When you post a listing, your selected contact methods are shown
								to logged-in users who reply to that listing. When you reply to
								a listing, your selected contact methods are shown to the
								listing owner so either person can contact the other directly.
							</p>
						</section>

						<section>
							<h2 className="mb-3 text-lg font-semibold">User Rules</h2>
							<ul className="list-disc space-y-1 pl-6 text-muted-foreground">
								<li>No fake, misleading, duplicate, or spam listings.</li>
								<li>Face value or below is strongly encouraged.</li>
								<li>Use official ticket transfer platforms where available.</li>
								<li>Do not pressure people to pay quickly.</li>
								<li>Do not share another person&apos;s contact details.</li>
								<li>
									Mark selling listings sold, and looking listings found, when
									they are no longer active.
								</li>
								<li>
									Repost only when your ticket availability or ticket need is
									still genuine.
								</li>
								<li>
									OOOC may remove listings or restrict access at any time.
								</li>
							</ul>
						</section>

						<section>
							<h2 className="mb-3 text-lg font-semibold">Staying Safe</h2>
							<ul className="list-disc space-y-1 pl-6 text-muted-foreground">
								<li>Avoid screenshots as proof.</li>
								<li>Use official ticket transfer links where possible.</li>
								<li>
									Double check ticket date, event, platform, and account
									details.
								</li>
								<li>
									Be wary of urgency, unusual payment requests, or prices.
								</li>
								<li>Do not share login or verification codes.</li>
								<li>Prefer payment methods with buyer protection.</li>
								<li>
									When in doubt, say no, avoid the trade, or ask an admin in our
									communication channels for help.
								</li>
								<li>Report suspicious listings.</li>
							</ul>
						</section>

						<section>
							<h2 className="mb-3 text-lg font-semibold">Contact</h2>
							<p className="text-muted-foreground">
								Questions or concerns? Contact hello@outofofficecollective.co.uk
								<CopyEmailButton email="hello@outofofficecollective.co.uk" />
							</p>
						</section>
					</CardContent>
				</Card>
			</main>
			<ScrollToTopButton mobileDock="stacked-with-filter" />
		</div>
	);
}
