import Link from "next/link";
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
				{/* Editorial intro — design system: section label + display heading + divider */}
				<section className="mb-8" aria-label="Introduction">
					<p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
						Paris · Fête de la Musique
					</p>
					<h2
						className="mt-2 text-2xl font-light tracking-tight text-foreground sm:text-3xl"
						style={{ fontFamily: "var(--ooo-font-display)" }}
					>
						Discover events across the city
					</h2>
					<p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
						Explore live music and cultural events by arrondissement. Use the
						map and filters to find what’s on.
					</p>
					<Link
						href="/how-it-works"
						className="mt-3 inline-flex text-sm font-medium text-foreground underline-offset-4 transition-colors hover:text-foreground/78 hover:underline"
					>
						New here? See how Fête Finder works →
					</Link>
					<div className="mt-6 border-t border-border" role="presentation" />
				</section>

				<Suspense fallback={<HomeEventsSectionLoading />}>
					<HomeEventsSection mapLoadStrategy={homeMapLoadStrategy} />
				</Suspense>
			</main>
		</div>
	);
}
