import { CopyEmailButton } from "@/components/CopyEmailButton";
import { ScrollToTopButton } from "@/components/ScrollToTopButton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TICKET_EXCHANGE_RULES_VERSION } from "@/features/ticket-exchange/constants";
import {
	legalCompanyNumber,
	legalContactEmail,
	legalEntityName,
	legalRegisteredOffice,
	legalRegistrationJurisdiction,
} from "@/lib/legal";
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
							Last updated: 3 June 2026
						</p>
						<p className="text-sm text-muted-foreground">
							Ticket Exchange agreement version: {TICKET_EXCHANGE_RULES_VERSION}
						</p>
					</CardHeader>
					<CardContent className="prose prose-sm max-w-none space-y-6">
						<div className="rounded-lg border border-border/60 bg-muted/45 p-4">
							<p className="text-sm leading-relaxed text-muted-foreground">
								<strong>Simple summary:</strong> You can use Fete Finder to
								browse, learn, and plan your own events. You cannot copy, clone,
								scrape, resell, host, commercially exploit, or build a competing
								product from the site, its data, its design, or the OOOC brand
								without written permission.
							</p>
						</div>

						<section>
							<h2 className="mb-3 text-lg font-semibold">
								Ownership and Permitted Use
							</h2>
							<p className="text-muted-foreground">
								Fete Finder, Fête Finder, OOOC, Out Of Office Collective, and
								the site&apos;s software, design, data structure, copy, curated
								event selections, graphics, logos, and brand assets are owned by
								or licensed to {legalEntityName}. The public site is provided
								for personal, educational, informational, and event-planning use
								only.
							</p>
							<p className="mt-3 text-muted-foreground">
								Public access does not give you permission to copy, clone,
								recreate, publish, host, scrape, bulk download, resell,
								commercially exploit, train models on, or build a competing
								product from Fete Finder or any part of the OOOC brand without
								prior written permission.
							</p>
						</section>

						<section>
							<h2 className="mb-3 text-lg font-semibold">Trade Marks</h2>
							<p className="text-muted-foreground">
								Out Of Office Collective&reg; is a registered trade mark of{" "}
								{legalEntityName}. OOOC&trade;, Fete Finder&trade;, Fête
								Finder&trade;, and associated logos, names, visual identity, and
								trade dress are trade marks or claimed trade marks of{" "}
								{legalEntityName}. You may not use them in a way that suggests
								affiliation, sponsorship, endorsement, origin, or permission
								without prior written approval.
							</p>
						</section>

						<section>
							<h2 className="mb-3 text-lg font-semibold">
								No Commercial Reuse
							</h2>
							<ul className="list-disc space-y-1 pl-6 text-muted-foreground">
								<li>
									Do not sell, rent, license, or package access to the site.
								</li>
								<li>
									Do not copy, mirror, or republish the event database, design,
									software, or curated collections.
								</li>
								<li>
									Do not use the site&apos;s content, brand, or data to promote
									a commercial product or service without written permission.
								</li>
								<li>
									Do not remove copyright, trade mark, attribution, or ownership
									notices.
								</li>
							</ul>
						</section>

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
							<p className="mt-3 text-muted-foreground">
								Only share contact methods you are comfortable giving to another
								user. Although OOOC limits exchange visibility inside the
								product, you should assume the other person may copy, save, or
								contact you using any email, phone number, social handle, or
								other detail you choose to provide.
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
								<li>Do not rely on screenshots alone as proof.</li>
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
								Questions, permission requests, or concerns? Contact{" "}
								{legalContactEmail}
								<CopyEmailButton email={legalContactEmail} />
							</p>
							<p className="mt-3 text-muted-foreground">
								{legalEntityName}, company number {legalCompanyNumber},
								registered in {legalRegistrationJurisdiction}. Registered
								office: {legalRegisteredOffice}.
							</p>
						</section>
					</CardContent>
				</Card>
			</main>
			<ScrollToTopButton mobileDock="stacked-with-filter" />
		</div>
	);
}
