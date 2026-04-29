"use client";

import { useFloatingPromptSlot } from "@/hooks/useFloatingPromptSlot";
import { useHasActiveBodyOverlay } from "@/hooks/useHasActiveBodyOverlay";
import { useScrollVisibility } from "@/hooks/useScrollVisibility";
import { LAYERS } from "@/lib/ui/layers";
import { Coffee } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface CoffeePromptState {
	dismissedAt?: number;
	dismissCount?: number;
	supportedAt?: number;
}

const STORAGE_KEY = "oooc_coffee_prompt_state";
const INITIAL_DELAY_MS = 75_000;
const REAPPEAR_AFTER_SUPPORT_MS = 120 * 24 * 60 * 60 * 1000;
const DISMISSAL_BACKOFF_MS = [
	5 * 24 * 60 * 60 * 1000,
	14 * 24 * 60 * 60 * 1000,
	45 * 24 * 60 * 60 * 1000,
] as const;
const PROMPT_PRIORITY = 10;

function isCoffeePromptState(value: unknown): value is CoffeePromptState {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	const parsed = value as Record<string, unknown>;
	const hasValidDismissedAt =
		!("dismissedAt" in parsed) || typeof parsed.dismissedAt === "number";
	const hasValidDismissCount =
		!("dismissCount" in parsed) || typeof parsed.dismissCount === "number";
	const hasValidSupportedAt =
		!("supportedAt" in parsed) || typeof parsed.supportedAt === "number";

	return hasValidDismissedAt && hasValidDismissCount && hasValidSupportedAt;
}

function readPromptState(): CoffeePromptState {
	if (typeof window === "undefined") {
		return {};
	}

	const raw = window.localStorage.getItem(STORAGE_KEY);
	if (!raw) {
		return {};
	}

	try {
		const parsed: unknown = JSON.parse(raw);
		return isCoffeePromptState(parsed) ? parsed : {};
	} catch {
		return {};
	}
}

function savePromptState(state: CoffeePromptState): void {
	if (typeof window === "undefined") {
		return;
	}

	window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function isPromptAllowed(now = Date.now()): boolean {
	const { dismissedAt, dismissCount, supportedAt } = readPromptState();

	if (
		typeof supportedAt === "number" &&
		now - supportedAt < REAPPEAR_AFTER_SUPPORT_MS
	) {
		return false;
	}

	if (typeof dismissedAt === "number") {
		const normalizedDismissCount = Math.max(1, Math.floor(dismissCount ?? 1));
		const backoffIndex = Math.min(
			normalizedDismissCount - 1,
			DISMISSAL_BACKOFF_MS.length - 1,
		);
		const backoffMs = DISMISSAL_BACKOFF_MS[backoffIndex];

		if (now - dismissedAt < backoffMs) {
			return false;
		}
	}

	return true;
}

export function SupportCoffeePrompt() {
	const [isDelayComplete, setIsDelayComplete] = useState(false);
	const [isAllowed, setIsAllowed] = useState(false);
	const pathname = usePathname();
	const hasActiveOverlay = useHasActiveBodyOverlay();
	const { isVisible: isEngagedByScroll } = useScrollVisibility({
		threshold: 8,
		mode: "show-after",
		initiallyVisible: false,
	});
	const isRequestingSlot =
		isAllowed && isDelayComplete && isEngagedByScroll && !hasActiveOverlay;
	const hasPromptSlot = useFloatingPromptSlot(
		"support-coffee",
		isRequestingSlot,
		PROMPT_PRIORITY,
	);

	useEffect(() => {
		setIsAllowed(isPromptAllowed());

		const timer = window.setTimeout(() => {
			setIsDelayComplete(true);
		}, INITIAL_DELAY_MS);

		return () => window.clearTimeout(timer);
	}, []);

	const handleDismiss = useCallback(() => {
		const currentState = readPromptState();
		const previousDismissCount =
			currentState.dismissCount ??
			(typeof currentState.dismissedAt === "number" ? 1 : 0);
		savePromptState({
			...currentState,
			dismissedAt: Date.now(),
			dismissCount: previousDismissCount + 1,
		});
		setIsAllowed(false);
	}, []);

	const handleSupportClick = useCallback(() => {
		const currentState = readPromptState();
		savePromptState({
			...currentState,
			supportedAt: Date.now(),
		});
		setIsAllowed(false);
	}, []);

	if (
		!isAllowed ||
		pathname?.startsWith("/social/") ||
		!isDelayComplete ||
		!isEngagedByScroll ||
		hasActiveOverlay ||
		!hasPromptSlot
	) {
		return null;
	}

	return (
		<div
			className="fixed bottom-5 left-5 max-w-[min(22rem,calc(100vw-2.5rem))]"
			style={{ zIndex: LAYERS.FLOATING_PROMPT }}
		>
			<div className="rounded-lg border border-border/65 bg-card/95 px-3.5 py-3 text-xs shadow-lg backdrop-blur-md">
				<p className="text-muted-foreground">
					Enjoying Fete Finder? If it helped, you can support updates with a
					coffee.
				</p>
				<div className="mt-2 flex items-center gap-3">
					<Link
						href="https://coff.ee/milkandhenny"
						target="_blank"
						rel="noopener noreferrer"
						onClick={handleSupportClick}
						className="inline-flex items-center gap-1 rounded-sm font-medium text-foreground underline-offset-4 transition-colors hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
						title="Support future updates"
					>
						<Coffee className="h-3 w-3" />
						<span>Buy a coffee</span>
					</Link>
					<button
						type="button"
						onClick={handleDismiss}
						className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
					>
						Maybe later
					</button>
				</div>
			</div>
		</div>
	);
}
