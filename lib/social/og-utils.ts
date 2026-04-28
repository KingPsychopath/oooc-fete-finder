/**
 * Utility functions for generating dynamic OG:image URLs
 * Used throughout the app to create custom social media images
 */

import { env } from "@/lib/config/env";

type OGImageVariant = "default" | "event-modal";
type LegacyTheme = "default" | "event" | "admin" | "custom";
export type OGPreset =
	| "home"
	| "submit-event"
	| "feature-event"
	| "partner-success"
	| "partner-performance-report";

type OGImageParams = {
	title?: string;
	subtitle?: string;
	variant?: OGImageVariant;
	theme?: LegacyTheme;
	eventCount?: number;
	arrondissement?: string;
	venue?: string;
	time?: string;
	date?: string;
	price?: string;
	genres?: string[];
};

const buildOGRouteUrl = (params: Record<string, string | undefined>): string => {
	const searchParams = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value) {
			searchParams.set(key, value);
		}
	}

	const query = searchParams.toString();
	return `/api/og${query ? `?${query}` : ""}`;
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
	if (params.venue) searchParams.set("venue", params.venue);
	if (params.time) searchParams.set("time", params.time);
	if (params.date) searchParams.set("date", params.date);
	if (params.price) searchParams.set("price", params.price);
	if (params.genres && params.genres.length > 0)
		searchParams.set("genres", params.genres.join(","));

	const query = searchParams.toString();
	return `/api/og${query ? `?${query}` : ""}`;
};

export const generatePresetOGImage = (preset: OGPreset): string =>
	buildOGRouteUrl({ preset });

/**
 * Generate OG:image URL for event-specific content
 */
export const generateEventOGImage = (params: { eventKey: string }): string =>
	buildOGRouteUrl({ preset: "event", eventKey: params.eventKey });

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
	return generatePresetOGImage("home");
};

/**
 * Generate OG:image URL for the main site
 */
export const generateMainOGImage = (eventCount?: number): string => {
	void eventCount;
	return generatePresetOGImage("home");
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
	event: (eventKey: string) => generateEventOGImage({ eventKey }),
	custom: (_title: string, _subtitle: string) => generatePresetOGImage("home"),
} as const;
