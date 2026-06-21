import Header from "@/components/Header";
import { SharedPlanClient } from "@/features/plans/components/SharedPlanClient";
import {
	FEATURED_FETE_ROUTE,
	getFeaturedFeteRouteHref,
} from "@/features/plans/featured-route";
import {
	buildSharedPlanMetadata,
	getSharedPlanByToken,
	getSharedPlanPagePayload,
} from "@/features/plans/shared-plan-page.server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
	const plan = await getSharedPlanByToken(FEATURED_FETE_ROUTE.shareToken);
	if (!plan) {
		return {
			title: "Route not found",
			robots: { index: false, follow: false },
		};
	}

	return buildSharedPlanMetadata({
		plan,
		urlPath: getFeaturedFeteRouteHref(),
		title: FEATURED_FETE_ROUTE.routeTitle,
		description: FEATURED_FETE_ROUTE.routeSummary,
		robots: { index: true, follow: true },
	});
}

export default async function FeaturedRoutePage() {
	const payload = await getSharedPlanPagePayload(
		FEATURED_FETE_ROUTE.shareToken,
	);
	if (!payload) notFound();

	return (
		<div className="ooo-site-shell">
			<Header bannerSettings={payload.bannerSettings} />
			<main
				id="main-content"
				className="min-h-screen bg-background"
				tabIndex={-1}
			>
				<SharedPlanClient plan={payload.plan} initialEvents={payload.events} />
			</main>
		</div>
	);
}
