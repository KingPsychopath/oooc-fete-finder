export default function EventShareLoading() {
	return (
		<div className="ooo-site-shell">
			<main className="container mx-auto max-w-2xl px-4 py-16" aria-hidden="true">
				<section className="rounded-2xl border border-border/80 bg-card/90 p-6 sm:p-8">
					<div className="h-3 w-24 animate-pulse rounded bg-muted/60" />
					<div className="mt-3 h-10 w-full max-w-sm animate-pulse rounded bg-muted/55" />
					<div className="mt-3 h-4 w-full max-w-md animate-pulse rounded bg-muted/50" />
					<div className="mt-2 h-4 w-full max-w-sm animate-pulse rounded bg-muted/50" />
					<div className="mt-5 h-10 w-36 animate-pulse rounded-full bg-muted/55" />
				</section>
			</main>
		</div>
	);
}
