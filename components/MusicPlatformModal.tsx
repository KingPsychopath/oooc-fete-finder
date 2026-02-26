"use client";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ExternalLink, Music2, X } from "lucide-react";
import React from "react";

interface MusicPlatformModalProps {
	isOpen: boolean;
	onClose: () => void;
}

type MusicPlatformId = "spotify" | "apple" | "youtubeMusic";

type MusicPlatformConfig = {
	id: MusicPlatformId;
	label: string;
	subtitle: string;
	href: string | null;
	buttonClassName: string;
	badgeClassName: string;
	icon: React.ReactNode;
};

const PLATFORM_CONFIGS: MusicPlatformConfig[] = [
	{
		id: "spotify",
		label: "Spotify",
		subtitle: "Community playlist",
		href: "https://open.spotify.com/playlist/0zfRemqFPipkrXo5VEcATh?si=_1Kvv_wvQ6eVlF-7eNJxSA&pi=Uw3u5NKeRDqXL",
		buttonClassName:
			"border-[#1db954]/60 bg-[linear-gradient(145deg,rgba(29,185,84,0.16),rgba(29,185,84,0.08))] text-foreground hover:bg-[linear-gradient(145deg,rgba(29,185,84,0.2),rgba(29,185,84,0.12))] dark:border-[#1db954]/40 dark:bg-[linear-gradient(145deg,rgba(29,185,84,0.18),rgba(29,185,84,0.08))]",
		badgeClassName:
			"border-[#1db954]/45 bg-[#1db954]/12 text-[#0e8f3d] dark:text-[#7be7aa]",
		icon: (
			<svg
				viewBox="0 0 24 24"
				className="h-5 w-5 fill-current"
				aria-hidden="true"
			>
				<path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z" />
			</svg>
		),
	},
	{
		id: "apple",
		label: "Apple Music",
		subtitle: "Curated vibe set",
		href: "https://music.apple.com/gb/playlist/konzombazouklove/pl.u-2aoqXWaHq8NvKE",
		buttonClassName:
			"border-pink-300/70 bg-[linear-gradient(140deg,rgba(250,87,193,0.16),rgba(255,190,11,0.12))] text-foreground hover:bg-[linear-gradient(140deg,rgba(250,87,193,0.22),rgba(255,190,11,0.16))] dark:border-pink-400/35 dark:bg-[linear-gradient(140deg,rgba(250,87,193,0.18),rgba(255,190,11,0.1))]",
		badgeClassName:
			"border-pink-300/60 bg-pink-200/35 text-pink-700 dark:border-pink-400/40 dark:bg-pink-500/12 dark:text-pink-200",
		icon: (
			<svg
				viewBox="0 0 24 24"
				className="h-5 w-5 fill-current"
				aria-hidden="true"
			>
				<path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
			</svg>
		),
	},
	{
		id: "youtubeMusic",
		label: "YouTube Music",
		subtitle: "Playlist link coming soon",
		href: null,
		buttonClassName:
			"border-rose-300/65 bg-[linear-gradient(145deg,rgba(234,67,53,0.14),rgba(244,114,182,0.1))] text-foreground hover:bg-[linear-gradient(145deg,rgba(234,67,53,0.17),rgba(244,114,182,0.12))] dark:border-rose-400/35 dark:bg-[linear-gradient(145deg,rgba(234,67,53,0.16),rgba(244,114,182,0.08))]",
		badgeClassName:
			"border-rose-300/60 bg-rose-200/35 text-rose-700 dark:border-rose-400/40 dark:bg-rose-500/12 dark:text-rose-200",
		icon: (
			<svg
				viewBox="0 0 24 24"
				className="h-5 w-5 fill-current"
				aria-hidden="true"
			>
				<path d="M21.6 7.2c-.2-.8-.8-1.4-1.6-1.6C18.5 5.2 12 5.2 12 5.2s-6.5 0-8 .4c-.8.2-1.4.8-1.6 1.6C2 8.7 2 12 2 12s0 3.3.4 4.8c.2.8.8 1.4 1.6 1.6 1.5.4 8 .4 8 .4s6.5 0 8-.4c.8-.2 1.4-.8 1.6-1.6.4-1.5.4-4.8.4-4.8s0-3.3-.4-4.8ZM10 15.4V8.6l5.8 3.4L10 15.4Z" />
			</svg>
		),
	},
];

const openPlatformLink = (href: string) => {
	window.open(href, "_blank", "noopener,noreferrer");
};

const MusicPlatformModal: React.FC<MusicPlatformModalProps> = ({
	isOpen,
	onClose,
}) => {
	return (
		<Dialog
			open={isOpen}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent
				showCloseButton={false}
				className="sm:max-w-lg overflow-hidden rounded-2xl border border-border/70 bg-card/96 p-0 shadow-[0_24px_60px_-26px_rgba(16,12,9,0.48)] backdrop-blur-xl"
			>
				<div className="relative border-b border-border/70 bg-[linear-gradient(160deg,rgba(246,241,233,0.86),rgba(241,233,220,0.62))] px-5 py-4 dark:bg-[linear-gradient(160deg,rgba(22,18,15,0.9),rgba(29,24,20,0.76))]">
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						onClick={onClose}
						className="absolute right-3 top-3 rounded-full border border-border/70 bg-background/60 hover:bg-accent"
						aria-label="Close music platform chooser"
					>
						<X className="h-4 w-4" />
					</Button>
					<DialogHeader className="pr-10">
						<p className="text-[10px] uppercase tracking-[0.24em] text-foreground/60">
							Out Of Office Collective
						</p>
						<DialogTitle className="flex items-center gap-2 text-[1.25rem] [font-family:var(--ooo-font-display)] font-light leading-tight">
							<Music2 className="h-5 w-5 text-foreground/80" />
							Choose your soundtrack
						</DialogTitle>
						<DialogDescription className="max-w-[42ch] text-sm leading-relaxed text-muted-foreground">
							Pick a platform to hear community-curated sounds for the Paris
							run. Spotify and Apple Music are live now, with YouTube Music
							ready for the next playlist drop.
						</DialogDescription>
					</DialogHeader>
				</div>

				<div className="space-y-3 px-4 py-4">
					{PLATFORM_CONFIGS.map((platform) => {
						const isDisabled = !platform.href;
						return (
							<button
								key={platform.id}
								type="button"
								disabled={isDisabled}
								onClick={() => {
									if (!platform.href) return;
									openPlatformLink(platform.href);
									onClose();
								}}
								className={cn(
									"group w-full rounded-xl border p-3 text-left transition-all",
									"focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
									platform.buttonClassName,
									isDisabled
										? "cursor-not-allowed opacity-75"
										: "hover:-translate-y-[1px] hover:shadow-[0_10px_26px_-20px_rgba(16,12,9,0.55)]",
								)}
								aria-label={
									isDisabled
										? `${platform.label} coming soon`
										: `Listen on ${platform.label}`
								}
							>
								<div className="flex items-center gap-3">
									<div className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white/80 text-foreground shadow-sm dark:border-white/10 dark:bg-white/10">
										{platform.icon}
									</div>
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2">
											<span className="text-sm font-medium text-foreground">
												{platform.label}
											</span>
											<span
												className={cn(
													"rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em]",
													platform.badgeClassName,
												)}
											>
												{isDisabled ? "Soon" : "Open"}
											</span>
										</div>
										<p className="mt-0.5 text-xs text-muted-foreground">
											{platform.subtitle}
										</p>
									</div>
									<div className="flex h-8 w-8 items-center justify-center rounded-full border border-border/70 bg-background/55 text-muted-foreground transition-colors group-hover:text-foreground">
										<ExternalLink className="h-3.5 w-3.5" />
									</div>
								</div>
							</button>
						);
					})}
				</div>

				<div className="border-t border-border/70 bg-background/45 px-4 py-3">
					<p className="text-center text-[11px] tracking-[0.04em] text-muted-foreground">
						Kompa, Zouk, French cuts and warm-up energy for your route.
					</p>
				</div>
			</DialogContent>
		</Dialog>
	);
};

export default MusicPlatformModal;
