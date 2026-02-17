"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useOutsideClick } from "@/hooks/useOutsideClick";
import {
	ChevronDown,
	ExternalLink,
	MapPin,
	Music2,
	Utensils,
	Zap,
	Toilet,
} from "lucide-react";
import Link from "next/link";
import React, { useState, useEffect } from "react";

interface QuickActionsDropdownProps {
	onMusicSelect: () => void;
	triggerClassName?: string;
	menuClassName?: string;
}

const QuickActionsDropdown: React.FC<QuickActionsDropdownProps> = ({
	onMusicSelect,
	triggerClassName,
	menuClassName,
}) => {
	const [isOpen, setIsOpen] = useState(false);
	const [isIOS, setIsIOS] = useState(false);
	const [isAndroid, setIsAndroid] = useState(false);

	useEffect(() => {
		const userAgent = navigator.userAgent.toLowerCase();
		const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
		const isAndroidDevice = /android/.test(userAgent);

		setIsIOS(isIOSDevice);
		setIsAndroid(isAndroidDevice);
	}, []);

	const dropdownRef = useOutsideClick<HTMLDivElement>(() => {
		setIsOpen(false);
	});

	const handleToggle = () => {
		setIsOpen(!isOpen);
	};

	const handleMusicClick = () => {
		onMusicSelect();
		setIsOpen(false);
	};

	// Toilet Finder app links and descriptions
	const getToiletFinderData = () => {
		if (isIOS) {
			return {
				url: "https://apps.apple.com/app/id311896604",
				description: "Download from App Store",
			};
		} else if (isAndroid) {
			return {
				url: "https://play.google.com/store/apps/details?id=com.bto.toilet&hl=en_GB",
				description: "Download from Play Store",
			};
		} else {
			// Default to iOS link for desktop/other devices
			return {
				url: "https://apps.apple.com/app/id311896604",
				description: "150,000+ restrooms worldwide",
			};
		}
	};

	const toiletFinderData = getToiletFinderData();

	return (
		<div className="relative" ref={dropdownRef}>
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="outline"
							size="sm"
							onClick={handleToggle}
							className={cn(
								"gap-1 text-xs sm:text-sm transition-colors p-1.5 sm:p-2 h-8 sm:h-9 flex-shrink-0",
								triggerClassName,
							)}
							aria-label="Quick actions menu"
							aria-expanded={isOpen}
							aria-haspopup="true"
						>
							<Zap className="h-3 w-3 sm:h-4 sm:w-4" />
							<ChevronDown
								className={`h-3 w-3 sm:h-4 sm:w-4 transition-transform transition-bouncy ${isOpen ? "rotate-180" : "rotate-0"}`}
							/>
						</Button>
					</TooltipTrigger>
					<TooltipContent>
						<p>Paris Essentials & Shortcuts</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>

			{/* Dropdown Menu */}
			{isOpen && (
				<div
					className={cn(
						"absolute right-0 top-full mt-2 w-64 bg-popover border rounded-md shadow-lg z-50 animate-in fade-in-0 zoom-in-95 duration-150",
						menuClassName,
					)}
				>
					<div className="p-1">
						{/* Music Option */}
						<button
							onClick={handleMusicClick}
							className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm transition-colors text-left"
						>
							<div className="w-10 flex items-center justify-center">
								<Music2 className="h-4 w-4 text-primary" />
							</div>
							<div className="flex-1 min-w-0">
								<div className="font-medium">Listen to Playlist</div>
								<div className="text-xs text-muted-foreground line-clamp-2">
									Paris vibes playlist
								</div>
							</div>
							<ExternalLink className="h-3 w-3 opacity-50 flex-shrink-0" />
						</button>

						{/* Divider */}
						<div className="my-1 h-px bg-border" />

						{/* Food Guide Option */}
						<Link
							href="https://maps.app.goo.gl/YZdYYpsh2ViR2tQi8?g_st=i"
							target="_blank"
							rel="noopener noreferrer"
							onClick={() => setIsOpen(false)}
							className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm transition-colors"
						>
							<div className="w-10 flex items-center justify-center gap-1">
								<Utensils className="h-4 w-4 text-orange-600" />
								<MapPin className="h-4 w-4 text-blue-600" />
							</div>
							<div className="flex-1 min-w-0">
								<div className="font-medium">Food Guide</div>
								<div className="text-xs text-muted-foreground line-clamp-2">
									Paris restaurants by Mel
								</div>
							</div>
							<ExternalLink className="h-3 w-3 opacity-50 flex-shrink-0" />
						</Link>

						{/* Divider */}
						<div className="my-1 h-px bg-border" />

						{/* Toilet Finder Option */}
						<Link
							href={toiletFinderData.url}
							target="_blank"
							rel="noopener noreferrer"
							onClick={() => setIsOpen(false)}
							className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm transition-colors"
						>
							<div className="w-10 flex items-center justify-center gap-1">
								<Toilet className="h-4 w-4 text-purple-600" />
								<MapPin className="h-4 w-4 text-green-600" />
							</div>
							<div className="flex-1 min-w-0">
								<div className="font-medium">Toilet Finder</div>
								<div className="text-xs text-muted-foreground line-clamp-2">
									{toiletFinderData.description}
								</div>
							</div>
							<ExternalLink className="h-3 w-3 opacity-50 flex-shrink-0" />
						</Link>
					</div>
				</div>
			)}
		</div>
	);
};

export default QuickActionsDropdown;
