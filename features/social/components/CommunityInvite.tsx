"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useHasActiveBodyOverlay } from "@/hooks/useHasActiveBodyOverlay";
import { useScrollVisibility } from "@/hooks/useScrollVisibility";
import { LAYERS } from "@/lib/ui/layers";
import { MessageCircle, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { COMMUNITY_INVITE_CONFIG } from "../config";
import { useCommunityInviteStorage } from "../hooks/use-community-invite-storage";
import type { CommunityInviteProps } from "../types";

export function CommunityInvite({
	whatsappUrl = COMMUNITY_INVITE_CONFIG.WHATSAPP_URL,
	delayAfterChatClick = COMMUNITY_INVITE_CONFIG.DELAYS.AFTER_CHAT_CLICK,
	delayAfterDismiss = COMMUNITY_INVITE_CONFIG.DELAYS.AFTER_DISMISS,
	scrollHideThreshold = COMMUNITY_INVITE_CONFIG.SCROLL
		.HIDE_THRESHOLD_PERCENTAGE,
	className = "",
}: CommunityInviteProps = {}) {
	const [isAnimating, setIsAnimating] = useState(false);
	const hasActiveOverlay = useHasActiveBodyOverlay();
	const { shouldShow, markChatClicked, markDismissed } =
		useCommunityInviteStorage({
			delayAfterChatClick,
			delayAfterDismiss,
		});
	const { isVisible: isInScrollArea } = useScrollVisibility({
		threshold: scrollHideThreshold,
		mode: "hide-after",
		initiallyVisible: true,
	});

	const shouldBeVisible = isInScrollArea && shouldShow && !hasActiveOverlay;

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

	const { CONTENT } = COMMUNITY_INVITE_CONFIG;

	return (
		<div
			className={`fixed bottom-24 right-5 pointer-events-none lg:bottom-5 ${className}`}
			style={{
				zIndex: LAYERS.FLOATING_PROMPT,
			}}
			role="complementary"
			aria-label="Community invitation"
			onKeyDown={handleKeyDown}
			tabIndex={-1}
		>
			<div className="flex justify-end">
				<Card
					className={`
            w-[328px] max-w-[calc(100vw-2.5rem)] sm:w-[312px]
            overflow-hidden rounded-2xl border backdrop-blur-[9px]
            [border-color:color-mix(in_oklab,var(--border)_84%,rgba(23,16,11,0.14))]
            [background:linear-gradient(145deg,rgba(255,255,255,0.56)_10%,rgba(255,255,255,0)_65%),color-mix(in_oklab,var(--card)_90%,rgba(250,246,239,0.3))]
            [box-shadow:0_20px_40px_-28px_rgba(20,14,10,0.6),0_1px_0_rgba(255,255,255,0.42)_inset]
            dark:[border-color:color-mix(in_oklab,var(--border)_84%,rgba(255,255,255,0.12))]
            dark:[background:linear-gradient(145deg,rgba(255,255,255,0.14)_10%,rgba(255,255,255,0)_65%),color-mix(in_oklab,var(--card)_91%,rgba(17,13,10,0.4))]
            dark:[box-shadow:0_22px_40px_-30px_rgba(0,0,0,0.78),0_1px_0_rgba(255,255,255,0.08)_inset]
            transition-all duration-500 ease-out touch-manipulation
            ${
							shouldBeVisible && isAnimating
								? "translate-y-0 opacity-100 scale-100 pointer-events-auto"
								: "translate-y-4 opacity-0 scale-95 pointer-events-none"
						}
          `}
					style={{
						transitionTimingFunction:
							shouldBeVisible && isAnimating
								? "cubic-bezier(0.16, 1, 0.3, 1)"
								: "cubic-bezier(0.7, 0, 0.84, 0)",
					}}
				>
					<div className="space-y-4 p-5">
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0 flex-1">
								<p className="mb-2 text-[0.64rem] uppercase tracking-[0.22em] text-muted-foreground/85">
									Out Of Office Collective
								</p>
								<div className="flex items-center gap-2">
									<div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/72">
										<MessageCircle className="h-4 w-4 text-foreground/88" />
									</div>
									<h3 className="text-[1.25rem] leading-none [font-family:var(--ooo-font-display)] font-light tracking-[0.02em] text-foreground">
										{CONTENT.TITLE}
									</h3>
								</div>
							</div>
							<Button
								onClick={handleDismiss}
								variant="ghost"
								size="sm"
								className="mt-0.5 size-8 shrink-0 rounded-full border border-border/55 bg-background/65 p-0 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
								aria-label="Close community invitation"
							>
								<X className="h-3.5 w-3.5" />
							</Button>
						</div>
						<p className="text-sm leading-relaxed text-muted-foreground">
							{CONTENT.DESCRIPTION}
						</p>
						<Button
							onClick={handleChatClick}
							className="h-9 w-full rounded-full border border-border/70 bg-primary text-primary-foreground hover:bg-primary/90"
							aria-describedby="community-invite-description"
						>
							<MessageCircle className="mr-1.5 h-3.5 w-3.5" />
							{CONTENT.CTA_TEXT}
						</Button>
						<p className="text-[11px] tracking-[0.04em] text-muted-foreground/85">
							Opens in WhatsApp
						</p>
					</div>
				</Card>
			</div>
			<div id="community-invite-description" className="sr-only">
				Opens WhatsApp community chat in a new tab
			</div>
		</div>
	);
}
