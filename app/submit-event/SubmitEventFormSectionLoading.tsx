export function SubmitEventFormSectionLoading() {
	return (
		<div className="mt-4 rounded-2xl border border-border/80 bg-card/90 p-5" aria-hidden="true">
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
	);
}
