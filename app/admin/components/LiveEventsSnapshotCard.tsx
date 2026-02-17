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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { getLiveSiteEventsSnapshot } from "@/features/data-management/actions";
import { useCallback, useEffect, useMemo, useState } from "react";

type SnapshotState = Awaited<ReturnType<typeof getLiveSiteEventsSnapshot>>;

type LiveEventsSnapshotCardProps = {
	isAuthenticated: boolean;
	initialSnapshot?: SnapshotState | null;
};

const DEFAULT_VISIBLE_ROWS = 5;

export const LiveEventsSnapshotCard = ({
	isAuthenticated,
	initialSnapshot,
}: LiveEventsSnapshotCardProps) => {
	const [responseMode, setResponseMode] = useState<"cached" | "fresh">(
		initialSnapshot?.cached ? "cached" : "fresh",
	);
	const [snapshot, setSnapshot] = useState<SnapshotState | null>(
		initialSnapshot ?? null,
	);
	const [isLoading, setIsLoading] = useState(false);
	const [isExpanded, setIsExpanded] = useState(false);

	const loadSnapshot = useCallback(async (mode: "cached" | "fresh") => {
		if (!isAuthenticated) return;

		setIsLoading(true);
		try {
			const result = await getLiveSiteEventsSnapshot(undefined, 500, {
				forceRefresh: mode === "fresh",
			});
			setResponseMode(mode);
			setSnapshot(result);
		} finally {
			setIsLoading(false);
		}
	}, [isAuthenticated]);

	useEffect(() => {
		if (initialSnapshot != null) return;
		void loadSnapshot("cached");
	}, [loadSnapshot, initialSnapshot]);

	const rows = snapshot?.rows || [];
	const visibleRows = useMemo(
		() => (isExpanded ? rows : rows.slice(0, DEFAULT_VISIBLE_ROWS)),
		[isExpanded, rows],
	);
	const canExpand = rows.length > DEFAULT_VISIBLE_ROWS;

	const sourceLabel = snapshot?.source || "unknown";
	const sourceDisplayLabel =
		sourceLabel === "store" ? "Postgres Store" :
		sourceLabel === "remote" ? "Remote CSV" :
		sourceLabel === "local" ? "Local File" :
		sourceLabel === "test" ? "Test Dataset" :
		sourceLabel === "cached" ? "Cached" :
		"Unknown";
	const sourceBadgeVariant =
		sourceLabel === "store" ? "default" :
		sourceLabel === "remote" ? "secondary" :
		sourceLabel === "local" ? "outline" :
		sourceLabel === "test" ? "outline" : "outline";

	return (
		<Card className="ooo-admin-card-soft min-w-0 overflow-hidden">
			<CardHeader className="space-y-3">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div>
						<CardTitle>Live Site Snapshot</CardTitle>
						<CardDescription>
							Toggle between cached and forced-fresh site payload responses.
						</CardDescription>
					</div>
					<div className="flex items-center gap-2">
						<Badge variant={sourceBadgeVariant}>{sourceDisplayLabel}</Badge>
						<ToggleGroup
							type="single"
							value={responseMode}
							onValueChange={(value) => {
								if (value === "cached" || value === "fresh") {
									void loadSnapshot(value);
								}
							}}
							disabled={isLoading}
							variant="outline"
							size="sm"
						>
							<ToggleGroupItem value="cached">Cached</ToggleGroupItem>
							<ToggleGroupItem value="fresh">Fresh</ToggleGroupItem>
						</ToggleGroup>
					</div>
				</div>
				<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
					<span>Total events: {snapshot?.totalCount ?? 0}</span>
					<span>
						Last update:{" "}
						{snapshot?.lastUpdate
							? new Date(snapshot.lastUpdate).toLocaleString()
							: "Unknown"}
					</span>
					<Button
						type="button"
						size="sm"
						variant="outline"
						disabled={isLoading}
						onClick={() => void loadSnapshot(responseMode)}
					>
						{isLoading ? "Refreshing..." : "Refresh snapshot"}
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
						{sourceLabel === "local" && (
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
										<th className="px-2 py-2 text-left font-medium">Location</th>
										<th className="px-2 py-2 text-left font-medium">Arr.</th>
										<th className="px-2 py-2 text-left font-medium">Genre</th>
										<th className="px-2 py-2 text-left font-medium">Type</th>
									</tr>
								</thead>
								<tbody>
									{visibleRows.map((row) => (
										<tr key={row.id} className="border-t">
											<td className="px-2 py-2">{row.name}</td>
											<td className="px-2 py-2">{row.date}</td>
											<td className="px-2 py-2">{row.time}</td>
											<td className="px-2 py-2">{row.location}</td>
											<td className="px-2 py-2">{row.arrondissement}</td>
											<td className="px-2 py-2">{row.genre}</td>
											<td className="px-2 py-2">{row.type}</td>
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
