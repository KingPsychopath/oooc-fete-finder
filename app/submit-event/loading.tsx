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

export default function SubmitEventLoading() {
	return (
		<div className="ooo-site-shell">
			<HeaderSkeleton />
			<main id="main-content" className="container mx-auto px-4 py-8">
				<section className="mx-auto max-w-3xl space-y-4" aria-hidden="true">
					<div className="h-3 w-32 animate-pulse rounded bg-muted/60" />
					<div className="h-10 w-full max-w-md animate-pulse rounded bg-muted/55" />
					<div className="h-4 w-full max-w-2xl animate-pulse rounded bg-muted/50" />
					<div className="h-4 w-full max-w-xl animate-pulse rounded bg-muted/50" />
					<div className="border-t border-border" role="presentation" />
					<div className="h-4 w-full max-w-sm animate-pulse rounded bg-muted/50" />

					<div className="mt-4 rounded-2xl border border-border/80 bg-card/90 p-5">
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="h-10 animate-pulse rounded bg-muted/55" />
							<div className="h-10 animate-pulse rounded bg-muted/55" />
						</div>
						<div className="mt-4 h-10 animate-pulse rounded bg-muted/55" />
						<div className="mt-4 h-24 animate-pulse rounded bg-muted/50" />
						<div className="mt-4 grid gap-4 sm:grid-cols-2">
							<div className="h-10 animate-pulse rounded bg-muted/55" />
							<div className="h-10 animate-pulse rounded bg-muted/55" />
						</div>
						<div className="mt-5 h-11 w-full animate-pulse rounded-full bg-muted/55" />
					</div>
				</section>
			</main>
		</div>
	);
}
