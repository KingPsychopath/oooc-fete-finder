import { DataManager } from "@/features/data-management/data-manager";
import { env } from "@/lib/config/env";
import Link from "next/link";

export async function ArchiveAdminStatus() {
	const eventsResult = await DataManager.getEventsData({
		populateCoordinates: false,
	}).catch((error) => ({
		success: false,
		count: 0,
		source: "local" as const,
		warnings: [],
		error: error instanceof Error ? error.message : "Unknown archive load error",
	}));

	return (
		<main className="min-h-screen bg-background px-4 py-8 text-foreground">
			<section className="mx-auto max-w-3xl rounded-xl border border-border bg-card p-6 shadow-sm">
				<p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
					Admin Archive Status
				</p>
				<h1 className="mt-2 text-3xl font-light tracking-tight">
					Archive mode is enabled
				</h1>
				<p className="mt-3 text-sm leading-relaxed text-muted-foreground">
					The full admin dashboard is disabled in archive mode so the public app
					can run from the bundled CSV without depending on Postgres-backed
					admin stores.
				</p>

				<div className="mt-6 grid gap-3 sm:grid-cols-2">
					<div className="rounded-lg border border-border bg-background/70 p-4">
						<p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
							Event Source
						</p>
						<p className="mt-2 text-xl font-medium">{eventsResult.source}</p>
						<p className="mt-1 text-sm text-muted-foreground">
							{eventsResult.count} events loaded
						</p>
					</div>
					<div className="rounded-lg border border-border bg-background/70 p-4">
						<p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
							Postgres URL
						</p>
						<p className="mt-2 text-xl font-medium">
							{env.DATABASE_URL ? "Configured" : "Not configured"}
						</p>
						<p className="mt-1 text-sm text-muted-foreground">
							Archive reads do not require it.
						</p>
					</div>
				</div>

				<div className="mt-6 rounded-lg border border-border bg-background/70 p-4 text-sm">
					<p className="font-medium">Archive behavior</p>
					<ul className="mt-3 space-y-2 text-muted-foreground">
						<li>Event browsing uses the bundled CSV archive.</li>
						<li>Login, account sync, admin writes, submissions, and paid intake are disabled.</li>
						<li>Planner and Ticket Exchange run as local-only browser demos.</li>
						<li>First-party analytics and scheduled database maintenance are suppressed.</li>
					</ul>
				</div>

				{eventsResult.success ? null : (
					<p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
						{eventsResult.error}
					</p>
				)}
				{eventsResult.warnings.length > 0 ? (
					<div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100">
						{eventsResult.warnings.join(" ")}
					</div>
				) : null}

				<Link
					href="/"
					className="mt-6 inline-flex text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
				>
					View public archive
				</Link>
			</section>
		</main>
	);
}
