import type { Metadata } from "next";
import { HomeHeader } from "@/app/HomeHeader";
import { SubmitEventForm } from "@/features/events/submissions/SubmitEventForm";
import { EventSubmissionSettingsStore } from "@/features/events/submissions/settings-store";
import {
	generateOGImageUrl,
	generateOGMetadata,
} from "@/lib/social/og-utils";
import Link from "next/link";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = generateOGMetadata({
	title: "Submit Event | Fête Finder",
	description:
		"Submit your event to Out Of Office Collective with only the essential details. Our team reviews every submission before publishing.",
	ogImageUrl: generateOGImageUrl({
		title: "Submit Your Event",
		subtitle: "Share your event with Out Of Office Collective",
		variant: "default",
	}),
	url: `${siteUrl}${basePath || ""}/submit-event`,
});

export default async function SubmitEventPage() {
	const settings = await EventSubmissionSettingsStore.getPublicSettings();

	return (
		<div className="ooo-site-shell">
			<HomeHeader />
			<main id="main-content" className="container mx-auto px-4 py-8" tabIndex={-1}>
				<section className="mx-auto max-w-3xl space-y-4">
					<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
						Host Submission
					</p>
					<h1
						className="text-3xl font-light tracking-tight text-foreground sm:text-4xl"
						style={{ fontFamily: "var(--ooo-font-display)" }}
					>
						Submit Your Event
					</h1>
					<p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
						Share the essentials and we will review your event for inclusion in Fete
						Finder. Accepted submissions are published by the admin team.
					</p>
					<div className="border-t border-border" role="presentation" />
					<p className="text-xs text-muted-foreground">
						Already listed and want extra visibility? Why are you here.{" "}
						<Link
							href={`${basePath}/feature-event`}
							className="text-foreground underline underline-offset-4 transition-colors hover:text-foreground/80"
						>
							Promote yours here.
						</Link>
					</p>
					<SubmitEventForm submissionsEnabled={settings.enabled} />
				</section>
			</main>
		</div>
	);
}
