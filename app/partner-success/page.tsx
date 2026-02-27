import { Button } from "@/components/ui/button";
import {
	generateOGImageUrl,
	generateOGMetadata,
} from "@/lib/social/og-utils";
import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import { FeatureEventHeader } from "../feature-event/FeatureEventHeader";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const metadata: Metadata = generateOGMetadata({
	title: "Payment Received | OOOC Fete Finder",
	description:
		"Your payment was received. The OOOC team will activate your placement shortly.",
	ogImageUrl: generateOGImageUrl({
		title: "Payment Received",
		subtitle: "Your OOOC placement is now in the activation queue",
		variant: "default",
	}),
	url: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}${basePath || ""}/partner-success/`,
});

export default function PartnerSuccessPage() {
	return (
		<div className="ooo-site-shell">
			<FeatureEventHeader />
			<main className="container mx-auto max-w-3xl px-4 py-12">
				<section className="rounded-2xl border border-border/80 bg-card/90 p-8 text-center">
					<div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-emerald-300 bg-emerald-50">
						<CheckCircle2 className="h-6 w-6 text-emerald-700" />
					</div>
					<p className="mt-4 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
						Payment confirmed
					</p>
					<h1
						className="mt-2 text-3xl font-light tracking-tight sm:text-4xl"
						style={{ fontFamily: "var(--ooo-font-display)" }}
					>
						You are in the activation queue
					</h1>
					<p className="mt-3 text-sm text-muted-foreground sm:text-base">
						Thanks for partnering with OOOC. Our team has your order and will
						activate your placement shortly.
					</p>
					<div className="mt-6 flex flex-wrap items-center justify-center gap-3">
						<Button
							nativeButton={false}
							className="rounded-full border border-border bg-primary text-primary-foreground hover:bg-primary/90"
							render={<a href="mailto:hello@outofofficecollective.co.uk" />}
						>
							Email partnership team
						</Button>
						<Button
							nativeButton={false}
							variant="outline"
							className="rounded-full"
							render={<a href={`${basePath}/feature-event`} />}
						>
							Back to partner page
						</Button>
					</div>
				</section>
			</main>
		</div>
	);
}
