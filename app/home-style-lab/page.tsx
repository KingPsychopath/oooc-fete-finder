import Link from "next/link";

const CARD_OPTIONS = [
	{
		name: "Option A · Current Editorial",
		description: "Balanced warmth, soft glass, and restrained border contrast.",
		cardClass:
			"border-border/75 bg-card/84 shadow-[0_10px_24px_-18px_rgba(30,22,17,0.38)]",
	},
	{
		name: "Option B · Minimal Flat",
		description: "Lower blur, flatter shadows, cleaner utility-first dashboard feel.",
		cardClass:
			"border-border/85 bg-card shadow-[0_4px_10px_-8px_rgba(30,22,17,0.22)]",
	},
	{
		name: "Option C · Luxe Contrast",
		description: "Stronger depth and richer tonal contrast for premium visual drama.",
		cardClass:
			"border-border/65 bg-[color-mix(in_oklab,var(--card)_80%,rgba(248,236,214,0.2))] shadow-[0_16px_32px_-20px_rgba(20,14,10,0.52)]",
	},
];

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default function HomeStyleLabPage() {
	return (
		<div className="ooo-site-shell min-h-screen px-4 py-8 sm:px-6">
			<div className="mx-auto w-full max-w-[1120px]">
				<div className="mb-6 flex items-center justify-between gap-3">
					<div>
						<p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
							Homepage Style Lab
						</p>
						<h1 className="text-3xl [font-family:var(--ooo-font-display)] font-light">
							Card Surface Directions
						</h1>
					</div>
					<Link
						href={basePath || "/"}
						className="rounded-full border border-border/75 bg-background/70 px-4 py-2 text-sm transition-colors hover:bg-accent"
					>
						Back to Home
					</Link>
				</div>

				<div className="grid gap-5">
					{CARD_OPTIONS.map((option) => (
						<section
							key={option.name}
							className={`rounded-2xl border p-5 ${option.cardClass}`}
						>
							<h2 className="text-xl [font-family:var(--ooo-font-display)] font-light">
								{option.name}
							</h2>
							<p className="mt-1 text-sm text-muted-foreground">{option.description}</p>
							<div className="mt-4 grid gap-3 md:grid-cols-3">
								<div className="rounded-xl border border-border/70 bg-background/55 p-4">
									<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
										Events
									</p>
									<p className="mt-1 text-3xl [font-family:var(--ooo-font-display)] font-light">
										81
									</p>
								</div>
								<div className="rounded-xl border border-border/70 bg-background/55 p-4">
									<p className="text-sm font-medium">Sample Event Card</p>
									<p className="mt-1 text-sm text-muted-foreground">
										Softer badge hierarchy and muted metadata colors.
									</p>
								</div>
								<div className="rounded-xl border border-border/70 bg-background/55 p-4">
									<p className="text-sm font-medium">Map Panel</p>
									<p className="mt-1 text-sm text-muted-foreground">
										Header chips and actions share the same tokenized surface.
									</p>
								</div>
							</div>
						</section>
					))}
				</div>
			</div>
		</div>
	);
}
