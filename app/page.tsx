import { Suspense } from "react";
import { HomeEventsSection } from "./HomeEventsSection";
import { HomeEventsSectionLoading } from "./HomeEventsSectionLoading";
import { HomeHeader } from "./HomeHeader";

// Keep ISR short to limit stale windows when data changes.
export const revalidate = 300; // 5 minutes in seconds
const homeMapLoadStrategy: "immediate" | "expand" | "idle" = "expand";

export default function Home() {
	return (
		<div className="ooo-site-shell">
			<HomeHeader />
			<main
				id="main-content"
				className="container mx-auto px-4 py-8"
				tabIndex={-1}
			>
				<Suspense fallback={<HomeEventsSectionLoading />}>
					<HomeEventsSection mapLoadStrategy={homeMapLoadStrategy} />
				</Suspense>
			</main>
		</div>
	);
}
