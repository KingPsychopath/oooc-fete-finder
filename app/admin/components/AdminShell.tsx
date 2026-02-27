"use client";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Home, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
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
};

export function AdminShell({ children }: AdminShellProps) {
	const pathname = usePathname();
	const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
	const normalizedPath = stripAdminBasePath(pathname || "/admin");
	const activeRoute = getAdminRouteByPath(normalizedPath);

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
									{route.label}
								</Link>
							);
						})}
					</nav>
				</DialogContent>
			</Dialog>
		</div>
	);
}
