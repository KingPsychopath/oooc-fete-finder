"use client";

import { Button } from "@/components/ui/button";
import { useAppHaptics } from "@/hooks/useAppHaptics";
import { LAYERS } from "@/lib/ui/layers";
import {
	OVERLAY_BODY_ATTRIBUTE,
	setBodyOverlayAttribute,
} from "@/lib/ui/overlay-state";
import { cn } from "@/lib/utils";
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface PlanRouteTourProps {
	isOpen: boolean;
	onClose: () => void;
	onComplete?: () => void;
	onSkip?: () => void;
}

interface TourStep {
	id: string;
	selector: string;
	title: string;
	body: string;
	preferredSide: "top" | "right" | "bottom" | "left";
}

interface SpotlightRect {
	top: number;
	left: number;
	width: number;
	height: number;
}

interface BackdropPanel {
	top: number;
	left: number;
	width: number;
	height: number;
}

const findTarget = (selector: string): Element | null => {
	if (typeof document === "undefined") return null;
	return (
		Array.from(document.querySelectorAll(selector)).find((target) => {
			const rect = target.getBoundingClientRect();
			const style = window.getComputedStyle(target);
			return (
				style.display !== "none" &&
				style.visibility !== "hidden" &&
				rect.width > 0 &&
				rect.height > 0
			);
		}) ?? null
	);
};

const getSpotlightRect = (target: Element): SpotlightRect => {
	const rect = target.getBoundingClientRect();
	const margin = window.matchMedia("(max-width: 767px)").matches ? 8 : 10;
	const viewportWidth = window.innerWidth;
	const viewportHeight = window.innerHeight;
	const left = Math.max(8, rect.left - margin);
	const top = Math.max(8, rect.top - margin);
	const right = Math.min(viewportWidth - 8, rect.right + margin);
	const bottom = Math.min(viewportHeight - 8, rect.bottom + margin);

	return {
		top,
		left,
		width: Math.max(44, right - left),
		height: Math.max(44, bottom - top),
	};
};

const getCardPosition = (
	rect: SpotlightRect,
	side: TourStep["preferredSide"],
): { top: number; left: number; placement: TourStep["preferredSide"] } => {
	const gap = 14;
	const cardWidth = Math.min(360, window.innerWidth - 32);
	const cardHeight = 230;
	const viewportWidth = window.innerWidth;
	const viewportHeight = window.innerHeight;
	const sideCandidates: TourStep["preferredSide"][] = [
		side,
		"right",
		"left",
		"bottom",
		"top",
	];
	const uniqueCandidates = Array.from(new Set(sideCandidates));

	for (const candidate of uniqueCandidates) {
		let top = rect.top;
		let left = rect.left;

		if (candidate === "bottom") {
			top = rect.top + rect.height + gap;
			left = rect.left + rect.width / 2 - cardWidth / 2;
		}
		if (candidate === "top") {
			top = rect.top - cardHeight - gap;
			left = rect.left + rect.width / 2 - cardWidth / 2;
		}
		if (candidate === "right") {
			top = rect.top + rect.height / 2 - cardHeight / 2;
			left = rect.left + rect.width + gap;
		}
		if (candidate === "left") {
			top = rect.top + rect.height / 2 - cardHeight / 2;
			left = rect.left - cardWidth - gap;
		}

		const clampedTop = Math.min(
			Math.max(16, top),
			Math.max(16, viewportHeight - cardHeight - 16),
		);
		const clampedLeft = Math.min(
			Math.max(16, left),
			Math.max(16, viewportWidth - cardWidth - 16),
		);
		const fitsVertically =
			candidate === "top"
				? rect.top - gap >= cardHeight
				: candidate === "bottom"
					? viewportHeight - (rect.top + rect.height + gap) >= cardHeight
					: true;
		const fitsHorizontally =
			candidate === "left"
				? rect.left - gap >= cardWidth
				: candidate === "right"
					? viewportWidth - (rect.left + rect.width + gap) >= cardWidth
					: true;

		if (fitsVertically && fitsHorizontally) {
			return { top: clampedTop, left: clampedLeft, placement: candidate };
		}
	}

	return {
		top: Math.max(16, viewportHeight - cardHeight - 20),
		left: Math.max(16, (viewportWidth - cardWidth) / 2),
		placement: "bottom",
	};
};

const getBackdropPanels = (rect: SpotlightRect): BackdropPanel[] => {
	const viewportWidth = window.innerWidth;
	const viewportHeight = window.innerHeight;
	const right = rect.left + rect.width;
	const bottom = rect.top + rect.height;

	return [
		{
			top: 0,
			left: 0,
			width: viewportWidth,
			height: rect.top,
		},
		{
			top: bottom,
			left: 0,
			width: viewportWidth,
			height: Math.max(0, viewportHeight - bottom),
		},
		{
			top: rect.top,
			left: 0,
			width: rect.left,
			height: rect.height,
		},
		{
			top: rect.top,
			left: right,
			width: Math.max(0, viewportWidth - right),
			height: rect.height,
		},
	].filter((panel) => panel.width > 0 && panel.height > 0);
};

export function PlanRouteTour({
	isOpen,
	onClose,
	onComplete,
	onSkip,
}: PlanRouteTourProps) {
	const haptics = useAppHaptics();
	const cardRef = useRef<HTMLDivElement>(null);
	const [mounted, setMounted] = useState(false);
	const [stepIndex, setStepIndex] = useState(0);
	const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(
		null,
	);
	const steps = useMemo<TourStep[]>(
		() => [
			{
				id: "settings",
				selector: "#plans-route-settings",
				title: "Set the mood",
				body: "Choose the day, stop count, vibe, when you're stepping, travel style and budget. Fête Finder uses the choices you make.",
				preferredSide: "right",
			},
			{
				id: "line",
				selector: "#plans-route-line",
				title: "Tune the route",
				body: "Suggest a route, add saved events, then drag, pin or remove stops. Tap a stop time to tweak arrival; pinned stops stay put when you regenerate.",
				preferredSide: "right",
			},
			{
				id: "routes",
				selector: "#plans-saved-routes",
				title: "Saved routes",
				body: "Open a route whenever you want to keep editing. New route starts a separate plan for the selected day.",
				preferredSide: "right",
			},
		],
		[],
	);
	const currentStep = steps[stepIndex];

	const syncSpotlight = useCallback(() => {
		if (!currentStep) return false;
		const target = findTarget(currentStep.selector);
		if (!target) return false;
		setSpotlightRect(getSpotlightRect(target));
		return true;
	}, [currentStep]);

	const syncSpotlightWhileLayoutSettles = useCallback(
		(durationMs = 900) => {
			let isCancelled = false;
			let frameId = 0;
			const startedAt = performance.now();

			const tick = () => {
				if (isCancelled) return;
				syncSpotlight();
				if (performance.now() - startedAt < durationMs) {
					frameId = window.requestAnimationFrame(tick);
				}
			};

			frameId = window.requestAnimationFrame(tick);

			return () => {
				isCancelled = true;
				window.cancelAnimationFrame(frameId);
			};
		},
		[syncSpotlight],
	);

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		setBodyOverlayAttribute(OVERLAY_BODY_ATTRIBUTE.FETE_FINDER_TOUR, isOpen);
		return () => {
			setBodyOverlayAttribute(OVERLAY_BODY_ATTRIBUTE.FETE_FINDER_TOUR, false);
		};
	}, [isOpen]);

	useEffect(() => {
		if (!isOpen) return;
		let cancelSettledSync: (() => void) | undefined;
		const target = findTarget(currentStep.selector);
		if (!target) return;
		target.scrollIntoView({ block: "center", behavior: "smooth" });
		const timer = window.setTimeout(() => {
			syncSpotlight();
			cancelSettledSync = syncSpotlightWhileLayoutSettles();
		}, 180);
		window.requestAnimationFrame(() => cardRef.current?.focus());
		return () => {
			window.clearTimeout(timer);
			cancelSettledSync?.();
		};
	}, [
		currentStep.selector,
		isOpen,
		syncSpotlight,
		syncSpotlightWhileLayoutSettles,
	]);

	useEffect(() => {
		if (!isOpen) return;
		const closeAsSkipped = () => {
			onSkip?.();
			onClose();
		};
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") closeAsSkipped();
			if (event.key === "ArrowRight") {
				setStepIndex((index) => Math.min(index + 1, steps.length - 1));
			}
			if (event.key === "ArrowLeft") {
				setStepIndex((index) => Math.max(index - 1, 0));
			}
		};
		const handleViewportChange = () => syncSpotlight();
		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("resize", handleViewportChange);
		window.addEventListener("scroll", handleViewportChange, { passive: true });
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("resize", handleViewportChange);
			window.removeEventListener("scroll", handleViewportChange);
		};
	}, [isOpen, onClose, onSkip, steps.length, syncSpotlight]);

	const closeAsSkipped = () => {
		onSkip?.();
		onClose();
	};

	if (!mounted || !isOpen || !currentStep || !spotlightRect) return null;

	const position = getCardPosition(spotlightRect, currentStep.preferredSide);
	const backdropPanels = getBackdropPanels(spotlightRect);
	const isLastStep = stepIndex === steps.length - 1;

	return createPortal(
		<div
			data-tour-backdrop="true"
			className="fixed inset-0"
			style={{ zIndex: LAYERS.SYSTEM_TOAST - 1 }}
			role="dialog"
			aria-modal="true"
			aria-labelledby="plans-tour-title"
		>
			{backdropPanels.map((panel) => (
				<div
					key={`${panel.top}-${panel.left}-${panel.width}-${panel.height}`}
					className="pointer-events-none fixed bg-black/45 backdrop-blur-[2px]"
					style={{
						top: panel.top,
						left: panel.left,
						width: panel.width,
						height: panel.height,
					}}
				/>
			))}
			<div
				data-tour-spotlight="true"
				className="pointer-events-none fixed rounded-[20px] border-2 border-white bg-transparent shadow-[0_0_0_1px_rgba(0,0,0,0.2),0_18px_54px_-34px_rgba(0,0,0,0.7)]"
				style={{
					top: spotlightRect.top,
					left: spotlightRect.left,
					width: spotlightRect.width,
					height: spotlightRect.height,
				}}
			/>
			<div
				ref={cardRef}
				tabIndex={-1}
				className={cn(
					"fixed w-[min(22.5rem,calc(100vw-2rem))] rounded-2xl border border-border/80 bg-card/98 p-4 shadow-[0_24px_72px_-38px_rgba(0,0,0,0.9)] outline-none backdrop-blur-xl transition-all duration-200",
					position.placement === "top" && "animate-in slide-in-from-bottom-1",
					position.placement === "bottom" && "animate-in slide-in-from-top-1",
					position.placement === "left" && "animate-in slide-in-from-right-1",
					position.placement === "right" && "animate-in slide-in-from-left-1",
				)}
				style={{
					top: position.top,
					left: position.left,
				}}
			>
				<div className="flex items-start justify-between gap-3">
					<div>
						<p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
							Step {stepIndex + 1} of {steps.length}
						</p>
						<h2
							id="plans-tour-title"
							className="mt-1 text-xl [font-family:var(--ooo-font-display)] font-light"
						>
							{currentStep.title}
						</h2>
					</div>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						onClick={closeAsSkipped}
						className="h-8 w-8 rounded-full"
						aria-label="Close plan tour"
					>
						<X className="h-4 w-4" />
					</Button>
				</div>
				<p className="mt-2 text-sm leading-6 text-muted-foreground">
					{currentStep.body}
				</p>
				<div className="mt-4 flex items-center justify-between gap-3">
					<div className="flex gap-1.5" aria-hidden="true">
						{steps.map((step, index) => (
							<span
								key={step.id}
								className={cn(
									"h-1.5 rounded-full transition-all",
									index === stepIndex
										? "w-6 bg-primary"
										: "w-1.5 bg-muted-foreground/32",
								)}
							/>
						))}
					</div>
					<div className="flex items-center gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => {
								haptics.light();
								setStepIndex((index) => Math.max(index - 1, 0));
							}}
							disabled={stepIndex === 0}
							className="h-8 rounded-full px-3"
						>
							<ChevronLeft className="h-3.5 w-3.5" />
							<span className="sr-only">Previous step</span>
						</Button>
						<Button
							type="button"
							size="sm"
							onClick={() => {
								if (isLastStep) {
									haptics.success();
									onComplete?.();
									onClose();
									return;
								}
								haptics.nudge();
								setStepIndex((index) => Math.min(index + 1, steps.length - 1));
							}}
							className="h-8 rounded-full px-3"
						>
							{isLastStep ? (
								<>
									<Check className="mr-1.5 h-3.5 w-3.5" />
									Done
								</>
							) : (
								<>
									Next
									<ChevronRight className="ml-1.5 h-3.5 w-3.5" />
								</>
							)}
						</Button>
					</div>
				</div>
			</div>
		</div>,
		document.body,
	);
}
