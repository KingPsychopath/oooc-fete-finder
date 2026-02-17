import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import type { CacheStatus } from "../types";

type CacheManagementCardProps = {
	cacheStatus: CacheStatus;
	refreshing: boolean;
	refreshMessage: string;
	onRefresh: () => void;
};

const formatDuration = (ms: number): string => {
	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);

	if (hours > 0) return `${hours}h ${minutes % 60}m`;
	if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
	return `${seconds}s`;
};

const sourcePresentation = (
	source: CacheStatus["dataSource"],
): { label: string; variant: "default" | "secondary" | "outline" | "destructive" } => {
	switch (source) {
		case "store":
			return { label: "Postgres Store", variant: "default" };
		case "local":
			return { label: "Local CSV Fallback", variant: "secondary" };
		case "test":
			return { label: "Test Dataset", variant: "outline" };
		case "remote":
			return { label: "Remote CSV", variant: "outline" };
		case "cached":
			return { label: "Cached", variant: "outline" };
		default:
			return { label: "Unknown", variant: "destructive" };
	}
};

const modePresentation = (
	mode: CacheStatus["configuredDataSource"],
): { label: string; variant: "default" | "secondary" | "outline" | "destructive" } => {
	switch (mode) {
		case "remote":
			return { label: "Remote Mode", variant: "default" };
		case "local":
			return { label: "Local Mode", variant: "secondary" };
		case "test":
			return { label: "Test Mode", variant: "outline" };
		default:
			return { label: "Unknown", variant: "destructive" };
	}
};

const getRefreshMessageTone = (message: string) => {
	if (!message) return "";
	const normalized = message.toLowerCase();

	if (
		normalized.includes("success") ||
		normalized.includes("completed") ||
		normalized.includes("revalidated") ||
		normalized.includes("refreshed")
	) {
		return "border-emerald-200 bg-emerald-50 text-emerald-800";
	}

	if (normalized.includes("fallback") || normalized.includes("cached")) {
		return "border-amber-200 bg-amber-50 text-amber-800";
	}

	return "border-rose-200 bg-rose-50 text-rose-800";
};

export const CacheManagementCard = ({
	cacheStatus,
	refreshing,
	refreshMessage,
	onRefresh,
}: CacheManagementCardProps) => {
	const source = sourcePresentation(cacheStatus.dataSource);
	const mode = modePresentation(cacheStatus.configuredDataSource);
	const fallbackActive =
		cacheStatus.configuredDataSource === "remote" &&
		cacheStatus.dataSource !== "store";

	return (
		<Card className="ooo-admin-card-soft">
			<CardHeader className="space-y-2">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div>
						<CardTitle>Events Data Management</CardTitle>
						<CardDescription>
							Remote Mode serves Postgres first. If unavailable, the app serves local
							CSV fallback until store data is restored.
						</CardDescription>
					</div>
					<div className="flex items-center gap-2">
						<Badge variant={mode.variant}>{mode.label}</Badge>
						<Badge variant={source.variant}>{source.label}</Badge>
					</div>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
					<div className="rounded-md border bg-background/60 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Live Events
						</p>
						<p className="mt-1 text-lg font-semibold">{cacheStatus.eventCount}</p>
					</div>
					<div className="rounded-md border bg-background/60 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Store Rows (CSV)
						</p>
						<p className="mt-1 text-lg font-semibold">{cacheStatus.storeRowCount}</p>
					</div>
					<div className="rounded-md border bg-background/60 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Store Provider
						</p>
						<p className="mt-1 text-sm font-medium capitalize">
							{cacheStatus.storeProvider}
						</p>
					</div>
					<div className="rounded-md border bg-background/60 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Last Refresh
						</p>
						<p className="mt-1 text-sm font-medium">
							{cacheStatus.lastFetchTime ?
								new Date(cacheStatus.lastFetchTime).toLocaleString()
							: 	"Never"}
						</p>
					</div>
				</div>

				{fallbackActive && (
					<div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
						Postgres is not currently serving live data. The site is using local CSV
						fallback until Postgres data is available again.
					</div>
				)}

				{cacheStatus.lastRemoteErrorMessage && (
					<div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
						<p className="font-medium">Latest fallback reason</p>
						<p className="mt-1">{cacheStatus.lastRemoteErrorMessage}</p>
					</div>
				)}

				<div className="flex flex-wrap items-center gap-3">
					<Button onClick={onRefresh} disabled={refreshing}>
						{refreshing ? "Refreshing..." : "Refresh Live Cache"}
					</Button>
					<span className="text-xs text-muted-foreground">
						Cache age: {formatDuration(cacheStatus.cacheAge)}
					</span>
				</div>

				{refreshMessage && (
					<div
						className={`rounded-md border p-3 text-sm ${getRefreshMessageTone(refreshMessage)}`}
					>
						{refreshMessage}
					</div>
				)}
			</CardContent>
		</Card>
	);
};
