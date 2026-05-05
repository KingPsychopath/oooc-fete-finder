import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const normalizeBasePath = (value: string): string => {
	if (!value || value === "/") return "";
	return value.endsWith("/") ? value.slice(0, -1) : value;
};

const toAbsoluteUrl = (path: string): string =>
	new URL(`${normalizeBasePath(basePath)}${path}`, siteUrl).toString();

export default function sitemap(): MetadataRoute.Sitemap {
	const lastModified = new Date();

	return [
		{
			url: toAbsoluteUrl("/"),
			lastModified,
			changeFrequency: "daily",
			priority: 1,
		},
		{
			url: toAbsoluteUrl("/how-it-works"),
			lastModified,
			changeFrequency: "weekly",
			priority: 0.8,
		},
		{
			url: toAbsoluteUrl("/submit-event"),
			lastModified,
			changeFrequency: "weekly",
			priority: 0.7,
		},
		{
			url: toAbsoluteUrl("/feature-event"),
			lastModified,
			changeFrequency: "weekly",
			priority: 0.7,
		},
		{
			url: toAbsoluteUrl("/privacy"),
			lastModified,
			changeFrequency: "yearly",
			priority: 0.2,
		},
	];
}
