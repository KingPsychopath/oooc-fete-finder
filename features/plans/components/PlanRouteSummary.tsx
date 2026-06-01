"use client";

import {
	EventCategoryBadge,
	getEventCategoryCardClassName,
} from "@/features/events/components/EventCategoryBadge";
import {
	type Event,
	formatLocationAreaShort,
	getResolvedEventExperienceCategoryDefinition,
} from "@/features/events/types";
import type { UserPlan } from "@/features/plans/types";
import { cn } from "@/lib/utils";
import { ArrowUpRight, CalendarDays, Clock, MapPin } from "lucide-react";

const STOP_DOT_CLASSES = [
	"bg-rose-400",
	"bg-emerald-400",
	"bg-sky-400",
	"bg-amber-400",
] as const;

const formatTime = (value: string | undefined | null): string =>
	value && value.toLowerCase() !== "tbc" ? value : "Time TBC";

const normalizeEventKey = (value: string): string => value.trim().toLowerCase();

export function PlanRouteSummary({
	plan,
	eventsByKey,
	className,
	onEventSelect,
}: {
	plan: UserPlan;
	eventsByKey: Map<string, Event>;
	className?: string;
	onEventSelect?: (event: Event) => void;
}) {
	const stops = plan.stops
		.slice()
		.sort((left, right) => left.stopOrder - right.stopOrder)
		.map((stop) => ({
			stop,
			event: eventsByKey.get(normalizeEventKey(stop.eventKey)),
		}))
		.filter((item): item is { stop: UserPlan["stops"][number]; event: Event } =>
			Boolean(item.event),
		);

	return (
		<ol className={cn("relative space-y-3", className)} aria-label="Plan stops">
			{stops.map(({ event }, index) => {
				const category = getResolvedEventExperienceCategoryDefinition(event);
				const isInteractive = Boolean(onEventSelect);
				const cardClassName = cn(
					"rounded-2xl border border-border/70 bg-background/88 p-3 text-left shadow-sm backdrop-blur transition duration-300 group-hover:-translate-y-0.5 group-hover:border-foreground/25 group-hover:shadow-md sm:p-4",
					getEventCategoryCardClassName(category),
				);
				const cardContent = (
					<>
						<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
							<span className="inline-flex items-center gap-1">
								<Clock className="h-3.5 w-3.5" />
								{formatTime(event.time)}
							</span>
							<span className="inline-flex items-center gap-1">
								<MapPin className="h-3.5 w-3.5" />
								{formatLocationAreaShort(event.arrondissement)}
							</span>
							{event.date && (
								<span className="inline-flex items-center gap-1">
									<CalendarDays className="h-3.5 w-3.5" />
									{event.date}
								</span>
							)}
							<EventCategoryBadge event={event} />
						</div>
						<h3 className="mt-2 text-lg font-medium leading-tight sm:text-xl">
							{event.name}
						</h3>
						{event.location || event.locationAddress ? (
							<p className="mt-2 text-sm leading-5 text-muted-foreground">
								{[event.location, event.locationAddress]
									.filter(Boolean)
									.join(" · ")}
							</p>
						) : null}
						{isInteractive ? (
							<span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground">
								View details
								<ArrowUpRight className="h-3.5 w-3.5" />
							</span>
						) : null}
					</>
				);
				return (
					<li
						key={event.eventKey}
						className="group relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3"
					>
						<div className="relative flex justify-center">
							<div
								className={cn(
									"z-10 grid h-10 w-10 place-items-center rounded-full text-sm font-semibold text-white shadow-[0_12px_30px_-18px_rgba(20,20,20,0.75)]",
									STOP_DOT_CLASSES[index % STOP_DOT_CLASSES.length],
								)}
							>
								{index + 1}
							</div>
							{index < stops.length - 1 && (
								<div className="absolute top-9 h-[calc(100%+0.85rem)] w-1 rounded-full bg-[linear-gradient(180deg,#fb7185,#10b981,#38bdf8,#f59e0b)] opacity-70" />
							)}
						</div>
						{isInteractive ? (
							<button
								type="button"
								onClick={() => onEventSelect?.(event)}
								className={cn(
									cardClassName,
									"cursor-pointer outline-none focus-visible:border-foreground/40 focus-visible:ring-2 focus-visible:ring-ring/40",
								)}
								aria-label={`Open details for ${event.name}`}
							>
								{cardContent}
							</button>
						) : (
							<article className={cardClassName}>{cardContent}</article>
						)}
					</li>
				);
			})}
		</ol>
	);
}
