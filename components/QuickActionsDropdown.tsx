"use client";

import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { trackNavigationClick } from "@/features/events/engagement/client-tracking";
import { requestFeteFinderTour } from "@/features/events/tour-events";
import { COMMUNITY_INVITE_CONFIG } from "@/features/social/config";
import { useOutsideClick } from "@/hooks/useOutsideClick";
import { cn } from "@/lib/utils";
import {
	ChevronDown,
	CircleHelp,
	ExternalLink,
	MapPin,
	MessageCircle,
	Music2,
	Toilet,
	Utensils,
	Zap,
} from "lucide-react";
import Link from "next/link";
import React, { useState, useEffect } from "react";

interface QuickActionsDropdownProps {
	onMusicSelect: () => void;
	triggerClassName?: string;
	menuClassName?: string;
}

const toiletFinderIosUrl =
	process.env.NEXT_PUBLIC_TOILET_FINDER_IOS_URL?.trim() ||
	"https://apps.apple.com/app/id311896604";
const toiletFinderAndroidUrl =
	process.env.NEXT_PUBLIC_TOILET_FINDER_ANDROID_URL?.trim() ||
	"https://play.google.com/store/apps/details?id=com.bto.toilet&hl=en_GB";
const foodGuideUrl =
	process.env.NEXT_PUBLIC_FOOD_GUIDE_URL?.trim() ||
	"https://maps.app.goo.gl/YZdYYpsh2ViR2tQi8?g_st=i";

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
		trackNavigationClick({ group: "quick_action", label: "playlist" });
		onMusicSelect();
		setIsOpen(false);
	};

	const handleTourClick = () => {
		trackNavigationClick({ group: "quick_action", label: "tour" });
		requestFeteFinderTour();
		setIsOpen(false);
	};

	const handleExternalLinkClick = (label: string) => {
		trackNavigationClick({ group: "quick_action", label });
		setIsOpen(false);
	};

	// Toilet Finder app links and descriptions
	const getToiletFinderData = () => {
		if (isIOS) {
			return {
				url: toiletFinderIosUrl,
				description: "Download from App Store",
			};
		} else if (isAndroid) {
			return {
				url: toiletFinderAndroidUrl,
				description: "Download from Play Store",
			};
		} else {
			// Default to iOS link for desktop/other devices
			return {
				url: toiletFinderIosUrl,
				description: "150,000+ restrooms worldwide",
			};
		}
	};

	const toiletFinderData = getToiletFinderData();

	return (
		<div className="relative" ref={dropdownRef}>
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger
						id="header-quick-actions-trigger"
						render={
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
							/>
						}
					>
						<Zap className="h-3 w-3 sm:h-4 sm:w-4" />
						<ChevronDown
							className={`h-3 w-3 sm:h-4 sm:w-4 transition-transform transition-bouncy ${isOpen ? "rotate-180" : "rotate-0"}`}
						/>
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
						<button
							type="button"
							onClick={handleTourClick}
							className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm transition-colors text-left"
						>
							<div className="w-10 flex items-center justify-center">
								<CircleHelp className="h-4 w-4 text-amber-700 dark:text-amber-300" />
							</div>
							<div className="flex-1 min-w-0">
								<div className="font-medium">Take the Tour</div>
								<div className="text-xs text-muted-foreground line-clamp-2">
									Find your first plan in 30 seconds
								</div>
							</div>
						</button>

						<div className="my-1 h-px bg-border" />

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
							href={foodGuideUrl}
							target="_blank"
							rel="noopener noreferrer"
							onClick={() => handleExternalLinkClick("food_guide")}
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

						{/* WhatsApp Community Option */}
						<Link
							href={COMMUNITY_INVITE_CONFIG.WHATSAPP_URL}
							target="_blank"
							rel="noopener noreferrer"
							onClick={() => handleExternalLinkClick("whatsapp")}
							className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm transition-colors"
						>
							<div className="w-10 flex items-center justify-center gap-1">
								<MessageCircle className="h-4 w-4 text-green-600" />
							</div>
							<div className="flex-1 min-w-0">
								<div className="font-medium">WhatsApp Community</div>
								<div className="text-xs text-muted-foreground line-clamp-2">
									Real-time updates from the OOOC group
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
							onClick={() => handleExternalLinkClick("toilet_finder")}
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
