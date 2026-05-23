import Header from "@/components/Header";
import { ScrollToTopButton } from "@/components/ScrollToTopButton";
import { generateOGMetadata, generatePresetOGImage } from "@/lib/social/og-utils";
import { buildSiteUrl } from "@/lib/site-url";
import type { Metadata } from "next";
import { HowItWorksExperience } from "./HowItWorksExperience";

export const metadata: Metadata = generateOGMetadata({
	title: "How It Works",
	description:
		"Learn how Fête Finder helps you plan Fête de la Musique weekend in Paris with curated events, filters, sharing and the OOOC community.",
	ogImageUrl: generatePresetOGImage("how-it-works"),
	url: buildSiteUrl("/how-it-works"),
});

export default function HowItWorksPage() {
	return (
		<div className="ooo-site-shell">
			<Header />
			<main id="main-content" tabIndex={-1}>
				<HowItWorksExperience />
			</main>
			<ScrollToTopButton mobileDock="stacked-with-filter" />
		</div>
	);
}
