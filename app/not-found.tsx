import { Button } from "@/components/ui/button";
import { ArrowRight, Compass, Home, Search } from "lucide-react";
import Link from "next/link";
import { NotFoundDevDetails } from "./NotFoundDevDetails";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default function NotFound() {
	return (
		<div className="ooo-site-shell">
			<main className="container mx-auto max-w-4xl px-4 py-14 sm:py-20">
				<section className="overflow-hidden rounded-2xl border border-border/80 bg-card/88 shadow-[0_10px_30px_rgba(20,16,12,0.14)]">
					<div className="border-b border-border/70 bg-gradient-to-r from-background/85 via-background/65 to-background/85 px-6 py-6 sm:px-8">
						<p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
							Fete Finder
						</p>
						<h1
							className="mt-2 text-3xl font-light tracking-tight text-foreground sm:text-4xl"
							style={{ fontFamily: "var(--ooo-font-display)" }}
						>
							You drifted off route
						</h1>
						<p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
							This page is not in the current city map. The route may have
							moved, expired, or never existed.
						</p>
					</div>

					<div className="grid gap-6 px-6 py-6 sm:px-8 sm:py-7 lg:grid-cols-[1.3fr_1fr]">
						<div className="space-y-4">
							<div className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/70 p-3">
								<div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/12">
									<Compass className="h-5 w-5 text-amber-700 dark:text-amber-300" />
								</div>
								<p className="text-sm text-muted-foreground">
									Start from home and reopen your event from search or map.
								</p>
							</div>
							<div className="flex flex-wrap gap-2">
								<Button
									size="lg"
									className="gap-2 rounded-full"
									nativeButton={false}
									render={<Link href={basePath || "/"} />}
								>
									<Home className="h-4 w-4" />
									Go Home
								</Button>
								<Button
									variant="outline"
									size="lg"
									className="gap-2 rounded-full"
									nativeButton={false}
									render={<Link href={basePath || "/"} />}
								>
									<Search className="h-4 w-4" />
									Find Events
								</Button>
							</div>
							{process.env.NODE_ENV === "development" ? <NotFoundDevDetails /> : null}
						</div>

						<aside className="rounded-xl border border-border/70 bg-background/72 p-4">
							<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
								Useful routes
							</p>
							<div className="mt-3 space-y-2">
								<a
									href={basePath || "/"}
									className="flex items-center justify-between rounded-lg border border-border/70 bg-card/70 px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent"
								>
									<span>Home</span>
									<ArrowRight className="h-4 w-4 text-muted-foreground" />
								</a>
								<a
									href={`${basePath}/submit-event`}
									className="flex items-center justify-between rounded-lg border border-border/70 bg-card/70 px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent"
								>
									<span>Submit Event</span>
									<ArrowRight className="h-4 w-4 text-muted-foreground" />
								</a>
								<a
									href={`${basePath}/feature-event`}
									className="flex items-center justify-between rounded-lg border border-border/70 bg-card/70 px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent"
								>
									<span>Promote Event</span>
									<ArrowRight className="h-4 w-4 text-muted-foreground" />
								</a>
							</div>
						</aside>
					</div>
				</section>
			</main>
		</div>
	);
}
