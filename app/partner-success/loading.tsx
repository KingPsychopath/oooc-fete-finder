export default function PartnerSuccessLoading() {
	return (
		<main className="container mx-auto max-w-3xl px-4 py-12" aria-hidden="true">
			<section className="rounded-2xl border border-border/80 bg-card/90 p-8 text-center">
				<div className="mx-auto h-12 w-12 animate-pulse rounded-full bg-muted/55" />
				<div className="mx-auto mt-4 h-3 w-32 animate-pulse rounded bg-muted/55" />
				<div className="mx-auto mt-3 h-10 w-full max-w-md animate-pulse rounded bg-muted/55" />
				<div className="mx-auto mt-3 h-4 w-full max-w-lg animate-pulse rounded bg-muted/50" />
				<div className="mx-auto mt-2 h-4 w-full max-w-md animate-pulse rounded bg-muted/50" />
				<div className="mt-6 flex flex-wrap items-center justify-center gap-3">
					<div className="h-10 w-44 animate-pulse rounded-full bg-muted/55" />
					<div className="h-10 w-40 animate-pulse rounded-full bg-muted/55" />
				</div>
			</section>
		</main>
	);
}
