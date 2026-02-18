import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import type { RuntimeDataStatus } from "../types";

type RuntimeDataStatusCardProps = {
	runtimeDataStatus: RuntimeDataStatus;
	refreshing: boolean;
	refreshMessage: string;
	onRefresh: () => void;
};

const sourcePresentation = (
	source: RuntimeDataStatus["dataSource"],
): { label: string; variant: "default" | "secondary" | "outline" | "destructive" } => {
	switch (source) {
		case "store":
			return { label: "Postgres Store", variant: "default" };
		case "local":
			return { label: "Local CSV Fallback", variant: "secondary" };
		case "test":
			return { label: "Test Dataset", variant: "outline" };
		default:
			return { label: "Unknown", variant: "destructive" };
	}
};

const modePresentation = (
	mode: RuntimeDataStatus["configuredDataSource"],
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

	if (normalized.includes("fallback")) {
		return "border-amber-200 bg-amber-50 text-amber-800";
	}

	return "border-rose-200 bg-rose-50 text-rose-800";
};

export const RuntimeDataStatusCard = ({
	runtimeDataStatus,
	refreshing,
	refreshMessage,
	onRefresh,
}: RuntimeDataStatusCardProps) => {
	const source = sourcePresentation(runtimeDataStatus.dataSource);
	const mode = modePresentation(runtimeDataStatus.configuredDataSource);
	const fallbackActive =
		runtimeDataStatus.configuredDataSource === "remote" &&
		runtimeDataStatus.dataSource === "local";

	return (
		<Card className="ooo-admin-card-soft min-w-0 overflow-hidden">
			<CardHeader className="space-y-2">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div>
						<CardTitle>Events Data Status</CardTitle>
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
						<p className="mt-1 text-lg font-semibold">{runtimeDataStatus.eventCount}</p>
						<p className="mt-1 text-xs text-muted-foreground">
							Current runtime payload count.
						</p>
					</div>
					<div className="rounded-md border bg-background/60 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Store Events
						</p>
						<p className="mt-1 text-lg font-semibold">{runtimeDataStatus.storeRowCount}</p>
						<p className="mt-1 text-xs text-muted-foreground">
							Currently saved in the managed database-backed store.
						</p>
					</div>
					<div className="rounded-md border bg-background/60 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Last Runtime Check
						</p>
						<p className="mt-1 text-sm font-medium">
							{runtimeDataStatus.lastFetchTime ?
								new Date(runtimeDataStatus.lastFetchTime).toLocaleString()
							: 	"Never"}
						</p>
						<p className="mt-1 text-xs text-muted-foreground">
							Updated when the runtime source is read.
						</p>
					</div>
				</div>

				{fallbackActive && (
					<div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
						Postgres is not currently serving live data. The site is using local CSV
						fallback until Postgres data is available again.
					</div>
				)}

				{runtimeDataStatus.lastRemoteErrorMessage && (
					<div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
						<p className="font-medium">Latest fallback reason</p>
						<p className="mt-1">{runtimeDataStatus.lastRemoteErrorMessage}</p>
					</div>
				)}

				<div className="flex flex-wrap items-center gap-3">
					<Button onClick={onRefresh} disabled={refreshing}>
						{refreshing ? "Revalidating..." : "Revalidate Homepage"}
					</Button>
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
