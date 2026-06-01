"use client";

import { Badge } from "@/components/ui/badge";
import {
	type Event,
	type EventExperienceCategoryDefinition,
	getPartyEventTypeLabel,
	getResolvedEventExperienceCategoryDefinition,
} from "@/features/events/types";
import { cn } from "@/lib/utils";
import { Clock, type LucideIcon, Tag } from "lucide-react";

export const getEventCategoryCardClassName = (
	category: EventExperienceCategoryDefinition | null | undefined,
): string | null => {
	switch (category?.key) {
		case "party":
			return "border-amber-300/18 bg-[linear-gradient(145deg,var(--card),rgba(255,251,239,0.42))] hover:bg-[linear-gradient(145deg,var(--card),rgba(255,251,239,0.5))] dark:border-amber-500/16 dark:bg-[linear-gradient(145deg,var(--card),rgba(73,53,24,0.14))] dark:hover:bg-[linear-gradient(145deg,var(--card),rgba(73,53,24,0.18))]";
		case "activity":
			return "border-sky-300/18 bg-[linear-gradient(145deg,var(--card),rgba(239,246,255,0.34))] hover:bg-[linear-gradient(145deg,var(--card),rgba(239,246,255,0.42))] dark:border-sky-500/16 dark:bg-[linear-gradient(145deg,var(--card),rgba(19,63,104,0.14))] dark:hover:bg-[linear-gradient(145deg,var(--card),rgba(19,63,104,0.18))]";
		case "culture":
			return "border-violet-300/18 bg-[linear-gradient(145deg,var(--card),rgba(248,245,255,0.32))] hover:bg-[linear-gradient(145deg,var(--card),rgba(248,245,255,0.4))] dark:border-violet-500/16 dark:bg-[linear-gradient(145deg,var(--card),rgba(57,43,90,0.14))] dark:hover:bg-[linear-gradient(145deg,var(--card),rgba(57,43,90,0.18))]";
		case "food":
			return "border-emerald-300/18 bg-[linear-gradient(145deg,var(--card),rgba(236,252,243,0.32))] hover:bg-[linear-gradient(145deg,var(--card),rgba(236,252,243,0.4))] dark:border-emerald-500/16 dark:bg-[linear-gradient(145deg,var(--card),rgba(30,74,51,0.14))] dark:hover:bg-[linear-gradient(145deg,var(--card),rgba(30,74,51,0.18))]";
		case "wellness":
			return "border-teal-300/18 bg-[linear-gradient(145deg,var(--card),rgba(240,253,250,0.32))] hover:bg-[linear-gradient(145deg,var(--card),rgba(240,253,250,0.4))] dark:border-teal-500/16 dark:bg-[linear-gradient(145deg,var(--card),rgba(20,83,75,0.14))] dark:hover:bg-[linear-gradient(145deg,var(--card),rgba(20,83,75,0.18))]";
		default:
			return null;
	}
};

export const getEventCategoryIcon = (
	category: EventExperienceCategoryDefinition | null | undefined,
): LucideIcon => (category?.key === "party" ? Clock : Tag);

export const getEventCategoryControlClassName = (
	category: EventExperienceCategoryDefinition | null | undefined,
	selected: boolean,
): string => {
	const base =
		category?.color ?? "border-border bg-muted/45 text-muted-foreground";
	if (!selected) return `${base} hover:bg-background/60`;

	switch (category?.key) {
		case "party":
			return "border-amber-500/35 bg-amber-500/12 text-amber-950 shadow-sm hover:bg-amber-500/16 dark:border-amber-300/30 dark:bg-amber-300/14 dark:text-amber-100";
		case "activity":
			return "border-sky-500/35 bg-sky-500/12 text-sky-950 shadow-sm hover:bg-sky-500/16 dark:border-sky-300/30 dark:bg-sky-300/14 dark:text-sky-100";
		case "culture":
			return "border-violet-500/35 bg-violet-500/12 text-violet-950 shadow-sm hover:bg-violet-500/16 dark:border-violet-300/30 dark:bg-violet-300/14 dark:text-violet-100";
		case "food":
			return "border-emerald-500/35 bg-emerald-500/12 text-emerald-950 shadow-sm hover:bg-emerald-500/16 dark:border-emerald-300/30 dark:bg-emerald-300/14 dark:text-emerald-100";
		case "wellness":
			return "border-teal-500/35 bg-teal-500/12 text-teal-950 shadow-sm hover:bg-teal-500/16 dark:border-teal-300/30 dark:bg-teal-300/14 dark:text-teal-100";
		default:
			return "border-foreground/25 bg-muted text-foreground shadow-sm hover:bg-muted";
	}
};

export function EventCategoryBadge({
	event,
	className,
}: {
	event: Pick<Event, "type" | "eventCategory" | "category">;
	className?: string;
}) {
	const category = getResolvedEventExperienceCategoryDefinition(event);
	if (!category) return null;

	const isParty = category.key === "party";
	const label = isParty
		? (getPartyEventTypeLabel(event.type) ?? category.label)
		: category.label;
	const Icon = getEventCategoryIcon(category);
	const colorClassName = isParty
		? "border-border/70 bg-background/50 text-muted-foreground"
		: category.color;

	return (
		<Badge
			variant="outline"
			className={cn(
				"max-w-full px-2 text-[10px] font-semibold uppercase tracking-[0.12em] shadow-none hover:bg-background/60",
				colorClassName,
				className,
			)}
		>
			<span className="inline-flex min-w-0 items-center gap-1">
				<Icon className="h-3 w-3 shrink-0" />
				<span className="truncate">{label}</span>
			</span>
		</Badge>
	);
}
