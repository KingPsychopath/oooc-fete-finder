"use client";

import type { Event } from "@/types/events";
import {
	MUSIC_GENRES,
	NATIONALITIES,
	VENUE_TYPES,
	formatAge,
	formatDayWithDate,
	formatPrice,
	formatVenueTypeIcons,
} from "@/types/events";

type ShareableImageGeneratorProps = {
	event: Event;
	onError: (message: string) => void;
};

export type ShareImageFormat = "portrait" | "landscape";

const FORMATS: Record<ShareImageFormat, { width: number; height: number; label: string }> = {
	portrait: { width: 1080, height: 1920, label: "story" },
	landscape: { width: 1200, height: 630, label: "post" },
};

const RENDER_SCALE = 2;

const isMobileDevice = (): boolean => {
	if (typeof navigator === "undefined" || typeof window === "undefined") return false;
	return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
};

const canUseNativeShareWithFiles = (): boolean => {
	if (typeof navigator === "undefined" || typeof window === "undefined") return false;
	return isMobileDevice() && typeof navigator.share === "function";
};

const escapeHtml = (value: string): string =>
	value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");

const resolveGenreChipColors = (genreKey: string): { background: string; text: string } => {
	const colorClass = MUSIC_GENRES.find((g) => g.key === genreKey)?.color;
	const colorMap: Record<string, { background: string; text: string }> = {
		"bg-emerald-500": { background: "#10B981", text: "#FFFFFF" },
		"bg-orange-500": { background: "#F97316", text: "#111111" },
		"bg-yellow-500": { background: "#EAB308", text: "#111111" },
		"bg-pink-500": { background: "#EC4899", text: "#FFFFFF" },
		"bg-red-500": { background: "#EF4444", text: "#FFFFFF" },
		"bg-purple-600": { background: "#9333EA", text: "#FFFFFF" },
		"bg-indigo-500": { background: "#6366F1", text: "#FFFFFF" },
		"bg-green-600": { background: "#16A34A", text: "#FFFFFF" },
		"bg-lime-500": { background: "#84CC16", text: "#111111" },
		"bg-amber-500": { background: "#F59E0B", text: "#111111" },
		"bg-teal-500": { background: "#14B8A6", text: "#FFFFFF" },
		"bg-blue-600": { background: "#2563EB", text: "#FFFFFF" },
		"bg-violet-500": { background: "#8B5CF6", text: "#FFFFFF" },
		"bg-orange-600": { background: "#EA580C", text: "#FFFFFF" },
		"bg-cyan-500": { background: "#06B6D4", text: "#111111" },
		"bg-fuchsia-500": { background: "#D946EF", text: "#FFFFFF" },
		"bg-gray-600": { background: "#4B5563", text: "#FFFFFF" },
		"bg-slate-600": { background: "#475569", text: "#FFFFFF" },
		"bg-red-600": { background: "#DC2626", text: "#FFFFFF" },
		"bg-blue-500": { background: "#3B82F6", text: "#FFFFFF" },
		"bg-emerald-600": { background: "#059669", text: "#FFFFFF" },
		"bg-rose-500": { background: "#F43F5E", text: "#FFFFFF" },
		"bg-yellow-600": { background: "#CA8A04", text: "#FFFFFF" },
		"bg-indigo-600": { background: "#4F46E5", text: "#FFFFFF" },
		"bg-pink-600": { background: "#DB2777", text: "#FFFFFF" },
		"bg-orange-400": { background: "#FB923C", text: "#111111" },
		"bg-purple-400": { background: "#C084FC", text: "#111111" },
		"bg-stone-500": { background: "#78716C", text: "#FFFFFF" },
		"bg-sky-500": { background: "#0EA5E9", text: "#FFFFFF" },
		"bg-gray-500": { background: "#6B7280", text: "#FFFFFF" },
	};

	return colorMap[colorClass || ""] || { background: "#D6D3CD", text: "#191714" };
};

const buildBaseMeta = (event: Event) => {
	const eventName = escapeHtml(event.name);
	const dateLabel = escapeHtml(formatDayWithDate(event.day, event.date));
	const timeLabel = escapeHtml(
		event.time && event.time !== "TBC" ?
			event.endTime && event.endTime !== "TBC" ? `${event.time} - ${event.endTime}` : event.time
		: 	"TBC",
	);
	const priceLabel = escapeHtml(formatPrice(event.price));
	const locationLabel = escapeHtml(
		event.location && event.location !== "TBA" ? event.location : "Location TBA",
	);
	const arrondissementLabel = escapeHtml(
		event.arrondissement === "unknown" ? "Arrondissement TBC" : `${event.arrondissement}e Arrondissement`,
	);
	const venueLabel = escapeHtml(
		event.venueTypes && event.venueTypes.length > 0 ?
			event.venueTypes
				.map((vt) => VENUE_TYPES.find((v) => v.key === vt)?.label || vt)
				.join(" & ")
		: event.indoor ?
			"Indoor"
		: 	"Outdoor",
	);
	const ageLabel = escapeHtml(event.age ? formatAge(event.age) : "All ages");
	const genres = (event.genre || []).slice(0, 4).map((genre) => {
		const label = escapeHtml(MUSIC_GENRES.find((g) => g.key === genre)?.label || genre);
		const colors = resolveGenreChipColors(genre);
		return { label, background: colors.background, text: colors.text };
	});
	const genreOverflow = Math.max(0, (event.genre?.length || 0) - genres.length);
	const nationalityBadges = (event.nationality || [])
		.slice(0, 3)
		.map((nationality) => {
			const found = NATIONALITIES.find((n) => n.key === nationality);
			if (!found) return escapeHtml(nationality);
			return `${found.flag} ${escapeHtml(found.shortCode)}`;
		});

	return {
		eventName,
		dateLabel,
		timeLabel,
		priceLabel,
		locationLabel,
		arrondissementLabel,
		venueLabel,
		ageLabel,
		genres,
		genreOverflow,
		nationalityBadges,
	};
};

const buildPortraitTemplate = (event: Event): string => {
	const meta = buildBaseMeta(event);
	const pickBadge =
		event.isOOOCPick ?
			'<div style="display:inline-flex;align-items:center;padding:9px 14px;border-radius:999px;background:#121212;color:#ffffff;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">OOOC Pick</div>'
		: "";

	const genreChips =
		meta.genres.length > 0 ?
			`<div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:14px;">${meta.genres
				.map(
					(genre) => `<div style="padding:8px 14px;border-radius:999px;background:${genre.background};color:${genre.text};font-size:14px;font-weight:600;">${genre.label}</div>`,
				)
				.join("")}${
				meta.genreOverflow > 0 ?
					`<div style="padding:8px 14px;border-radius:999px;background:#E9E5DE;border:1px solid #D0CBC2;color:#171717;font-size:14px;font-weight:600;">+${meta.genreOverflow} more</div>`
				: ""
			}</div>`
		: "";

	return `
		<div style="display:flex;flex-direction:column;height:100%;background:
			radial-gradient(120% 82% at 50% 95%, rgba(26,16,12,0.18) 0%, rgba(26,16,12,0) 54%),
			linear-gradient(180deg,#FCFBF9 0%,#F4F0E8 100%);
			padding:56px;box-sizing:border-box;color:#161616;">
			<div style="display:flex;flex-direction:column;height:100%;border-radius:34px;border:1px solid #D8D2C8;background:#FBF9F5;padding:38px;">
				<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
					<div>
						<p style="margin:0;font-size:13px;letter-spacing:0.22em;text-transform:uppercase;color:#57534c;">Out Of Office Collective</p>
						<div style="margin-top:12px;">${pickBadge}</div>
					</div>
					<div style="padding:10px 16px;border-radius:999px;background:#ffffff;border:1px solid #d7d3cb;font-size:16px;font-weight:600;color:#171717;">${meta.arrondissementLabel}</div>
				</div>

				<div style="margin-top:26px;">
					<h1 style="margin:0;font-family:'Swear Display','Times New Roman',serif;font-size:96px;line-height:0.9;font-weight:400;color:#121212;word-break:break-word;">${meta.eventName}</h1>
					${genreChips}
				</div>

				<div style="margin-top:24px;border-radius:24px;border:1px solid #D6D0C7;background:#FFFFFF;padding:16px;display:flex;flex-direction:column;gap:12px;flex:1;">
					<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
						<div style="border-radius:15px;border:1px solid #DDD9D1;background:#FAF9F7;padding:14px;"><p style="margin:0;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#57534c;">Date</p><p style="margin:8px 0 0 0;font-size:38px;font-weight:600;color:#161616;line-height:1.1;">${meta.dateLabel}</p></div>
						<div style="border-radius:15px;border:1px solid #DDD9D1;background:#FAF9F7;padding:14px;"><p style="margin:0;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#57534c;">Time</p><p style="margin:8px 0 0 0;font-size:38px;font-weight:600;color:#161616;line-height:1.1;">${meta.timeLabel}</p></div>
						<div style="border-radius:15px;border:1px solid #DDD9D1;background:#FAF9F7;padding:14px;"><p style="margin:0;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#57534c;">Price</p><p style="margin:8px 0 0 0;font-size:42px;font-weight:700;color:#161616;line-height:1.1;">${meta.priceLabel}</p></div>
						<div style="border-radius:15px;border:1px solid #DDD9D1;background:#FAF9F7;padding:14px;"><p style="margin:0;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#57534c;">Venue</p><p style="margin:8px 0 0 0;font-size:33px;font-weight:600;color:#161616;line-height:1.1;">${escapeHtml(`${formatVenueTypeIcons(event)} ${meta.venueLabel}`)}</p></div>
					</div>
					<div style="border-radius:15px;border:1px solid #DDD9D1;background:#FAF9F7;padding:14px;">
						<p style="margin:0;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#57534c;">Location</p>
						<p style="margin:8px 0 0 0;font-size:34px;font-weight:500;color:#161616;line-height:1.16;">${meta.locationLabel}</p>
						<p style="margin:7px 0 0 0;font-size:21px;color:#57534c;">Age: ${meta.ageLabel} · ${escapeHtml(event.type)}</p>
					</div>
					${
						meta.nationalityBadges.length > 0 ?
							`<div style="margin-top:auto;display:flex;align-items:center;gap:8px;flex-wrap:wrap;border-top:1px solid #DDD9D1;padding-top:12px;">
								<span style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#67625A;">Host origin</span>
								${meta.nationalityBadges
									.map(
										(nationality) => `<span style="display:inline-flex;align-items:center;padding:6px 10px;border-radius:999px;background:#F2EEE7;border:1px solid #D8D2C8;color:#2D2A25;font-size:13px;font-weight:600;line-height:1;">${nationality}</span>`,
									)
									.join("")}
							</div>`
						: ""
					}
				</div>

				<div style="margin-top:auto;padding-top:20px;">
					<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;border-top:1px solid #D7D3CB;padding-top:14px;">
						<div><p style="margin:0;font-size:18px;font-weight:700;color:#121212;">OOOC Fête Finder</p><p style="margin:4px 0 0 0;font-size:14px;color:#57534c;">outofofficecollective.co.uk</p></div>
						<div style="padding:10px 16px;border-radius:999px;background:#121212;color:#ffffff;font-size:14px;font-weight:600;">Paris Event Story</div>
					</div>
				</div>
			</div>
		</div>
	`;
};

const buildLandscapeTemplate = (event: Event): string => {
	const meta = buildBaseMeta(event);
	const genreChips =
		meta.genres.length > 0 ?
			`<div style="display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 14px;">${meta.genres
				.map(
					(genre) => `<div style="padding:6px 10px;border-radius:999px;background:${genre.background};color:${genre.text};font-size:12px;font-weight:600;">${genre.label}</div>`,
				)
				.join("")}</div>`
		: "";

	return `
		<div style="display:flex;flex-direction:column;height:100%;background:
			radial-gradient(120% 90% at 50% 100%, rgba(26,16,12,0.28) 0%, rgba(26,16,12,0) 62%),
			linear-gradient(180deg,#F6F2EC 0%,#EEE8DF 100%);
			padding:24px;box-sizing:border-box;color:#161616;">
			<div style="display:flex;flex-direction:column;height:100%;border-radius:32px;border:1px solid #D8D2C8;background:#FBF9F5;padding:26px;">
				<div style="display:flex;justify-content:space-between;align-items:flex-start;">
					<p style="margin:0;font-size:12px;letter-spacing:0.24em;text-transform:uppercase;color:#57534c;">Out Of Office Collective</p>
					<div style="padding:8px 12px;border-radius:999px;background:#ffffff;border:1px solid #d7d3cb;font-size:14px;font-weight:600;color:#171717;">${meta.arrondissementLabel}</div>
				</div>
				<h1 style="margin:14px 0 0;font-family:'Swear Display','Times New Roman',serif;font-size:72px;line-height:0.9;font-weight:400;color:#121212;max-width:88%;word-break:break-word;">${meta.eventName}</h1>
				${genreChips}

				<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;flex:1;min-height:0;">
					<div style="border-radius:20px;border:1px solid #d7d3cb;background:#ffffff;padding:16px;display:flex;flex-direction:column;gap:12px;">
						<div><p style="margin:0;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#57534c;">Date</p><p style="margin:6px 0 0 0;font-size:42px;font-weight:600;color:#161616;line-height:1.08;">${meta.dateLabel}</p></div>
						<div><p style="margin:0;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#57534c;">Time</p><p style="margin:6px 0 0 0;font-size:42px;font-weight:600;color:#161616;line-height:1.08;">${meta.timeLabel}</p></div>
						<div><p style="margin:0;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#57534c;">Location</p><p style="margin:6px 0 0 0;font-size:29px;font-weight:500;color:#161616;line-height:1.2;">${meta.locationLabel}</p></div>
					</div>
					<div style="border-radius:20px;border:1px solid #d7d3cb;background:#ffffff;padding:16px;display:flex;flex-direction:column;gap:12px;">
						<div><p style="margin:0;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#57534c;">Price</p><p style="margin:6px 0 0 0;font-size:46px;font-weight:700;color:#161616;line-height:1.08;">${meta.priceLabel}</p></div>
						<div><p style="margin:0;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#57534c;">Venue</p><p style="margin:6px 0 0 0;font-size:30px;font-weight:600;color:#161616;line-height:1.15;">${escapeHtml(`${formatVenueTypeIcons(event)} ${meta.venueLabel}`)}</p></div>
						<div><p style="margin:0;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#57534c;">Age</p><p style="margin:6px 0 0 0;font-size:28px;font-weight:500;color:#161616;line-height:1.15;">${meta.ageLabel}</p></div>
					</div>
				</div>

				<div style="margin-top:18px;display:flex;justify-content:space-between;align-items:center;padding-top:8px;">
					<div><p style="margin:0;font-size:17px;font-weight:700;color:#121212;">OOOC Fête Finder</p><p style="margin:4px 0 0 0;font-size:13px;color:#57534c;">Paris Event Post</p></div>
					${event.isOOOCPick ? '<div style="padding:8px 12px;border-radius:999px;background:#121212;color:#ffffff;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">OOOC Pick</div>' : ""}
				</div>
			</div>
		</div>
	`;
};

const generateShareableImage = async (
	event: Event,
	format: ShareImageFormat = "portrait",
): Promise<void> => {
	const dimensions = FORMATS[format];
	const container = document.createElement("div");
	container.style.position = "fixed";
	container.style.inset = "0";
	container.style.display = "flex";
	container.style.alignItems = "center";
	container.style.justifyContent = "center";
	container.style.overflow = "hidden";
	container.style.background = "rgba(12, 10, 8, 0.42)";
	container.style.backdropFilter = "blur(2px)";
	container.style.setProperty("-webkit-backdrop-filter", "blur(2px)");
	container.style.opacity = "0";
	container.style.transition = "opacity 110ms ease";
	container.style.pointerEvents = "none";
	container.style.zIndex = "2147483647";
	container.setAttribute("aria-hidden", "true");

	const previewWrapper = document.createElement("div");
	previewWrapper.style.transformOrigin = "center center";
	previewWrapper.style.willChange = "transform";

	const frame = document.createElement("div");
	frame.style.width = `${dimensions.width}px`;
	frame.style.height = `${dimensions.height}px`;
	frame.style.overflow = "hidden";
	frame.style.borderRadius = "24px";
	frame.style.boxShadow = "0 28px 80px rgba(0, 0, 0, 0.35)";
	frame.innerHTML =
		format === "portrait" ? buildPortraitTemplate(event) : buildLandscapeTemplate(event);

	const previewScale = Math.min(
		0.62,
		window.innerWidth / dimensions.width,
		window.innerHeight / dimensions.height,
	);
	previewWrapper.style.transform = `scale(${Math.max(previewScale, 0.24).toFixed(3)})`;

	previewWrapper.appendChild(frame);
	container.appendChild(previewWrapper);
	document.body.appendChild(container);

	try {
		if (typeof document !== "undefined" && "fonts" in document) {
			await document.fonts.ready;
		}
		await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
		container.style.opacity = "1";
		await new Promise((resolve) => setTimeout(resolve, 120));

		const { domToCanvas } = await import("modern-screenshot");
		const canvas = await domToCanvas(frame, {
			scale: RENDER_SCALE,
			quality: 1,
			width: dimensions.width,
			height: dimensions.height,
		});
		container.style.opacity = "0";

		const fileName =
			`${event.name.replace(/[^a-z0-9]/gi, "_").toLowerCase()}-${FORMATS[format].label}.png`;
		const triggerDownload = (blob?: Blob) => {
			const link = document.createElement("a");
			link.download = fileName;
			const objectUrl = blob ? URL.createObjectURL(blob) : canvas.toDataURL("image/png", 1.0);
			link.href = objectUrl;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);

			if (blob) {
				setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
			}
		};

		const blob = await new Promise<Blob | null>((resolve) => {
			canvas.toBlob(resolve, "image/png", 1.0);
		});

		if (!blob) {
			triggerDownload();
			return;
		}

		if (canUseNativeShareWithFiles()) {
			const file = new File([blob], fileName, {
				type: "image/png",
			});

			const canShareFile =
				typeof navigator.canShare === "function" ?
					navigator.canShare({ files: [file] })
				: false;

			if (canShareFile) {
				try {
					await navigator.share({
						title: `${event.name} - OOOC Fête Finder`,
						text: `Check out this event: ${event.name}`,
						files: [file],
					});
					return;
				} catch {
					triggerDownload(blob);
					return;
				}
			}
		} else {
			triggerDownload(blob);
			return;
		}

		triggerDownload(blob);
	} catch (error) {
		console.error("Error generating shareable image:", error);
		throw error;
	} finally {
		if (document.body.contains(container)) {
			document.body.removeChild(container);
		}
	}
};

export const ShareableImageGenerator = ({
	event,
	onError,
}: ShareableImageGeneratorProps) => {
	const handleGenerateImage = async (format: ShareImageFormat = "portrait") => {
		try {
			await generateShareableImage(event, format);
		} catch (error) {
			onError(
				error instanceof Error ? error.message : "Unknown error occurred",
			);
		}
	};

	return { generateImage: handleGenerateImage };
};

export default ShareableImageGenerator;
