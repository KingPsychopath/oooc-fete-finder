import Header from "@/components/Header";
import { Route, Share2 } from "lucide-react";

const Pulse = ({ className }: { className: string }) => (
	<div className={`animate-pulse rounded bg-muted/55 ${className}`} />
);

const PillPulse = ({ className = "" }: { className?: string }) => (
	<div className={`h-10 animate-pulse rounded-full bg-muted/55 ${className}`} />
);

export default function PlanLoading() {
	return (
		<div className="ooo-site-shell">
			<Header />
			<main
				id="main-content"
				className="min-h-screen bg-background"
				tabIndex={-1}
			>
				<div className="relative overflow-hidden" aria-hidden="true">
					<div className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[linear-gradient(115deg,rgba(251,113,133,0.16),transparent_34%),linear-gradient(245deg,rgba(16,185,129,0.15),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.72),transparent)] dark:bg-[linear-gradient(115deg,rgba(251,113,133,0.12),transparent_34%),linear-gradient(245deg,rgba(16,185,129,0.1),transparent_36%)]" />
					<div className="relative mx-auto flex w-full max-w-6xl flex-col gap-5 px-3 pb-[calc(var(--oooc-mobile-nav-clearance,5.75rem)+1rem)] pt-4 sm:px-5 lg:px-8 lg:pb-12 lg:pt-8">
						<section className="grid items-end gap-8 pt-10 pb-8 sm:pt-14 lg:grid-cols-[minmax(0,0.95fr)_minmax(24rem,0.72fr)] lg:pt-18 lg:pb-12">
							<div className="min-w-0">
								<div className="inline-flex h-7 items-center gap-2 rounded-full border border-border/70 bg-background/72 px-3 text-xs text-muted-foreground shadow-sm backdrop-blur">
									<Share2 className="h-3.5 w-3.5" />
									Plan
								</div>
								<Pulse className="mt-5 h-16 w-full max-w-2xl sm:h-24" />
								<Pulse className="mt-5 h-4 w-full max-w-xl" />
								<Pulse className="mt-2 h-4 w-4/5 max-w-lg" />
								<div className="mt-6 flex flex-wrap gap-2">
									<PillPulse className="w-36" />
									<PillPulse className="w-28" />
									<PillPulse className="w-32" />
								</div>
							</div>
							<div className="max-w-md border-y border-border/70 py-5 text-sm text-muted-foreground lg:justify-self-end">
								<Pulse className="h-3 w-28" />
								<div className="mt-4 flex flex-wrap gap-2">
									<Pulse className="h-5 w-20" />
									<Pulse className="h-5 w-16" />
									<Pulse className="h-5 w-28" />
								</div>
							</div>
						</section>

						<section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start">
							<div className="rounded-2xl border border-border/70 bg-card/92 p-4 shadow-sm sm:p-5">
								<div className="mb-4 flex items-center justify-between gap-3">
									<div>
										<Pulse className="h-3 w-24" />
										<Pulse className="mt-2 h-7 w-44" />
									</div>
									<Route className="h-5 w-5 text-muted-foreground/60" />
								</div>
								<div className="space-y-3">
									{[0, 1, 2].map((index) => (
										<div
											key={index}
											className="rounded-2xl border border-border/70 bg-background/70 p-3"
										>
											<div className="flex items-start gap-3">
												<div className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-card text-sm text-muted-foreground">
													{index + 1}
												</div>
												<div className="min-w-0 flex-1">
													<Pulse className="h-5 w-4/5" />
													<Pulse className="mt-2 h-3 w-1/2" />
													<Pulse className="mt-3 h-3 w-3/4" />
												</div>
											</div>
										</div>
									))}
								</div>
							</div>
							<aside className="rounded-2xl border border-border/70 bg-card/92 p-4 shadow-sm">
								<Pulse className="h-3 w-24" />
								<Pulse className="mt-3 h-12 w-full rounded-xl" />
								<Pulse className="mt-3 h-12 w-full rounded-xl" />
								<Pulse className="mt-5 h-20 w-full rounded-xl" />
							</aside>
						</section>
					</div>
				</div>
			</main>
		</div>
	);
}
