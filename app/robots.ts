import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const normalizeBasePath = (value: string): string => {
	if (!value || value === "/") return "";
	return value.endsWith("/") ? value.slice(0, -1) : value;
};

const withBasePath = (path: string): string =>
	`${normalizeBasePath(basePath)}${path}`;

export default function robots(): MetadataRoute.Robots {
	return {
		rules: {
			userAgent: "*",
			allow: withBasePath("/"),
			disallow: [
				withBasePath("/admin"),
				withBasePath("/api"),
				withBasePath("/event"),
				withBasePath("/labs/event-modal"),
				withBasePath("/labs/font-test"),
				withBasePath("/labs/header"),
				withBasePath("/labs/home-style"),
				withBasePath("/partner-stats"),
				withBasePath("/partner-success"),
				withBasePath("/social"),
			],
		},
		sitemap: new URL(
			`${normalizeBasePath(basePath)}/sitemap.xml`,
			siteUrl,
		).toString(),
		host: siteUrl,
	};
}
