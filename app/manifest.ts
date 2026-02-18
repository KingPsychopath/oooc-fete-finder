import type { MetadataRoute } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const withBasePath = (path: string): string => `${basePath}${path}`;

export default function manifest(): MetadataRoute.Manifest {
	return {
		id: withBasePath("/"),
		name: "Fete Finder - Out Of Office Collective",
		short_name: "Fete Finder",
		description:
			"Interactive map of music events across Paris arrondissements for Fete de la Musique. Discover live music performances and cultural events.",
		theme_color: "#000000",
		background_color: "#ffffff",
		display: "standalone",
		scope: withBasePath("/"),
		start_url: withBasePath("/"),
		orientation: "portrait-primary",
		categories: ["music", "entertainment", "lifestyle"],
		lang: "en",
		dir: "ltr",
		icons: [
			{
				src: withBasePath("/icons/icon-72x72.png"),
				sizes: "72x72",
				type: "image/png",
				purpose: "any",
			},
			{
				src: withBasePath("/icons/icon-96x96.png"),
				sizes: "96x96",
				type: "image/png",
				purpose: "any",
			},
			{
				src: withBasePath("/icons/icon-128x128.png"),
				sizes: "128x128",
				type: "image/png",
				purpose: "any",
			},
			{
				src: withBasePath("/icons/icon-144x144.png"),
				sizes: "144x144",
				type: "image/png",
				purpose: "any",
			},
			{
				src: withBasePath("/icons/icon-152x152.png"),
				sizes: "152x152",
				type: "image/png",
				purpose: "any",
			},
			{
				src: withBasePath("/icons/icon-192x192.png"),
				sizes: "192x192",
				type: "image/png",
				purpose: "any",
			},
			{
				src: withBasePath("/icons/icon-384x384.png"),
				sizes: "384x384",
				type: "image/png",
				purpose: "any",
			},
			{
				src: withBasePath("/icons/icon-512x512.png"),
				sizes: "512x512",
				type: "image/png",
				purpose: "any",
			},
			{
				src: withBasePath("/icons/icon-192x192.png"),
				sizes: "192x192",
				type: "image/png",
				purpose: "maskable",
			},
			{
				src: withBasePath("/icons/icon-512x512.png"),
				sizes: "512x512",
				type: "image/png",
				purpose: "maskable",
			},
		],
		shortcuts: [
			{
				name: "Admin Panel",
				short_name: "Admin",
				description: "Access admin dashboard",
				url: withBasePath("/admin"),
				icons: [
					{
						src: withBasePath("/icons/icon-192x192.png"),
						sizes: "192x192",
						type: "image/png",
					},
				],
			},
		],
		display_override: ["window-controls-overlay", "standalone"],
		protocol_handlers: [],
		related_applications: [],
		prefer_related_applications: false,
	};
}
