export default function PartnerStatsLoading() {
	return (
		<main className="container mx-auto max-w-5xl px-4 py-10 pb-16" aria-hidden="true">
			<section className="rounded-2xl border border-border/80 bg-card/90 p-6 sm:p-8">
				<div className="h-3 w-28 animate-pulse rounded bg-muted/60" />
				<div className="mt-3 h-10 w-full max-w-md animate-pulse rounded bg-muted/55" />
				<div className="mt-3 h-4 w-40 animate-pulse rounded bg-muted/50" />
				<div className="mt-2 h-4 w-56 animate-pulse rounded bg-muted/50" />
			</section>

			<section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
				<div className="h-24 animate-pulse rounded-xl border border-border bg-card/60" />
				<div className="h-24 animate-pulse rounded-xl border border-border bg-card/60" />
				<div className="h-24 animate-pulse rounded-xl border border-border bg-card/60" />
				<div className="h-24 animate-pulse rounded-xl border border-border bg-card/60" />
				<div className="h-24 animate-pulse rounded-xl border border-border bg-card/60" />
				<div className="h-24 animate-pulse rounded-xl border border-border bg-card/60" />
			</section>

			<section className="mt-4 h-16 animate-pulse rounded-xl border border-border bg-card/60" />
			<section className="mt-6 h-20 animate-pulse rounded-xl border border-border bg-card/60" />
		</main>
	);
}
