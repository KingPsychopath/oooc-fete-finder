import { Suspense } from "react";
import { HomeEventsSection } from "./HomeEventsSection";
import { HomeEventsSectionLoading } from "./HomeEventsSectionLoading";
import { HomeHeader } from "./HomeHeader";

// Event edits trigger on-demand revalidation; keep public ISR calm by default.
export const revalidate = false;
const homeMapLoadStrategy: "immediate" | "expand" | "idle" = "idle";

export default function Home() {
	return (
		<div className="ooo-site-shell">
			<HomeHeader />
			<main
				id="main-content"
				className="container mx-auto w-full max-w-[92rem] px-4 py-8 sm:px-6 lg:px-10 2xl:px-14 2xl:max-w-[104rem]"
				tabIndex={-1}
			>
				<h1 className="sr-only">
					Fete Finder: curated Paris music events by Out Of Office Collective
				</h1>
				<Suspense fallback={<HomeEventsSectionLoading />}>
					<HomeEventsSection mapLoadStrategy={homeMapLoadStrategy} />
				</Suspense>
			</main>
		</div>
	);
}
