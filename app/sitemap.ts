import type { MetadataRoute } from "next";
import { buildSiteUrl } from "@/lib/site-url";

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
			url: buildSiteUrl("/privacy"),
			lastModified,
			changeFrequency: "yearly",
			priority: 0.2,
		},
	];
}
