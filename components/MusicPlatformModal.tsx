"use client";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { ExternalLink, Music2 } from "lucide-react";
import React from "react";

interface MusicPlatformModalProps {
	isOpen: boolean;
	onClose: () => void;
}

const MusicPlatformModal: React.FC<MusicPlatformModalProps> = ({
	isOpen,
	onClose,
}) => {
	const handlePlatformSelect = (platform: "spotify" | "apple") => {
		const links = {
			spotify:
				"https://open.spotify.com/playlist/0zfRemqFPipkrXo5VEcATh?si=_1Kvv_wvQ6eVlF-7eNJxSA&pi=Uw3u5NKeRDqXL",
			apple:
				"https://music.apple.com/gb/playlist/konzombazouklove/pl.u-2aoqXWaHq8NvKE",
		};

		window.open(links[platform], "_blank", "noopener,noreferrer");
		onClose();
	};

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Music2 className="h-5 w-5 text-primary" />
						Choose Your Music Platform
					</DialogTitle>
					<DialogDescription>
						Listen to playlists created by our community to get in the mood for
						Paris! 🇫🇷🎉
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-3 mt-4">
					<Button
						onClick={() => handlePlatformSelect("spotify")}
						className="w-full flex items-center justify-between gap-3 h-12 bg-[#1DB954] hover:bg-[#1ed760] text-white"
					>
						<div className="flex items-center gap-3">
							<div className="w-6 h-6 flex items-center justify-center">
								<svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
									<path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z" />
								</svg>
							</div>
							<span className="font-medium">Listen on Spotify</span>
						</div>
						<ExternalLink className="h-4 w-4" />
					</Button>

					<Button
						onClick={() => handlePlatformSelect("apple")}
						className="w-full flex items-center justify-between gap-3 h-12 bg-gradient-to-r from-[#FA57C1] to-[#FFBE0B] hover:from-[#fb6bc6] hover:to-[#ffc533] text-white"
					>
						<div className="flex items-center gap-3">
							<div className="w-6 h-6 flex items-center justify-center">
								<svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
									<path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
								</svg>
							</div>
							<span className="font-medium">Listen on Apple Music</span>
						</div>
						<ExternalLink className="h-4 w-4" />
					</Button>
				</div>

				<div className="mt-4 p-3 bg-muted rounded-lg">
					<p className="text-xs text-muted-foreground text-center">
						🎵 The perfect soundtrack for your Paris adventure - featuring
						Kompa, Zouk & French vibes!
					</p>
				</div>
			</DialogContent>
		</Dialog>
	);
};

export default MusicPlatformModal;
