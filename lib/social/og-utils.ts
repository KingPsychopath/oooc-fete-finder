/**
 * Utility functions for generating OG:image URLs.
 * Static public pages use fixed PNGs; event shares stay dynamic.
 */

import { buildSiteUrl } from "@/lib/site-url";

type OGImageVariant = "default" | "event-modal";
type LegacyTheme = "default" | "event" | "admin" | "custom";
export type OGPreset =
	| "home"
	| "how-it-works"
	| "privacy"
	| "submit-event"
	| "feature-event"
	| "partner-success"
	| "partner-performance-report"
	| "social-assets"
	| "exchange"
	| "plans";

const STATIC_OG_IMAGE_BY_PRESET: Record<OGPreset, string> = {
	home: "/og/home.png",
	"how-it-works": "/og/how-it-works.png",
	privacy: "/og/privacy.png",
	"submit-event": "/og/submit-event.png",
	"feature-event": "/og/feature-event.png",
	"partner-success": "/og/partner-success.png",
	"partner-performance-report": "/og/partner-performance-report.png",
	"social-assets": "/og/social-assets.png",
	exchange: "/og/exchange.png",
	plans: "/og/plans.png",
};

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

type SharedPlanOGImageParams = {
	stopCount: number;
	planDateLabel?: string;
};

const getOGImageVersion = (): string =>
	(
		process.env.NEXT_PUBLIC_OG_IMAGE_VERSION ||
		process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ||
		""
	).trim();

const applyOGImageVersion = (searchParams: URLSearchParams): void => {
	const version = getOGImageVersion();
	if (version) {
		searchParams.set("v", version);
	}
};

const buildOGRouteUrl = (
	params: Record<string, string | undefined>,
): string => {
	const searchParams = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value) {
			searchParams.set(key, value);
		}
	}
	applyOGImageVersion(searchParams);

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
	applyOGImageVersion(searchParams);

	const query = searchParams.toString();
	return `/api/og${query ? `?${query}` : ""}`;
};

export const generatePresetOGImage = (preset: OGPreset): string => {
	const path = STATIC_OG_IMAGE_BY_PRESET[preset];
	const searchParams = new URLSearchParams();
	applyOGImageVersion(searchParams);

	const query = searchParams.toString();
	return query ? `${path}?${query}` : path;
};

/**
 * Generate OG:image URL for event-specific content
 */
export const generateEventOGImage = (params: { eventKey: string }): string =>
	buildOGRouteUrl({ preset: "event", eventKey: params.eventKey });

export const generateSharedPlanOGImage = (
	params: SharedPlanOGImageParams,
): string => {
	const stopCount = Math.max(0, Math.min(99, Math.floor(params.stopCount)));
	return buildOGRouteUrl({
		preset: "shared-plan",
		stopCount: stopCount.toString(),
		planDate: params.planDateLabel,
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
	const url = params.url || buildSiteUrl("/");

	return {
		title: params.title,
		description: params.description,
		alternates: {
			canonical: url,
		},
		...(params.noIndex && {
			robots: {
				index: false,
				follow: false,
				googleBot: {
					index: false,
					follow: false,
				},
			},
		}),
		openGraph: {
			type: "website" as const,
			locale: "en_US",
			url,
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
			site: "@OutOfOfficeCol",
			creator: "@OutOfOfficeCol",
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
