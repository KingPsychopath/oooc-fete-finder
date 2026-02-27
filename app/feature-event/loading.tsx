export default function FeatureEventLoading() {
	return (
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
	);
}
