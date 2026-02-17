"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useScrollVisibility } from "@/hooks/useScrollVisibility";
import { MessageCircle, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { COMMUNITY_INVITE_CONFIG } from "../config";
import { useCommunityInviteStorage } from "../hooks/use-community-invite-storage";
import type { CommunityInviteProps } from "../types";

export function CommunityInvite({
	whatsappUrl = COMMUNITY_INVITE_CONFIG.WHATSAPP_URL,
	delayAfterChatClick = COMMUNITY_INVITE_CONFIG.DELAYS.AFTER_CHAT_CLICK,
	delayAfterDismiss = COMMUNITY_INVITE_CONFIG.DELAYS.AFTER_DISMISS,
	scrollHideThreshold = COMMUNITY_INVITE_CONFIG.SCROLL.HIDE_THRESHOLD_PERCENTAGE,
	className = "",
}: CommunityInviteProps = {}) {
	const [isAnimating, setIsAnimating] = useState(false);
	const { shouldShow, markChatClicked, markDismissed } = useCommunityInviteStorage({
		delayAfterChatClick,
		delayAfterDismiss,
	});
	const { isVisible: isInScrollArea } = useScrollVisibility({
		threshold: scrollHideThreshold,
		mode: "hide-after",
		initiallyVisible: true,
	});

	const shouldBeVisible = isInScrollArea && shouldShow;

	useEffect(() => {
		if (shouldBeVisible) {
			const timer = setTimeout(() => setIsAnimating(true), 100);
			return () => clearTimeout(timer);
		} else {
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

	if (!shouldShow) return null;

	const { UI, CONTENT } = COMMUNITY_INVITE_CONFIG;

	return (
		<div
			className={`fixed pointer-events-none ${className}`}
			style={{
				bottom: UI.EDGE_OFFSET,
				right: UI.EDGE_OFFSET,
				zIndex: UI.Z_INDEX,
			}}
			role="complementary"
			aria-label="Community invitation"
			onKeyDown={handleKeyDown}
			tabIndex={-1}
		>
			<div className="flex justify-end">
				<Card
					className={`
            w-[320px] max-w-[calc(100vw-2.5rem)] sm:w-[300px]
            bg-card/98 backdrop-blur-md border border-border/60
            shadow-xl shadow-black/5 ring-1 ring-black/5
            transition-all duration-500 ease-out touch-manipulation
            ${
							shouldBeVisible && isAnimating
								? "translate-y-0 opacity-100 scale-100 pointer-events-auto"
								: "translate-y-4 opacity-0 scale-95 pointer-events-none"
						}
          `}
					style={{
						boxShadow:
							shouldBeVisible && isAnimating
								? "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
								: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
						transitionTimingFunction:
							shouldBeVisible && isAnimating
								? "cubic-bezier(0.16, 1, 0.3, 1)"
								: "cubic-bezier(0.7, 0, 0.84, 0)",
					}}
				>
					<div className="p-5 space-y-4">
						<div className="flex items-start justify-between gap-3">
							<div className="flex items-center gap-2.5 min-w-0 flex-1">
								<div className="flex-shrink-0 p-1.5 bg-green-50 dark:bg-green-950/50 rounded-lg">
									<MessageCircle className="h-4 w-4 text-green-600 dark:text-green-500" />
								</div>
								<h3 className="text-sm font-semibold text-foreground leading-tight truncate">
									{CONTENT.TITLE}
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
						<div className="space-y-1">
							<p className="text-sm text-muted-foreground leading-5 tracking-[0.01em]">
								{CONTENT.DESCRIPTION}
							</p>
						</div>
						<Button
							onClick={handleChatClick}
							className="w-full h-10 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-medium shadow-sm hover:shadow-md transition-all duration-200 focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
							aria-describedby="community-invite-description"
						>
							<MessageCircle className="h-4 w-4 mr-2.5" />
							{CONTENT.CTA_TEXT}
						</Button>
					</div>
				</Card>
			</div>
			<div id="community-invite-description" className="sr-only">
				Opens WhatsApp community chat in a new tab
			</div>
		</div>
	);
}
