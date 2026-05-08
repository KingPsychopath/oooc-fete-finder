export function EventShareLoadingShell() {
	return (
		<div className="relative min-h-[62svh]" aria-hidden="true">
			<div className="fixed inset-0 z-[95] bg-foreground/45 backdrop-blur-sm" />
			<section className="fixed left-1/2 top-1/2 z-[96] w-[min(calc(100vw-2rem),38rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border/80 bg-card p-4 shadow-[0_24px_70px_-36px_rgba(0,0,0,0.82)] sm:p-5">
				<div className="flex items-start justify-between gap-4">
					<div className="min-w-0 flex-1">
						<div className="h-2 w-32 animate-pulse rounded bg-muted/70" />
						<div className="mt-4 h-8 w-full max-w-sm animate-pulse rounded bg-muted/75" />
						<div className="mt-4 flex flex-wrap gap-2">
							<div className="h-6 w-16 animate-pulse rounded-full bg-muted/65" />
							<div className="h-6 w-24 animate-pulse rounded-full bg-muted/65" />
							<div className="h-6 w-20 animate-pulse rounded-full bg-muted/65" />
						</div>
					</div>
					<div className="flex gap-2">
						<div className="size-10 animate-pulse rounded-xl bg-muted/65" />
						<div className="size-10 animate-pulse rounded-xl bg-muted/65" />
					</div>
				</div>

				<div className="mt-6 grid gap-2 sm:grid-cols-2">
					{Array.from({ length: 4 }, (_, index) => (
						<div
							key={index}
							className="h-16 animate-pulse rounded-xl border border-border/70 bg-background/60"
						/>
					))}
				</div>

				<div className="mt-3 h-20 animate-pulse rounded-xl border border-border/70 bg-background/60" />
				<div className="mt-5 grid gap-2 sm:grid-cols-2">
					<div className="h-11 animate-pulse rounded-lg bg-primary/70" />
					<div className="h-11 animate-pulse rounded-lg border border-border/80 bg-background/70" />
				</div>
			</section>
		</div>
	);
}
