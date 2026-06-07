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
import { getLiveSiteEventsSnapshot } from "@/features/data-management/actions";
import { formatAdminDateTime } from "@/lib/ui/admin-date-format";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { withAdminBasePath } from "../config";

type SnapshotState = Awaited<ReturnType<typeof getLiveSiteEventsSnapshot>>;

type LiveEventsSnapshotCardProps = {
	isAuthenticated: boolean;
	initialSnapshot?: SnapshotState | null;
};

const DEFAULT_VISIBLE_ROWS = 5;

const normalizeBasePath = (value: string): string => {
	if (!value || value === "/") return "";
	return value.endsWith("/") ? value.slice(0, -1) : value;
};

const buildEventHref = (eventKey: string, slug: string): string => {
	const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH || "");
	const encodedKey = encodeURIComponent(eventKey);
	const encodedSlug = slug ? `/${encodeURIComponent(slug)}` : "";
	return `${basePath}/event/${encodedKey}${encodedSlug}`;
};

const buildEventEvidenceHref = (eventKey: string): string =>
	withAdminBasePath(
		`/admin/insights?eventSearch=${encodeURIComponent(eventKey)}#event-engagement-stats`,
	);

const sourceDisplay = (source?: SnapshotState["source"]) => {
	if (source === "store")
		return { label: "Postgres Store", variant: "default" as const };
	if (source === "backup")
		return { label: "Event Backup Fallback", variant: "secondary" as const };
	if (source === "local")
		return { label: "Local CSV Fallback", variant: "outline" as const };
	if (source === "test")
		return { label: "Test Dataset", variant: "outline" as const };
	return { label: "Unknown", variant: "outline" as const };
};

export const LiveEventsSnapshotCard = ({
	isAuthenticated,
	initialSnapshot,
}: LiveEventsSnapshotCardProps) => {
	const [snapshot, setSnapshot] = useState<SnapshotState | null>(
		initialSnapshot ?? null,
	);
	const [lastCheckMode, setLastCheckMode] = useState<"runtime" | "source">(
		"runtime",
	);
	const [isLoading, setIsLoading] = useState(false);
	const [isExpanded, setIsExpanded] = useState(false);

	const loadSnapshot = useCallback(
		async (mode: "runtime" | "source") => {
			if (!isAuthenticated) return;
			setLastCheckMode(mode);
			setIsLoading(true);
			try {
				const result = await getLiveSiteEventsSnapshot(undefined, 500, {
					forceRefresh: mode === "source",
				});
				setSnapshot(result);
			} finally {
				setIsLoading(false);
			}
		},
		[isAuthenticated],
	);

	useEffect(() => {
		if (initialSnapshot != null) return;
		void loadSnapshot("runtime");
	}, [initialSnapshot, loadSnapshot]);

	const rows = snapshot?.rows || [];
	const visibleRows = useMemo(
		() => (isExpanded ? rows : rows.slice(0, DEFAULT_VISIBLE_ROWS)),
		[isExpanded, rows],
	);
	const canExpand = rows.length > DEFAULT_VISIBLE_ROWS;
	const source = sourceDisplay(snapshot?.source);

	return (
		<Card className="ooo-admin-card-soft min-w-0 overflow-hidden">
			<CardHeader className="space-y-3">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div>
						<CardTitle>Live Runtime Snapshot</CardTitle>
						<CardDescription>
							Direct payload view from current runtime source. Source check is a
							dry run and does not mutate runtime state.
						</CardDescription>
					</div>
					<Badge variant={source.variant}>{source.label}</Badge>
				</div>
				<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
					<span>Total events: {snapshot?.totalCount ?? 0}</span>
					<span>
						Last update:{" "}
						{snapshot?.lastUpdate
							? formatAdminDateTime(snapshot.lastUpdate)
							: "Unknown"}
					</span>
					<span>
						Last check:{" "}
						{lastCheckMode === "source" ? "Source dry run" : "Runtime read"}
					</span>
					<Button
						type="button"
						size="sm"
						variant="outline"
						disabled={isLoading}
						onClick={() => void loadSnapshot("runtime")}
						title={
							isLoading
								? "Wait for the current snapshot check to finish"
								: "Read the event payload currently served by the runtime"
						}
					>
						{isLoading && lastCheckMode === "runtime"
							? "Refreshing..."
							: "Refresh snapshot"}
					</Button>
					<Button
						type="button"
						size="sm"
						variant="outline"
						disabled={isLoading}
						onClick={() => void loadSnapshot("source")}
						title={
							isLoading
								? "Wait for the current snapshot check to finish"
								: "Dry-run the configured source without mutating runtime state"
						}
					>
						{isLoading && lastCheckMode === "source"
							? "Checking..."
							: "Dry-run source check"}
					</Button>
				</div>
			</CardHeader>
			<CardContent className="space-y-3">
				{!snapshot?.success ? (
					<div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
						{snapshot?.error || "Failed to load live snapshot"}
					</div>
				) : rows.length === 0 ? (
					<div className="rounded-md border p-4 text-sm text-muted-foreground">
						No events in current snapshot.
					</div>
				) : (
					<>
						{snapshot?.source === "backup" && (
							<div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
								Live site is currently serving the latest event backup, not the
								primary Postgres store.
							</div>
						)}
						{snapshot?.source === "local" && (
							<div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
								Live site is currently serving local CSV fallback, not Postgres.
							</div>
						)}
						<div className="max-w-full overflow-auto rounded-md border">
							<table className="w-full text-xs">
								<thead className="bg-muted/40">
									<tr>
										<th className="px-2 py-2 text-left font-medium">Name</th>
										<th className="px-2 py-2 text-left font-medium">Date</th>
										<th className="px-2 py-2 text-left font-medium">Time</th>
										<th className="px-2 py-2 text-left font-medium">
											Location
										</th>
										<th className="px-2 py-2 text-left font-medium">Arr.</th>
										<th className="px-2 py-2 text-left font-medium">Genre</th>
										<th className="px-2 py-2 text-left font-medium">Type</th>
										<th className="px-2 py-2 text-left font-medium">
											Evidence
										</th>
									</tr>
								</thead>
								<tbody>
									{visibleRows.map((row) => (
										<tr key={row.id} className="border-t">
											<td className="px-2 py-2">
												<Link
													href={buildEventHref(row.eventKey, row.slug)}
													className="font-medium underline-offset-2 hover:underline"
													target="_blank"
													rel="noreferrer"
													title="Open the public event page in a new tab"
												>
													{row.name}
												</Link>
												<div className="text-[11px] text-muted-foreground">
													{row.eventKey}
												</div>
											</td>
											<td className="px-2 py-2">{row.date}</td>
											<td className="px-2 py-2">{row.time}</td>
											<td className="px-2 py-2">{row.location}</td>
											<td className="px-2 py-2">{row.arrondissement}</td>
											<td className="px-2 py-2">{row.genre}</td>
											<td className="px-2 py-2">{row.type}</td>
											<td className="px-2 py-2">
												<Link
													href={buildEventEvidenceHref(row.eventKey)}
													className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
												>
													Open insights
												</Link>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
						<div className="flex items-center justify-between">
							<div className="text-xs text-muted-foreground">
								Showing {visibleRows.length} of {rows.length} rows
							</div>
							{canExpand && (
								<Button
									type="button"
									size="sm"
									variant="outline"
									onClick={() => setIsExpanded((current) => !current)}
									title={
										isExpanded
											? `Collapse to the first ${DEFAULT_VISIBLE_ROWS} rows`
											: `Show all ${rows.length} snapshot rows`
									}
								>
									{isExpanded ? "Show less" : "Show more"}
								</Button>
							)}
						</div>
					</>
				)}
			</CardContent>
		</Card>
	);
};
