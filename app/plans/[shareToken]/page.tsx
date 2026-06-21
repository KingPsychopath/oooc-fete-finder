import Header from "@/components/Header";
import { SharedPlanClient } from "@/features/plans/components/SharedPlanClient";
import {
	FEATURED_FETE_ROUTE,
	getFeaturedFeteRouteHref,
	isFeaturedFeteRouteShareToken,
} from "@/features/plans/featured-route";
import { formatPublicPlanTitle } from "@/features/plans/plan-title";
import {
	buildSharedPlanMetadata,
	getSharedPlanByToken,
	getSharedPlanPagePayload,
} from "@/features/plans/shared-plan-page.server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const revalidate = 0;

type SharedPlanPageProps = {
	params: Promise<{ shareToken: string }>;
};

export async function generateMetadata({
	params,
}: SharedPlanPageProps): Promise<Metadata> {
	const { shareToken } = await params;
	const plan = await getSharedPlanByToken(shareToken);
	if (!plan) {
		return {
			title: "Plan not found",
			robots: { index: false, follow: false },
		};
	}

	const isFeaturedFeteRoute = isFeaturedFeteRouteShareToken(plan.shareToken);
	const title = isFeaturedFeteRoute
		? FEATURED_FETE_ROUTE.routeTitle
		: "A Fête Route";
	const publicPlanTitle = formatPublicPlanTitle(plan.planDate);
	const description = isFeaturedFeteRoute
		? FEATURED_FETE_ROUTE.routeSummary
		: `${publicPlanTitle} with ${plan.stops.length} stop${
				plan.stops.length === 1 ? "" : "s"
			}. Save it to your own Fete Finder plans.`;
	const canonicalPath = isFeaturedFeteRoute
		? getFeaturedFeteRouteHref()
		: `/plans/${shareToken}`;

	return buildSharedPlanMetadata({
		plan,
		urlPath: canonicalPath,
		title,
		description,
		robots: { index: false, follow: true },
	});
}

export default async function SharedPlanPage({ params }: SharedPlanPageProps) {
	const { shareToken } = await params;
	const payload = await getSharedPlanPagePayload(shareToken);
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
