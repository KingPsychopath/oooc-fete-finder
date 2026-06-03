import { createHash } from "crypto";
import { DataManager } from "@/features/data-management/data-manager";
import {
	getCurrentParisYearDateRange,
	getEventCountForDateRange,
} from "@/features/events/filtering";
import {
	formatDayWithDate,
	formatLocationAreaLong,
	formatPrice,
} from "@/features/events/types";
import { getKVStore } from "@/lib/platform/kv/kv-store-factory";
import { log } from "@/lib/platform/logger";
import {
	type EventShareDetails,
	getEventShareDetails,
} from "@/lib/social/event-share-details";
import type { NextRequest } from "next/server";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";

export const runtime = "nodejs";

const OG_CACHE_CONTROL = "public, max-age=300, stale-while-revalidate=86400";
const OG_CDN_CACHE_CONTROL =
	"public, max-age=86400, stale-while-revalidate=604800";
const OG_RESPONSE_HEADERS = {
	"Cache-Control": OG_CACHE_CONTROL,
	"CDN-Cache-Control": OG_CDN_CACHE_CONTROL,
} as const;
const FONT_ROOT = join(process.cwd(), "public", "fonts");
const RATE_LIMIT_KEY_PREFIX = "og-rate:";
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 120;
const MAX_TEXT_LENGTH = 110;
const MAX_CHIPS = 3;
const ALLOWED_VARIANTS = ["default", "event-modal"] as const;
const ALLOWED_PRESETS = [
	"home",
	"how-it-works",
	"privacy",
	"submit-event",
	"feature-event",
	"partner-success",
	"partner-performance-report",
	"social-assets",
	"event",
	"shared-plan",
] as const;

type OGVariant = (typeof ALLOWED_VARIANTS)[number];
type OGPreset = (typeof ALLOWED_PRESETS)[number];
type RateState = { count: number; resetAt: number };

type OGTheme = {
	label: string;
	accent: string;
};

type OGContent = {
	variant: OGVariant;
	title: string;
	subtitle: string;
	eventCount: number;
	arrondissement: string;
	date: string;
	time: string;
	price: string;
	venue: string;
	genres: string[];
};

const OG_FONT_FILES = [
	join(FONT_ROOT, "degular_regular.ttf"),
	join(FONT_ROOT, "prata_regular.ttf"),
];

const THEMES: Record<OGVariant, OGTheme> = {
	default: {
		label: "Fête de la Musique · Paris",
		accent: "#7f2f28",
	},
	"event-modal": {
		label: "Event Pick",
		accent: "#155d63",
	},
};

const sanitizeText = (value: string, fallback: string): string => {
	const cleaned = value.replace(/[<>]/g, "").trim();
	if (!cleaned) return fallback;
	return cleaned.length > MAX_TEXT_LENGTH
		? `${cleaned.slice(0, MAX_TEXT_LENGTH - 1)}…`
		: cleaned;
};

const parseBoundedCount = (
	value: string | null,
	max: number,
	fallback = 0,
): number => {
	if (!value) return fallback;
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed)) return fallback;
	return Math.max(0, Math.min(max, parsed));
};

const sanitizeCacheTagSegment = (value: string): string =>
	value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9_-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80);

const getOGCacheTags = (searchParams: URLSearchParams): string => {
	const preset = parsePreset(searchParams);
	if (preset === "event") {
		const eventKey = sanitizeCacheTagSegment(
			searchParams.get("eventKey") || "unknown",
		);
		return `og,event,event-${eventKey || "unknown"}`;
	}

	const requestedPreset = searchParams.get("preset") || "home";
	const cachePreset = requestedPreset === preset ? preset : "fallback-home";
	return `og,preset,preset-${sanitizeCacheTagSegment(cachePreset)}`;
};

const getOGResponseHeaders = (cacheTags: string): HeadersInit => ({
	...OG_RESPONSE_HEADERS,
	"Cache-Tag": cacheTags,
});

export async function HEAD(request: NextRequest) {
	const { searchParams } = new URL(request.url);
	return new Response(null, {
		status: 200,
		headers: getOGResponseHeaders(getOGCacheTags(searchParams)),
	});
}

const STATIC_PRESET_CONTENT: Record<
	Exclude<OGPreset, "event" | "shared-plan">,
	Omit<
		OGContent,
		| "eventCount"
		| "arrondissement"
		| "date"
		| "time"
		| "price"
		| "venue"
		| "genres"
	>
> = {
	home: {
		variant: "default",
		title: "Fête Finder",
		subtitle: "Curated Paris music events by Out Of Office Collective",
	},
	"how-it-works": {
		variant: "default",
		title: "How Fête Finder Works",
		subtitle:
			"Plan your Paris music weekend with curated picks, filters and community tips",
	},
	privacy: {
		variant: "default",
		title: "Privacy Policy",
		subtitle: "How Fête Finder handles attendee, host and partner data",
	},
	"submit-event": {
		variant: "default",
		title: "Submit Your Event",
		subtitle: "Share your event with Out Of Office Collective",
	},
	"feature-event": {
		variant: "default",
		title: "Partner With OOOC",
		subtitle: "Spotlight and promoted placements in Fête Finder",
	},
	"partner-success": {
		variant: "default",
		title: "Payment Received",
		subtitle: "Your OOOC placement is now in the activation queue",
	},
	"partner-performance-report": {
		variant: "default",
		title: "Partner Performance Report",
		subtitle: "Private campaign performance metrics",
	},
	"social-assets": {
		variant: "default",
		title: "Fête Finder Social Assets",
		subtitle: "Private branded export routes for Out Of Office Collective",
	},
};

const getClientIp = (request: NextRequest): string => {
	const forwardedFor = request.headers.get("x-forwarded-for");
	if (forwardedFor?.trim()) {
		return forwardedFor.split(",")[0]?.trim() || "unknown";
	}
	return request.headers.get("x-real-ip")?.trim() || "unknown";
};

const hashIp = (ip: string): string =>
	createHash("sha256").update(ip).digest("hex").slice(0, 24);

const parseRateState = (raw: string | null): RateState | null => {
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as Partial<RateState>;
		if (
			typeof parsed.count !== "number" ||
			typeof parsed.resetAt !== "number" ||
			!Number.isFinite(parsed.count) ||
			!Number.isFinite(parsed.resetAt)
		) {
			return null;
		}
		return {
			count: Math.max(0, Math.floor(parsed.count)),
			resetAt: parsed.resetAt,
		};
	} catch {
		return null;
	}
};

const isRateLimited = async (request: NextRequest): Promise<boolean> => {
	const ip = getClientIp(request);
	const now = Date.now();
	const key = `${RATE_LIMIT_KEY_PREFIX}${hashIp(ip)}`;

	try {
		const kv = await getKVStore();
		const current = parseRateState(await kv.get(key));

		if (!current || now >= current.resetAt) {
			await kv.set(
				key,
				JSON.stringify({
					count: 1,
					resetAt: now + RATE_LIMIT_WINDOW_MS,
				}),
			);
			return false;
		}

		if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
			return true;
		}

		await kv.set(
			key,
			JSON.stringify({
				count: current.count + 1,
				resetAt: current.resetAt,
			}),
		);
		return false;
	} catch (error) {
		log.warn("og-image", "Rate limiter unavailable; allowing request", {
			error: error instanceof Error ? error.message : "unknown",
		});
		return false;
	}
};

const buildThemeText = (
	variant: OGVariant,
	arrondissement: string,
	eventCount: number,
) => {
	if (variant === "event-modal" && arrondissement) {
		return {
			title: `Events in ${arrondissement}`,
			subtitle:
				eventCount > 0
					? `${eventCount} live picks for your Paris route.`
					: "Curated live music picks for your Paris route.",
		};
	}

	return {
		title: "Fête Finder",
		subtitle:
			eventCount > 0
				? `${eventCount} curated Paris picks by Out Of Office Collective.`
				: "Curated Paris music picks by Out Of Office Collective.",
	};
};

const toDisplayTitle = (value: string): string => {
	const normalized = value.replace(/[-_]+/g, " ").trim();
	if (!normalized) return "Event";
	return normalized
		.split(/\s+/)
		.map((segment) => segment[0]?.toUpperCase() + segment.slice(1))
		.join(" ");
};

const formatArrondissement = (
	value: EventShareDetails["arrondissement"],
): string => {
	if (value === "unknown") return "Paris";
	if (typeof value === "number") return `${value}e arrondissement`;
	return formatLocationAreaLong(value);
};

const formatTimeRange = (event: EventShareDetails): string => {
	const hasStart = Boolean(event.time && event.time !== "TBC");
	const hasEnd = Boolean(event.endTime && event.endTime !== "TBC");
	if (hasStart && hasEnd) return `${event.time} - ${event.endTime}`;
	if (hasStart) return event.time || "";
	return "";
};

const formatVenue = (value: string | undefined): string => {
	if (!value) return "";
	const cleaned = value.trim();
	if (!cleaned || cleaned.toUpperCase() === "TBA") return "";
	return cleaned;
};

const formatEventDate = (event: EventShareDetails): string => {
	if (!event.date) return "";
	return formatDayWithDate(event.day, event.date);
};

const formatEventPrice = (event: EventShareDetails): string => {
	const price = formatPrice(event.price);
	return price === "TBA" ? "" : price;
};

const parsePreset = (searchParams: URLSearchParams): OGPreset => {
	const preset = searchParams.get("preset") || "";
	return ALLOWED_PRESETS.includes(preset as OGPreset)
		? (preset as OGPreset)
		: "home";
};

const resolveStaticPresetContent = (
	preset: Exclude<OGPreset, "event" | "shared-plan">,
): OGContent => {
	const content = STATIC_PRESET_CONTENT[preset];
	return {
		...content,
		eventCount: 0,
		arrondissement: "",
		date: "",
		time: "",
		price: "",
		venue: "",
		genres: [],
	};
};

const resolveSharedPlanContent = (searchParams: URLSearchParams): OGContent => {
	const stopCount = parseBoundedCount(searchParams.get("stopCount"), 99);
	const planDate = sanitizeText(searchParams.get("planDate") || "", "");
	const stopLabel = `${stopCount} stop${stopCount === 1 ? "" : "s"}`;
	const dateLabel = planDate || "Fête de la Musique";

	return {
		variant: "event-modal",
		title: "Shared Fête Finder Plan",
		subtitle: `${dateLabel} route with ${stopLabel}. Save it, remix it, and make it yours.`,
		eventCount: 0,
		arrondissement: "Paris",
		date: dateLabel,
		time: "",
		price: "",
		venue: stopLabel,
		genres: ["Route"],
	};
};

const getCurrentYearEventCount = async (): Promise<number> => {
	const result = await DataManager.getEventsData({
		populateCoordinates: false,
	});
	if (!result.success) {
		return 0;
	}
	return getEventCountForDateRange(result.data, getCurrentParisYearDateRange());
};

const resolveEventContent = async (
	searchParams: URLSearchParams,
): Promise<OGContent> => {
	const eventKey = searchParams.get("eventKey") || "";
	const event = await getEventShareDetails(eventKey);
	if (!event) {
		return {
			...resolveStaticPresetContent("home"),
			variant: "event-modal",
			title: eventKey ? toDisplayTitle(eventKey) : "Live Music Events",
			subtitle:
				"Live event details and nearby picks curated by Out Of Office Collective",
		};
	}

	const arrondissement = formatArrondissement(event.arrondissement);
	return {
		variant: "event-modal",
		title: event.name,
		subtitle: `Fête de la Musique pick in ${arrondissement}`,
		eventCount: 0,
		arrondissement,
		date: formatEventDate(event),
		time: formatTimeRange(event),
		price: formatEventPrice(event),
		venue: formatVenue(event.location),
		genres: event.genres,
	};
};

const resolveOGContent = async (
	searchParams: URLSearchParams,
): Promise<OGContent> => {
	const preset = parsePreset(searchParams);
	if (preset === "event") {
		return resolveEventContent(searchParams);
	}
	if (preset === "shared-plan") {
		return resolveSharedPlanContent(searchParams);
	}

	const content = resolveStaticPresetContent(preset);
	const requestedPreset = searchParams.get("preset") || "home";
	if (preset !== "home" || requestedPreset !== "home") {
		return content;
	}

	return {
		...content,
		subtitle: "Curated Paris music events by Out Of Office Collective",
		eventCount: await getCurrentYearEventCount(),
	};
};

const escapeXml = (value: string): string =>
	value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");

const truncateText = (value: string, maxLength: number): string => {
	if (value.length <= maxLength) return value;
	return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
};

const wrapText = (
	value: string,
	maxChars: number,
	maxLines: number,
): string[] => {
	const words = value.split(/\s+/).filter(Boolean);
	const lines: string[] = [];
	let current = "";

	for (const word of words) {
		const next = current ? `${current} ${word}` : word;
		if (next.length > maxChars && current) {
			lines.push(current);
			current = word;
			continue;
		}
		current = next;
	}

	if (current) lines.push(current);
	const visible = lines.slice(0, maxLines);
	if (lines.length > maxLines && visible.length > 0) {
		visible[visible.length - 1] = truncateText(visible[visible.length - 1], 24);
	}
	return visible;
};

const getSvgTitleLayout = (title: string, isEventCard: boolean) => {
	const candidates = isEventCard
		? [
				{ maxChars: 18, size: 76, maxLines: 2 },
				{ maxChars: 22, size: 64, maxLines: 2 },
				{ maxChars: 25, size: 56, maxLines: 2 },
			]
		: [
				{ maxChars: 18, size: 82, maxLines: 2 },
				{ maxChars: 20, size: 74, maxLines: 2 },
				{ maxChars: 22, size: 66, maxLines: 2 },
			];

	for (const candidate of candidates) {
		const lines = wrapText(title, candidate.maxChars, candidate.maxLines);
		if (lines.join(" ").replace(/\.\.\.$/, "") === title) {
			return {
				lines,
				size: title.length <= 14 && lines.length === 1 ? 104 : candidate.size,
				lineHeight: candidate.size * 0.98,
			};
		}
	}

	const fallback = candidates[candidates.length - 1];
	return {
		lines: wrapText(title, fallback.maxChars, fallback.maxLines),
		size: fallback.size,
		lineHeight: fallback.size * 0.98,
	};
};

const renderSvgTextLines = ({
	lines,
	x,
	startY,
	className,
	fontSize,
	lineHeight,
}: {
	lines: string[];
	x: number;
	startY: number;
	className: string;
	fontSize: number;
	lineHeight: number;
}): string =>
	lines
		.map(
			(line, index) =>
				`<text x="${x}" y="${
					startY + index * lineHeight
				}" class="${className}" font-size="${fontSize}">${escapeXml(
					line,
				)}</text>`,
		)
		.join("");

type MetaFact = {
	label: string;
	value: string;
	wide?: boolean;
};

const renderSvgMetaRows = (
	factsInput: MetaFact[],
	accent: string,
	yPosition: number,
): string => {
	const facts = factsInput.map((fact) => ({
		...fact,
		value: truncateText(fact.value, fact.wide ? 39 : 19),
	}));
	const rows = [facts.slice(0, 3), facts.slice(3, 5)].filter(
		(row) => row.length > 0,
	);
	return `<g transform="translate(86 ${yPosition})">
	<line x1="0" y1="0" x2="540" y2="0" stroke="${accent}" stroke-opacity="0.5" stroke-width="2"/>
	${rows
		.map((row, rowIndex) =>
			row
				.map((fact, index) => {
					const x = index * 180;
					const width = fact.wide ? 360 : 180;
					const y = 22 + rowIndex * 56;
					return `<g transform="translate(${x} ${y})">
	<line x1="0" y1="-10" x2="0" y2="36" stroke="${accent}" stroke-opacity="0.28"/>
	<text x="18" y="0" class="metaLabel" font-size="13">${escapeXml(fact.label)}</text>
	<text x="18" y="29" class="meta" font-size="22">${escapeXml(fact.value)}</text>
	<line x1="${width}" y1="-10" x2="${width}" y2="36" stroke="${accent}" stroke-opacity="0"/>
</g>`;
				})
				.join("\n"),
		)
		.join("\n")}
</g>`;
};

const renderOGSvg = (content: {
	title: string;
	subtitle: string;
	label: string;
	eventCount: number;
	footerLocation: string;
	isEventCard: boolean;
	accent: string;
	chips: MetaFact[];
}): string => {
	const titleLayout = getSvgTitleLayout(content.title, content.isEventCard);
	const titleTop = content.isEventCard
		? titleLayout.lines.length >= 3
			? 250
			: titleLayout.lines.length === 2
				? 260
				: 264
		: titleLayout.lines.length === 1
			? 262
			: 252;
	const titleBottom =
		titleTop + (titleLayout.lines.length - 1) * titleLayout.lineHeight;
	const subtitleTop = titleBottom + (content.isEventCard ? 54 : 66);
	const subtitleLines = wrapText(
		content.subtitle,
		content.isEventCard ? 48 : 42,
		2,
	);
	const subtitleBottom = subtitleTop + (subtitleLines.length - 1) * 41;
	const factsTop = content.isEventCard
		? Math.min(Math.max(430, subtitleBottom + 70), 454)
		: 492;
	const eventCountChip =
		!content.isEventCard && content.eventCount > 0
			? `<rect x="894" y="82" width="202" height="42" rx="21" fill="#fff8ef" fill-opacity="0.14" stroke="#fff8ef" stroke-opacity="0.2"/>
	<text x="914" y="109" class="railSmall">${content.eventCount} events this year</text>`
			: "";

	return `<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
	<defs>
		<linearGradient id="bg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
			<stop offset="0" stop-color="#fff8ef"/>
			<stop offset="0.48" stop-color="#f3e1c8"/>
			<stop offset="1" stop-color="#dce9e1"/>
		</linearGradient>
		<linearGradient id="rail" x1="802" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
			<stop stop-color="#201812"/>
			<stop offset="1" stop-color="#12383a"/>
		</linearGradient>
		<linearGradient id="wash" x1="0" y1="0" x2="760" y2="630" gradientUnits="userSpaceOnUse">
			<stop stop-color="#fffaf2" stop-opacity="0.84"/>
			<stop offset="1" stop-color="#fffaf2" stop-opacity="0.08"/>
		</linearGradient>
		<style>
			.eyebrow { font: 700 19px "Degular", sans-serif; letter-spacing: 3px; fill: #624f42; }
			.label { font: 700 22px "Degular", sans-serif; letter-spacing: 1.2px; fill: ${content.accent}; text-transform: uppercase; }
			.title { font-family: "Prata", serif; font-weight: 400; fill: #211811; }
			.subtitle { font: 500 34px "Degular", sans-serif; fill: #5f5044; }
			.metaLabel { font: 700 13px "Degular", sans-serif; letter-spacing: 1.8px; fill: ${content.accent}; text-transform: uppercase; }
			.meta { font: 700 22px "Degular", sans-serif; fill: #2f241b; }
			.footer { font: 700 18px "Degular", sans-serif; letter-spacing: 2.1px; fill: #6a5849; text-transform: uppercase; }
			.railText { font: 700 19px "Degular", sans-serif; letter-spacing: 2.6px; fill: #fff8ef; }
			.railSmall { font: 700 18px "Degular", sans-serif; fill: #f5debd; }
		</style>
	</defs>
	<rect width="1200" height="630" fill="url(#bg)"/>
	<rect width="820" height="630" fill="url(#wash)"/>
	<path d="M800 0 L1200 0 L1200 630 L874 630 C802 470 778 295 800 0Z" fill="url(#rail)"/>
	<path d="M814 0 C782 206 805 442 874 630" stroke="#fff8ef" stroke-opacity="0.23" stroke-width="2"/>
	<path d="M1002 92 C938 171 926 247 967 317 C1009 390 995 470 932 543" stroke="${content.accent}" stroke-width="16" stroke-linecap="round"/>
	<path d="M1002 92 C938 171 926 247 967 317 C1009 390 995 470 932 543" stroke="#fff8ef" stroke-opacity="0.34" stroke-width="3" stroke-linecap="round" stroke-dasharray="1 28"/>
	<rect x="86" y="82" width="72" height="6" rx="3" fill="${content.accent}"/>
	<text x="86" y="122" class="eyebrow">OUT OF OFFICE COLLECTIVE</text>
	<text x="86" y="172" class="label">${escapeXml(content.label)}</text>
	${renderSvgTextLines({
		lines: titleLayout.lines,
		x: 86,
		startY: titleTop,
		className: "title",
		fontSize: titleLayout.size,
		lineHeight: titleLayout.lineHeight,
	})}
	${renderSvgTextLines({
		lines: subtitleLines,
		x: 90,
		startY: subtitleTop,
		className: "subtitle",
		fontSize: 34,
		lineHeight: 43,
	})}
	${renderSvgMetaRows(content.chips, content.accent, factsTop)}
	<text x="54" y="584" class="footer">${escapeXml(content.footerLocation)}</text>
	<text x="640" y="584" class="footer" text-anchor="end">FETE FINDER</text>
	${eventCountChip}
	<text x="912" y="123" class="railText">PARIS ROUTE</text>
	<text x="912" y="554" class="railText">OOOC</text>
	<line x1="900" y1="204" x2="1004" y2="204" stroke="#fff8ef" stroke-opacity="0.24"/>
	<text x="900" y="191" class="railSmall">Curated picks</text>
	<line x1="950" y1="320" x2="1084" y2="320" stroke="#fff8ef" stroke-opacity="0.24"/>
	<text x="950" y="307" class="railSmall">Live details</text>
	<line x1="870" y1="454" x2="986" y2="454" stroke="#fff8ef" stroke-opacity="0.24"/>
	<text x="870" y="441" class="railSmall">Easy sharing</text>
</svg>`;
};

const renderOGPng = async (content: {
	title: string;
	subtitle: string;
	label: string;
	eventCount: number;
	footerLocation: string;
	isEventCard: boolean;
	accent: string;
	chips: MetaFact[];
}): Promise<Buffer> =>
	new Resvg(renderOGSvg(content), {
		font: {
			fontFiles: OG_FONT_FILES,
			loadSystemFonts: false,
			defaultFontFamily: "Degular",
			serifFamily: "Prata",
			sansSerifFamily: "Degular",
		},
		fitTo: { mode: "original" },
		logLevel: "error",
		textRendering: 1,
	}).render().asPng();

export async function GET(request: NextRequest) {
	const startedAt = Date.now();
	let cacheTags = "og,error";
	try {
		if (await isRateLimited(request)) {
			return new Response("Rate limit exceeded", {
				status: 429,
				headers: {
					"Cache-Control": "private, no-store",
				},
			});
		}

		const { searchParams } = new URL(request.url);
		cacheTags = getOGCacheTags(searchParams);
		const content = await resolveOGContent(searchParams);
		const variant = content.variant;
		const eventCount = content.eventCount;
		const arrondissement = sanitizeText(content.arrondissement, "");
		const date = sanitizeText(content.date, "");
		const time = sanitizeText(content.time, "");
		const price = sanitizeText(content.price, "");
		const venue = sanitizeText(content.venue, "");
		const genres = content.genres
			.map((value) => sanitizeText(value, ""))
			.filter(Boolean)
			.slice(0, MAX_CHIPS);
		const defaultText = buildThemeText(variant, arrondissement, eventCount);
		const title = sanitizeText(content.title, defaultText.title);
		const subtitle = sanitizeText(content.subtitle, defaultText.subtitle);
		const svgPalette = THEMES[variant];
		const svgIsEventCard = variant === "event-modal";
		const svgFooterLocation =
			arrondissement && arrondissement !== "Paris"
				? `${arrondissement} · Paris`
				: "Paris";
		const svgLabel =
			title === "Shared Fête Finder Plan"
				? "Shared Plan"
				: svgIsEventCard
					? "Event Pick"
					: svgPalette.label;
		const svgChips = eventCount > 0
			? [`${eventCount} events`, "Paris", "OOOC"]
			: ["Paris", "OOOC"];
		const tagList = genres.slice(0, 3).join(" · ");
		const svgFacts: MetaFact[] = svgIsEventCard
			? [
					{ label: "Date", value: date },
					{ label: "Time", value: time },
					{ label: "Access", value: price },
					{ label: "Venue", value: venue },
					{ label: "Tags", value: tagList, wide: true },
				].filter((fact) => fact.value)
			: svgChips.map((value, index) => ({
					label: ["Focus", "Area", "Format"][index] ?? "Detail",
					value,
				}));
		const png = await renderOGPng({
			title,
			subtitle,
			label: svgLabel,
			eventCount,
			footerLocation: svgFooterLocation,
			isEventCard: svgIsEventCard,
			accent: svgPalette.accent,
			chips: svgFacts,
		});
		const svgDurationMs = Date.now() - startedAt;
		if (svgDurationMs >= 1000) {
			log.warn("og-image", "Slow OG image response", {
				durationMs: svgDurationMs,
				variant,
				cacheTags,
				isEventCard: svgIsEventCard,
			});
		}

		return new Response(new Uint8Array(png), {
			status: 200,
			headers: {
				...getOGResponseHeaders(cacheTags),
				"Content-Type": "image/png",
			},
		});
	} catch (error) {
		log.error("og-image", "Failed to generate OG image", undefined, error);
		try {
			const fallbackPng = await renderOGPng({
				title: "Fête Finder",
				subtitle: "Curated Paris music picks by Out Of Office Collective.",
				label: "Event Guide",
				eventCount: 0,
				footerLocation: "Paris",
				isEventCard: false,
				accent: THEMES.default.accent,
				chips: [
					{ label: "Area", value: "Paris" },
					{ label: "Format", value: "OOOC" },
				],
			});
			return new Response(new Uint8Array(fallbackPng), {
				status: 200,
				headers: {
					...getOGResponseHeaders(cacheTags),
					"Content-Type": "image/png",
				},
			});
		} catch {
			return new Response("OG image unavailable", {
				status: 500,
				headers: {
					"Cache-Control": "private, no-store",
				},
			});
		}
	}
}
