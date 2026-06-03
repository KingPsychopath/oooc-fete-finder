import { buildSiteUrl, getBasePath, getSiteUrl } from "@/lib/site-url";
import type { MetadataRoute } from "next";

const withBasePath = (path: string): string => `${getBasePath()}${path}`;

export default function robots(): MetadataRoute.Robots {
	return {
		rules: [
			{
				userAgent: ["GPTBot", "Google-Extended", "ClaudeBot", "CCBot"],
				disallow: withBasePath("/"),
			},
			{
				userAgent: "*",
				allow: withBasePath("/"),
				disallow: [
					withBasePath("/admin"),
					withBasePath("/api"),
					withBasePath("/event"),
					withBasePath("/labs"),
					withBasePath("/partner-stats"),
					withBasePath("/partner-success"),
					withBasePath("/plans/"),
					withBasePath("/social"),
					withBasePath("/tickets"),
				],
			},
		],
		sitemap: buildSiteUrl("/sitemap.xml"),
		host: getSiteUrl(),
	};
}
