import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { getAdminActivityOverview } from "@/features/admin/activity/actions";
import { getRuntimeDataStatus } from "@/features/data-management/actions";
import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { AdminActivityTimelineCard } from "./components/AdminActivityTimelineCard";
import { ADMIN_ROUTES, withAdminBasePath } from "./config";

export const dynamic = "force-dynamic";

const formatRuntimeSourceLabel = (source: string): string => {
	switch (source) {
		case "store":
			return "Postgres Store";
		case "backup":
			return "Event Backup Fallback";
		case "local":
			return "Local CSV Fallback";
		case "test":
			return "Test Dataset";
		default:
			return "Unknown";
	}
};

export default async function AdminPage() {
	noStore();

	const [runtimeDataStatusResult, activityOverviewResult] =
		await Promise.allSettled([
			getRuntimeDataStatus(),
			getAdminActivityOverview(undefined, 90),
		]);
	const runtimeDataStatus =
		runtimeDataStatusResult.status === "fulfilled"
			? runtimeDataStatusResult.value
			: undefined;
	const activityOverview =
		activityOverviewResult.status === "fulfilled"
			? activityOverviewResult.value
			: {
					success: false,
					supported: false,
					error: "Failed to load activity timeline",
				};

	const adminAreas = ADMIN_ROUTES.filter((route) => route.key !== "hub");

	return (
		<div className="space-y-6">
			<Card className="ooo-admin-card min-w-0 overflow-hidden">
				<CardHeader className="space-y-3">
					<div className="flex flex-wrap items-start justify-between gap-3">
						<div>
							<CardTitle>Admin Overview</CardTitle>
							<CardDescription>
								Use this page as a launchpad. Open one focused area at a time
								instead of scrolling through every tool in one screen.
							</CardDescription>
						</div>
						<Link href={withAdminBasePath("/admin/operations")}>
							<Button size="sm">Open System Operations</Button>
						</Link>
					</div>
				</CardHeader>

				<CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
					<Link
						href={withAdminBasePath("/admin/operations#events-data-status")}
						className="block rounded-md border bg-background/60 p-3 transition-colors hover:border-foreground/30 hover:bg-muted/35"
						title="Open runtime data status"
					>
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Runtime Source
						</p>
						<p className="mt-1 text-sm font-medium">
							{formatRuntimeSourceLabel(
								runtimeDataStatus?.dataSource ?? "unknown",
							)}
						</p>
						<p className="mt-1 text-xs text-muted-foreground">
							Open runtime status
						</p>
					</Link>
					<Link
						href={withAdminBasePath("/admin/operations#live-site-snapshot")}
						className="block rounded-md border bg-background/60 p-3 transition-colors hover:border-foreground/30 hover:bg-muted/35"
						title="Open live runtime snapshot"
					>
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							This Year&apos;s Events
						</p>
						<p className="mt-1 text-sm font-medium">
							{runtimeDataStatus?.currentYearEventCount ?? 0}
						</p>
						<p className="mt-1 text-xs text-muted-foreground">
							Open live snapshot
						</p>
					</Link>
					<Link
						href={withAdminBasePath("/admin/operations#data-store-controls")}
						className="block rounded-md border bg-background/60 p-3 transition-colors hover:border-foreground/30 hover:bg-muted/35"
						title="Open event store controls"
					>
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Store Rows
						</p>
						<p className="mt-1 text-sm font-medium">
							{runtimeDataStatus?.storeRowCount ?? 0}
						</p>
						<p className="mt-1 text-xs text-muted-foreground">
							Open store controls
						</p>
					</Link>
					<Link
						href={withAdminBasePath("/admin#admin-areas")}
						className="block rounded-md border bg-background/60 p-3 transition-colors hover:border-foreground/30 hover:bg-muted/35"
						title="Jump to admin area cards"
					>
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Admin Areas
						</p>
						<p className="mt-1 text-sm font-medium">{adminAreas.length}</p>
						<p className="mt-1 text-xs text-muted-foreground">
							Jump to area cards
						</p>
					</Link>
				</CardContent>
			</Card>

			<AdminActivityTimelineCard
				events={activityOverview.success ? (activityOverview.events ?? []) : []}
				categoryCounts={
					activityOverview.success && activityOverview.categoryCounts
						? activityOverview.categoryCounts
						: {
								auth: 0,
								content: 0,
								insights: 0,
								operations: 0,
								placements: 0,
								settings: 0,
							}
				}
				supported={activityOverview.supported !== false}
				error={activityOverview.success ? undefined : activityOverview.error}
			/>

			<div id="admin-areas" className="grid scroll-mt-44 gap-4 xl:grid-cols-2">
				{adminAreas.map((route) => (
					<Card
						key={route.key}
						className="ooo-admin-card-soft min-w-0 overflow-hidden"
					>
						<CardHeader className="space-y-2">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<div>
									<CardTitle>{route.label}</CardTitle>
									<CardDescription>{route.description}</CardDescription>
								</div>
								<Badge variant="outline">
									{route.sections.length} sections
								</Badge>
							</div>
						</CardHeader>
						<CardContent className="space-y-3">
							<div className="flex flex-wrap gap-2">
								<Link href={withAdminBasePath(route.path)}>
									<Button size="sm">Open {route.label}</Button>
								</Link>
								{route.sections[0] && (
									<Link href={withAdminBasePath(route.sections[0].path)}>
										<Button variant="outline" size="sm">
											Jump to {route.sections[0].label}
										</Button>
									</Link>
								)}
							</div>
							<div className="flex flex-wrap gap-1.5">
								{route.sections.map((section) => (
									<Link
										key={section.id}
										href={withAdminBasePath(section.path)}
										className="inline-flex h-6 items-center rounded-md border px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
									>
										{section.label}
									</Link>
								))}
							</div>
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);
}
