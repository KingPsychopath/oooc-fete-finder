"use client";

import { Button } from "@/components/ui/button";
import { useSavedEvents } from "@/features/events/components/saved-events-provider";
import type { Event } from "@/features/events/types";
import {
	markPlanRoutePromptShown,
	requestPlanRouteTour,
	shouldShowPlanRoutePrompt,
	snoozePlanRoutePrompt,
} from "@/features/plans/plan-onboarding";
import { usePlans } from "@/features/plans/plans-provider";
import { cn } from "@/lib/utils";
import { Route, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const normalizeEventKey = (value: string): string => value.trim().toLowerCase();

const formatPromptDate = (date: string): string => {
	const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!match) return date;
	const parsed = new Date(
		Date.UTC(
			Number.parseInt(match[1], 10),
			Number.parseInt(match[2], 10) - 1,
			Number.parseInt(match[3], 10),
		),
	);
	if (Number.isNaN(parsed.getTime())) return date;
	return new Intl.DateTimeFormat(undefined, {
		weekday: "short",
		month: "short",
		day: "numeric",
	}).format(parsed);
};

export function HomePlanRoutePrompt({
	events,
	className,
}: {
	events: Event[];
	className?: string;
}) {
	const { savedEventKeys } = useSavedEvents();
	const { plans } = usePlans();
	const [isVisible, setIsVisible] = useState(false);
	const promptTarget = useMemo(() => {
		const countsByDate = new Map<string, number>();
		for (const event of events) {
			if (!event.date) continue;
			if (!savedEventKeys.has(normalizeEventKey(event.eventKey))) continue;
			countsByDate.set(event.date, (countsByDate.get(event.date) ?? 0) + 1);
		}
		return Array.from(countsByDate.entries())
			.filter(([, count]) => count >= 2)
			.sort(
				(left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
			)
			.at(0);
	}, [events, savedEventKeys]);
	const hasRouteForPromptDate = promptTarget
		? plans.some((plan) => plan.planDate === promptTarget[0])
		: false;

	useEffect(() => {
		if (
			!promptTarget ||
			hasRouteForPromptDate ||
			!shouldShowPlanRoutePrompt()
		) {
			setIsVisible(false);
			return;
		}
		const timer = window.setTimeout(() => {
			if (!shouldShowPlanRoutePrompt()) return;
			markPlanRoutePromptShown();
			setIsVisible(true);
		}, 900);
		return () => window.clearTimeout(timer);
	}, [hasRouteForPromptDate, promptTarget]);

	if (!isVisible || !promptTarget) return null;

	const [date, count] = promptTarget;

	return (
		<div
			className={cn(
				"fixed right-3 bottom-[calc(var(--oooc-mobile-nav-offset,5.75rem)+0.75rem)] z-[60] w-[min(24rem,calc(100vw-1.5rem))] rounded-2xl border border-border/75 bg-card/95 p-3 shadow-[0_18px_55px_-32px_rgba(0,0,0,0.8)] backdrop-blur-xl sm:right-5 sm:bottom-5",
				className,
			)}
			role="status"
			aria-live="polite"
		>
			<div className="flex items-start gap-3">
				<div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-background text-foreground">
					<Route className="h-4 w-4" />
				</div>
				<div className="min-w-0 flex-1">
					<p className="text-sm font-medium leading-5">
						You saved {count} events for {formatPromptDate(date)}.
					</p>
					<p className="mt-1 text-sm leading-5 text-muted-foreground">
						Turn them into a route you can edit, share, map and save.
					</p>
					<div className="mt-3 flex flex-wrap gap-2">
						<Button
							type="button"
							size="sm"
							className="rounded-full"
							onClick={requestPlanRouteTour}
						>
							Build route
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="rounded-full"
							onClick={() => {
								snoozePlanRoutePrompt();
								setIsVisible(false);
							}}
						>
							Maybe later
						</Button>
					</div>
				</div>
				<button
					type="button"
					aria-label="Dismiss route suggestion"
					className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
					onClick={() => {
						snoozePlanRoutePrompt();
						setIsVisible(false);
					}}
				>
					<X className="h-4 w-4" />
				</button>
			</div>
		</div>
	);
}
