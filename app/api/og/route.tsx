import { createHash } from "crypto";
import { env } from "@/lib/config/env";
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
const ALLOWED_THEMES = ["default", "event", "admin", "custom"] as const;

type OGTheme = (typeof ALLOWED_THEMES)[number];
type RateState = { count: number; resetAt: number };

const THEMES: Record<
	OGTheme,
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
	event: {
		label: "Event Focus",
		background:
			"linear-gradient(145deg, #f4ece2 0%, #eedec9 42%, #e8d0ae 100%)",
		accent: "#4a2f22",
		card: "rgba(255,255,255,0.84)",
		border: "rgba(93,62,44,0.24)",
		ink: "#23160e",
		muted: "#695243",
	},
	admin: {
		label: "Admin",
		background:
			"linear-gradient(145deg, #ece9e4 0%, #dfd9d1 42%, #d0c6bc 100%)",
		accent: "#2f2822",
		card: "rgba(255,255,255,0.88)",
		border: "rgba(58,49,42,0.24)",
		ink: "#191511",
		muted: "#57504a",
	},
	custom: {
		label: "Custom Share",
		background:
			"linear-gradient(145deg, #f5efe6 0%, #eadcc9 42%, #ddc5a5 100%)",
		accent: "#4d2d1f",
		card: "rgba(255,255,255,0.84)",
		border: "rgba(95,63,45,0.24)",
		ink: "#24170f",
		muted: "#684f40",
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
	theme: OGTheme,
	arrondissement: string,
	eventCount: number,
) => {
	if (theme === "event" && arrondissement) {
		return {
			title: `Events in ${arrondissement}`,
			subtitle:
				eventCount > 0
					? `${eventCount} live picks for your Paris route.`
					: "Curated live music picks for your Paris route.",
		};
	}

	if (theme === "admin") {
		return {
			title: "Admin Dashboard",
			subtitle: "Live data controls, publishing checks, and runtime status.",
		};
	}

	return {
		title: "Fete Finder",
		subtitle:
			eventCount > 0
				? `${eventCount} curated events across Paris arrondissements.`
				: "Curated music events across Paris arrondissements.",
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
		const themeParam = searchParams.get("theme") || "default";
		const theme: OGTheme = ALLOWED_THEMES.includes(themeParam as OGTheme)
			? (themeParam as OGTheme)
			: "default";
		const eventCount = Math.min(
			Number.parseInt(searchParams.get("eventCount") || "0", 10) || 0,
			9999,
		);
		const arrondissement = sanitizeText(
			searchParams.get("arrondissement") || "",
			"",
		);
		const localImageParam = searchParams.get("localImage");
		const localImage =
			localImageParam && localImageParam.startsWith("/og-images/")
				? localImageParam
				: null;

		const defaultText = buildThemeText(theme, arrondissement, eventCount);
		const title = sanitizeText(
			searchParams.get("title") || "",
			defaultText.title,
		);
		const subtitle = sanitizeText(
			searchParams.get("subtitle") || "",
			defaultText.subtitle,
		);

		const palette = THEMES[theme];
		const backgroundImage = localImage
			? `${env.NEXT_PUBLIC_SITE_URL}${localImage}`
			: null;

		return new ImageResponse(
			<div
				style={{
					width: "100%",
					height: "100%",
					display: "flex",
					position: "relative",
					background: backgroundImage ? "#20140f" : palette.background,
					color: palette.ink,
					fontFamily: '"Helvetica Neue", Arial, sans-serif',
				}}
			>
				{backgroundImage ? (
					<div
						style={{
							position: "absolute",
							inset: 0,
							display: "flex",
							backgroundImage: `url(${backgroundImage})`,
							backgroundSize: "cover",
							backgroundPosition: "center",
						}}
					/>
				) : null}

				<div
					style={{
						position: "absolute",
						inset: 0,
						display: "flex",
						background: backgroundImage
							? "linear-gradient(150deg, rgba(17,10,8,0.72), rgba(45,29,21,0.62))"
							: "linear-gradient(160deg, rgba(255,255,255,0.22), rgba(255,255,255,0))",
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
									color: backgroundImage ? "#f2e7d8" : palette.muted,
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
									color: backgroundImage ? "#f9efe2" : palette.accent,
									background: backgroundImage
										? "rgba(255,255,255,0.14)"
										: "rgba(255,255,255,0.46)",
									border: `1px solid ${backgroundImage ? "rgba(255,255,255,0.26)" : palette.border}`,
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
									color: backgroundImage ? "#fff6ea" : palette.accent,
									background: backgroundImage
										? "rgba(255,255,255,0.12)"
										: "rgba(255,255,255,0.58)",
									border: `1px solid ${backgroundImage ? "rgba(255,255,255,0.3)" : palette.border}`,
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
							background: backgroundImage ? "rgba(17,10,8,0.55)" : palette.card,
							border: `1px solid ${backgroundImage ? "rgba(255,255,255,0.2)" : palette.border}`,
						}}
					>
						<div
							style={{
								fontFamily: "Georgia, Times New Roman, serif",
								fontSize: 76,
								lineHeight: 1.04,
								letterSpacing: "-0.02em",
								color: backgroundImage ? "#fff8ee" : palette.ink,
								fontWeight: 500,
							}}
						>
							{title}
						</div>
						<div
							style={{
								fontSize: 30,
								lineHeight: 1.25,
								color: backgroundImage ? "#e4d8c8" : palette.muted,
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
							color: backgroundImage ? "#ebddcb" : palette.muted,
							fontSize: 18,
							letterSpacing: "0.08em",
							textTransform: "uppercase",
							fontWeight: 600,
						}}
					>
						<div>{arrondissement ? `${arrondissement} · Paris` : "Paris"}</div>
						<div>fete-finder.ooo</div>
					</div>
				</div>
			</div>,
			{
				width: 1200,
				height: 630,
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
					fontFamily: "Georgia, serif",
					fontSize: 58,
				}}
			>
				Fete Finder
			</div>,
			{
				width: 1200,
				height: 630,
				headers: {
					"Cache-Control": OG_CACHE_CONTROL,
				},
			},
		);
	}
}
