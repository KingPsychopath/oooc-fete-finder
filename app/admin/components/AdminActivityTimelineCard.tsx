"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type {
	AdminActivityCategory,
	AdminActivityEvent,
	AdminActivitySeverity,
} from "@/features/admin/activity/types";
import { cn } from "@/lib/utils";
import {
	ArrowDownAZ,
	ArrowUpZA,
	Clock3,
	ExternalLink,
	Filter,
	History,
	Search,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { withAdminBasePath } from "../config";

type AdminActivityTimelineCardProps = {
	events: AdminActivityEvent[];
	categoryCounts: Record<AdminActivityCategory, number>;
	supported: boolean;
	error?: string;
};

type CategoryFilter = AdminActivityCategory | "all";
type SeverityFilter = AdminActivitySeverity | "all";
type SortMode = "newest" | "oldest";

const CATEGORY_LABELS: Record<AdminActivityCategory, string> = {
	auth: "Auth",
	content: "Content",
	insights: "Insights",
	operations: "Operations",
	placements: "Placements",
	settings: "Settings",
};

const CATEGORY_ACCENT: Record<AdminActivityCategory, string> = {
	auth: "border-sky-200 bg-sky-50 text-sky-800",
	content: "border-emerald-200 bg-emerald-50 text-emerald-800",
	insights: "border-violet-200 bg-violet-50 text-violet-800",
	operations: "border-amber-200 bg-amber-50 text-amber-900",
	placements: "border-rose-200 bg-rose-50 text-rose-800",
	settings: "border-teal-200 bg-teal-50 text-teal-800",
};

const SEVERITY_LABELS: Record<AdminActivitySeverity, string> = {
	info: "Info",
	warning: "Warning",
	destructive: "Destructive",
};

const SEVERITY_ACCENT: Record<AdminActivitySeverity, string> = {
	info: "bg-muted text-muted-foreground",
	warning: "bg-amber-100 text-amber-900",
	destructive: "bg-rose-100 text-rose-800",
};

const CATEGORY_OPTIONS: CategoryFilter[] = [
	"all",
	"operations",
	"content",
	"placements",
	"settings",
	"insights",
	"auth",
];

const SEVERITY_OPTIONS: SeverityFilter[] = [
	"all",
	"info",
	"warning",
	"destructive",
];

const formatRelativeTime = (isoDate: string): string => {
	const time = new Date(isoDate).getTime();
	if (!Number.isFinite(time)) return "unknown time";
	const diffMs = Date.now() - time;
	if (diffMs < 45_000) return "just now";
	const minutes = Math.floor(diffMs / 60_000);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 7) return `${days}d ago`;
	return new Date(isoDate).toLocaleDateString();
};

const formatActionLabel = (action: string): string =>
	action
		.split(".")
		.map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
		.join(" / ");

const normalize = (value: string | null | undefined): string =>
	(value ?? "").toLowerCase();

export function AdminActivityTimelineCard({
	events,
	categoryCounts,
	supported,
	error,
}: AdminActivityTimelineCardProps) {
	const [query, setQuery] = useState("");
	const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
	const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
	const [sortMode, setSortMode] = useState<SortMode>("newest");
	const [visibleLimit, setVisibleLimit] = useState(18);

	const filteredEvents = useMemo(() => {
		const needle = query.trim().toLowerCase();
		const filtered = events.filter((event) => {
			if (categoryFilter !== "all" && event.category !== categoryFilter) {
				return false;
			}
			if (severityFilter !== "all" && event.severity !== severityFilter) {
				return false;
			}
			if (!needle) return true;
			return [
				event.summary,
				event.action,
				event.actorLabel,
				event.targetLabel,
				event.targetId,
				event.targetType,
			].some((value) => normalize(value).includes(needle));
		});

		return filtered.sort((left, right) => {
			const delta =
				new Date(right.occurredAt).getTime() -
				new Date(left.occurredAt).getTime();
			return sortMode === "newest" ? delta : -delta;
		});
	}, [categoryFilter, events, query, severityFilter, sortMode]);

	const visibleEvents = filteredEvents.slice(0, visibleLimit);
	const totalCount = events.length;
	const destructiveCount = events.filter(
		(event) => event.severity === "destructive",
	).length;
	const warningCount = events.filter(
		(event) => event.severity === "warning",
	).length;

	return (
		<Card className="ooo-admin-card min-w-0 overflow-hidden">
			<CardHeader className="space-y-3">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<CardTitle className="flex items-center gap-2">
							<History className="h-5 w-5" />
							Recent Activity
						</CardTitle>
						<CardDescription>
							Centralized admin action history across operations, content,
							placements, settings, insights, and sessions.
						</CardDescription>
					</div>
					<div className="flex flex-wrap gap-2">
						<Badge variant="outline">{totalCount} loaded</Badge>
						{warningCount > 0 && (
							<Badge variant="secondary">{warningCount} warnings</Badge>
						)}
						{destructiveCount > 0 && (
							<Badge variant="destructive">
								{destructiveCount} destructive
							</Badge>
						)}
					</div>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				{!supported && (
					<div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
						Activity tracking requires Postgres. Configure DATABASE_URL to
						enable the central timeline.
					</div>
				)}
				{error && (
					<div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
						{error}
					</div>
				)}

				<div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
					<div className="relative">
						<Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							value={query}
							onChange={(event) => {
								setQuery(event.target.value);
								setVisibleLimit(18);
							}}
							placeholder="Search action, target, actor, or summary"
							className="pl-8"
						/>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<div className="flex items-center gap-1 rounded-md border bg-background px-2">
							<Filter className="h-3.5 w-3.5 text-muted-foreground" />
							<select
								value={categoryFilter}
								onChange={(event) => {
									setCategoryFilter(event.target.value as CategoryFilter);
									setVisibleLimit(18);
								}}
								className="h-8 bg-transparent text-xs outline-none"
							>
								{CATEGORY_OPTIONS.map((category) => (
									<option key={category} value={category}>
										{category === "all"
											? "All categories"
											: CATEGORY_LABELS[category]}
									</option>
								))}
							</select>
						</div>
						<select
							value={severityFilter}
							onChange={(event) => {
								setSeverityFilter(event.target.value as SeverityFilter);
								setVisibleLimit(18);
							}}
							className="h-8 rounded-md border bg-background px-2 text-xs"
						>
							{SEVERITY_OPTIONS.map((severity) => (
								<option key={severity} value={severity}>
									{severity === "all"
										? "All severities"
										: SEVERITY_LABELS[severity]}
								</option>
							))}
						</select>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="gap-1.5"
							onClick={() =>
								setSortMode((current) =>
									current === "newest" ? "oldest" : "newest",
								)
							}
						>
							{sortMode === "newest" ? (
								<ArrowDownAZ className="h-3.5 w-3.5" />
							) : (
								<ArrowUpZA className="h-3.5 w-3.5" />
							)}
							{sortMode === "newest" ? "Newest" : "Oldest"}
						</Button>
					</div>
				</div>

				<div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
					{CATEGORY_OPTIONS.filter(
						(category): category is AdminActivityCategory => category !== "all",
					).map((category) => (
						<button
							key={category}
							type="button"
							onClick={() => {
								setCategoryFilter(category);
								setVisibleLimit(18);
							}}
							className={cn(
								"rounded-md border px-3 py-2 text-left transition-colors hover:bg-muted/40",
								categoryFilter === category && "border-foreground/40 bg-muted",
							)}
						>
							<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
								{CATEGORY_LABELS[category]}
							</p>
							<p className="mt-1 text-sm font-semibold">
								{categoryCounts[category] ?? 0}
							</p>
						</button>
					))}
				</div>

				<div className="rounded-md border">
					<div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
						<span>
							Showing {visibleEvents.length} of {filteredEvents.length}
						</span>
						<span className="inline-flex items-center gap-1">
							<Clock3 className="h-3.5 w-3.5" />
							Live from centralized activity events
						</span>
					</div>
					<div className="max-h-[42rem] overflow-auto">
						{visibleEvents.length === 0 ? (
							<div className="px-3 py-8 text-center text-sm text-muted-foreground">
								{events.length === 0
									? "No admin activity has been recorded yet."
									: "No activity matches this view."}
							</div>
						) : (
							<ol className="divide-y">
								{visibleEvents.map((event) => (
									<li key={event.id} className="p-3">
										<div className="flex items-start gap-3">
											<div
												className={cn(
													"mt-0.5 h-2.5 w-2.5 rounded-full border",
													event.severity === "destructive"
														? "border-rose-500 bg-rose-500"
														: event.severity === "warning"
															? "border-amber-500 bg-amber-500"
															: "border-emerald-500 bg-emerald-500",
												)}
											/>
											<div className="min-w-0 flex-1 space-y-2">
												<div className="flex flex-wrap items-start justify-between gap-2">
													<div className="min-w-0">
														<p className="text-sm font-medium leading-snug">
															{event.summary}
														</p>
														<p className="mt-1 text-xs text-muted-foreground">
															{formatRelativeTime(event.occurredAt)} •{" "}
															{new Date(event.occurredAt).toLocaleString()} •{" "}
															{event.actorLabel}
														</p>
													</div>
													<div className="flex flex-wrap justify-end gap-1.5">
														<span
															className={cn(
																"inline-flex h-6 items-center rounded-full border px-2 text-[11px] font-medium",
																CATEGORY_ACCENT[event.category],
															)}
														>
															{CATEGORY_LABELS[event.category]}
														</span>
														<span
															className={cn(
																"inline-flex h-6 items-center rounded-full px-2 text-[11px] font-medium",
																SEVERITY_ACCENT[event.severity],
															)}
														>
															{SEVERITY_LABELS[event.severity]}
														</span>
													</div>
												</div>
												<div className="flex flex-wrap items-center justify-between gap-2">
													<div className="min-w-0 text-xs text-muted-foreground">
														<span className="font-mono">
															{formatActionLabel(event.action)}
														</span>
														{event.targetLabel && (
															<span> • {event.targetLabel}</span>
														)}
													</div>
													{event.href && (
														<Link
															href={withAdminBasePath(event.href)}
															className="inline-flex h-7 items-center gap-1 rounded-md border bg-background px-2 text-xs font-medium transition-colors hover:bg-muted"
														>
															Open
															<ExternalLink className="h-3 w-3" />
														</Link>
													)}
												</div>
											</div>
										</div>
									</li>
								))}
							</ol>
						)}
					</div>
				</div>

				{filteredEvents.length > visibleEvents.length && (
					<div className="flex justify-center">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => setVisibleLimit((current) => current + 18)}
						>
							Show More Activity
						</Button>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
