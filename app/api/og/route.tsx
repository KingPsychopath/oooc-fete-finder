import { createHash } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import { getKVStore } from "@/lib/platform/kv/kv-store-factory";
import { log } from "@/lib/platform/logger";
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

const OG_CACHE_CONTROL =
	"public, s-maxage=86400, stale-while-revalidate=604800";
const RATE_LIMIT_KEY_PREFIX = "og-rate:";
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 120;
const MAX_TEXT_LENGTH = 110;
const MAX_EVENT_COUNT = 9999;
const ALLOWED_VARIANTS = ["default", "event-modal"] as const;

type OGVariant = (typeof ALLOWED_VARIANTS)[number];
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

const loadFontBuffer = (filePath: string): Buffer | null => {
	try {
		return readFileSync(filePath);
	} catch {
		return null;
	}
};

const fontCandidates: Array<{
	name: string;
	paths: string[];
}> = [
	{
		name: "Degular",
		paths: [
			"public/fonts/degular_regular.ttf",
			"public/fonts/degular_regular.otf",
			"public/fonts/degular_regular.woff",
			"node_modules/geist/dist/fonts/geist-sans/Geist-Regular.ttf",
			"node_modules/next/dist/compiled/@vercel/og/noto-sans-v27-latin-regular.ttf",
		],
	},
	{
		name: "Swear Display",
		paths: [
			"public/fonts/swear_display_light.ttf",
			"public/fonts/swear_display_light.otf",
			"public/fonts/swear_display_light.woff",
		],
	},
];

const ogFonts: OGFont[] = fontCandidates
	.map((candidate) => {
		for (const relativePath of candidate.paths) {
			const loaded = loadFontBuffer(join(process.cwd(), relativePath));
			if (!loaded) continue;
			return {
				name: candidate.name,
				data: loaded,
				weight: 400 as const,
				style: "normal" as const,
			};
		}
		return null;
	})
	.filter((font): font is OGFont => font !== null);

const hasDisplayFont = ogFonts.some((font) => font.name === "Swear Display");
const ogTitleFontFamily = hasDisplayFont
	? '"Swear Display", Georgia, "Times New Roman", serif'
	: '"Degular", "Helvetica Neue", Arial, sans-serif';

const THEMES: Record<OGVariant, OGTheme> = {
	default: {
		label: "City Guide",
		background:
			"linear-gradient(145deg, #f8f1e8 0%, #f0e2d0 46%, #e5cfb4 100%)",
		accent: "#5f3223",
		accentSoft: "rgba(95,50,35,0.12)",
		card: "rgba(255,255,255,0.86)",
		border: "rgba(107,66,45,0.26)",
		shadow: "0 24px 70px -42px rgba(62, 32, 18, 0.55)",
		ink: "#26170f",
		muted: "#705746",
		badge: "rgba(255,255,255,0.62)",
		badgeText: "#4f2d1f",
		ambientA:
			"radial-gradient(circle at 20% 14%, rgba(182, 102, 63, 0.28), transparent 44%)",
		ambientB:
			"radial-gradient(circle at 84% 82%, rgba(82, 118, 93, 0.2), transparent 46%)",
	},
	"event-modal": {
		label: "Event Focus",
		background:
			"linear-gradient(148deg, #f7efe4 0%, #ecddca 44%, #e1c7a7 100%)",
		accent: "#21545a",
		accentSoft: "rgba(33,84,90,0.14)",
		card: "rgba(255,255,255,0.86)",
		border: "rgba(43,84,80,0.25)",
		shadow: "0 24px 70px -42px rgba(18, 54, 58, 0.5)",
		ink: "#1e1b16",
		muted: "#556058",
		badge: "rgba(255,255,255,0.6)",
		badgeText: "#1f4f55",
		ambientA:
			"radial-gradient(circle at 14% 12%, rgba(30, 98, 104, 0.28), transparent 44%)",
		ambientB:
			"radial-gradient(circle at 84% 86%, rgba(174, 108, 71, 0.24), transparent 48%)",
	},
};

const sanitizeText = (value: string, fallback: string): string => {
	const cleaned = value.replace(/[<>]/g, "").trim();
	if (!cleaned) return fallback;
	return cleaned.length > MAX_TEXT_LENGTH
		? `${cleaned.slice(0, MAX_TEXT_LENGTH - 1)}…`
		: cleaned;
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

const parseVariant = (searchParams: URLSearchParams): OGVariant => {
	const variantParam = searchParams.get("variant") || "";
	const legacyThemeParam = searchParams.get("theme") || "";
	const rawVariant =
		variantParam || (legacyThemeParam === "event" ? "event-modal" : "default");

	return ALLOWED_VARIANTS.includes(rawVariant as OGVariant)
		? (rawVariant as OGVariant)
		: "default";
};

const parseEventCount = (searchParams: URLSearchParams): number => {
	const rawEventCount = Number.parseInt(searchParams.get("eventCount") || "0", 10);
	if (!Number.isFinite(rawEventCount)) return 0;
	return Math.min(Math.max(rawEventCount, 0), MAX_EVENT_COUNT);
};

export async function GET(request: NextRequest) {
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
		const variant = parseVariant(searchParams);
		const eventCount = parseEventCount(searchParams);
		const arrondissement = sanitizeText(searchParams.get("arrondissement") || "", "");
		const defaultText = buildThemeText(variant, arrondissement, eventCount);
		const title = sanitizeText(searchParams.get("title") || "", defaultText.title);
		const subtitle = sanitizeText(
			searchParams.get("subtitle") || "",
			defaultText.subtitle,
		);
		const palette = THEMES[variant];

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
						position: "absolute",
						right: 58,
						top: 56,
						width: 170,
						height: 8,
						borderRadius: 999,
						background: palette.accentSoft,
						border: `1px solid ${palette.border}`,
					}}
				/>

				<div
					style={{
						position: "relative",
						display: "flex",
						width: "100%",
						height: "100%",
						padding: "48px 54px",
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
									fontSize: 16,
									letterSpacing: "0.24em",
									textTransform: "uppercase",
									color: palette.muted,
									fontWeight: 500,
								}}
							>
								Out Of Office Collective
							</div>
							<div
								style={{
									display: "flex",
									alignItems: "center",
									padding: "6px 14px",
									borderRadius: 999,
									fontSize: 15,
									fontWeight: 600,
									color: palette.accent,
									background: "rgba(255,255,255,0.48)",
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
									padding: "10px 16px",
									borderRadius: 999,
									fontSize: 16,
									fontWeight: 700,
									color: palette.badgeText,
									background: palette.badge,
									border: `1px solid ${palette.border}`,
								}}
							>
								{eventCount} events live
							</div>
						) : null}
					</div>

					<div
						style={{
							display: "flex",
							flexDirection: "column",
							gap: 16,
							maxWidth: 944,
							padding: "30px 34px",
							borderRadius: 30,
							background: palette.card,
							border: `1px solid ${palette.border}`,
							boxShadow: palette.shadow,
						}}
					>
						<div
							style={{
								fontFamily: ogTitleFontFamily,
								fontSize: 77,
								lineHeight: 1.03,
								letterSpacing: "-0.02em",
								color: palette.ink,
								fontWeight: 500,
							}}
						>
							{title}
						</div>
						<div
							style={{
								fontSize: 30,
								lineHeight: 1.26,
								color: palette.muted,
								fontWeight: 500,
								maxWidth: 820,
							}}
						>
							{subtitle}
						</div>
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
						<div>{arrondissement ? `${arrondissement} · Paris` : "Paris"}</div>
						<div>outofofficecollective.co.uk</div>
					</div>
				</div>
			</div>,
			{
				width: 1200,
				height: 630,
				fonts: ogFonts,
				headers: {
					"Cache-Control": OG_CACHE_CONTROL,
				},
			},
		);
	} catch (error) {
		log.error("og-image", "Failed to generate OG image", undefined, error);
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
					letterSpacing: "-0.01em",
				}}
			>
				Fête Finder
			</div>,
			{
				width: 1200,
				height: 630,
				fonts: ogFonts,
				headers: {
					"Cache-Control": OG_CACHE_CONTROL,
				},
			},
		);
	}
}
