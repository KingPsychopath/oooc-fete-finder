import { buildSiteUrl, getBasePath, getSiteUrl } from "@/lib/site-url";
import type { MetadataRoute } from "next";

const withBasePath = (path: string): string => `${getBasePath()}${path}`;

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
				withBasePath("/labs/header"),
				withBasePath("/labs/home-style"),
				withBasePath("/partner-stats"),
				withBasePath("/partner-success"),
				withBasePath("/social"),
			],
		},
		sitemap: buildSiteUrl("/sitemap.xml"),
		host: getSiteUrl(),
	};
}
