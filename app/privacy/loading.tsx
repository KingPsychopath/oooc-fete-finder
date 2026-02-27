export default function PrivacyLoading() {
	return (
		<div className="min-h-screen bg-background">
			<main className="container mx-auto max-w-4xl px-4 py-8" aria-hidden="true">
				<div className="mb-6 h-5 w-36 animate-pulse rounded bg-muted/55" />
				<div className="rounded-xl border border-border bg-card p-6">
					<div className="h-8 w-56 animate-pulse rounded bg-muted/55" />
					<div className="mt-3 h-4 w-40 animate-pulse rounded bg-muted/50" />
					<div className="mt-6 space-y-3">
						<div className="h-4 w-full animate-pulse rounded bg-muted/50" />
						<div className="h-4 w-full animate-pulse rounded bg-muted/50" />
						<div className="h-4 w-11/12 animate-pulse rounded bg-muted/50" />
						<div className="h-4 w-10/12 animate-pulse rounded bg-muted/50" />
						<div className="h-4 w-full animate-pulse rounded bg-muted/50" />
						<div className="h-4 w-9/12 animate-pulse rounded bg-muted/50" />
					</div>
					<div className="mt-8 h-24 animate-pulse rounded-lg bg-muted/45" />
				</div>
			</main>
		</div>
	);
}
