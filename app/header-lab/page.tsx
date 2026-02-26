import Link from "next/link";

type HeaderOption = {
	id: string;
	title: string;
	description: string;
	containerClassName: string;
	accentClassName: string;
	buttonClassName: string;
};

const HEADER_OPTIONS: HeaderOption[] = [
	{
		id: "A",
		title: "Option A · Editorial Soft Glass",
		description:
			"Closest to current update. Warm glass, restrained contrast, premium quiet controls.",
		containerClassName:
			"border-white/45 bg-[rgba(246,241,233,0.88)] shadow-[0_10px_32px_rgba(35,28,22,0.14)]",
		accentClassName: "text-foreground/60",
		buttonClassName:
			"border-black/12 bg-white/62 text-foreground/80 hover:bg-white/80",
	},
	{
		id: "B",
		title: "Option B · Minimal Line Nav",
		description:
			"Cleaner and flatter with finer rules. Best if you want less visual weight.",
		containerClassName:
			"border-black/10 bg-[rgba(249,245,239,0.95)] shadow-[0_4px_14px_rgba(35,28,22,0.08)]",
		accentClassName: "text-foreground/52",
		buttonClassName:
			"border-black/10 bg-transparent text-foreground/80 hover:bg-black/5",
	},
	{
		id: "C",
		title: "Option C · Brand Forward",
		description:
			"Larger display title and stronger logo zone. Better when brand presence is priority.",
		containerClassName:
			"border-[#d7ccbc] bg-[rgba(240,232,219,0.92)] shadow-[0_12px_34px_rgba(67,54,42,0.16)]",
		accentClassName: "text-[#6b5948]",
		buttonClassName:
			"border-[#c7b8a4] bg-[#f8f2e8] text-[#44372d] hover:bg-[#f1e8db]",
	},
	{
		id: "D",
		title: "Option D · Night Lounge",
		description:
			"Dark editorial variation for event-night identity while keeping the same layout.",
		containerClassName:
			"border-white/18 bg-[rgba(25,20,16,0.86)] shadow-[0_12px_30px_rgba(8,6,4,0.45)]",
		accentClassName: "text-white/60",
		buttonClassName:
			"border-white/20 bg-white/10 text-white/90 hover:bg-white/18",
	},
];
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default function HeaderLabPage() {
	return (
		<div className="ooo-site-shell px-4 py-8 sm:px-6">
			<div className="mx-auto w-full max-w-[1240px]">
				<div className="mb-6 flex flex-wrap items-center justify-between gap-3">
					<div>
						<p className="text-[11px] uppercase tracking-[0.28em] text-foreground/55">
							Header Design Lab
						</p>
						<h1 className="text-3xl [font-family:var(--ooo-font-display)] font-light">
							Choose Header Direction
						</h1>
					</div>
					<div className="flex gap-2">
						<Link
							href={basePath || "/"}
							className="rounded-full border border-black/15 bg-white/65 px-4 py-2 text-sm transition-colors hover:bg-white/85"
						>
							View Live Home
						</Link>
						<Link
							href={`${basePath}/admin`}
							className="rounded-full border border-black/15 bg-white/65 px-4 py-2 text-sm transition-colors hover:bg-white/85"
						>
							Back to Admin
						</Link>
					</div>
				</div>

				<div className="space-y-6">
					{HEADER_OPTIONS.map((option) => (
						<section
							key={option.id}
							className={`overflow-hidden rounded-2xl border p-4 ${option.containerClassName}`}
						>
							<div className="mb-3 flex flex-wrap items-start justify-between gap-3">
								<div>
									<h2 className="text-xl [font-family:var(--ooo-font-display)] font-light">
										{option.title}
									</h2>
									<p className={`text-sm ${option.accentClassName}`}>
										{option.description}
									</p>
								</div>
								<button
									type="button"
									className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.18em] transition-colors ${option.buttonClassName}`}
								>
									Quick Actions
								</button>
							</div>

							<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 bg-white/35 px-3 py-3">
								<div>
									<p className={`text-[10px] uppercase tracking-[0.24em] ${option.accentClassName}`}>
										Out Of Office Collective
									</p>
									<p className="text-xl [font-family:var(--ooo-font-display)] font-light">
										Fete Finder
									</p>
								</div>
								<div className="flex flex-wrap items-center gap-2">
									<button
										type="button"
										className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${option.buttonClassName}`}
									>
										Theme
									</button>
									<button
										type="button"
										className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${option.buttonClassName}`}
									>
										Playlist
									</button>
									<button
										type="button"
										className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${option.buttonClassName}`}
									>
										Logout
									</button>
								</div>
							</div>
						</section>
					))}
				</div>
			</div>
		</div>
	);
}
