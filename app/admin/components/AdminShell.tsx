"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Bell, Home, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
	ADMIN_ROUTES,
	getAdminRouteByPath,
	isAdminRouteActive,
	stripAdminBasePath,
	withAdminBasePath,
} from "../config";
import { AdminCommandPalette } from "./AdminCommandPalette";

type AdminShellProps = {
	children: ReactNode;
	notificationCounts: {
		pendingSubmissions: number;
		pendingPlacements: number;
		oldestPendingSubmissionAt: string | null;
		oldestPendingPlacementAt: string | null;
		newestPendingSubmissionAt: string | null;
		newestPendingPlacementAt: string | null;
		lastUpdatedAt: string;
	};
};

export function AdminShell({
	children,
	notificationCounts,
}: AdminShellProps) {
	const router = useRouter();
	const pathname = usePathname();
	const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
	const [isActionCenterOpen, setIsActionCenterOpen] = useState(false);
	const [pendingAnchor, setPendingAnchor] = useState<{
		pathname: string;
		anchorId: string;
	} | null>(null);
	const [seenState, setSeenState] = useState<{
		submissionsNewestSeenAt: string | null;
		placementsNewestSeenAt: string | null;
	}>({
		submissionsNewestSeenAt: null,
		placementsNewestSeenAt: null,
	});
	const [isRefreshingCounts, setIsRefreshingCounts] = useState(false);
	const normalizedPath = stripAdminBasePath(pathname || "/admin");
	const activeRoute = getAdminRouteByPath(normalizedPath);
	const totalNotifications =
		notificationCounts.pendingSubmissions + notificationCounts.pendingPlacements;

	const formatRelativeAge = (isoDate: string | null): string | null => {
		if (!isoDate) return null;
		const time = new Date(isoDate).getTime();
		if (!Number.isFinite(time)) return null;
		const diffMs = Date.now() - time;
		if (diffMs < 0) return "just now";
		const totalMinutes = Math.floor(diffMs / (1000 * 60));
		if (totalMinutes < 60) return `${Math.max(totalMinutes, 1)}m ago`;
		const totalHours = Math.floor(totalMinutes / 60);
		if (totalHours < 24) return `${totalHours}h ago`;
		const totalDays = Math.floor(totalHours / 24);
		return `${totalDays}d ago`;
	};

	const oldestPendingSubmissionAge = formatRelativeAge(
		notificationCounts.oldestPendingSubmissionAt,
	);
	const oldestPendingPlacementAge = formatRelativeAge(
		notificationCounts.oldestPendingPlacementAt,
	);

	const isSubmissionNewSinceLastVisit = useMemo(() => {
		if (!notificationCounts.newestPendingSubmissionAt) return false;
		if (!seenState.submissionsNewestSeenAt) {
			return notificationCounts.pendingSubmissions > 0;
		}
		return (
			new Date(notificationCounts.newestPendingSubmissionAt).getTime() >
			new Date(seenState.submissionsNewestSeenAt).getTime()
		);
	}, [
		notificationCounts.newestPendingSubmissionAt,
		notificationCounts.pendingSubmissions,
		seenState.submissionsNewestSeenAt,
	]);

	const isPlacementNewSinceLastVisit = useMemo(() => {
		if (!notificationCounts.newestPendingPlacementAt) return false;
		if (!seenState.placementsNewestSeenAt) {
			return notificationCounts.pendingPlacements > 0;
		}
		return (
			new Date(notificationCounts.newestPendingPlacementAt).getTime() >
			new Date(seenState.placementsNewestSeenAt).getTime()
		);
	}, [
		notificationCounts.newestPendingPlacementAt,
		notificationCounts.pendingPlacements,
		seenState.placementsNewestSeenAt,
	]);

	const getRouteAlertCount = (routeKey: string): number => {
		if (routeKey === "content") return notificationCounts.pendingSubmissions;
		if (routeKey === "placements") return notificationCounts.pendingPlacements;
		return 0;
	};

	const navigateToSection = (pathWithHash: string): void => {
		const [targetPath, hashPart] = pathWithHash.split("#");
		const anchorId = hashPart?.trim();
		const nextPath = withAdminBasePath(targetPath);

		setIsActionCenterOpen(false);
		if (!anchorId) {
			router.push(nextPath);
			return;
		}

		setPendingAnchor({ pathname: targetPath, anchorId });
		router.push(withAdminBasePath(pathWithHash));
	};

	useEffect(() => {
		if (typeof window === "undefined") return;
		const submissionsNewestSeenAt = window.localStorage.getItem(
			"admin-action-center:submissions-seen-at",
		);
		const placementsNewestSeenAt = window.localStorage.getItem(
			"admin-action-center:placements-seen-at",
		);
		setSeenState({
			submissionsNewestSeenAt: submissionsNewestSeenAt || null,
			placementsNewestSeenAt: placementsNewestSeenAt || null,
		});
	}, []);

	useEffect(() => {
		if (!isActionCenterOpen || typeof window === "undefined") return;

		if (notificationCounts.newestPendingSubmissionAt) {
			window.localStorage.setItem(
				"admin-action-center:submissions-seen-at",
				notificationCounts.newestPendingSubmissionAt,
			);
		}
		if (notificationCounts.newestPendingPlacementAt) {
			window.localStorage.setItem(
				"admin-action-center:placements-seen-at",
				notificationCounts.newestPendingPlacementAt,
			);
		}
		setSeenState({
			submissionsNewestSeenAt: notificationCounts.newestPendingSubmissionAt,
			placementsNewestSeenAt: notificationCounts.newestPendingPlacementAt,
		});
	}, [
		isActionCenterOpen,
		notificationCounts.newestPendingPlacementAt,
		notificationCounts.newestPendingSubmissionAt,
	]);

	useEffect(() => {
		if (!pendingAnchor || normalizedPath !== pendingAnchor.pathname) return;

		let attempts = 0;
		const maxAttempts = 10;
		const scrollToTarget = () => {
			const target = document.getElementById(pendingAnchor.anchorId);
			if (target) {
				target.scrollIntoView({ behavior: "smooth", block: "start" });
				setPendingAnchor(null);
				return;
			}
			if (attempts < maxAttempts) {
				attempts += 1;
				window.setTimeout(scrollToTarget, 80);
			} else {
				setPendingAnchor(null);
			}
		};

		window.setTimeout(scrollToTarget, 0);
	}, [normalizedPath, pendingAnchor]);

	return (
		<div className="ooo-admin-shell overflow-x-hidden">
			<div className="mx-auto w-full max-w-[1960px] px-4 py-6 sm:px-6 lg:px-8">
				<div className="mb-4 flex flex-wrap items-start justify-between gap-3">
					<div>
						<p className="ooo-admin-kicker">Out Of Office Collective</p>
						<h1 className="ooo-admin-title">Admin Workflow Console</h1>
						<p className="mt-1 max-w-3xl text-sm text-muted-foreground">
							{activeRoute?.description ||
								"Operational controls, scheduling, content management, and insights."}
						</p>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<Link href={withAdminBasePath("/")}>
							<Button variant="outline" size="sm" className="gap-2">
								<Home className="h-3.5 w-3.5" />
								Back to Home
							</Button>
						</Link>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="relative gap-2"
							onClick={() => setIsActionCenterOpen(true)}
						>
							<Bell className="h-3.5 w-3.5" />
							Action Center
							{totalNotifications > 0 && (
								<Badge
									variant="destructive"
									className="h-5 min-w-5 rounded-full px-1.5 text-[10px]"
								>
									{totalNotifications}
								</Badge>
							)}
							{(isSubmissionNewSinceLastVisit || isPlacementNewSinceLastVisit) && (
								<span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-emerald-500" />
							)}
						</Button>
						<div className="hidden md:block">
							<AdminCommandPalette />
						</div>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => setIsMobileNavOpen(true)}
							className="gap-2 lg:hidden"
						>
							<Menu className="h-3.5 w-3.5" />
							Menu
						</Button>
					</div>
				</div>

				<div className="mb-4 md:hidden">
					<AdminCommandPalette triggerClassName="w-full justify-between" />
				</div>

				<div className="grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
					<aside className="hidden lg:block">
						<div className="sticky top-4 rounded-2xl border bg-card/80 p-4 backdrop-blur ooo-admin-card-soft">
							<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
								Admin Areas
							</p>
							<nav className="mt-3 space-y-1.5">
								{ADMIN_ROUTES.map((route) => {
									const active = isAdminRouteActive(route, normalizedPath);
									const routeAlertCount = getRouteAlertCount(route.key);
									return (
										<Link
											key={route.key}
											href={withAdminBasePath(route.path)}
											className={cn(
												"block rounded-lg border px-3 py-2 text-sm transition-colors",
												active
													? "border-border bg-muted/70 font-medium"
													: "border-transparent hover:border-border/70 hover:bg-muted/40",
											)}
										>
											<p>{route.label}</p>
											{routeAlertCount > 0 && (
												<Badge
													variant="destructive"
													className="mt-1 h-5 rounded-full px-1.5 text-[10px]"
												>
													{routeAlertCount} pending
												</Badge>
											)}
											<p className="mt-0.5 text-xs text-muted-foreground">
												{route.path.replace("/admin", "") || "/"}
											</p>
										</Link>
									);
								})}
							</nav>
						</div>
					</aside>

					<div className="min-w-0">
						{activeRoute && activeRoute.sections.length > 0 && (
							<div className="sticky top-0 z-20 mb-4 rounded-xl border bg-card/85 p-3 backdrop-blur">
								<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
									Jump to section
								</p>
								<div className="mt-2 flex gap-2 overflow-x-auto pb-1">
									{activeRoute.sections.map((section) => (
										<Link
											key={section.id}
											href={withAdminBasePath(
												`${activeRoute.path}#${section.id}`,
											)}
											className="inline-flex h-7 shrink-0 items-center rounded-md border bg-background px-2.5 text-xs font-medium transition-colors hover:bg-muted"
										>
											{section.label}
										</Link>
									))}
								</div>
							</div>
						)}

						<main className="min-w-0">{children}</main>
					</div>
				</div>
			</div>

			<Dialog open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle>Admin areas</DialogTitle>
						<DialogDescription>
							Pick an area to navigate quickly.
						</DialogDescription>
					</DialogHeader>
					<nav className="space-y-2">
						{ADMIN_ROUTES.map((route) => {
							const active = isAdminRouteActive(route, normalizedPath);
							const routeAlertCount = getRouteAlertCount(route.key);
							return (
								<Link
									key={route.key}
									href={withAdminBasePath(route.path)}
									onClick={() => setIsMobileNavOpen(false)}
									className={cn(
										"block rounded-lg border px-3 py-2 text-sm",
										active
											? "border-border bg-muted/70 font-medium"
											: "border-transparent hover:border-border/70 hover:bg-muted/40",
									)}
								>
									<div className="flex items-center justify-between gap-2">
										<span>{route.label}</span>
										{routeAlertCount > 0 && (
											<Badge
												variant="destructive"
												className="h-5 rounded-full px-1.5 text-[10px]"
											>
												{routeAlertCount}
											</Badge>
										)}
									</div>
								</Link>
							);
						})}
					</nav>
				</DialogContent>
			</Dialog>

			<Dialog open={isActionCenterOpen} onOpenChange={setIsActionCenterOpen}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>Action Center</DialogTitle>
						<DialogDescription>
							Pending work that needs admin attention.
						</DialogDescription>
					</DialogHeader>
					<div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
						<span>
							Last updated{" "}
							{new Date(notificationCounts.lastUpdatedAt).toLocaleTimeString()}
						</span>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={async () => {
								setIsRefreshingCounts(true);
								try {
									router.refresh();
								} finally {
									window.setTimeout(() => setIsRefreshingCounts(false), 250);
								}
							}}
							disabled={isRefreshingCounts}
						>
							{isRefreshingCounts ? "Refreshing..." : "Refresh counts"}
						</Button>
					</div>
					<div className="space-y-2">
						<button
							type="button"
							onClick={() => navigateToSection("/admin/content#event-submissions")}
							className="block w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
						>
							<p className="text-sm font-medium">Event Submissions</p>
							<p className="mt-1 text-xs text-muted-foreground">
								{notificationCounts.pendingSubmissions > 0
									? `${notificationCounts.pendingSubmissions} pending review`
									: "No pending submissions"}
							</p>
							<p className="mt-1 text-xs text-muted-foreground">
								{oldestPendingSubmissionAge ?
									`Oldest pending: ${oldestPendingSubmissionAge}`
								:	"Oldest pending: none"}
							</p>
							{isSubmissionNewSinceLastVisit && (
								<Badge variant="secondary" className="mt-2 text-[10px]">
									New since last visit
								</Badge>
							)}
						</button>
						<button
							type="button"
							onClick={() => navigateToSection("/admin/placements#paid-orders-inbox")}
							className="block w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
						>
							<p className="text-sm font-medium">Paid Orders Queue</p>
							<p className="mt-1 text-xs text-muted-foreground">
								{notificationCounts.pendingPlacements > 0
									? `${notificationCounts.pendingPlacements} pending fulfillment`
									: "No pending paid orders"}
							</p>
							<p className="mt-1 text-xs text-muted-foreground">
								{oldestPendingPlacementAge ?
									`Oldest pending: ${oldestPendingPlacementAge}`
								:	"Oldest pending: none"}
							</p>
							{isPlacementNewSinceLastVisit && (
								<Badge variant="secondary" className="mt-2 text-[10px]">
									New since last visit
								</Badge>
							)}
						</button>
						{totalNotifications === 0 && (
							<div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
								All caught up. No pending submissions or paid orders.
							</div>
						)}
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
