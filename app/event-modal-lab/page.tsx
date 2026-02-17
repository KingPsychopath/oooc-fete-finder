import Link from "next/link";

type ModalOption = {
	id: string;
	name: string;
	description: string;
	shellClassName: string;
	panelClassName: string;
	titleClassName: string;
	metaClassName: string;
	bodyClassName: string;
	actionPrimaryClassName: string;
	actionSecondaryClassName: string;
	highlightClassName: string;
};

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const MODAL_OPTIONS: ModalOption[] = [
	{
		id: "A",
		name: "Option A · Editorial Utility",
		description:
			"Closest to current modal behavior with stronger information hierarchy and premium spacing.",
		shellClassName:
			"border-border/60 bg-[color-mix(in_oklab,var(--card)_72%,transparent)]",
		panelClassName:
			"border-border/70 bg-card/88 shadow-[0_30px_70px_-45px_rgba(16,12,8,0.7)]",
		titleClassName: "text-foreground",
		metaClassName: "text-muted-foreground",
		bodyClassName: "text-foreground/90",
		actionPrimaryClassName:
			"border-transparent bg-primary text-primary-foreground hover:bg-primary/90",
		actionSecondaryClassName:
			"border-border/70 bg-background/70 text-foreground hover:bg-accent",
		highlightClassName: "border-border/70 bg-background/60",
	},
	{
		id: "B",
		name: "Option B · Paper Dossier",
		description:
			"Luxury paper feel with clear utility rows so scanning remains instant.",
		shellClassName: "border-[#d9c8ab] bg-[#f2e6d2]",
		panelClassName:
			"border-[#c9b390] bg-[#f7efe1] shadow-[0_28px_66px_-44px_rgba(54,37,20,0.65)]",
		titleClassName: "text-[#2f2317]",
		metaClassName: "text-[#6f5a45]",
		bodyClassName: "text-[#3f2f1e]",
		actionPrimaryClassName:
			"border-[#8d6b4a] bg-[#8d6b4a] text-[#fffaf3] hover:bg-[#7e6042]",
		actionSecondaryClassName:
			"border-[#c2a98a] bg-[#efe0c7] text-[#3f2f1e] hover:bg-[#e7d5b8]",
		highlightClassName: "border-[#ccb899] bg-[#f1e3cb]",
	},
	{
		id: "C",
		name: "Option C · Field Notebook",
		description:
			"Notebook-inspired style with ruled utility rows and practical labels.",
		shellClassName: "border-[#a79780] bg-[#e6dccf]",
		panelClassName:
			"border-[#8a7a64] bg-[#f1e8dc] shadow-[0_26px_62px_-40px_rgba(33,26,20,0.55)]",
		titleClassName: "text-[#2a221a]",
		metaClassName: "text-[#605446]",
		bodyClassName: "text-[#3a3128]",
		actionPrimaryClassName:
			"border-[#2a221a] bg-[#2a221a] text-[#efe6db] hover:bg-[#1f1913]",
		actionSecondaryClassName:
			"border-[#98866f] bg-transparent text-[#2a221a] hover:bg-[#e7ddcf]",
		highlightClassName: "border-[#a6947c] bg-[#e8dece]",
	},
	{
		id: "D",
		name: "Option D · Night Concierge",
		description:
			"Dark evening tone for nightlife identity while staying refined and readable.",
		shellClassName: "border-white/16 bg-[rgba(20,14,10,0.92)]",
		panelClassName:
			"border-white/18 bg-[rgba(31,22,17,0.94)] shadow-[0_34px_80px_-48px_rgba(0,0,0,0.9)]",
		titleClassName: "text-[#f4e8d5]",
		metaClassName: "text-[#c3b6a3]",
		bodyClassName: "text-[#ddd0c0]",
		actionPrimaryClassName:
			"border-[#d7b58a] bg-[#d7b58a] text-[#21170f] hover:bg-[#c9a779]",
		actionSecondaryClassName:
			"border-white/25 bg-white/10 text-[#f1e3cf] hover:bg-white/16",
		highlightClassName: "border-white/20 bg-white/8",
	},
	{
		id: "E",
		name: "Option E · Dense Scan Card",
		description:
			"Highest scan speed: compact rows, strong labels, ideal for quick decisions on mobile.",
		shellClassName: "border-border/70 bg-background/75",
		panelClassName:
			"border-border/80 bg-card shadow-[0_22px_56px_-44px_rgba(8,8,8,0.8)]",
		titleClassName: "text-foreground",
		metaClassName: "text-muted-foreground",
		bodyClassName: "text-foreground/90",
		actionPrimaryClassName:
			"border-transparent bg-foreground text-background hover:bg-foreground/90",
		actionSecondaryClassName:
			"border-border/80 bg-background text-foreground hover:bg-accent",
		highlightClassName: "border-border/70 bg-muted/30",
	},
	{
		id: "F",
		name: "Option F · Poster Ticket",
		description:
			"A ticket-like visual accent while preserving all practical fields and button semantics.",
		shellClassName: "border-[#d2b893] bg-[#efe1cc]",
		panelClassName:
			"border-[#b99767] bg-[linear-gradient(180deg,#f7ecdb_0%,#f2e2ca_100%)] shadow-[0_26px_62px_-40px_rgba(71,45,15,0.5)]",
		titleClassName: "text-[#3d2914]",
		metaClassName: "text-[#71512f]",
		bodyClassName: "text-[#4b341d]",
		actionPrimaryClassName:
			"border-[#6d4a27] bg-[#6d4a27] text-[#fff4e5] hover:bg-[#5b3d20]",
		actionSecondaryClassName:
			"border-[#bc9b6e] bg-[#f4e6d2] text-[#4b341d] hover:bg-[#ebdbc3]",
		highlightClassName: "border-[#c3a37a] bg-[#f2e2ca]",
	},
];

export default function EventModalLabPage() {
	return (
		<div className="ooo-site-shell min-h-screen px-4 py-8 sm:px-6">
			<div className="mx-auto w-full max-w-[1220px]">
				<div className="mb-6 flex flex-wrap items-center justify-between gap-3">
					<div>
						<p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
							Event Modal Lab
						</p>
						<h1 className="text-3xl [font-family:var(--ooo-font-display)] font-light">
							Click-Through Modal Directions
						</h1>
						<p className="mt-1 text-sm text-muted-foreground">
							Visual prototypes only. Pick one direction and I will wire it into
							the live event modal.
						</p>
					</div>
					<div className="flex gap-2">
						<Link
							href={basePath || "/"}
							className="rounded-full border border-border/70 bg-background/70 px-4 py-2 text-sm transition-colors hover:bg-accent"
						>
							Back to Home
						</Link>
						<Link
							href={`${basePath}/admin`}
							className="rounded-full border border-border/70 bg-background/70 px-4 py-2 text-sm transition-colors hover:bg-accent"
						>
							Back to Admin
						</Link>
					</div>
				</div>

				<div className="space-y-6">
					{MODAL_OPTIONS.map((option) => (
						<section
							key={option.id}
							className={`rounded-2xl border p-4 sm:p-5 ${option.shellClassName}`}
						>
							<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
								<div>
									<h2 className="text-xl [font-family:var(--ooo-font-display)] font-light">
										{option.name}
									</h2>
									<p className={`mt-1 text-sm ${option.metaClassName}`}>
										{option.description}
									</p>
								</div>
								<span
									className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.16em] ${option.metaClassName}`}
								>
									Prototype {option.id}
								</span>
							</div>

							<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_250px]">
								<div className={`rounded-2xl border p-4 sm:p-5 ${option.panelClassName}`}>
									<div className="flex items-start justify-between gap-3">
										<div>
											<p className={`text-[10px] uppercase tracking-[0.22em] ${option.metaClassName}`}>
												Saturday · 21 June · 20:00
											</p>
											<h3
												className={`mt-1 text-2xl [font-family:var(--ooo-font-display)] font-light ${option.titleClassName}`}
											>
												La Nuit Collective Rooftop
											</h3>
										</div>
										<div
											className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] ${option.metaClassName}`}
										>
											OOOC Pick
										</div>
									</div>

									<div className="mt-3 flex flex-wrap gap-2">
										<span className="rounded-full border border-amber-300 bg-amber-500 px-2.5 py-1 text-xs text-amber-950">
											Afrobeats
										</span>
										<span className="rounded-full border border-violet-300 bg-violet-500 px-2.5 py-1 text-xs text-violet-50">
											Hip Hop
										</span>
										<span className="rounded-full border border-emerald-300 bg-emerald-600 px-2.5 py-1 text-xs text-emerald-50">
											Shatta
										</span>
									</div>

									<div className="mt-4 space-y-2">
										<div
											className={`rounded-xl border px-3 py-2 text-sm ${option.highlightClassName}`}
										>
											<div className="grid gap-2 sm:grid-cols-2">
												<p className={option.bodyClassName}>
													<span className={option.metaClassName}>Time:</span>{" "}
													23:59 - 05:45
												</p>
												<p className={option.bodyClassName}>
													<span className={option.metaClassName}>Price:</span> €15.99
												</p>
												<p className={option.bodyClassName}>
													<span className={option.metaClassName}>Venue:</span> Indoor
													Venue
												</p>
												<p className={option.bodyClassName}>
													<span className={option.metaClassName}>Age:</span> 18+
												</p>
											</div>
										</div>
										<div
											className={`rounded-xl border px-3 py-2 text-sm ${option.highlightClassName}`}
										>
											<div className="flex items-center justify-between gap-2">
												<div>
													<p className={option.bodyClassName}>
														11e Arrondissement
													</p>
													<p className={`text-xs ${option.metaClassName}`}>
														Le Perchoir Ménilmontant
													</p>
												</div>
												<button
													type="button"
													className={`rounded-lg border px-2 py-1 text-xs ${option.actionSecondaryClassName}`}
												>
													Map settings
												</button>
											</div>
										</div>
										<p className={`text-sm leading-relaxed ${option.bodyClassName}`}>
											Sunset into late-night rooftop session with a warm-up live set,
											then resident DJs until close. Entry is free before 21:00 with
											RSVP.
										</p>
										<p className={`text-xs ${option.metaClassName}`}>
											Bring ID, check venue updates before arrival, and confirm queue
											policy on the official page.
										</p>
									</div>
								</div>

								<div className="space-y-2">
									<button
										type="button"
										className={`w-full rounded-xl border px-3 py-2 text-sm transition-colors ${option.actionPrimaryClassName}`}
									>
										Open Official Link
									</button>
									<div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
										<button
											type="button"
											className="w-full rounded-xl border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-700 transition-colors hover:bg-blue-100"
										>
											Add to Calendar
										</button>
										<button
											type="button"
											className="w-full rounded-xl border border-fuchsia-400 bg-gradient-to-r from-violet-500 to-fuchsia-500 px-3 py-2 text-sm text-white transition-opacity hover:opacity-95"
										>
											Share to Story
										</button>
									</div>
									<button
										type="button"
										className={`w-full rounded-xl border px-3 py-2 text-sm transition-colors ${option.actionSecondaryClassName}`}
									>
										Close
									</button>
								</div>
							</div>

							<div className="mt-4 rounded-xl border border-dashed border-border/60 p-3">
								<p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
									Mobile Stress Preview
								</p>
								<div className="mt-2 max-w-sm rounded-xl border border-border/70 bg-background/80 p-3">
									<p className="text-sm font-medium">
										Very Long Event Name That Might Wrap Across Multiple Lines on
										Small Screens
									</p>
									<p className="mt-1 text-xs text-muted-foreground">
										Location with extra-long metadata for truncation behavior:
										Passage des Panoramas, Paris, France, Rooftop Floor 5
									</p>
									<div className="mt-2 grid grid-cols-2 gap-2 text-xs">
										<span className="rounded-md border px-2 py-1">23:59-05:45</span>
										<span className="rounded-md border px-2 py-1">€15.99</span>
										<span className="rounded-md border px-2 py-1">Indoor</span>
										<span className="rounded-md border px-2 py-1">18+</span>
									</div>
								</div>
							</div>
						</section>
					))}
				</div>
			</div>
		</div>
	);
}
