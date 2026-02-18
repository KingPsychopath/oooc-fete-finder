import type { Metadata } from "next";
import { HomeHeader } from "@/app/HomeHeader";
import { SubmitEventForm } from "@/features/events/submissions/SubmitEventForm";
import { EventSubmissionSettingsStore } from "@/features/events/submissions/settings-store";
import Link from "next/link";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const metadata: Metadata = {
	title: "Submit Event",
	description:
		"Submit your event to Out Of Office Collective with only the essential details. Our team reviews every submission before publishing.",
};

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
					<p className="rounded-md border border-border/70 bg-background/70 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
						Already listed and want extra visibility?{" "}
						<Link
							href={`${basePath}/feature-event`}
							className="font-medium text-foreground underline underline-offset-4"
						>
							Promote your event in Spotlight →
						</Link>
					</p>
					<div className="border-t border-border" role="presentation" />
					<SubmitEventForm submissionsEnabled={settings.enabled} />
				</section>
			</main>
		</div>
	);
}
