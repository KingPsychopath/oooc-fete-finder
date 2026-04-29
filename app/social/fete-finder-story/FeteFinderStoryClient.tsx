"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Download, Share2 } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";

const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1920;
const EXPORT_SCALE = 2;
const FILE_NAME = "oooc-fete-finder-story.png";

const canShareFiles = (file: File): boolean => {
	if (typeof navigator === "undefined") return false;
	if (typeof navigator.canShare !== "function") return false;
	return navigator.canShare({ files: [file] });
};

const downloadBlob = (blob: Blob) => {
	const objectUrl = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = objectUrl;
	link.download = FILE_NAME;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
};

type ExportMode = "download" | "share";

export function FeteFinderStoryClient() {
	const storyRef = useRef<HTMLDivElement>(null);
	const [isExporting, setIsExporting] = useState(false);
	const [message, setMessage] = useState<string | null>(null);

	const createImageBlob = async (): Promise<Blob> => {
		const storyElement = storyRef.current;
		if (!storyElement) throw new Error("Story artwork is not ready yet.");
		if (typeof document !== "undefined" && "fonts" in document) {
			await document.fonts.ready;
		}

		const { domToCanvas } = await import("modern-screenshot");
		const canvas = await domToCanvas(storyElement, {
			scale: EXPORT_SCALE,
			quality: 1,
			width: STORY_WIDTH,
			height: STORY_HEIGHT,
			style: {
				transform: "none",
				transformOrigin: "top left",
			},
		});

		const blob = await new Promise<Blob | null>((resolve) => {
			canvas.toBlob(resolve, "image/png", 1);
		});

		if (!blob) throw new Error("Could not render the story image.");
		return blob;
	};

	const handleExport = async (mode: ExportMode) => {
		setIsExporting(true);
		setMessage(null);

		try {
			const blob = await createImageBlob();

			if (mode === "share") {
				const file = new File([blob], FILE_NAME, { type: "image/png" });
				if (canShareFiles(file)) {
					await navigator.share({
						title: "OOOC Fête Finder",
						text: "A curated guide to Paris music events by Out Of Office Collective.",
						files: [file],
					});
					setMessage("Ready for your story.");
					return;
				}
			}

			downloadBlob(blob);
			setMessage("Downloaded the story image.");
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
					className="relative shrink-0 [--story-scale:0.28] sm:[--story-scale:0.34] xl:[--story-scale:0.4]"
					style={{
						width: `calc(${STORY_WIDTH}px * var(--story-scale))`,
						height: `calc(${STORY_HEIGHT}px * var(--story-scale))`,
					}}
				>
					<div
						ref={storyRef}
						className="absolute left-0 top-0 overflow-hidden bg-[#f7efe4] text-[#211912] shadow-[0_30px_90px_rgba(30,18,10,0.28)]"
						style={{
							width: STORY_WIDTH,
							height: STORY_HEIGHT,
							transform: "scale(var(--story-scale))",
							transformOrigin: "top left",
						}}
					>
						<div className="absolute inset-0 bg-[linear-gradient(180deg,#fbf5ec_0%,#ead6bd_54%,#213f43_100%)]" />
						<div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(167,94,55,0.34),transparent_32%),radial-gradient(circle_at_88%_28%,rgba(226,170,91,0.34),transparent_34%),radial-gradient(circle_at_46%_88%,rgba(23,85,91,0.82),transparent_46%)]" />
						<div className="absolute inset-x-0 bottom-0 h-[44%] bg-[linear-gradient(180deg,rgba(25,47,48,0)_0%,rgba(12,29,31,0.86)_58%,rgba(8,20,22,0.95)_100%)]" />

						<div className="absolute left-[72px] top-[72px] flex items-center gap-5">
							<div className="relative h-20 w-20">
								<Image
									src="/OOOCLogoDark.svg"
									alt=""
									fill
									priority
									sizes="80px"
									className="object-contain"
								/>
							</div>
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
							Paris
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
							{[
								"Browse events across the city",
								"Filter by arrondissement, sound and setting",
								"Plan your route before the night starts",
							].map((item, index) => (
								<div
									key={item}
									className="flex items-center gap-5 border-t border-[#9b7155]/32 bg-white/22 px-1 py-6 backdrop-blur-[1px]"
								>
									<span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#213f43] text-[22px] font-semibold text-[#fff8eb]">
										{index + 1}
									</span>
									<span className="text-[36px] leading-[1.05] text-[#2c211b]">
										{item}
									</span>
								</div>
							))}
						</div>

						<div className="absolute bottom-[210px] left-[72px] right-[72px]">
							<p className="m-0 max-w-[760px] text-[42px] leading-[1.1] text-[#fff7e9]">
								Curated by OOOC for people who want the good music without the
								group chat chaos.
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
					</div>
				</div>
			</div>

			<aside className="rounded-2xl border border-border/70 bg-card/86 p-5 shadow-[0_12px_36px_rgba(31,21,14,0.12)] backdrop-blur-md">
				<p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
					IG Story Asset
				</p>
				<h2
					className="mt-2 text-2xl font-light text-foreground"
					style={{ fontFamily: "var(--ooo-font-display)" }}
				>
					What is Fête Finder?
				</h2>
				<p className="mt-3 text-sm leading-relaxed text-muted-foreground">
					A direct-link social asset for explaining the product without sharing
					a screenshot of the event list.
				</p>
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
					{message || "Exports at 1080 x 1920 for Instagram Stories."}
				</p>
			</aside>
		</div>
	);
}
