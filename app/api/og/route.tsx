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
const ALLOWED_VARIANTS = ["default", "event-modal"] as const;

type OGVariant = (typeof ALLOWED_VARIANTS)[number];
type RateState = { count: number; resetAt: number };

const loadFontBuffer = (filePath: string): Buffer | null => {
	try {
		return readFileSync(filePath);
	} catch {
		return null;
	}
};

const degularFont = loadFontBuffer(
	join(process.cwd(), "public/fonts/degular_regular.woff2"),
);
const swearDisplayFont = loadFontBuffer(
	join(process.cwd(), "public/fonts/swear_display_light.woff2"),
);

const ogFonts = [
	degularFont
		? {
				name: "Degular",
				data: degularFont,
				weight: 400 as const,
				style: "normal" as const,
			}
		: null,
	swearDisplayFont
		? {
				name: "Swear Display",
				data: swearDisplayFont,
				weight: 400 as const,
				style: "normal" as const,
			}
		: null,
].filter((font): font is NonNullable<typeof font> => font !== null);

const THEMES: Record<
	OGVariant,
	{
		label: string;
		background: string;
		accent: string;
		card: string;
		border: string;
		ink: string;
		muted: string;
	}
> = {
	default: {
		label: "City Guide",
		background:
			"linear-gradient(140deg, #f5efe6 0%, #efe3d2 45%, #e5d4bd 100%)",
		accent: "#5a3727",
		card: "rgba(255,255,255,0.82)",
		border: "rgba(99,66,49,0.24)",
		ink: "#28190f",
		muted: "#6f5949",
	},
	"event-modal": {
		label: "Event Focus",
		background:
			"linear-gradient(145deg, #f4ece2 0%, #eedec9 42%, #e8d0ae 100%)",
		accent: "#4a2f22",
		card: "rgba(255,255,255,0.84)",
		border: "rgba(93,62,44,0.24)",
		ink: "#23160e",
		muted: "#695243",
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
			const variantParam = searchParams.get("variant") || "";
			const legacyThemeParam = searchParams.get("theme") || "";
			const rawVariant =
				variantParam ||
				(legacyThemeParam === "event" ? "event-modal" : "default");
			const variant: OGVariant = ALLOWED_VARIANTS.includes(rawVariant as OGVariant)
				? (rawVariant as OGVariant)
				: "default";
			const eventCount = Math.min(
				Number.parseInt(searchParams.get("eventCount") || "0", 10) || 0,
				9999,
		);
			const arrondissement = sanitizeText(
				searchParams.get("arrondissement") || "",
				"",
			);

			const defaultText = buildThemeText(variant, arrondissement, eventCount);
			const title = sanitizeText(
				searchParams.get("title") || "",
				defaultText.title,
		);
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
							background:
								"linear-gradient(160deg, rgba(255,255,255,0.22), rgba(255,255,255,0))",
						}}
					/>

				<div
					style={{
						position: "absolute",
						left: 46,
						top: 42,
						width: 220,
						height: 220,
						borderRadius: 999,
						background:
							"radial-gradient(circle, rgba(255,255,255,0.34), rgba(255,255,255,0))",
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
								gap: 10,
							}}
						>
							<div
									style={{
										fontSize: 18,
										letterSpacing: "0.22em",
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
										background: "rgba(255,255,255,0.46)",
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
										color: palette.accent,
										background: "rgba(255,255,255,0.58)",
										border: `1px solid ${palette.border}`,
									}}
								>
								{eventCount} events
							</div>
						) : null}
					</div>

					<div
						style={{
							display: "flex",
							flexDirection: "column",
							gap: 16,
								maxWidth: 940,
								padding: "30px 34px",
								borderRadius: 30,
								background: palette.card,
								border: `1px solid ${palette.border}`,
							}}
						>
							<div
								style={{
									fontFamily:
										'"Swear Display", Georgia, "Times New Roman", serif',
										fontSize: 76,
										lineHeight: 1.04,
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
									lineHeight: 1.25,
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
								fontSize: 18,
							letterSpacing: "0.08em",
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
							"linear-gradient(140deg, #f5efe6 0%, #eedfcf 52%, #e2ccb0 100%)",
						color: "#24170f",
						fontFamily:
							'"Swear Display", Georgia, "Times New Roman", serif',
						fontSize: 58,
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
