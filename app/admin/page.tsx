import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { getRuntimeDataStatus } from "@/features/data-management/actions";
import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { ADMIN_ROUTES, withAdminBasePath } from "./config";

export const dynamic = "force-dynamic";

const formatRuntimeSourceLabel = (source: string): string => {
	switch (source) {
		case "store":
			return "Postgres Store";
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

	const runtimeDataStatusResult = await Promise.allSettled([
		getRuntimeDataStatus(),
	]);
	const runtimeDataStatus =
		runtimeDataStatusResult[0].status === "fulfilled"
			? runtimeDataStatusResult[0].value
			: undefined;

	const adminAreas = ADMIN_ROUTES.filter((route) => route.key !== "hub");

	return (
		<div className="space-y-6">
			<Card className="ooo-admin-card min-w-0 overflow-hidden">
				<CardHeader className="space-y-3">
					<div className="flex flex-wrap items-start justify-between gap-3">
						<div>
							<CardTitle>Admin Hub</CardTitle>
							<CardDescription>
								Use this page as a launchpad. Open one focused module at a
									time instead of scrolling through every tool in one screen.
									Each area groups related tasks.
								</CardDescription>
							</div>
						<Link href={withAdminBasePath("/admin/operations")}>
							<Button size="sm">Open Operations</Button>
						</Link>
					</div>
				</CardHeader>

				<CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
					<div className="rounded-md border bg-background/60 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Runtime Source
						</p>
						<p className="mt-1 text-sm font-medium">
							{formatRuntimeSourceLabel(runtimeDataStatus?.dataSource ?? "unknown")}
						</p>
					</div>
					<div className="rounded-md border bg-background/60 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Live Event Count
						</p>
						<p className="mt-1 text-sm font-medium">
							{runtimeDataStatus?.eventCount ?? 0}
						</p>
					</div>
					<div className="rounded-md border bg-background/60 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Store Rows
						</p>
						<p className="mt-1 text-sm font-medium">
							{runtimeDataStatus?.storeRowCount ?? 0}
						</p>
					</div>
					<div className="rounded-md border bg-background/60 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Admin Areas
						</p>
						<p className="mt-1 text-sm font-medium">{adminAreas.length}</p>
					</div>
				</CardContent>
			</Card>

			<div className="grid gap-4 xl:grid-cols-2">
				{adminAreas.map((route) => (
					<Card key={route.key} className="ooo-admin-card-soft min-w-0 overflow-hidden">
						<CardHeader className="space-y-2">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<div>
									<CardTitle>{route.label}</CardTitle>
									<CardDescription>{route.description}</CardDescription>
								</div>
								<Badge variant="outline">{route.sections.length} sections</Badge>
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
