import Header from "@/components/Header";
import { getLiveEvents } from "@/features/data-management/runtime-service";
import { toHomepageEventPayload } from "@/features/events/homepage-event-payload";
import { SharedPlanClient } from "@/features/plans/components/SharedPlanClient";
import { formatPublicPlanTitle } from "@/features/plans/plan-title";
import { getPublicSlidingBannerSettingsCached } from "@/features/site-settings/queries";
import { getUserPlanRepository } from "@/lib/platform/postgres/user-plan-repository";
import { buildSiteUrl } from "@/lib/site-url";
import { generateOGImageUrl } from "@/lib/social/og-utils";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const revalidate = 0;

type SharedPlanPageProps = {
	params: Promise<{ shareToken: string }>;
};

const getSharedPlan = async (shareToken: string) => {
	const repository = getUserPlanRepository();
	if (!repository) return null;
	return repository.findSharedPlan({ shareToken });
};

export async function generateMetadata({
	params,
}: SharedPlanPageProps): Promise<Metadata> {
	const { shareToken } = await params;
	const plan = await getSharedPlan(shareToken);
	if (!plan) {
		return {
			title: "Plan not found",
			robots: { index: false, follow: false },
		};
	}

	const title =
		plan.shareOwnerNameVisible === false
			? "Shared plan"
			: `${plan.ownerDisplayName}'s plan`;
	const publicPlanTitle = formatPublicPlanTitle(plan.planDate);
	const description = `${publicPlanTitle} with ${plan.stops.length} stop${
		plan.stops.length === 1 ? "" : "s"
	}. Save it to your own Fete Finder plans.`;
	const url = buildSiteUrl(`/plans/${shareToken}`);

	return {
		title,
		description,
		alternates: { canonical: url },
		robots: { index: false, follow: true },
		openGraph: {
			type: "website",
			url,
			title,
			description,
			siteName: "Fete Finder",
			images: [
				{
					url: generateOGImageUrl({
						title,
						subtitle: description,
					}),
					width: 1200,
					height: 630,
				},
			],
		},
		twitter: {
			card: "summary_large_image",
			title,
			description,
		},
	};
}

export default async function SharedPlanPage({ params }: SharedPlanPageProps) {
	const { shareToken } = await params;
	const [plan, result, bannerSettings] = await Promise.all([
		getSharedPlan(shareToken),
		getLiveEvents({ includeEngagementProjection: true }),
		getPublicSlidingBannerSettingsCached(),
	]);

	if (!plan) notFound();

	const events = result.data.map(toHomepageEventPayload);

	return (
		<div className="ooo-site-shell">
			<Header bannerSettings={bannerSettings} />
			<main
				id="main-content"
				className="min-h-screen bg-background"
				tabIndex={-1}
			>
				<SharedPlanClient plan={plan} initialEvents={events} />
			</main>
		</div>
	);
}
