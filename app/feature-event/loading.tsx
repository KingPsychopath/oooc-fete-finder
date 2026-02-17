export default function FeatureEventLoading() {
	return (
		<div className="ooo-site-shell">
			<main className="ooo-feature-page container mx-auto max-w-3xl px-4 py-10">
				<div className="animate-pulse space-y-6">
					<div className="space-y-3">
						<div className="h-3 w-44 rounded bg-muted/70" />
						<div className="h-9 w-72 rounded bg-muted/70" />
						<div className="h-px w-16 bg-border" />
					</div>
					<div className="h-36 rounded-xl border border-border bg-card/60" />
					<div className="grid gap-6 md:grid-cols-2">
						<div className="h-64 rounded-xl border border-border bg-card/60" />
						<div className="h-64 rounded-xl border border-border bg-card/60" />
					</div>
				</div>
			</main>
		</div>
	);
}
