"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Download, Share2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";

const EXPORT_SCALE = 2;

export type SocialAssetVariant = "story" | "twitter" | "square";

const socialAssetVariants: Record<
	SocialAssetVariant,
	{
		width: number;
		height: number;
		fileName: string;
		label: string;
		title: string;
		description: string;
		exportHint: string;
		previewScaleClassName: string;
	}
> = {
	story: {
		width: 1080,
		height: 1920,
		fileName: "oooc-fete-finder-story.png",
		label: "Instagram Story",
		title: "What is Fête Finder?",
		description:
			"A vertical story asset for explaining the product without sharing a screenshot of the event list.",
		exportHint: "Exports at 1080 x 1920 for Instagram Stories.",
		previewScaleClassName:
			"[--asset-scale:0.28] sm:[--asset-scale:0.34] xl:[--asset-scale:0.4]",
	},
	twitter: {
		width: 1600,
		height: 900,
		fileName: "oooc-fete-finder-twitter.png",
		label: "Twitter",
		title: "Share Fête Finder on Twitter",
		description:
			"A wide social card for posts, link previews and announcement threads.",
		exportHint: "Exports at 1600 x 900 for Twitter, LinkedIn and widescreen posts.",
		previewScaleClassName:
			"[--asset-scale:0.22] sm:[--asset-scale:0.32] xl:[--asset-scale:0.42]",
	},
	square: {
		width: 1080,
		height: 1080,
		fileName: "oooc-fete-finder-square.png",
		label: "Square Post",
		title: "Share Fête Finder as a square post",
		description:
			"A compact feed asset for Instagram grids, WhatsApp previews and general posts.",
		exportHint: "Exports at 1080 x 1080 for square feed posts.",
		previewScaleClassName:
			"[--asset-scale:0.3] sm:[--asset-scale:0.42] xl:[--asset-scale:0.5]",
	},
};

const variantLinks: Array<{
	href: string;
	label: string;
	variant: SocialAssetVariant;
}> = [
	{ href: "/social/story", label: "Story", variant: "story" },
	{ href: "/social/twitter", label: "Twitter", variant: "twitter" },
	{ href: "/social/square", label: "Square", variant: "square" },
];

const canShareFiles = (file: File): boolean => {
	if (typeof navigator === "undefined") return false;
	if (typeof navigator.canShare !== "function") return false;
	return navigator.canShare({ files: [file] });
};

const downloadBlob = (blob: Blob, fileName: string) => {
	const objectUrl = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = objectUrl;
	link.download = fileName;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
};

type ExportMode = "download" | "share";

export function FeteFinderSocialAssetClient({
	variant,
}: {
	variant: SocialAssetVariant;
}) {
	const asset = socialAssetVariants[variant];
	const assetRef = useRef<HTMLDivElement>(null);
	const [isExporting, setIsExporting] = useState(false);
	const [message, setMessage] = useState<string | null>(null);

	const createImageBlob = async (): Promise<Blob> => {
		const assetElement = assetRef.current;
		if (!assetElement) throw new Error("Social artwork is not ready yet.");
		if (typeof document !== "undefined" && "fonts" in document) {
			await document.fonts.ready;
		}

		const { domToCanvas } = await import("modern-screenshot");
		const canvas = await domToCanvas(assetElement, {
			scale: EXPORT_SCALE,
			quality: 1,
			width: asset.width,
			height: asset.height,
			style: {
				transform: "none",
				transformOrigin: "top left",
			},
		});

		const blob = await new Promise<Blob | null>((resolve) => {
			canvas.toBlob(resolve, "image/png", 1);
		});

		if (!blob) throw new Error("Could not render the social image.");
		return blob;
	};

	const handleExport = async (mode: ExportMode) => {
		setIsExporting(true);
		setMessage(null);

		try {
			const blob = await createImageBlob();

			if (mode === "share") {
				const file = new File([blob], asset.fileName, { type: "image/png" });
				if (canShareFiles(file)) {
					await navigator.share({
						title: "OOOC Fête Finder",
						text: "A curated guide to Paris music events by Out Of Office Collective.",
						files: [file],
					});
					setMessage("Ready to share.");
					return;
				}
			}

			downloadBlob(blob, asset.fileName);
			setMessage(`Downloaded ${asset.fileName}.`);
		} catch (error) {
			setMessage(
				error instanceof Error
					? error.message
					: "Something went wrong while creating the image.",
			);
		} finally {
			setIsExporting(false);
		}
	};

	return (
		<div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start lg:gap-8">
			<div className="flex justify-center overflow-x-auto rounded-2xl border border-border/70 bg-card/72 p-4 shadow-[0_18px_60px_rgba(31,21,14,0.16)] backdrop-blur-md sm:p-6">
				<div
					className={cn("relative shrink-0", asset.previewScaleClassName)}
					style={{
						width: `calc(${asset.width}px * var(--asset-scale))`,
						height: `calc(${asset.height}px * var(--asset-scale))`,
					}}
				>
					<div
						ref={assetRef}
						className="absolute left-0 top-0 overflow-hidden bg-[#f7efe4] text-[#211912] shadow-[0_30px_90px_rgba(30,18,10,0.28)]"
						style={{
							width: asset.width,
							height: asset.height,
							transform: "scale(var(--asset-scale))",
							transformOrigin: "top left",
						}}
					>
						{variant === "story" ? <StoryArtwork /> : null}
						{variant === "twitter" ? <WideArtwork /> : null}
						{variant === "square" ? <SquareArtwork /> : null}
					</div>
				</div>
			</div>

			<aside className="rounded-2xl border border-border/70 bg-card/86 p-5 shadow-[0_12px_36px_rgba(31,21,14,0.12)] backdrop-blur-md">
				<p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
					{asset.label}
				</p>
				<h2
					className="mt-2 text-2xl font-light text-foreground"
					style={{ fontFamily: "var(--ooo-font-display)" }}
				>
					{asset.title}
				</h2>
				<p className="mt-3 text-sm leading-relaxed text-muted-foreground">
					{asset.description}
				</p>
				<nav className="mt-5 grid gap-2" aria-label="Social asset variants">
					{variantLinks.map((link) => (
						<Link
							key={link.variant}
							href={link.href}
							className={cn(
								"rounded-full border border-border/70 px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-foreground",
								link.variant === variant
									? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
									: "bg-background/58 text-muted-foreground",
							)}
						>
							{link.label}
						</Link>
					))}
				</nav>
				<div className="mt-5 grid gap-2">
					<Button
						type="button"
						size="lg"
						onClick={() => handleExport("download")}
						disabled={isExporting}
						className="h-10 rounded-full"
					>
						<Download aria-hidden="true" />
						{isExporting ? "Creating..." : "Download PNG"}
					</Button>
					<Button
						type="button"
						size="lg"
						variant="outline"
						onClick={() => handleExport("share")}
						disabled={isExporting}
						className="h-10 rounded-full"
					>
						<Share2 aria-hidden="true" />
						Share PNG
					</Button>
				</div>
				<p
					className={cn(
						"mt-4 text-sm leading-relaxed",
						message ? "text-muted-foreground" : "text-muted-foreground/70",
					)}
					aria-live="polite"
				>
					{message || asset.exportHint}
				</p>
			</aside>
		</div>
	);
}

function BrandMark({ size = 80 }: { size?: number }) {
	return (
		<div className="relative shrink-0" style={{ width: size, height: size }}>
			<Image
				src="/OOOCLogoDark.svg"
				alt=""
				fill
				priority
				sizes={`${size}px`}
				className="object-contain"
			/>
		</div>
	);
}

function StoryArtwork() {
	return (
		<>
			<StoryBackground />
			<div className="absolute left-[72px] top-[72px] flex items-center gap-5">
				<BrandMark />
				<div>
					<p className="m-0 text-[22px] uppercase tracking-[0.24em] text-[#5c4636]">
						Out Of Office
					</p>
					<p className="m-0 mt-1 text-[22px] uppercase tracking-[0.24em] text-[#5c4636]">
						Collective
					</p>
				</div>
			</div>

			<div className="absolute right-[72px] top-[82px] rounded-full border border-[#9b7155]/36 bg-white/48 px-6 py-3 text-[20px] font-semibold uppercase tracking-[0.12em] text-[#5c3224]">
				2026 guide
			</div>

			<div className="absolute left-[72px] right-[72px] top-[238px]">
				<p className="m-0 text-[24px] uppercase tracking-[0.22em] text-[#6f5341]">
					Fête de la Musique
				</p>
				<h1 className="m-0 mt-4 max-w-[860px] text-[148px] font-light leading-[0.86] text-[#211912] [font-family:var(--ooo-font-display)]">
					Fête Finder
				</h1>
				<p className="m-0 mt-8 max-w-[760px] text-[46px] leading-[1.08] text-[#3a2a20]">
					Your curated guide to Paris music events, mapped by area, genre,
					price and vibe.
				</p>
			</div>

			<div className="absolute left-[72px] right-[72px] top-[790px] grid gap-4">
				<StoryRoutes />
			</div>

			<div className="absolute bottom-[210px] left-[72px] right-[72px]">
				<p className="m-0 max-w-[760px] text-[42px] leading-[1.1] text-[#fff7e9]">
					Curated by OOOC for people who want the good music without the group
					chat chaos.
				</p>
			</div>

			<div className="absolute bottom-[76px] left-[72px] right-[72px] flex items-end justify-between gap-8 border-t border-[#fff2da]/30 pt-8">
				<div>
					<p className="m-0 text-[24px] uppercase tracking-[0.18em] text-[#e9c997]">
						Explore the map
					</p>
					<p className="m-0 mt-3 text-[34px] font-semibold text-[#fff9ef]">
						outofofficecollective.co.uk
					</p>
				</div>
				<div className="rounded-full border border-[#fff2da]/28 bg-[#fff7e9] px-7 py-4 text-[22px] font-semibold uppercase tracking-[0.12em] text-[#213f43]">
					Share with the chat
				</div>
			</div>
		</>
	);
}

function WideArtwork() {
	return (
		<>
			<WideBackground />
			<div className="absolute left-[72px] right-[72px] top-[64px] flex items-center justify-between">
				<div className="flex items-center gap-5">
					<BrandMark size={70} />
					<div>
						<p className="m-0 text-[20px] uppercase tracking-[0.22em] text-[#5c4636]">
							Out Of Office Collective
						</p>
						<p className="m-0 mt-1 text-[18px] uppercase tracking-[0.18em] text-[#7d5c45]">
							Paris · Fête de la Musique
						</p>
					</div>
				</div>
				<div className="rounded-full border border-[#fff2da]/28 bg-[#fff7e9] px-6 py-3 text-[18px] font-semibold uppercase tracking-[0.12em] text-[#213f43]">
					2026 guide
				</div>
			</div>

			<div className="absolute left-[76px] top-[218px] max-w-[840px]">
				<h1 className="m-0 text-[132px] font-light leading-[0.9] text-[#211912] [font-family:var(--ooo-font-display)]">
					Fête Finder
				</h1>
				<p className="m-0 mt-7 text-[42px] leading-[1.08] text-[#3a2a20]">
					A curated map of Paris music events by arrondissement, sound, price
					and vibe.
				</p>
			</div>

			<div className="absolute bottom-[74px] left-[76px] right-[76px] grid grid-cols-3 gap-4">
				<WideStat label="Browse" value="City picks" />
				<WideStat label="Filter" value="Sound + setting" />
				<WideStat label="Move" value="Share the route" />
			</div>

			<div className="absolute right-[78px] top-[260px] w-[430px] rounded-[38px] border border-[#fff2da]/32 bg-[#213f43]/90 p-6 text-[#fff8eb] shadow-[0_30px_80px_-50px_rgba(20,14,8,0.8)]">
				<p className="m-0 text-[18px] uppercase tracking-[0.18em] text-[#e9c997]">
					Live weekend layer
				</p>
				<p className="m-0 mt-4 text-[34px] leading-[1.05]">
					Find the good music without the group chat chaos.
				</p>
				<p className="m-0 mt-8 text-[24px] font-semibold">
					fete.outofofficecollective.co.uk
				</p>
			</div>
		</>
	);
}

function SquareArtwork() {
	return (
		<>
			<WideBackground />
			<div className="absolute left-[64px] right-[64px] top-[62px] flex items-center justify-between">
				<BrandMark size={76} />
				<div className="rounded-full border border-[#fff2da]/28 bg-[#fff7e9] px-5 py-3 text-[18px] font-semibold uppercase tracking-[0.12em] text-[#213f43]">
					2026 guide
				</div>
			</div>

			<div className="absolute left-[64px] right-[64px] top-[190px]">
				<p className="m-0 text-[22px] uppercase tracking-[0.2em] text-[#6f5341]">
					Out Of Office Collective
				</p>
				<h1 className="m-0 mt-4 text-[124px] font-light leading-[0.88] text-[#211912] [font-family:var(--ooo-font-display)]">
					Fête Finder
				</h1>
				<p className="m-0 mt-7 text-[38px] leading-[1.1] text-[#3a2a20]">
					Paris music events, mapped by area, genre, price and vibe.
				</p>
			</div>

			<div className="absolute left-[64px] right-[64px] top-[650px] grid gap-3">
				<StoryRoutes compact />
			</div>

			<div className="absolute bottom-[64px] left-[64px] right-[64px] flex items-center justify-between border-t border-[#fff2da]/30 pt-7">
				<p className="m-0 text-[28px] font-semibold text-[#211912]">
					fete.outofofficecollective.co.uk
				</p>
				<div className="rounded-full bg-[#fff7e9] px-6 py-3 text-[18px] font-semibold uppercase tracking-[0.12em] text-[#213f43]">
					Open map
				</div>
			</div>
		</>
	);
}

function StoryRoutes({ compact = false }: { compact?: boolean }) {
	return (
		<>
			{[
				"Browse events across the city",
				"Filter by arrondissement, sound and setting",
				"Plan your route before the night starts",
			].map((item, index) => (
				<div
					key={item}
					className={cn(
						"flex items-center rounded-[22px] border border-[#9b7155]/24 bg-white/24 shadow-[0_12px_32px_-28px_rgba(35,24,16,0.48)] backdrop-blur-[1px]",
						compact ? "gap-4 px-4 py-4" : "gap-5 px-5 py-6",
					)}
				>
					<span
						className={cn(
							"flex shrink-0 items-center justify-center rounded-full bg-[#213f43] font-semibold text-[#fff8eb]",
							compact ? "h-10 w-10 text-[18px]" : "h-12 w-12 text-[22px]",
						)}
					>
						{index + 1}
					</span>
					<span
						className={cn(
							"leading-[1.05] text-[#2c211b]",
							compact ? "text-[28px]" : "text-[36px]",
						)}
					>
						{item}
					</span>
				</div>
			))}
		</>
	);
}

function WideStat({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-[26px] border border-[#9b7155]/24 bg-white/30 px-5 py-4 backdrop-blur-[1px]">
			<p className="m-0 text-[16px] uppercase tracking-[0.18em] text-[#6f5341]">
				{label}
			</p>
			<p className="m-0 mt-2 text-[28px] font-semibold text-[#2c211b]">
				{value}
			</p>
		</div>
	);
}

function StoryBackground() {
	return (
		<>
			<div className="absolute inset-0 bg-[linear-gradient(180deg,#fbf5ec_0%,#ead6bd_54%,#213f43_100%)]" />
			<div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(167,94,55,0.34),transparent_32%),radial-gradient(circle_at_88%_28%,rgba(226,170,91,0.34),transparent_34%),radial-gradient(circle_at_46%_88%,rgba(23,85,91,0.82),transparent_46%)]" />
			<div className="absolute inset-x-0 bottom-0 h-[44%] bg-[linear-gradient(180deg,rgba(25,47,48,0)_0%,rgba(12,29,31,0.86)_58%,rgba(8,20,22,0.95)_100%)]" />
			<GrainOverlay />
		</>
	);
}

function WideBackground() {
	return (
		<>
			<div className="absolute inset-0 bg-[linear-gradient(135deg,#fbf5ec_0%,#ead6bd_48%,#d5b38c_100%)]" />
			<div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_14%,rgba(167,94,55,0.35),transparent_31%),radial-gradient(circle_at_86%_18%,rgba(226,170,91,0.42),transparent_32%),radial-gradient(circle_at_86%_86%,rgba(23,85,91,0.88),transparent_38%)]" />
			<div className="absolute inset-y-0 right-0 w-[42%] bg-[linear-gradient(90deg,rgba(25,47,48,0)_0%,rgba(12,29,31,0.72)_72%,rgba(8,20,22,0.92)_100%)]" />
			<GrainOverlay />
		</>
	);
}

function GrainOverlay() {
	return (
		<div
			className="pointer-events-none absolute inset-0 opacity-[0.16] mix-blend-multiply"
			style={{
				backgroundImage:
					"radial-gradient(circle at 20% 30%, rgba(33, 25, 18, 0.42) 0 0.7px, transparent 0.9px), radial-gradient(circle at 70% 80%, rgba(255, 247, 233, 0.54) 0 0.7px, transparent 1px), radial-gradient(circle at 45% 55%, rgba(33, 25, 18, 0.28) 0 0.6px, transparent 0.9px)",
				backgroundPosition: "0 0, 1px 2px, 3px 1px",
				backgroundSize: "4px 4px, 5px 5px, 6px 6px",
			}}
		/>
	);
}
