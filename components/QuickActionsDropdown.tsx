"use client";

import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";

interface QuickActionsDropdownProps {
	onMusicSelect: () => void;
}

const QuickActionsDropdown: React.FC<QuickActionsDropdownProps> = ({
	onMusicSelect,
}) => {
	const [isOpen, setIsOpen] = useState(false);

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

	return (
		<div className="relative" ref={dropdownRef}>
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="outline"
							size="sm"
							onClick={handleToggle}
							className="gap-1 text-xs sm:text-sm hover:bg-accent hover:text-accent-foreground transition-colors p-1.5 sm:p-2 h-8 sm:h-9 flex-shrink-0"
							aria-label="Quick actions menu"
							aria-expanded={isOpen}
							aria-haspopup="true"
						>
							<Music2 className="h-3 w-3 sm:h-4 sm:w-4" />
							<ChevronDown
								className={`h-3 w-3 sm:h-4 sm:w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
							/>
						</Button>
					</TooltipTrigger>
					<TooltipContent>
						<p>Music & Food</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>

			{/* Dropdown Menu */}
			{isOpen && (
				<div className="absolute right-0 top-full mt-2 w-56 bg-popover border rounded-md shadow-lg z-50 animate-in fade-in-0 zoom-in-95 duration-200">
					<div className="p-1">
						{/* Music Option */}
						<button
							onClick={handleMusicClick}
							className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm transition-colors text-left"
						>
							<div className="w-10 flex items-center justify-center">
								<Music2 className="h-4 w-4 text-primary" />
							</div>
							<div className="flex-1">
								<div className="font-medium">Listen to Playlist</div>
								<div className="text-xs text-muted-foreground">
									Paris vibes playlist
								</div>
							</div>
							<ExternalLink className="h-3 w-3 opacity-50" />
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
							<div className="flex-1">
								<div className="font-medium">Food Guide</div>
								<div className="text-xs text-muted-foreground">
									Paris restaurants by Mel
								</div>
							</div>
							<ExternalLink className="h-3 w-3 opacity-50" />
						</Link>
					</div>
				</div>
			)}
		</div>
	);
};

export default QuickActionsDropdown;
