export default function SubmitEventLoading() {
	return (
		<main id="main-content" className="container mx-auto px-4 py-8">
			<section className="mx-auto max-w-3xl space-y-4" aria-hidden="true">
				<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
					Host Submission
				</p>
				<h1
					className="text-3xl font-light tracking-tight text-foreground sm:text-4xl"
					style={{ fontFamily: "var(--ooo-font-display)" }}
				>
					Submit Your Event
				</h1>
				<p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
					Share the essentials and we will review your event for inclusion in Fete
					Finder. Accepted submissions are published by the admin team.
				</p>
				<div className="border-t border-border" role="presentation" />
				<div className="h-4 w-full max-w-sm animate-pulse rounded bg-muted/45" />

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
	);
}
