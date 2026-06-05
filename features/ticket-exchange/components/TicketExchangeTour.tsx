"use client";

import { Button } from "@/components/ui/button";
import { trackTicketExchangeAnalytics } from "@/features/events/engagement/client-tracking";
import {
	TICKET_EXCHANGE_TOUR_EVENT,
	TICKET_EXCHANGE_TOUR_STATE_COMPLETED,
	TICKET_EXCHANGE_TOUR_STATE_SKIPPED,
	consumePendingTicketExchangeTourRequest,
	markTicketExchangeTourPromptShown,
	shouldShowTicketExchangeTourPrompt,
	snoozeTicketExchangeTourPrompt,
	writeTicketExchangeTourState,
} from "@/features/ticket-exchange/tour-onboarding";
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

interface TicketExchangeTourProps {
	selectedEventKey?: string | null;
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

const TOUR_CARD_HEIGHT = 230;

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

const hasBlockingOverlay = (): boolean => {
	if (typeof document === "undefined") return false;
	return (
		document.body.hasAttribute(OVERLAY_BODY_ATTRIBUTE.EVENT_MODAL) ||
		document.body.hasAttribute(OVERLAY_BODY_ATTRIBUTE.FILTER_PANEL) ||
		document.body.hasAttribute(OVERLAY_BODY_ATTRIBUTE.TICKET_EXCHANGE_MODAL)
	);
};

const trapTabKey = (event: KeyboardEvent, dialog: HTMLElement | null): void => {
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
			top = rect.top - TOUR_CARD_HEIGHT - gap;
			left = rect.left + rect.width / 2 - cardWidth / 2;
		}
		if (candidate === "right") {
			top = rect.top + rect.height / 2 - TOUR_CARD_HEIGHT / 2;
			left = rect.left + rect.width + gap;
		}
		if (candidate === "left") {
			top = rect.top + rect.height / 2 - TOUR_CARD_HEIGHT / 2;
			left = rect.left - cardWidth - gap;
		}

		const clampedTop = Math.min(
			Math.max(16, top),
			Math.max(16, viewportHeight - TOUR_CARD_HEIGHT - 16),
		);
		const clampedLeft = Math.min(
			Math.max(16, left),
			Math.max(16, viewportWidth - cardWidth - 16),
		);
		const fitsVertically =
			candidate === "top"
				? rect.top - gap >= TOUR_CARD_HEIGHT
				: candidate === "bottom"
					? viewportHeight - (rect.top + rect.height + gap) >= TOUR_CARD_HEIGHT
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
		top: Math.max(16, viewportHeight - TOUR_CARD_HEIGHT - 20),
		left: Math.max(16, (viewportWidth - cardWidth) / 2),
		placement: "bottom",
	};
};

export function TicketExchangeTour({
	selectedEventKey,
}: TicketExchangeTourProps) {
	const haptics = useAppHaptics();
	const promptRef = useRef<HTMLDivElement>(null);
	const cardRef = useRef<HTMLDivElement>(null);
	const [mounted, setMounted] = useState(false);
	const [isPromptOpen, setIsPromptOpen] = useState(false);
	const [isTourOpen, setIsTourOpen] = useState(false);
	const [hasManualTourRequest, setHasManualTourRequest] = useState(false);
	const [hasPendingOverlayTour, setHasPendingOverlayTour] = useState(false);
	const [stepIndex, setStepIndex] = useState(0);
	const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(
		null,
	);

	const steps = useMemo<TourStep[]>(
		() => [
			{
				id: "views",
				selector: "#ticket-exchange-marketplace-tabs",
				title: "Choose what you need",
				body: "All shows the whole market. Selling is for available tickets, Looking is for people still searching, and My activity keeps your own replies and posts together.",
				preferredSide: "bottom",
			},
			{
				id: "events",
				selector:
					"#ticket-exchange-event-filter, #ticket-exchange-mobile-event-filter",
				title: "Filter to one event",
				body: "Use the event search when you care about one party. Show all brings you back to the full marketplace.",
				preferredSide: "right",
			},
			{
				id: "reply",
				selector: "#ticket-exchange-first-reply-button",
				title: "Reply to reveal contacts",
				body: "Use this when a listing matches what you need. The note underneath will tell you if rules or a backup contact still need sorting.",
				preferredSide: "top",
			},
			{
				id: "post",
				selector: "#ticket-exchange-board-post-button",
				title: "Post if you need a match",
				body: "Post a Selling listing if you have spare tickets, or Looking if you need one. People message you directly; OOOC does not hold or verify tickets.",
				preferredSide: "bottom",
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

	const moveToAvailableStep = useCallback(
		(nextIndex: number, direction: 1 | -1) => {
			haptics.nudge();
			const boundedIndex = Math.min(Math.max(nextIndex, 0), steps.length - 1);
			for (
				let index = boundedIndex;
				index >= 0 && index < steps.length;
				index += direction
			) {
				if (findTarget(steps[index].selector)) {
					setStepIndex(index);
					return;
				}
			}
			setStepIndex(boundedIndex);
		},
		[haptics, steps],
	);

	const startTour = useCallback(
		(source: "manual" | "prompt" | "pending" = "manual") => {
			if (hasBlockingOverlay()) {
				haptics.nudge();
				setIsPromptOpen(false);
				setHasPendingOverlayTour(true);
				return;
			}
			haptics.nudge();
			trackTicketExchangeAnalytics({
				actionType: "tour_start",
				eventKey: selectedEventKey,
				surface: "tour",
				detail: source,
			});
			setHasManualTourRequest(source === "manual");
			setIsPromptOpen(false);
			setIsTourOpen(true);
			setStepIndex(0);
		},
		[haptics, selectedEventKey],
	);

	const dismissPrompt = useCallback(
		(source: string) => {
			haptics.light();
			snoozeTicketExchangeTourPrompt();
			trackTicketExchangeAnalytics({
				actionType: "tour_prompt_dismiss",
				eventKey: selectedEventKey,
				surface: "tour",
				detail: source,
			});
			setHasPendingOverlayTour(false);
			setIsPromptOpen(false);
			setIsTourOpen(false);
			setSpotlightRect(null);
		},
		[haptics, selectedEventKey],
	);

	const finishTour = useCallback(
		(state: string, source: string) => {
			if (state === TICKET_EXCHANGE_TOUR_STATE_COMPLETED) {
				haptics.success();
			} else {
				haptics.light();
			}
			trackTicketExchangeAnalytics({
				actionType:
					state === TICKET_EXCHANGE_TOUR_STATE_COMPLETED
						? "tour_complete"
						: "tour_skip",
				eventKey: selectedEventKey,
				surface: "tour",
				detail: [currentStep?.id, source].filter(Boolean).join(":"),
				immediate: true,
			});
			writeTicketExchangeTourState(state);
			setHasPendingOverlayTour(false);
			setIsPromptOpen(false);
			setIsTourOpen(false);
			setSpotlightRect(null);
		},
		[currentStep?.id, haptics, selectedEventKey],
	);

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
				cardRef.current?.focus();
				return;
			}
			promptRef.current?.focus();
		});
	}, [isPromptOpen, isTourOpen]);

	useEffect(() => {
		if (consumePendingTicketExchangeTourRequest()) {
			const timer = window.setTimeout(() => startTour("pending"), 450);
			return () => window.clearTimeout(timer);
		}
	}, [startTour]);

	useEffect(() => {
		const handleStart = () => {
			setHasManualTourRequest(true);
			startTour("manual");
		};
		window.addEventListener(TICKET_EXCHANGE_TOUR_EVENT, handleStart);
		return () => {
			window.removeEventListener(TICKET_EXCHANGE_TOUR_EVENT, handleStart);
		};
	}, [startTour]);

	useEffect(() => {
		if (isTourOpen || isPromptOpen || hasManualTourRequest) return;
		if (!shouldShowTicketExchangeTourPrompt()) return;
		const timer = window.setTimeout(() => {
			if (hasBlockingOverlay()) return;
			markTicketExchangeTourPromptShown();
			trackTicketExchangeAnalytics({
				actionType: "tour_prompt_shown",
				eventKey: selectedEventKey,
				surface: "tour",
				detail: "auto",
			});
			setIsPromptOpen(true);
		}, 1200);
		return () => window.clearTimeout(timer);
	}, [hasManualTourRequest, isPromptOpen, isTourOpen, selectedEventKey]);

	useEffect(() => {
		if (!hasPendingOverlayTour || isTourOpen || isPromptOpen) return;
		const timer = window.setInterval(() => {
			if (hasBlockingOverlay()) return;
			setHasPendingOverlayTour(false);
			startTour("manual");
		}, 240);
		return () => window.clearInterval(timer);
	}, [hasPendingOverlayTour, isPromptOpen, isTourOpen, startTour]);

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
		if (!isTourOpen || !currentStep) return;
		let cancelSettledSync: (() => void) | undefined;
		let isCancelled = false;
		const timer = window.setTimeout(() => {
			if (isCancelled) return;
			const target = findTarget(currentStep.selector);
			if (!target) {
				moveToAvailableStep(stepIndex + 1, 1);
				return;
			}
			target.scrollIntoView({ block: "center", behavior: "smooth" });
			const found = syncSpotlight();
			if (!found) {
				moveToAvailableStep(stepIndex + 1, 1);
				return;
			}
			cancelSettledSync = syncSpotlightWhileLayoutSettles();
		}, 180);
		return () => {
			isCancelled = true;
			window.clearTimeout(timer);
			cancelSettledSync?.();
		};
	}, [
		currentStep,
		isTourOpen,
		moveToAvailableStep,
		stepIndex,
		syncSpotlight,
		syncSpotlightWhileLayoutSettles,
	]);

	useEffect(() => {
		if (!isTourOpen) return;
		const handleViewportChange = () => syncSpotlight();
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				finishTour(TICKET_EXCHANGE_TOUR_STATE_SKIPPED, "keyboard");
			}
			if (event.key === "ArrowRight") moveToAvailableStep(stepIndex + 1, 1);
			if (event.key === "ArrowLeft") moveToAvailableStep(stepIndex - 1, -1);
			trapTabKey(event, cardRef.current);
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
				aria-labelledby="ticket-exchange-tour-prompt-title"
			>
				<div
					ref={promptRef}
					tabIndex={-1}
					onClick={(event) => event.stopPropagation()}
					className="ooo-site-card w-full max-w-md rounded-2xl border border-border/80 bg-card/96 p-5 shadow-[0_28px_70px_-38px_rgba(6,4,2,0.78)] outline-none backdrop-blur-xl"
				>
					<p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
						Ticket Exchange
					</p>
					<h2
						id="ticket-exchange-tour-prompt-title"
						className="mt-2 text-2xl [font-family:var(--ooo-font-display)] font-light text-foreground"
					>
						Want the 30-second map?
					</h2>
					<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
						Take a quick pass through browsing, posting, replying, and the
						contact setup people miss first.
					</p>
					<div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
						<Button
							type="button"
							variant="ghost"
							onClick={() => dismissPrompt("skip_button")}
							className="rounded-full"
						>
							Not now
						</Button>
						<Button
							type="button"
							onClick={() => startTour("prompt")}
							className="rounded-full"
						>
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

	const position = getCardPosition(spotlightRect, currentStep.preferredSide);
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
						data-tour-spotlight="true"
						className="pointer-events-none fixed rounded-2xl border border-[#f0b668]/80 shadow-[0_0_0_9999px_rgba(9,7,5,0.58),0_0_0_1px_rgba(255,247,234,0.72),0_18px_48px_-28px_rgba(240,182,104,0.9)] transition-all duration-200"
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
							"pointer-events-auto fixed w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-border/80 bg-card/97 p-4 text-card-foreground shadow-[0_24px_64px_-36px_rgba(6,4,2,0.82)] outline-none backdrop-blur-xl transition-all duration-200",
							position.placement === "top" &&
								"animate-in slide-in-from-bottom-1",
							position.placement === "bottom" &&
								"animate-in slide-in-from-top-1",
						)}
						style={{ top: position.top, left: position.left }}
						role="dialog"
						aria-modal="true"
						aria-labelledby={`ticket-exchange-tour-${currentStep.id}-title`}
					>
						<div className="flex items-start justify-between gap-3">
							<div>
								<p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
									Step {stepIndex + 1} of {steps.length}
								</p>
								<h2
									id={`ticket-exchange-tour-${currentStep.id}-title`}
									className="mt-1 text-xl [font-family:var(--ooo-font-display)] font-light text-foreground"
								>
									{currentStep.title}
								</h2>
							</div>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								onClick={() =>
									finishTour(TICKET_EXCHANGE_TOUR_STATE_SKIPPED, "close_button")
								}
								className="h-8 w-8 rounded-full"
								aria-label="Close ticket exchange tour"
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
											finishTour(
												TICKET_EXCHANGE_TOUR_STATE_COMPLETED,
												"done_button",
											);
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
