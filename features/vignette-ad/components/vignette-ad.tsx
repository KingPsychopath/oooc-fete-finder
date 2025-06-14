"use client";

import { useState, useEffect, useCallback } from "react";
import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { VignetteAdProps } from "../types";
import { useVignetteAdStorage } from "../hooks/use-vignette-ad-storage";
import { useScrollVisibility } from "@/hooks/useScrollVisibility";
import { VIGNETTE_AD_CONFIG } from "../config";

export function VignetteAd({
	whatsappUrl = VIGNETTE_AD_CONFIG.WHATSAPP_URL,
	delayAfterChatClick = VIGNETTE_AD_CONFIG.DELAYS.AFTER_CHAT_CLICK,
	delayAfterDismiss = VIGNETTE_AD_CONFIG.DELAYS.AFTER_DISMISS,
	scrollHideThreshold = VIGNETTE_AD_CONFIG.SCROLL.HIDE_THRESHOLD_PERCENTAGE,
	className = "",
}: VignetteAdProps = {}) {
	const [isAnimating, setIsAnimating] = useState(false);

	// Storage logic: check if user has dismissed/clicked recently
	const { shouldShow, markChatClicked, markDismissed } = useVignetteAdStorage({
		delayAfterChatClick,
		delayAfterDismiss,
	});

	// Scroll logic: check if within visible scroll area
	const { isVisible: isInScrollArea } = useScrollVisibility({
		threshold: scrollHideThreshold,
		mode: "hide-after",
		initiallyVisible: true,
	});

	// INVARIANTS:
	// Show ad IF: within visible scroll area AND localStorage permits it
	// Hide ad IF: outside scroll range (regardless of localStorage)
	const shouldBeVisible = isInScrollArea && shouldShow;

	useEffect(() => {
		if (shouldBeVisible) {
			// Show with animation delay
			const timer = setTimeout(() => setIsAnimating(true), 100);
			return () => clearTimeout(timer);
		} else {
			// Hide immediately
			setIsAnimating(false);
		}
	}, [shouldBeVisible]);

	const handleChatClick = useCallback((): void => {
		markChatClicked();
		window.open(whatsappUrl, "_blank", "noopener,noreferrer");
	}, [markChatClicked, whatsappUrl]);

	const handleDismiss = useCallback((): void => {
		markDismissed();
	}, [markDismissed]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent): void => {
			if (e.key === "Escape") {
				e.preventDefault();
				handleDismiss();
			}
		},
		[handleDismiss],
	);

	// Don't render if storage logic says don't show
	if (!shouldShow) return null;

	return (
		<div
			className={`fixed pointer-events-none ${className}`}
			style={{
				bottom: VIGNETTE_AD_CONFIG.UI.EDGE_OFFSET,
				right: VIGNETTE_AD_CONFIG.UI.EDGE_OFFSET,
				zIndex: VIGNETTE_AD_CONFIG.UI.Z_INDEX,
			}}
			role="complementary"
			aria-label="Community invitation"
			onKeyDown={handleKeyDown}
			tabIndex={-1}
		>
			{/* Optimally sized container for professional appearance */}
			<div className="flex justify-end">
				<Card
					className={`
            w-[320px] max-w-[calc(100vw-2.5rem)]
            sm:w-[300px]
            bg-card/98 backdrop-blur-md
            border border-border/60
            shadow-xl shadow-black/5
            ring-1 ring-black/5
            transition-all duration-500 ease-out
            touch-manipulation
            ${
							shouldBeVisible && isAnimating
								? "translate-y-0 opacity-100 scale-100 pointer-events-auto"
								: "translate-y-4 opacity-0 scale-95 pointer-events-none"
						}
          `}
					style={{
						// Enhanced shadow for depth with smooth transition
						boxShadow:
							shouldBeVisible && isAnimating
								? "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
								: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
						transitionTimingFunction:
							shouldBeVisible && isAnimating
								? "cubic-bezier(0.16, 1, 0.3, 1)" // Smooth ease-out for entry
								: "cubic-bezier(0.7, 0, 0.84, 0)", // Smooth ease-in for exit
					}}
				>
					<div className="p-5 space-y-4">
						{/* Header with improved spacing and visual hierarchy */}
						<div className="flex items-start justify-between gap-3">
							<div className="flex items-center gap-2.5 min-w-0 flex-1">
								<div className="flex-shrink-0 p-1.5 bg-green-50 dark:bg-green-950/50 rounded-lg">
									<MessageCircle className="h-4 w-4 text-green-600 dark:text-green-500" />
								</div>
								<h3 className="text-sm font-semibold text-foreground leading-tight truncate">
									{VIGNETTE_AD_CONFIG.CONTENT.TITLE}
								</h3>
							</div>
							<Button
								onClick={handleDismiss}
								variant="ghost"
								size="sm"
								className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md flex-shrink-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
								aria-label="Close community invitation"
							>
								<X className="h-4 w-4" />
							</Button>
						</div>

						{/* Content with improved typography and spacing */}
						<div className="space-y-1">
							<p className="text-sm text-muted-foreground leading-5 tracking-[0.01em]">
								{VIGNETTE_AD_CONFIG.CONTENT.DESCRIPTION}
							</p>
						</div>

						{/* CTA Button with enhanced design */}
						<Button
							onClick={handleChatClick}
							className="w-full h-10 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-medium shadow-sm hover:shadow-md transition-all duration-200 focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
							aria-describedby="vignette-ad-description"
						>
							<MessageCircle className="h-4 w-4 mr-2.5" />
							{VIGNETTE_AD_CONFIG.CONTENT.CTA_TEXT}
						</Button>
					</div>
				</Card>
			</div>

			{/* Hidden description for screen readers */}
			<div id="vignette-ad-description" className="sr-only">
				Opens WhatsApp community chat in a new tab
			</div>
		</div>
	);
}
