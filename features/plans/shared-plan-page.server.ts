import "server-only";

import { getLiveEvents } from "@/features/data-management/runtime-service";
import { toHomepageEventPayload } from "@/features/events/homepage-event-payload";
import { formatPublicPlanTitle } from "@/features/plans/plan-title";
import type { SharedPlan } from "@/features/plans/types";
import { getPublicSlidingBannerSettingsCached } from "@/features/site-settings/queries";
import { getUserPlanRepository } from "@/lib/platform/postgres/user-plan-repository";
import { buildSiteUrl } from "@/lib/site-url";
import { generateSharedPlanOGImage } from "@/lib/social/og-utils";
import type { Metadata } from "next";

export const getSharedPlanByToken = async (
	shareToken: string,
): Promise<SharedPlan | null> => {
	const repository = getUserPlanRepository();
	if (!repository) return null;
	return repository.findSharedPlan({ shareToken });
};

export const getSharedPlanPagePayload = async (shareToken: string) => {
	const [plan, result, bannerSettings] = await Promise.all([
		getSharedPlanByToken(shareToken),
		getLiveEvents({ includeEngagementProjection: true }),
		getPublicSlidingBannerSettingsCached(),
	]);

	if (!plan) return null;

	return {
		plan,
		events: result.data.map(toHomepageEventPayload),
		bannerSettings,
	};
};

export const buildSharedPlanMetadata = ({
	plan,
	urlPath,
	title,
	description,
	robots,
}: {
	plan: SharedPlan;
	urlPath: string;
	title: string;
	description: string;
	robots: Metadata["robots"];
}): Metadata => {
	const publicPlanTitle = formatPublicPlanTitle(plan.planDate);
	const url = buildSiteUrl(urlPath);
	const ogImageUrl = generateSharedPlanOGImage({
		stopCount: plan.stops.length,
		planDateLabel: publicPlanTitle,
		planVersion: plan.updatedAt,
	});

	return {
		title,
		description,
		alternates: { canonical: url },
		robots,
		openGraph: {
			type: "website",
			url,
			title,
			description,
			siteName: "Fete Finder",
			images: [
				{
					url: ogImageUrl,
					width: 1200,
					height: 630,
					alt: "Shared Fete Finder route with stop count and plan date",
					type: "image/png",
				},
			],
		},
		twitter: {
			card: "summary_large_image",
			title,
			description,
			images: [
				{
					url: ogImageUrl,
					alt: "Shared Fete Finder route with stop count and plan date",
				},
			],
		},
	};
};
