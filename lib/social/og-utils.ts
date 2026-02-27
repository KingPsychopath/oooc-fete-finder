/**
 * Utility functions for generating dynamic OG:image URLs
 * Used throughout the app to create custom social media images
 */

import { env } from "@/lib/config/env";

type OGImageVariant = "default" | "event-modal";
type LegacyTheme = "default" | "event" | "admin" | "custom";

type OGImageParams = {
	title?: string;
	subtitle?: string;
	variant?: OGImageVariant;
	theme?: LegacyTheme;
	eventCount?: number;
	arrondissement?: string;
};

const resolveVariant = (params: OGImageParams): OGImageVariant => {
	if (params.variant) {
		return params.variant;
	}

	if (params.theme === "event") {
		return "event-modal";
	}

	return "default";
};

/**
 * Generate an OG:image URL with custom parameters
 */
export const generateOGImageUrl = (params: OGImageParams = {}): string => {
	const searchParams = new URLSearchParams();
	const variant = resolveVariant(params);

	searchParams.set("variant", variant);

	if (params.title) searchParams.set("title", params.title);
	if (params.subtitle) searchParams.set("subtitle", params.subtitle);
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
			? `Live picks in ${params.arrondissement} curated by Out Of Office Collective`
			: "Live event details and nearby picks curated by Out Of Office Collective",
		variant: "event-modal",
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
	void params;
	return generateOGImageUrl({
		variant: "default",
	});
};

/**
 * Generate OG:image URL for the main site
 */
export const generateMainOGImage = (eventCount?: number): string => {
	return generateOGImageUrl({
		title: "Fête Finder",
		subtitle: "Curated Paris music events by Out Of Office Collective",
		variant: "default",
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
	const siteUrl = env.NEXT_PUBLIC_SITE_URL;

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
	custom: (title: string, subtitle: string) =>
		generateOGImageUrl({ title, subtitle, variant: "default" }),
} as const;
