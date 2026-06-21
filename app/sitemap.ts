import {
	OFFICIAL_FETE_PLAN,
	getOfficialFetePlanArchiveHref,
	getOfficialFetePlanHref,
} from "@/features/plans/official-plan-config";
import { buildSiteUrl } from "@/lib/site-url";
import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
	const lastModified = new Date();

	return [
		{
			url: buildSiteUrl("/"),
			lastModified,
			changeFrequency: "daily",
			priority: 1,
		},
		{
			url: buildSiteUrl("/how-it-works"),
			lastModified,
			changeFrequency: "weekly",
			priority: 0.8,
		},
		{
			url: buildSiteUrl("/submit-event"),
			lastModified,
			changeFrequency: "weekly",
			priority: 0.7,
		},
		{
			url: buildSiteUrl("/feature-event"),
			lastModified,
			changeFrequency: "weekly",
			priority: 0.7,
		},
		{
			url: buildSiteUrl("/exchange"),
			lastModified,
			changeFrequency: "hourly",
			priority: 0.8,
		},
		{
			url: buildSiteUrl("/plans"),
			lastModified,
			changeFrequency: "weekly",
			priority: 0.6,
		},
		...(OFFICIAL_FETE_PLAN.active
			? [
					{
						url: buildSiteUrl(getOfficialFetePlanHref()),
						lastModified,
						changeFrequency: "hourly" as const,
						priority: 0.8,
					},
					{
						url: buildSiteUrl(getOfficialFetePlanArchiveHref()),
						lastModified,
						changeFrequency: "yearly" as const,
						priority: 0.5,
					},
				]
			: []),
		{
			url: buildSiteUrl("/privacy"),
			lastModified,
			changeFrequency: "yearly",
			priority: 0.2,
		},
		{
			url: buildSiteUrl("/terms"),
			lastModified,
			changeFrequency: "yearly",
			priority: 0.2,
		},
	];
}
