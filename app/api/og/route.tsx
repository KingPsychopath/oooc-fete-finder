import { createHash } from "crypto";
import { join } from "path";
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
import { readFile } from "fs/promises";
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

const OG_CACHE_CONTROL = "public, max-age=0, must-revalidate";
const OG_CDN_CACHE_CONTROL = "public, max-age=0, must-revalidate";
const OG_RESPONSE_HEADERS = {
	"Cache-Control": OG_CACHE_CONTROL,
	"CDN-Cache-Control": OG_CDN_CACHE_CONTROL,
	"Vercel-CDN-Cache-Control": OG_CDN_CACHE_CONTROL,
} as const;
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
] as const;

type OGVariant = (typeof ALLOWED_VARIANTS)[number];
type OGPreset = (typeof ALLOWED_PRESETS)[number];
type RateState = { count: number; resetAt: number };

type OGTheme = {
	label: string;
	background: string;
	accent: string;
	accentSoft: string;
	card: string;
	border: string;
	shadow: string;
	ink: string;
	muted: string;
	badge: string;
	badgeText: string;
	ambientA: string;
	ambientB: string;
};

type OGFont = {
	name: string;
	data: Buffer;
	weight: 400;
	style: "normal";
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

const readFont = async (
	name: string,
	filePath: string,
): Promise<OGFont | null> => {
	try {
		return {
			name,
			data: await readFile(filePath),
			weight: 400,
			style: "normal",
		};
	} catch {
		return null;
	}
};

const loadOGFonts = async (): Promise<OGFont[]> => {
	const fontCandidates = [
		join(process.cwd(), "public", "fonts", "Geist-Regular.ttf"),
	];

	for (const fontPath of fontCandidates) {
		const fallbackSans = await readFont("Degular", fontPath);
		if (fallbackSans) return [fallbackSans];
	}

	log.warn("og-image", "No OG fonts loaded; ImageResponse may fail");
	return [];
};

let ogFontsPromise: Promise<OGFont[]> | null = null;

const getOGFonts = (): Promise<OGFont[]> => {
	ogFontsPromise ??= loadOGFonts();
	return ogFontsPromise;
};

const getOGTitleFontFamily = (fonts: OGFont[]): string =>
	fonts.some((font) => font.name === "Swear Display")
		? '"Swear Display", Georgia, "Times New Roman", serif'
		: '"Degular", "Helvetica Neue", Arial, sans-serif';

const THEMES: Record<OGVariant, OGTheme> = {
	default: {
		label: "Fête de la Musique · Paris",
		background:
			"linear-gradient(145deg, #fbf3e7 0%, #f2dcc3 42%, #dfeee7 100%)",
		accent: "#7f2f28",
		accentSoft: "rgba(127,47,40,0.13)",
		card: "rgba(255,252,247,0.92)",
		border: "rgba(91,66,48,0.25)",
		shadow: "0 26px 72px -44px rgba(40, 29, 22, 0.58)",
		ink: "#241911",
		muted: "#6d5546",
		badge: "rgba(255,252,247,0.72)",
		badgeText: "#5d2f27",
		ambientA:
			"radial-gradient(circle at 18% 16%, rgba(191, 75, 55, 0.28), transparent 44%)",
		ambientB:
			"radial-gradient(circle at 84% 80%, rgba(27, 105, 95, 0.24), transparent 46%)",
	},
	"event-modal": {
		label: "Event Pick",
		background:
			"linear-gradient(148deg, #fbf0e4 0%, #e3eee9 48%, #efd2b3 100%)",
		accent: "#155d63",
		accentSoft: "rgba(21,93,99,0.15)",
		card: "rgba(255,252,247,0.93)",
		border: "rgba(36,88,84,0.24)",
		shadow: "0 26px 72px -44px rgba(12, 58, 64, 0.54)",
		ink: "#1d1a16",
		muted: "#52625c",
		badge: "rgba(255,252,247,0.72)",
		badgeText: "#164f56",
		ambientA:
			"radial-gradient(circle at 15% 12%, rgba(24, 115, 122, 0.28), transparent 44%)",
		ambientB:
			"radial-gradient(circle at 85% 84%, rgba(192, 86, 54, 0.24), transparent 48%)",
	},
};

const sanitizeText = (value: string, fallback: string): string => {
	const cleaned = value.replace(/[<>]/g, "").trim();
	if (!cleaned) return fallback;
	return cleaned.length > MAX_TEXT_LENGTH
		? `${cleaned.slice(0, MAX_TEXT_LENGTH - 1)}…`
		: cleaned;
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
	"Vercel-Cache-Tag": cacheTags,
});

export async function HEAD(request: NextRequest) {
	const { searchParams } = new URL(request.url);
	return new Response(null, {
		status: 200,
		headers: getOGResponseHeaders(getOGCacheTags(searchParams)),
	});
}

const STATIC_PRESET_CONTENT: Record<
	Exclude<OGPreset, "event">,
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
	preset: Exclude<OGPreset, "event">,
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
		const palette = THEMES[variant];
		const ogFonts = await getOGFonts();
		const ogTitleFontFamily = getOGTitleFontFamily(ogFonts);
		const footerLocation =
			arrondissement && arrondissement !== "Paris"
				? `${arrondissement} · Paris`
				: "Paris";
		const isEventCard = variant === "event-modal";
		const titleFontSize = title.length > 58 ? 62 : title.length > 38 ? 76 : 98;
		const cardMaxWidth = isEventCard ? 1000 : 980;
		const cardPadding = isEventCard ? "36px 40px" : "34px 38px";
		const subtitleFontSize = isEventCard ? 28 : 32;
		const durationMs = Date.now() - startedAt;
		if (durationMs >= 1000) {
			log.warn("og-image", "Slow OG image response", {
				durationMs,
				variant,
				cacheTags,
				isEventCard,
			});
		}

		return new ImageResponse(
			<div
				style={{
					width: "100%",
					height: "100%",
					display: "flex",
					position: "relative",
					background: palette.background,
					color: palette.ink,
					fontFamily: '"Degular", "Helvetica Neue", Arial, sans-serif',
				}}
			>
				<div
					style={{
						position: "absolute",
						inset: 0,
						display: "flex",
						background: palette.ambientA,
					}}
				/>
				<div
					style={{
						position: "absolute",
						inset: 0,
						display: "flex",
						background: palette.ambientB,
					}}
				/>
				<div
					style={{
						position: "absolute",
						inset: 0,
						display: "flex",
						background:
							"linear-gradient(165deg, rgba(255,255,255,0.22), rgba(255,255,255,0))",
					}}
				/>

				<div
					style={{
						position: "absolute",
						left: 44,
						top: 42,
						width: 250,
						height: 250,
						borderRadius: 999,
						background:
							"radial-gradient(circle, rgba(255,255,255,0.3), rgba(255,255,255,0))",
					}}
				/>
				<div
					style={{
						position: "relative",
						display: "flex",
						width: "100%",
						height: "100%",
						padding: "46px 72px 44px 54px",
						flexDirection: "column",
						justifyContent: "space-between",
					}}
				>
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: "flex-start",
						}}
					>
						<div
							style={{
								display: "flex",
								flexDirection: "column",
								gap: 11,
							}}
						>
							<div
								style={{
									fontSize: 15,
									letterSpacing: "0.22em",
									textTransform: "uppercase",
									color: palette.muted,
									fontWeight: 600,
								}}
							>
								Out Of Office Collective
							</div>
							<div
								style={{
									display: "flex",
									alignItems: "center",
									padding: "7px 15px",
									borderRadius: 999,
									fontSize: 15,
									fontWeight: 600,
									color: palette.accent,
									background: "rgba(255,252,247,0.62)",
									border: `1px solid ${palette.border}`,
								}}
							>
								{palette.label}
							</div>
						</div>

						{eventCount > 0 ? (
							<div
								style={{
									display: "flex",
									alignItems: "center",
									padding: "10px 17px",
									borderRadius: 999,
									fontSize: 16,
									fontWeight: 700,
									color: palette.badgeText,
									background: palette.badge,
									border: `1px solid ${palette.border}`,
								}}
							>
								{eventCount} events this year
							</div>
						) : null}
					</div>

					<div
						style={{
							display: "flex",
							flexDirection: "column",
							gap: isEventCard ? 17 : 18,
							maxWidth: cardMaxWidth,
							padding: isEventCard ? cardPadding : "0",
							borderRadius: isEventCard ? 28 : 0,
							background: isEventCard ? palette.card : "transparent",
							border: isEventCard ? `1px solid ${palette.border}` : "none",
							boxShadow: isEventCard ? palette.shadow : "none",
						}}
					>
						{!isEventCard ? (
							<div
								style={{
									display: "flex",
									width: 86,
									height: 4,
									borderRadius: 999,
									background: palette.accent,
									marginBottom: 2,
								}}
							/>
						) : null}
						<div
							style={{
								fontFamily: ogTitleFontFamily,
								fontSize: titleFontSize,
								lineHeight: isEventCard ? 1.04 : 0.96,
								letterSpacing: 0,
								color: palette.ink,
								fontWeight: 520,
							}}
						>
							{title}
						</div>
						<div
							style={{
								fontSize: subtitleFontSize,
								lineHeight: isEventCard ? 1.28 : 1.22,
								color: palette.muted,
								fontWeight: 500,
								maxWidth: isEventCard ? 820 : 860,
							}}
						>
							{subtitle}
						</div>
						{date || time || price || venue || genres.length > 0 ? (
							<div
								style={{
									display: "flex",
									flexWrap: "wrap",
									gap: 10,
									marginTop: 5,
								}}
							>
								{date ? (
									<div
										style={{
											display: "flex",
											alignItems: "center",
											padding: "6px 12px",
											borderRadius: 999,
											fontSize: 18,
											fontWeight: 600,
											color: palette.badgeText,
											background: palette.badge,
											border: `1px solid ${palette.border}`,
										}}
									>
										{date}
									</div>
								) : null}
								{time ? (
									<div
										style={{
											display: "flex",
											alignItems: "center",
											padding: "6px 12px",
											borderRadius: 999,
											fontSize: 18,
											fontWeight: 600,
											color: palette.badgeText,
											background: palette.badge,
											border: `1px solid ${palette.border}`,
										}}
									>
										{time}
									</div>
								) : null}
								{price ? (
									<div
										style={{
											display: "flex",
											alignItems: "center",
											padding: "6px 12px",
											borderRadius: 999,
											fontSize: 18,
											fontWeight: 600,
											color: palette.badgeText,
											background: palette.badge,
											border: `1px solid ${palette.border}`,
										}}
									>
										{price}
									</div>
								) : null}
								{venue ? (
									<div
										style={{
											display: "flex",
											alignItems: "center",
											padding: "6px 12px",
											borderRadius: 999,
											fontSize: 18,
											fontWeight: 600,
											color: palette.badgeText,
											background: palette.badge,
											border: `1px solid ${palette.border}`,
										}}
									>
										{venue}
									</div>
								) : null}
								{genres.map((genre) => (
									<div
										key={genre}
										style={{
											display: "flex",
											alignItems: "center",
											padding: "6px 12px",
											borderRadius: 999,
											fontSize: 18,
											fontWeight: 600,
											color: palette.badgeText,
											background: palette.badge,
											border: `1px solid ${palette.border}`,
										}}
									>
										{genre}
									</div>
								))}
							</div>
						) : null}
					</div>

					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
							color: palette.muted,
							fontSize: 17,
							letterSpacing: "0.1em",
							textTransform: "uppercase",
							fontWeight: 600,
						}}
					>
						<div>{footerLocation}</div>
						<div>OOOC</div>
					</div>
				</div>
			</div>,
			{
				width: 1200,
				height: 630,
				fonts: ogFonts,
				headers: getOGResponseHeaders(cacheTags),
			},
		);
	} catch (error) {
		log.error("og-image", "Failed to generate OG image", undefined, error);
		const ogFonts = await getOGFonts();
		const ogTitleFontFamily = getOGTitleFontFamily(ogFonts);
		return new ImageResponse(
			<div
				style={{
					width: "100%",
					height: "100%",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					background:
						"linear-gradient(145deg, #f8f1e8 0%, #eedfcb 50%, #e4ccb1 100%)",
					color: "#26170f",
					fontFamily: ogTitleFontFamily,
					fontSize: 58,
					letterSpacing: 0,
				}}
			>
				Fête Finder
			</div>,
			{
				width: 1200,
				height: 630,
				fonts: ogFonts,
				headers: getOGResponseHeaders(cacheTags),
			},
		);
	}
}
