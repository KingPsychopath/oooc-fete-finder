"use client";

import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";

interface SlidingBannerProps {
	messages: string[];
	messageDurationMs?: number;
	desktopMessageCount?: 1 | 2;
	className?: string;
}

const DEFAULT_MESSAGE_DURATION_MS = 4200;
const MIN_MESSAGE_DURATION_MS = 1800;
const MAX_MESSAGE_DURATION_MS = 12000;
const SLIDE_TRANSITION_MS = 560;

const clamp = (value: number, min: number, max: number): number =>
	Math.max(min, Math.min(max, value));

const normalizeNumber = (
	value: number | undefined,
	fallback: number,
	min: number,
	max: number,
): number => {
	if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
	return clamp(Math.round(value), min, max);
};

const normalizeMessages = (messages: string[]): string[] => {
	return messages
		.map((message) => message.replace(/\s+/g, " ").trim())
		.filter((message) => message.length > 0);
};

const SlidingBanner = ({
	messages,
	messageDurationMs = DEFAULT_MESSAGE_DURATION_MS,
	desktopMessageCount = 2,
	className,
}: SlidingBannerProps) => {
	const [activeIndex, setActiveIndex] = useState(0);
	const [isSliding, setIsSliding] = useState(false);

	const normalizedMessages = useMemo(
		() => normalizeMessages(messages),
		[messages],
	);
	const normalizedDurationMs = normalizeNumber(
		messageDurationMs,
		DEFAULT_MESSAGE_DURATION_MS,
		MIN_MESSAGE_DURATION_MS,
		MAX_MESSAGE_DURATION_MS,
	);
	const normalizedDesktopMessageCount = desktopMessageCount === 1 ? 1 : 2;

	useEffect(() => {
		setActiveIndex((current) =>
			normalizedMessages.length > 0 ? current % normalizedMessages.length : 0,
		);
		setIsSliding(false);
	}, [normalizedMessages.length]);

	useEffect(() => {
		if (normalizedMessages.length <= 1 || isSliding) return;

		const timer = window.setTimeout(() => {
			setIsSliding(true);
		}, normalizedDurationMs);

		return () => window.clearTimeout(timer);
	}, [isSliding, normalizedDurationMs, normalizedMessages.length]);

	if (normalizedMessages.length === 0) {
		return null;
	}

	const currentIndex = activeIndex;
	const nextIndex = (activeIndex + 1) % normalizedMessages.length;
	const currentPrimaryMessage = normalizedMessages[currentIndex];
	const currentSecondaryMessage =
		normalizedMessages[(currentIndex + 1) % normalizedMessages.length];
	const nextPrimaryMessage = normalizedMessages[nextIndex];
	const nextSecondaryMessage =
		normalizedMessages[(nextIndex + 1) % normalizedMessages.length];

	const showSecondary =
		normalizedDesktopMessageCount === 2 && normalizedMessages.length > 1;

	const handleTransitionEnd = () => {
		if (!isSliding) return;
		setActiveIndex((current) => (current + 1) % normalizedMessages.length);
		setIsSliding(false);
	};

	const renderMessageFrame = (
		primaryMessage: string,
		secondaryMessage: string,
	) => (
		<div
			className={cn(
				"grid w-1/2 min-h-9 grid-cols-1",
				showSecondary && "md:grid-cols-2",
			)}
		>
			<div className="px-4 py-2 text-xs font-medium tracking-[0.08em] text-foreground/85">
				<p className="truncate" title={primaryMessage}>
					{primaryMessage}
				</p>
			</div>
			{showSecondary && (
				<div className="hidden border-l border-white/20 px-4 py-2 text-xs font-medium tracking-[0.08em] text-foreground/70 md:block dark:border-white/10">
					<p className="truncate" title={secondaryMessage}>
						{secondaryMessage}
					</p>
				</div>
			)}
		</div>
	);

	return (
		<div
			className={cn(
				"relative overflow-hidden border-b border-white/20 bg-gradient-to-r from-white/10 via-white/5 to-white/10 shadow-sm backdrop-blur-sm dark:border-white/10 dark:from-white/5 dark:via-white/2 dark:to-white/5",
				className,
			)}
		>
			<div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
			<div className="relative overflow-hidden">
				<div
					className={cn(
						"flex w-[200%]",
						normalizedMessages.length > 1 &&
							"transition-transform ease-[cubic-bezier(0.22,0.61,0.36,1)] motion-reduce:transition-none",
					)}
					style={{
						transform: isSliding ? "translateX(-50%)" : "translateX(0%)",
						transitionDuration:
							normalizedMessages.length > 1
								? `${SLIDE_TRANSITION_MS}ms`
								: "0ms",
					}}
					onTransitionEnd={handleTransitionEnd}
				>
					{renderMessageFrame(currentPrimaryMessage, currentSecondaryMessage)}
					{renderMessageFrame(nextPrimaryMessage, nextSecondaryMessage)}
				</div>
			</div>
		</div>
	);
};

export default SlidingBanner;
