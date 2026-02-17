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
		case "remote":
			return { label: "Remote CSV", variant: "secondary" };
		case "local":
			return { label: "Local File", variant: "outline" };
		case "test":
			return { label: "Test Dataset", variant: "outline" };
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
			return { label: "Remote Mode", variant: "secondary" };
		case "local":
			return { label: "Local Mode", variant: "outline" };
		case "test":
			return { label: "Test Mode", variant: "outline" };
		default:
			return { label: "Unknown Mode", variant: "destructive" };
	}
};

const getRefreshMessageTone = (message: string) => {
	if (!message) return "";

	const normalized = message.toLowerCase();
	if (
		normalized.includes("success") ||
		normalized.includes("completed") ||
		normalized.includes("refreshed")
	) {
		return "border-emerald-200 bg-emerald-50 text-emerald-800";
	}
	if (
		normalized.includes("warning") ||
		normalized.includes("fallback") ||
		normalized.includes("cached")
	) {
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

	const cacheFreshness =
		cacheStatus.cacheAge > 0 ? formatDuration(cacheStatus.cacheAge) : "Just refreshed";

	return (
		<Card className="border-white/20 bg-white/90 backdrop-blur-sm">
			<CardHeader className="space-y-2">
				<CardTitle>Events Data Management</CardTitle>
				<CardDescription>
					Track what is live, verify source alignment, and refresh the cache when
					publishing updates.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-5">
				<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
					<div className="rounded-md border bg-background/60 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Live Source
						</p>
						<Badge variant={source.variant} className="mt-2">
							{source.label}
						</Badge>
					</div>
					<div className="rounded-md border bg-background/60 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Configured Mode
						</p>
						<Badge variant={mode.variant} className="mt-2">
							{mode.label}
						</Badge>
					</div>
					<div className="rounded-md border bg-background/60 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Events Count
						</p>
						<p className="mt-1 text-2xl font-semibold">{cacheStatus.eventCount}</p>
					</div>
					<div className="rounded-md border bg-background/60 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Cache Freshness
						</p>
						<p className="mt-1 text-sm font-medium">{cacheFreshness}</p>
					</div>
				</div>

				{cacheStatus.dataSource === "store" ? (
					<div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
						Serving from Postgres-backed managed store. This is the expected
						Remote Mode behavior.
					</div>
				) : cacheStatus.dataSource === "test" ? (
					<div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
						Running in Test Mode with hardcoded data. Postgres and remote CSV are
						bypassed in this mode.
					</div>
				) : cacheStatus.hasLocalStoreData ? (
					<div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
						Live source is <strong>{source.label}</strong>, not Postgres store. Use
						Publish in the sheet editor if you want managed store data to become
						live.
					</div>
				) : (
					<div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
						Managed store is empty. Import remote CSV in Data Store Controls, then
						publish from the sheet editor.
					</div>
				)}

				<div className="rounded-md border bg-background/60 p-3 text-xs text-muted-foreground">
					<p className="font-medium text-foreground">Mode semantics (single source model)</p>
					<p className="mt-1">
						Remote: read from managed Postgres store first. File/memory are
						emergency local fallbacks. Remote CSV (Google legacy mirror) is used
						only if store is empty/unavailable.
					</p>
					<p className="mt-1">
						Local: read from local fallback file (`data/events.csv`) only.
					</p>
					<p className="mt-1">Test: read from hardcoded demo dataset only.</p>
				</div>

				<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
					<div className="rounded-md border bg-background/60 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Remote Configured
						</p>
						<p className="mt-1 text-sm font-medium">
							{cacheStatus.remoteConfigured ? "Yes" : "No"}
						</p>
					</div>
					<div className="rounded-md border bg-background/60 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Store Has Data
						</p>
						<p className="mt-1 text-sm font-medium">
							{cacheStatus.hasLocalStoreData ? "Yes" : "No"}
						</p>
					</div>
					<div className="rounded-md border bg-background/60 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Store Provider
						</p>
						<p className="mt-1 text-sm font-medium">{cacheStatus.storeProvider}</p>
					</div>
					<div className="rounded-md border bg-background/60 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Store Keys
						</p>
						<p className="mt-1 text-sm font-medium">{cacheStatus.storeKeyCount}</p>
					</div>
					<div className="rounded-md border bg-background/60 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Last Remote Success
						</p>
						<p className="mt-1 text-sm font-medium">
							{cacheStatus.lastRemoteSuccessTime ?
								new Date(cacheStatus.lastRemoteSuccessTime).toLocaleString()
							:	"Never"}
						</p>
					</div>
					<div className="rounded-md border bg-background/60 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Next Remote Check
						</p>
						<p className="mt-1 text-sm font-medium">
							{cacheStatus.nextRemoteCheck > 0 ?
								`In ${formatDuration(cacheStatus.nextRemoteCheck)}`
							:	"Due now"}
						</p>
					</div>
				</div>

				<div className="grid gap-3 md:grid-cols-2">
					<div className="rounded-md border bg-background/60 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Store Rows
						</p>
						<p className="mt-1 text-sm font-medium">{cacheStatus.storeRowCount}</p>
					</div>
					<div className="rounded-md border bg-background/60 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Store Updated
						</p>
						<p className="mt-1 text-sm font-medium">
							{cacheStatus.storeUpdatedAt ?
								new Date(cacheStatus.storeUpdatedAt).toLocaleString()
							:	"Never"}
						</p>
						<p className="mt-1 break-all text-[11px] text-muted-foreground">
							{cacheStatus.storeProviderLocation}
						</p>
					</div>
				</div>

				{cacheStatus.lastRemoteErrorMessage && (
					<div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
						<p className="font-medium">Last remote warning</p>
						<p className="mt-1">{cacheStatus.lastRemoteErrorMessage}</p>
					</div>
				)}

				<div className="flex flex-wrap items-center gap-3">
					<Button onClick={onRefresh} disabled={refreshing}>
						{refreshing ? "Refreshing..." : "Refresh Cache + Revalidate"}
					</Button>
					<div className="text-xs text-muted-foreground">
						Last cache update:{" "}
						{cacheStatus.lastFetchTime ?
							new Date(cacheStatus.lastFetchTime).toLocaleString()
						:	"Unknown"}
					</div>
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
