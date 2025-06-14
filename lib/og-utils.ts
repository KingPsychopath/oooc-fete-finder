/**
 * Utility functions for generating dynamic OG:image URLs
 * Used throughout the app to create custom social media images
 */

import { ClientEnvironmentManager } from "@/lib/config/env";

type OGImageTheme = "default" | "event" | "admin";

type OGImageParams = {
	title?: string;
	subtitle?: string;
	theme?: OGImageTheme;
	eventCount?: number;
	arrondissement?: string;
};

/**
 * Generate an OG:image URL with custom parameters
 */
export const generateOGImageUrl = (params: OGImageParams = {}): string => {
	const searchParams = new URLSearchParams();

	if (params.title) searchParams.set("title", params.title);
	if (params.subtitle) searchParams.set("subtitle", params.subtitle);
	if (params.theme) searchParams.set("theme", params.theme);
	if (params.eventCount)
		searchParams.set("eventCount", params.eventCount.toString());
	if (params.arrondissement)
		searchParams.set("arrondissement", params.arrondissement);

	const query = searchParams.toString();
	return `/api/og${query ? `?${query}` : ""}`;
};

/**
 * Generate OG:image URL for event-specific content
 */
export const generateEventOGImage = (params: {
	eventName?: string;
	arrondissement?: string;
	eventCount?: number;
}): string => {
	return generateOGImageUrl({
		title: params.eventName || "Live Music Events",
		subtitle: params.arrondissement
			? `Discover events in ${params.arrondissement} during Fête de la Musique 2025`
			: "Interactive Paris Music Events Map",
		theme: "event",
		eventCount: params.eventCount,
		arrondissement: params.arrondissement,
	});
};

/**
 * Generate OG:image URL for admin/dashboard content
 */
export const generateAdminOGImage = (
	params: {
		title?: string;
		subtitle?: string;
	} = {},
): string => {
	return generateOGImageUrl({
		title: params.title || "Admin Dashboard",
		subtitle: params.subtitle || "Event Management & Cache Control",
		theme: "admin",
	});
};

/**
 * Generate OG:image URL for the main site
 */
export const generateMainOGImage = (eventCount?: number): string => {
	return generateOGImageUrl({
		title: "Fête Finder",
		subtitle: "Interactive Paris Music Events Map",
		theme: "default",
		eventCount,
	});
};

/**
 * Generate structured metadata for Next.js pages
 */
export const generateOGMetadata = (params: {
	title: string;
	description: string;
	ogImageUrl: string;
	url?: string;
	noIndex?: boolean;
}) => {
	const siteUrl = ClientEnvironmentManager.get("NEXT_PUBLIC_SITE_URL");

	return {
		title: params.title,
		description: params.description,
		...(params.noIndex && {
			robots: {
				index: false,
				follow: false,
			},
		}),
		openGraph: {
			type: "website" as const,
			locale: "en_US",
			url: params.url || siteUrl,
			title: params.title,
			description: params.description,
			siteName: "Fête Finder - OOOC",
			images: [
				{
					url: params.ogImageUrl,
					width: 1200,
					height: 630,
					alt: params.title,
					type: "image/png",
				},
			],
		},
		twitter: {
			card: "summary_large_image" as const,
			title: params.title,
			description: params.description,
			images: [
				{
					url: params.ogImageUrl,
					alt: params.title,
				},
			],
		},
	};
};

/**
 * Predefined OG:image configurations for common use cases
 */
export const OG_PRESETS = {
	main: () => generateMainOGImage(),
	admin: () => generateAdminOGImage(),
	event: (arrondissement?: string, eventCount?: number) =>
		generateEventOGImage({ arrondissement, eventCount }),
	custom: (title: string, subtitle: string, theme: OGImageTheme = "default") =>
		generateOGImageUrl({ title, subtitle, theme }),
} as const;
