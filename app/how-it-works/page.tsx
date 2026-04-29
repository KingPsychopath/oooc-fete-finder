import Header from "@/components/Header";
import { ScrollToTopButton } from "@/components/ScrollToTopButton";
import type { Metadata } from "next";
import { HowItWorksExperience } from "./HowItWorksExperience";

export const metadata: Metadata = {
	title: "How It Works",
	description:
		"Learn how Fête Finder helps you plan Fête de la Musique weekend in Paris with curated events, filters, sharing and the OOOC community.",
};

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
