"use client";

import { useScrollVisibility } from "@/hooks/useScrollVisibility";
import { Coffee } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface CoffeePromptState {
	dismissedAt?: number;
	supportedAt?: number;
}

const STORAGE_KEY = "oooc_coffee_prompt_state";
const INITIAL_DELAY_MS = 75_000;
const REAPPEAR_AFTER_DISMISS_MS = 5 * 24 * 60 * 60 * 1000;
const REAPPEAR_AFTER_SUPPORT_MS = 120 * 24 * 60 * 60 * 1000;

function isCoffeePromptState(value: unknown): value is CoffeePromptState {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	const parsed = value as Record<string, unknown>;
	const hasValidDismissedAt =
		!("dismissedAt" in parsed) || typeof parsed.dismissedAt === "number";
	const hasValidSupportedAt =
		!("supportedAt" in parsed) || typeof parsed.supportedAt === "number";

	return hasValidDismissedAt && hasValidSupportedAt;
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
	const { dismissedAt, supportedAt } = readPromptState();

	if (
		typeof supportedAt === "number" &&
		now - supportedAt < REAPPEAR_AFTER_SUPPORT_MS
	) {
		return false;
	}

	if (
		typeof dismissedAt === "number" &&
		now - dismissedAt < REAPPEAR_AFTER_DISMISS_MS
	) {
		return false;
	}

	return true;
}

export function SupportCoffeePrompt() {
	const [isDelayComplete, setIsDelayComplete] = useState(false);
	const [isAllowed, setIsAllowed] = useState(false);
	const { isVisible: isEngagedByScroll } = useScrollVisibility({
		threshold: 8,
		mode: "show-after",
		initiallyVisible: false,
	});

	useEffect(() => {
		setIsAllowed(isPromptAllowed());

		const timer = window.setTimeout(() => {
			setIsDelayComplete(true);
		}, INITIAL_DELAY_MS);

		return () => window.clearTimeout(timer);
	}, []);

	const handleDismiss = useCallback(() => {
		const currentState = readPromptState();
		savePromptState({
			...currentState,
			dismissedAt: Date.now(),
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

	if (!isAllowed || !isDelayComplete || !isEngagedByScroll) {
		return null;
	}

	return (
		<div className="mt-2 max-w-sm rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-xs">
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
	);
}
