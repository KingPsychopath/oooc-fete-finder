import "server-only";

import { getLiveEvents } from "@/features/data-management/runtime-service";
import { toHomepageEventPayload } from "@/features/events/homepage-event-payload";
import {
	OFFICIAL_FETE_PLAN,
	isDeprecatedOfficialFeteSourceToken,
} from "@/features/plans/official-plan-config";
import { formatPublicPlanTitle } from "@/features/plans/plan-title";
import type {
	PublishedPlanAliasResolution,
	PublishedPlanResolution,
	PublishedPlanVersion,
} from "@/features/plans/published-plan-types";
import type { SharedPlan } from "@/features/plans/types";
import { getPublicSlidingBannerSettingsCached } from "@/features/site-settings/queries";
import { getPublishedPlanRepository } from "@/lib/platform/postgres/published-plan-repository";
import { getUserPlanRepository } from "@/lib/platform/postgres/user-plan-repository";
import { buildSiteUrl } from "@/lib/site-url";
import { generateSharedPlanOGImage } from "@/lib/social/og-utils";
import type { Metadata } from "next";
import type { SharedPlanPresentation } from "./components/SharedPlanClient";

export type PublicPlanResolution =
	| {
			kind: "official";
			published: PublishedPlanResolution;
			plan: SharedPlan;
			presentation: SharedPlanPresentation;
			canonicalPath: string;
	  }
	| {
			kind: "shared";
			plan: SharedPlan;
			presentation: SharedPlanPresentation;
			canonicalPath: string;
	  }
	| {
			kind: "redirect";
			destination: string;
	  }
	| {
			kind: "gone";
			title: string;
			description: string;
			redirectPath?: string;
	  }
	| {
			kind: "not_found";
	  };

export const getSharedPlanByToken = async (
	shareToken: string,
): Promise<SharedPlan | null> => {
	const repository = getUserPlanRepository();
	if (!repository) return null;
	return repository.findSharedPlan({ shareToken });
};

const versionToSharedPlan = (
	version: PublishedPlanVersion,
	resolution: PublishedPlanResolution,
): SharedPlan => {
	const now = version.publishedAt;
	return {
		id: version.id,
		userId: null,
		ownerKey: `published:${resolution.alias.pathSlug}`,
		planDate: version.planDate,
		title: version.title,
		visibility: "unlisted",
		shareToken: null,
		shareOwnerNameVisible: false,
		ownerDisplayName: "OOOC",
		createdAt: version.publishedAt,
		updatedAt: version.publishedAt,
		stops: version.stops.map((stop, index) => ({
			id: `${version.id}:${stop.eventKey}:${index}`,
			eventKey: stop.eventKey,
			stopOrder: stop.stopOrder || index + 1,
			locked: stop.locked,
			arrivalTime: stop.arrivalTime,
			departureTime: stop.departureTime,
			travelMinutesFromPrevious: stop.travelMinutesFromPrevious,
			createdAt: now,
			updatedAt: now,
		})),
	};
};

const buildOfficialPresentation = (): SharedPlanPresentation => ({
	kind: "official",
	badge: OFFICIAL_FETE_PLAN.routeBadge,
	title: OFFICIAL_FETE_PLAN.routeTitle,
	description: OFFICIAL_FETE_PLAN.routeSummary,
	saveCta: OFFICIAL_FETE_PLAN.routeSaveCta,
	savedCta: OFFICIAL_FETE_PLAN.routeSavedCta,
	showOfficialPlanPrompt: false,
});

const buildSharedPresentation = (plan: SharedPlan): SharedPlanPresentation => ({
	kind: "shared",
	badge: "Shared plan",
	title:
		plan.shareOwnerNameVisible === false
			? "Shared plan"
			: `${plan.ownerDisplayName}'s plan`,
	description:
		"Open each stop for details, copy the link, or save the route to your own Fete Finder plans.",
	saveCta: "Save to my plans",
	savedCta: "Saved to my plans",
	showOfficialPlanPrompt: true,
});

const resolvePublishedAlias = async (
	id: string,
): Promise<PublishedPlanAliasResolution | null> => {
	const repository = getPublishedPlanRepository();
	if (!repository) return null;
	try {
		return await repository.resolveAlias(id);
	} catch {
		return null;
	}
};

export async function resolvePublicPlanIdentifier(
	id: string,
): Promise<PublicPlanResolution> {
	const cleanId = id.trim();
	if (!cleanId) return { kind: "not_found" };

	if (isDeprecatedOfficialFeteSourceToken(cleanId)) {
		return { kind: "redirect", destination: "/plans/fete" };
	}

	const published = await resolvePublishedAlias(cleanId);
	if (published?.kind === "published") {
		return {
			kind: "official",
			published: published.value,
			plan: versionToSharedPlan(published.value.version, published.value),
			presentation: buildOfficialPresentation(),
			canonicalPath: `/plans/${published.value.canonicalSlug}`,
		};
	}
	if (published?.kind === "redirect") {
		return {
			kind: "redirect",
			destination: `/plans/${published.value.redirectToSlug}`,
		};
	}
	if (published?.kind === "gone") {
		return {
			kind: "gone",
			title: "This plan has moved",
			description: "This official plan is no longer available from this link.",
		};
	}

	const sharedPlan = await getSharedPlanByToken(cleanId);
	if (!sharedPlan) return { kind: "not_found" };
	return {
		kind: "shared",
		plan: sharedPlan,
		presentation: buildSharedPresentation(sharedPlan),
		canonicalPath: `/plans/${cleanId}`,
	};
}

export const getSharedPlanPagePayload = async (id: string) => {
	const [resolution, result, bannerSettings] = await Promise.all([
		resolvePublicPlanIdentifier(id),
		getLiveEvents({ includeEngagementProjection: true }),
		getPublicSlidingBannerSettingsCached(),
	]);

	if (resolution.kind !== "official" && resolution.kind !== "shared") {
		return { resolution, events: [], bannerSettings };
	}
	const routeEventKeys = new Set(
		resolution.plan.stops.map((stop) => stop.eventKey.trim().toLowerCase()),
	);

	return {
		resolution,
		events: result.data
			.filter((event) =>
				routeEventKeys.has(event.eventKey.trim().toLowerCase()),
			)
			.map(toHomepageEventPayload),
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
					alt: "Fete Finder route with stop count and plan date",
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
					alt: "Fete Finder route with stop count and plan date",
				},
			],
		},
	};
};
