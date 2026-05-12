"use client";

import { Button } from "@/components/ui/button";
import { trackTourInteraction } from "@/features/events/engagement/client-tracking";
import {
	FETE_FINDER_TOUR_EVENT,
	FETE_FINDER_TOUR_STORAGE_KEY,
	PENDING_FETE_FINDER_TOUR_STORAGE_KEY,
} from "@/features/events/tour-events";
import { LAYERS } from "@/lib/ui/layers";
import {
	OVERLAY_BODY_ATTRIBUTE,
	setBodyOverlayAttribute,
} from "@/lib/ui/overlay-state";
import { cn } from "@/lib/utils";
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const TOUR_STATE_COMPLETED = "completed";
const TOUR_STATE_DISMISSED = "dismissed";
const TOUR_STATE_SKIPPED = "skipped";

interface TourStep {
	id: string;
	selector: string;
	title: string;
	body: string;
	preferredSide: "top" | "right" | "bottom" | "left";
	beforeStep?: () => void;
}

interface SpotlightRect {
	top: number;
	left: number;
	width: number;
	height: number;
}

interface FeteFinderTourProps {
	isAuthenticated: boolean;
	isAuthResolved: boolean;
	onAuthRequired: () => void;
	onFilterClose: () => void;
	onFilterOpen: () => void;
	onMapExpand: () => void;
	onScrollToAllEvents: () => void;
}

function readTourState(): string | null {
	try {
		return window.localStorage.getItem(FETE_FINDER_TOUR_STORAGE_KEY);
	} catch {
		return null;
	}
}

function writeTourState(state: string): void {
	try {
		window.localStorage.setItem(FETE_FINDER_TOUR_STORAGE_KEY, state);
	} catch {
		// The tour still works when storage is unavailable.
	}
}

function hasBlockingOverlay(): boolean {
	if (typeof document === "undefined") return false;
	return (
		document.body.hasAttribute(OVERLAY_BODY_ATTRIBUTE.EVENT_MODAL) ||
		document.body.hasAttribute(OVERLAY_BODY_ATTRIBUTE.FILTER_PANEL)
	);
}

function findVisibleTourTarget(selector: string): Element | null {
	if (typeof document === "undefined") return null;
	const targets = Array.from(document.querySelectorAll(selector));
	return (
		targets.find((target) => {
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
}

function trapTabKey(event: KeyboardEvent, dialog: HTMLElement | null): void {
	if (event.key !== "Tab" || !dialog) return;
	const focusableElements = Array.from(
		dialog.querySelectorAll<HTMLElement>(
			'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
		),
	);
	if (focusableElements.length === 0) return;

	const firstElement = focusableElements[0];
	const lastElement = focusableElements[focusableElements.length - 1];
	if (
		!document.activeElement ||
		document.activeElement === dialog ||
		!dialog.contains(document.activeElement)
	) {
		event.preventDefault();
		if (event.shiftKey) {
			lastElement?.focus();
			return;
		}
		firstElement?.focus();
		return;
	}
	if (event.shiftKey && document.activeElement === firstElement) {
		event.preventDefault();
		lastElement?.focus();
		return;
	}
	if (!event.shiftKey && document.activeElement === lastElement) {
		event.preventDefault();
		firstElement?.focus();
	}
}

function getSpotlightRect(element: Element): SpotlightRect {
	const rect = element.getBoundingClientRect();
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
}

function getCardPosition(
	rect: SpotlightRect,
	side: TourStep["preferredSide"],
): { top: number; left: number; placement: TourStep["preferredSide"] } {
	const gap = 14;
	const cardWidth = Math.min(360, window.innerWidth - 32);
	const cardHeight = 230;
	const viewportWidth = window.innerWidth;
	const viewportHeight = window.innerHeight;
	const sideCandidates: TourStep["preferredSide"][] = [
		side,
		"bottom",
		"top",
		"right",
		"left",
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
}

export function FeteFinderTour({
	isAuthenticated,
	isAuthResolved,
	onAuthRequired,
	onFilterClose,
	onFilterOpen,
	onMapExpand,
	onScrollToAllEvents,
}: FeteFinderTourProps) {
	const [isPromptOpen, setIsPromptOpen] = useState(false);
	const [isTourOpen, setIsTourOpen] = useState(false);
	const [stepIndex, setStepIndex] = useState(0);
	const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(
		null,
	);
	const [mounted, setMounted] = useState(false);
	const [hasPendingAuthTour, setHasPendingAuthTour] = useState(false);
	const [hasManualTourRequest, setHasManualTourRequest] = useState(false);
	const [hasPendingOverlayTour, setHasPendingOverlayTour] = useState(false);
	const promptRef = useRef<HTMLDivElement>(null);
	const tourCardRef = useRef<HTMLDivElement>(null);

	const steps = useMemo<TourStep[]>(
		() => [
			{
				id: "picks",
				selector: "#tour-oooc-picks",
				title: "Trust the curated picks",
				body: "OOOC Picks are the fastest route when you want the collective's favourites without overthinking the list.",
				preferredSide: "bottom",
			},
			{
				id: "map",
				selector: "#event-map",
				title: "Plan by movement",
				body: "Open the Paris map when location matters. It helps you build a night by arrondissement instead of zig-zagging across the city.",
				preferredSide: "top",
				beforeStep: onMapExpand,
			},
			{
				id: "filters",
				selector: "#tour-filter-rail, #tour-filter-panel, #tour-filter-button",
				title: "Shape the list",
				body: "Use the filter rail or open the filter drawer to narrow by time, price, arrondissement, venue setting, genre and OOOC Picks.",
				preferredSide: "top",
				beforeStep: onFilterOpen,
			},
			{
				id: "search",
				selector: "#tour-search",
				title: "Search the list",
				body: "Use the chips or type your own cue when you already know the day, price, sound, phase or event name you want.",
				preferredSide: "top",
				beforeStep: onScrollToAllEvents,
			},
			{
				id: "events",
				selector: "#tour-first-event-card",
				title: "Open the right event",
				body: "Cards lead to the practical details: time, address, price, share links, calendar saves and update requests.",
				preferredSide: "top",
				beforeStep: onScrollToAllEvents,
			},
		],
		[onFilterOpen, onMapExpand, onScrollToAllEvents],
	);

	const currentStep = steps[stepIndex];

	const syncSpotlight = useCallback(() => {
		if (!currentStep || typeof document === "undefined") return false;
		const target = findVisibleTourTarget(currentStep.selector);
		if (!target) return false;
		setSpotlightRect(getSpotlightRect(target));
		return true;
	}, [currentStep]);

	const moveToAvailableStep = useCallback(
		(nextIndex: number, direction: 1 | -1) => {
			const boundedIndex = Math.min(Math.max(nextIndex, 0), steps.length - 1);
			for (
				let index = boundedIndex;
				index >= 0 && index < steps.length;
				index += direction
			) {
				const target = findVisibleTourTarget(steps[index].selector);
				if (target) {
					setStepIndex(index);
					return;
				}
			}
			setStepIndex(boundedIndex);
		},
		[steps],
	);

	const startTour = useCallback(() => {
		if (hasBlockingOverlay()) {
			setHasPendingOverlayTour(true);
			setIsPromptOpen(false);
			return;
		}
		trackTourInteraction({ action: "start" });
		setIsPromptOpen(false);
		setIsTourOpen(true);
		setStepIndex(0);
	}, []);

	const dismissPrompt = useCallback(
		(source: string) => {
			trackTourInteraction({ action: "prompt_dismissed", source });
			writeTourState(TOUR_STATE_DISMISSED);
			onFilterClose();
			setHasPendingOverlayTour(false);
			setIsPromptOpen(false);
			setIsTourOpen(false);
			setSpotlightRect(null);
		},
		[onFilterClose],
	);

	const finishTour = useCallback(
		(state: string, source: string) => {
			trackTourInteraction({
				action: state === TOUR_STATE_COMPLETED ? "complete" : "skip",
				stepId: isTourOpen ? currentStep?.id : undefined,
				source,
			});
			writeTourState(state);
			onFilterClose();
			setHasPendingOverlayTour(false);
			setIsPromptOpen(false);
			setIsTourOpen(false);
			setSpotlightRect(null);
		},
		[currentStep?.id, isTourOpen, onFilterClose],
	);

	const handleExternalStart = useCallback(() => {
		setHasManualTourRequest(true);
		if (!isAuthenticated) {
			trackTourInteraction({ action: "auth_required", source: "manual" });
			setHasPendingAuthTour(true);
			onAuthRequired();
			return;
		}
		startTour();
	}, [isAuthenticated, onAuthRequired, startTour]);

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		const isOpen = isPromptOpen || isTourOpen;
		setBodyOverlayAttribute(OVERLAY_BODY_ATTRIBUTE.FETE_FINDER_TOUR, isOpen);
		return () => {
			setBodyOverlayAttribute(OVERLAY_BODY_ATTRIBUTE.FETE_FINDER_TOUR, false);
		};
	}, [isPromptOpen, isTourOpen]);

	useEffect(() => {
		if (!isPromptOpen && !isTourOpen) return;
		window.requestAnimationFrame(() => {
			if (isTourOpen) {
				tourCardRef.current?.focus();
				return;
			}
			promptRef.current?.focus();
		});
	}, [isPromptOpen, isTourOpen]);

	useEffect(() => {
		if (!isPromptOpen) return;
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") dismissPrompt("keyboard");
			trapTabKey(event, promptRef.current);
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [dismissPrompt, isPromptOpen]);

	useEffect(() => {
		if (!isAuthResolved) return;
		let hasPendingTour = false;
		try {
			hasPendingTour =
				window.sessionStorage.getItem(PENDING_FETE_FINDER_TOUR_STORAGE_KEY) ===
				"1";
			if (hasPendingTour) {
				window.sessionStorage.removeItem(PENDING_FETE_FINDER_TOUR_STORAGE_KEY);
			}
		} catch {
			hasPendingTour = false;
		}
		if (!hasPendingTour) return;
		handleExternalStart();
	}, [handleExternalStart, isAuthResolved]);

	useEffect(() => {
		window.addEventListener(FETE_FINDER_TOUR_EVENT, handleExternalStart);
		return () => {
			window.removeEventListener(FETE_FINDER_TOUR_EVENT, handleExternalStart);
		};
	}, [handleExternalStart]);

	useEffect(() => {
		if (!isAuthResolved || !isAuthenticated) return;
		if (isTourOpen || isPromptOpen) return;
		if (hasPendingAuthTour) {
			setHasPendingAuthTour(false);
			window.setTimeout(startTour, 450);
			return;
		}
		if (hasManualTourRequest) return;
		if (readTourState() !== null) return;
		const timer = window.setTimeout(() => {
			if (hasBlockingOverlay()) return;
			trackTourInteraction({ action: "prompt_shown", source: "auto" });
			setIsPromptOpen(true);
		}, 900);
		return () => window.clearTimeout(timer);
	}, [
		hasPendingAuthTour,
		hasManualTourRequest,
		isAuthResolved,
		isAuthenticated,
		isPromptOpen,
		isTourOpen,
		startTour,
	]);

	useEffect(() => {
		if (!hasPendingOverlayTour || isTourOpen || isPromptOpen) return;
		const timer = window.setInterval(() => {
			if (hasBlockingOverlay()) return;
			setHasPendingOverlayTour(false);
			startTour();
		}, 240);
		return () => window.clearInterval(timer);
	}, [hasPendingOverlayTour, isPromptOpen, isTourOpen, startTour]);

	useEffect(() => {
		if (!isTourOpen || !currentStep) return;
		if (currentStep.id !== "filters") {
			onFilterClose();
		}
		currentStep.beforeStep?.();
		const timer = window.setTimeout(() => {
			const target = findVisibleTourTarget(currentStep.selector);
			if (!target) {
				moveToAvailableStep(stepIndex + 1, 1);
				return;
			}
			target.scrollIntoView({ block: "center", behavior: "smooth" });
			window.setTimeout(() => {
				const found = syncSpotlight();
				if (!found) {
					moveToAvailableStep(stepIndex + 1, 1);
				}
			}, 360);
		}, 220);
		return () => {
			window.clearTimeout(timer);
		};
	}, [
		currentStep,
		isTourOpen,
		moveToAvailableStep,
		onFilterClose,
		stepIndex,
		syncSpotlight,
	]);

	useEffect(() => {
		if (!isTourOpen) return;
		const handleViewportChange = () => {
			syncSpotlight();
		};
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") finishTour(TOUR_STATE_SKIPPED, "keyboard");
			if (event.key === "ArrowRight") moveToAvailableStep(stepIndex + 1, 1);
			if (event.key === "ArrowLeft") moveToAvailableStep(stepIndex - 1, -1);
			trapTabKey(event, tourCardRef.current);
		};
		window.addEventListener("resize", handleViewportChange);
		window.addEventListener("scroll", handleViewportChange, { passive: true });
		window.addEventListener("keydown", handleKeyDown);
		return () => {
			window.removeEventListener("resize", handleViewportChange);
			window.removeEventListener("scroll", handleViewportChange);
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [finishTour, isTourOpen, moveToAvailableStep, stepIndex, syncSpotlight]);

	if (!mounted) return null;

	const prompt =
		isPromptOpen &&
		createPortal(
			<div
				className="fixed inset-0 flex items-end justify-center bg-black/35 backdrop-blur-[2px] sm:items-center"
				onClick={() => dismissPrompt("backdrop")}
				style={{
					zIndex: LAYERS.SYSTEM_TOAST - 1,
					paddingTop: "max(env(safe-area-inset-top), 1.25rem)",
					paddingRight: "max(env(safe-area-inset-right), 1rem)",
					paddingBottom: "max(env(safe-area-inset-bottom), 1.25rem)",
					paddingLeft: "max(env(safe-area-inset-left), 1rem)",
				}}
				role="dialog"
				aria-modal="true"
				aria-labelledby="fete-finder-tour-prompt-title"
			>
				<div
					ref={promptRef}
					tabIndex={-1}
					onClick={(event) => event.stopPropagation()}
					className="ooo-site-card w-full max-w-md rounded-2xl border border-border/80 bg-card/96 p-5 shadow-[0_28px_70px_-38px_rgba(6,4,2,0.78)] outline-none backdrop-blur-xl"
				>
					<p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
						Fete Finder
					</p>
					<h2
						id="fete-finder-tour-prompt-title"
						className="mt-2 text-2xl [font-family:var(--ooo-font-display)] font-light text-foreground"
					>
						Find your first plan in 30 seconds
					</h2>
					<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
						Take a quick guided pass through picks, map, filters, search and
						event cards.
					</p>
					<div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
						<Button
							type="button"
							variant="ghost"
							onClick={() => dismissPrompt("skip_button")}
							className="rounded-full"
						>
							Skip
						</Button>
						<Button type="button" onClick={startTour} className="rounded-full">
							Start tour
						</Button>
					</div>
				</div>
			</div>,
			document.body,
		);

	if (!isTourOpen || !currentStep || !spotlightRect) {
		return <>{prompt}</>;
	}

	const cardPosition = getCardPosition(
		spotlightRect,
		currentStep.preferredSide,
	);
	const isLastStep = stepIndex === steps.length - 1;

	return (
		<>
			{prompt}
			{createPortal(
				<div
					className="fixed inset-0"
					style={{ zIndex: LAYERS.SYSTEM_TOAST - 1 }}
					aria-live="polite"
				>
					<div
						className="pointer-events-none fixed rounded-2xl border border-[#f0b668]/80 shadow-[0_0_0_9999px_rgba(9,7,5,0.58),0_0_0_1px_rgba(255,247,234,0.72),0_18px_48px_-28px_rgba(240,182,104,0.9)] transition-all duration-200"
						style={{
							top: spotlightRect.top,
							left: spotlightRect.left,
							width: spotlightRect.width,
							height: spotlightRect.height,
						}}
					/>
					<div
						ref={tourCardRef}
						tabIndex={-1}
						className={cn(
							"pointer-events-auto fixed w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-border/80 bg-card/97 p-4 text-card-foreground shadow-[0_24px_64px_-36px_rgba(6,4,2,0.82)] outline-none backdrop-blur-xl transition-all duration-200",
							cardPosition.placement === "top" &&
								"animate-in slide-in-from-bottom-1",
							cardPosition.placement === "bottom" &&
								"animate-in slide-in-from-top-1",
						)}
						style={{ top: cardPosition.top, left: cardPosition.left }}
						role="dialog"
						aria-modal="true"
						aria-labelledby={`fete-finder-tour-${currentStep.id}-title`}
					>
						<div className="flex items-start justify-between gap-3">
							<div>
								<p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
									Step {stepIndex + 1} of {steps.length}
								</p>
								<h2
									id={`fete-finder-tour-${currentStep.id}-title`}
									className="mt-1 text-xl [font-family:var(--ooo-font-display)] font-light text-foreground"
								>
									{currentStep.title}
								</h2>
							</div>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								onClick={() => finishTour(TOUR_STATE_SKIPPED, "close_button")}
								className="h-8 w-8 rounded-full"
								aria-label="Close tour"
							>
								<X className="h-4 w-4" />
							</Button>
						</div>
						<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
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
									onClick={() => moveToAvailableStep(stepIndex - 1, -1)}
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
											finishTour(TOUR_STATE_COMPLETED, "done_button");
											return;
										}
										moveToAvailableStep(stepIndex + 1, 1);
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
			)}
		</>
	);
}
