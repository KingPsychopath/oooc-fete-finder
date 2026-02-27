export function HomeEventsSectionLoading() {
	return (
		<div className="space-y-6" aria-hidden="true">
			<div className="mb-8 flex min-h-[120px] items-center justify-center rounded-xl border border-border bg-card/60 px-4">
				<div className="h-10 w-full max-w-md animate-pulse rounded-md bg-muted/60" />
			</div>

			<div className="rounded-xl border border-border bg-card/60 p-5">
				<div className="mb-4 h-6 w-44 animate-pulse rounded bg-muted/60" />
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
					<div className="h-44 animate-pulse rounded-lg bg-muted/55" />
					<div className="h-44 animate-pulse rounded-lg bg-muted/55" />
					<div className="hidden h-44 animate-pulse rounded-lg bg-muted/55 lg:block" />
				</div>
			</div>

			<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
				<div className="h-28 animate-pulse rounded-xl border border-border bg-card/60" />
				<div className="h-28 animate-pulse rounded-xl border border-border bg-card/60" />
				<div className="h-28 animate-pulse rounded-xl border border-border bg-card/60" />
			</div>

			<div className="rounded-xl border border-border bg-card/60 p-5">
				<div className="mb-4 h-6 w-48 animate-pulse rounded bg-muted/60" />
				<div className="h-24 animate-pulse rounded-lg border border-border bg-muted/50" />
			</div>

			<div className="min-h-[400px] rounded-xl border border-border bg-card/60 p-5">
				<div className="mb-3 h-6 w-40 animate-pulse rounded bg-muted/60" />
				<div className="h-[320px] animate-pulse rounded-lg bg-muted/50" />
			</div>

			<div className="rounded-xl border border-border bg-card/60 p-5">
				<div className="mb-4 h-6 w-32 animate-pulse rounded bg-muted/60" />
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
					<div className="h-44 animate-pulse rounded-lg bg-muted/55" />
					<div className="h-44 animate-pulse rounded-lg bg-muted/55" />
					<div className="hidden h-44 animate-pulse rounded-lg bg-muted/55 lg:block" />
				</div>
			</div>
		</div>
	);
}
