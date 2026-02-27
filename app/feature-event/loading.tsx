function HeaderSkeleton() {
	return (
		<>
			<header className="sticky top-0 z-50 px-3 pt-2 sm:px-4 sm:pt-3" aria-hidden="true">
				<div className="mx-auto w-full max-w-[1400px] rounded-2xl border border-border/65 bg-card/86 shadow-[0_6px_18px_rgba(20,16,12,0.16)] backdrop-blur-lg">
					<div className="mx-auto flex min-h-[72px] items-center justify-between gap-3 px-3 py-3 sm:min-h-[84px] sm:px-5">
						<div className="flex min-w-0 items-center gap-3">
							<div className="h-10 w-10 animate-pulse rounded-full bg-muted/55 sm:h-12 sm:w-12" />
							<div className="space-y-2">
								<div className="h-2.5 w-32 animate-pulse rounded bg-muted/55 sm:w-40" />
								<div className="h-5 w-28 animate-pulse rounded bg-muted/50 sm:w-36" />
							</div>
						</div>
						<div className="flex items-center gap-2.5 sm:gap-3">
							<div className="hidden h-9 w-32 animate-pulse rounded-full bg-muted/50 sm:block" />
							<div className="h-9 w-9 animate-pulse rounded-full bg-muted/55" />
							<div className="h-9 w-9 animate-pulse rounded-full bg-muted/55 sm:w-20" />
						</div>
					</div>
					<div className="border-t border-border/70 px-3 py-2 sm:px-5 sm:py-3">
						<div className="h-5 w-full animate-pulse rounded bg-muted/50" />
					</div>
				</div>
			</header>
			<div className="mx-3 mt-2 rounded-xl border border-white/35 bg-[rgba(246,241,233,0.78)] p-2 dark:border-white/16 dark:bg-[rgba(12,13,16,0.82)] sm:mx-4">
				<div className="h-4 w-full animate-pulse rounded bg-muted/45" />
			</div>
		</>
	);
}

export default function FeatureEventLoading() {
	return (
		<div className="ooo-site-shell">
			<HeaderSkeleton />
			<main className="container mx-auto max-w-6xl px-4 py-10 pb-28 sm:pb-12">
				<div className="space-y-8" aria-hidden="true">
					<section className="rounded-2xl border border-border/80 bg-card/85 p-6 sm:p-8">
						<div className="h-3 w-40 animate-pulse rounded bg-muted/60" />
						<div className="mt-3 h-10 w-full max-w-2xl animate-pulse rounded bg-muted/55" />
						<div className="mt-3 h-4 w-full max-w-3xl animate-pulse rounded bg-muted/50" />
						<div className="mt-2 h-4 w-full max-w-2xl animate-pulse rounded bg-muted/50" />
						<div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
							<div className="h-20 animate-pulse rounded-xl border border-border/70 bg-background/70" />
							<div className="h-20 animate-pulse rounded-xl border border-border/70 bg-background/70" />
							<div className="h-20 animate-pulse rounded-xl border border-border/70 bg-background/70" />
						</div>
					</section>

					<section className="rounded-2xl border border-border/80 bg-card p-6">
						<div className="h-3 w-28 animate-pulse rounded bg-muted/60" />
						<div className="mt-3 h-8 w-full max-w-lg animate-pulse rounded bg-muted/55" />
						<div className="mt-5 grid gap-4 md:grid-cols-3">
							<div className="h-72 animate-pulse rounded-xl border border-border bg-card/60" />
							<div className="h-72 animate-pulse rounded-xl border border-border bg-card/60" />
							<div className="h-72 animate-pulse rounded-xl border border-border bg-card/60" />
						</div>
					</section>

					<section className="grid gap-4 md:grid-cols-2">
						<div className="h-56 animate-pulse rounded-xl border border-border bg-card/60" />
						<div className="h-56 animate-pulse rounded-xl border border-border bg-card/60" />
					</section>
				</div>
			</main>
		</div>
	);
}
