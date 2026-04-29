import type { Metadata } from "next";
import { FeteFinderStoryClient } from "./FeteFinderStoryClient";

export const metadata: Metadata = {
	title: "Fête Finder Story Asset",
	description:
		"Instagram Story asset explaining Fête Finder by Out Of Office Collective.",
	robots: {
		index: false,
		follow: false,
	},
};

export default function FeteFinderStoryPage() {
	return (
		<div className="ooo-site-shell">
			<main id="main-content" tabIndex={-1}>
				<FeteFinderStoryClient />
			</main>
		</div>
	);
}
