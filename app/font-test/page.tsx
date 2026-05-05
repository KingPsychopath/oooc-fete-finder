import type { Metadata } from "next";
import {
	Bodoni_Moda,
	Buda,
	Cormorant_Garamond,
	Crimson_Pro,
	DM_Serif_Display,
	Fraunces,
	Gloock,
	Instrument_Serif,
	Libre_Bodoni,
	Marcellus,
	Newsreader,
	Playfair_Display,
	Prata,
} from "next/font/google";
import Link from "next/link";

export const metadata: Metadata = {
	title: "Font Test | Fête Finder",
	robots: {
		index: false,
		follow: false,
	},
};

const cormorantGaramond = Cormorant_Garamond({
	weight: "variable",
	subsets: ["latin"],
	display: "swap",
	variable: "--font-test-cormorant-garamond",
});

const buda = Buda({
	weight: "300",
	subsets: ["latin"],
	display: "swap",
	variable: "--font-test-buda",
});

const fraunces = Fraunces({
	weight: "variable",
	subsets: ["latin"],
	display: "swap",
	variable: "--font-test-fraunces",
});

const playfairDisplay = Playfair_Display({
	weight: "variable",
	subsets: ["latin"],
	display: "swap",
	variable: "--font-test-playfair-display",
});

const prata = Prata({
	weight: "400",
	subsets: ["latin"],
	display: "swap",
	variable: "--font-test-prata",
});

const marcellus = Marcellus({
	weight: "400",
	subsets: ["latin"],
	display: "swap",
	variable: "--font-test-marcellus",
});

const dmSerifDisplay = DM_Serif_Display({
	weight: "400",
	subsets: ["latin"],
	display: "swap",
	variable: "--font-test-dm-serif-display",
});

const libreBodoni = Libre_Bodoni({
	weight: "variable",
	subsets: ["latin"],
	display: "swap",
	variable: "--font-test-libre-bodoni",
});

const gloock = Gloock({
	weight: "400",
	subsets: ["latin"],
	display: "swap",
	variable: "--font-test-gloock",
});

const instrumentSerif = Instrument_Serif({
	weight: "400",
	subsets: ["latin"],
	display: "swap",
	variable: "--font-test-instrument-serif",
});

const newsreader = Newsreader({
	weight: "variable",
	subsets: ["latin"],
	display: "swap",
	variable: "--font-test-newsreader",
});

const bodoniModa = Bodoni_Moda({
	weight: "variable",
	subsets: ["latin"],
	display: "swap",
	variable: "--font-test-bodoni-moda",
});

const crimsonPro = Crimson_Pro({
	weight: "variable",
	subsets: ["latin"],
	display: "swap",
	variable: "--font-test-crimson-pro",
});

const displayFonts = [
	{
		name: "Swear Display",
		note: "Current local brand face",
		className: "",
		family: '"Swear Display", "Iowan Old Style", "Times New Roman", Times, serif',
	},
	{
		name: "Cormorant Garamond",
		note: "Elegant, literary, high contrast",
		className: cormorantGaramond.variable,
		family: "var(--font-test-cormorant-garamond)",
	},
	{
		name: "Buda",
		note: "Very light, ceremonial, fragile",
		className: buda.variable,
		family: "var(--font-test-buda)",
	},
	{
		name: "Fraunces",
		note: "Warm, editorial, more character",
		className: fraunces.variable,
		family: "var(--font-test-fraunces)",
	},
	{
		name: "Playfair Display",
		note: "Polished, familiar luxury editorial",
		className: playfairDisplay.variable,
		family: "var(--font-test-playfair-display)",
	},
	{
		name: "Prata",
		note: "Sharp, premium, restrained",
		className: prata.variable,
		family: "var(--font-test-prata)",
	},
	{
		name: "Marcellus",
		note: "Quiet, Roman, travel-guide elegance",
		className: marcellus.variable,
		family: "var(--font-test-marcellus)",
	},
	{
		name: "DM Serif Display",
		note: "Confident, friendly, less delicate",
		className: dmSerifDisplay.variable,
		family: "var(--font-test-dm-serif-display)",
	},
	{
		name: "Libre Bodoni",
		note: "Fashion-magazine contrast",
		className: libreBodoni.variable,
		family: "var(--font-test-libre-bodoni)",
	},
	{
		name: "Gloock",
		note: "Distinctive editorial, compact and confident",
		className: gloock.variable,
		family: "var(--font-test-gloock)",
	},
	{
		name: "Instrument Serif",
		note: "Soft, stylish, less formal",
		className: instrumentSerif.variable,
		family: "var(--font-test-instrument-serif)",
	},
	{
		name: "Newsreader",
		note: "Editorial but practical at many sizes",
		className: newsreader.variable,
		family: "var(--font-test-newsreader)",
	},
	{
		name: "Bodoni Moda",
		note: "High fashion, dramatic contrast",
		className: bodoniModa.variable,
		family: "var(--font-test-bodoni-moda)",
	},
	{
		name: "Crimson Pro",
		note: "Classic bookish serif with warmth",
		className: crimsonPro.variable,
		family: "var(--font-test-crimson-pro)",
	},
] as const;

const storyExamples = [
	{
		kicker: "The Problem",
		title: "Fête weekend should feel electric, not impossible to plan.",
		body: "Paris is full of music, but the useful details are scattered across flyers, posts, venue pages and group chats. Fête Finder gives the weekend a readable shape before everyone starts moving.",
	},
	{
		kicker: "The Map",
		title: "Start with the part of Paris you actually want to move through.",
		body: "Fête Finder turns the city into a practical weekend guide, so people can scan by arrondissement, spot nearby picks and avoid zig-zagging across town without a plan.",
	},
	{
		kicker: "The Filters",
		title: "Find the sound, setting and price that match your weekend.",
		body: "Filters make the experience feel less like research and more like choosing a vibe: genre, venue type, price, age, time and curated picks all working together.",
	},
] as const;

export default function FontTestPage() {
	return (
		<main className="min-h-screen bg-background text-foreground">
			<section className="border-b border-border/70 px-4 py-10 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-7xl">
					<Link
						href="/"
						className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
					>
						Back to Fête Finder
					</Link>
					<p className="mt-8 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
						Display font test
					</p>
					<h1 className="mt-3 max-w-4xl text-4xl font-light tracking-tight text-foreground sm:text-5xl">
						Real Fête Finder copy, real sizing, Degular still doing the quiet
						work around it.
					</h1>
					<p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
						Each block changes only the display face. Labels, body copy, nav
						text, badges and buttons keep the site font stack so the pairing is
						easier to judge in context.
					</p>
				</div>
			</section>

			<div className="px-4 py-8 sm:px-6 lg:px-8">
				<div className="mx-auto grid max-w-7xl gap-6">
					{displayFonts.map((font) => (
						<article
							key={font.name}
							className={`${font.className} overflow-hidden rounded-lg border border-border/70 bg-card shadow-[0_18px_48px_-42px_rgba(22,16,10,0.7)]`}
						>
							<div className="border-b border-border/70 px-5 py-4 sm:px-6">
								<div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
									<div>
										<p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
											{font.note}
										</p>
										<h2
											className="mt-1 text-3xl font-light leading-none text-foreground sm:text-4xl"
											style={{ fontFamily: font.family }}
										>
											{font.name}
										</h2>
									</div>
									<p className="text-sm text-muted-foreground">
										Display face + Degular body/UI
									</p>
								</div>
							</div>

							<div className="grid gap-0 lg:grid-cols-[minmax(0,1.06fr)_minmax(22rem,0.94fr)]">
								<section className="bg-[linear-gradient(120deg,color-mix(in_oklab,var(--background)_82%,#dca15f_18%),color-mix(in_oklab,var(--background)_70%,#315b5f_30%))] px-5 py-8 sm:px-7 lg:py-10">
									<p className="text-[11px] font-medium uppercase tracking-[0.22em] text-foreground/62">
										Out Of Office Collective
									</p>
									<h3
										className="mt-5 max-w-[9ch] text-[clamp(4rem,14vw,8rem)] font-light leading-[0.82] text-foreground lg:text-[clamp(5.6rem,7.2vw,8.4rem)]"
										style={{ fontFamily: font.family }}
									>
										Your Fête weekend, beautifully mapped.
									</h3>
									<p className="mt-8 max-w-2xl text-xl leading-relaxed text-foreground/72 sm:text-2xl lg:text-xl">
										Fête Finder is the OOOC guide for Paris during Fête de la
										Musique weekend: curated events, practical filters,
										shareable plans and a live community of like-minded people on
										the ground.
									</p>
									<div className="mt-8 flex flex-wrap gap-3">
										<span className="inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground">
											Explore the map
										</span>
										<span className="inline-flex h-11 items-center rounded-full border border-border bg-background/54 px-5 text-sm font-medium text-foreground">
											Join the community
										</span>
									</div>
								</section>

								<section className="px-5 py-8 sm:px-7 lg:py-10">
									<div className="rounded-lg border border-border/70 bg-background/64 p-4">
										<p className="truncate text-[10px] uppercase tracking-[0.26em] text-foreground/55 sm:text-[11px]">
											Out Of Office Collective
										</p>
										<h3
											className="mt-1 truncate text-lg font-light leading-none text-foreground sm:text-2xl"
											style={{ fontFamily: font.family }}
										>
											Fete Finder
										</h3>
									</div>

									<div className="mt-7">
										<p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
											Paris · Fête de la Musique
										</p>
										<h3
											className="mt-2 text-2xl font-light tracking-tight text-foreground sm:text-3xl"
											style={{ fontFamily: font.family }}
										>
											Discover events across the city
										</h3>
										<p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
											Explore live music and cultural events by arrondissement.
											Use the map and filters to find what’s on.
										</p>
										<p className="mt-3 inline-flex text-sm font-medium text-foreground underline underline-offset-4">
											New here? See how Fête Finder works
										</p>
									</div>

									<div className="mt-8 border-t border-border/70 pt-7">
										<p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
											Choose your lane
										</p>
										<h3
											className="mt-3 text-[clamp(2.4rem,7vw,5.6rem)] font-light leading-[0.9] text-foreground"
											style={{ fontFamily: font.family }}
										>
											Use it for the weekend, the community, or the crowd.
										</h3>
									</div>
								</section>
							</div>

							<section className="border-t border-border/70 px-5 py-7 sm:px-7">
								<div className="grid gap-5 lg:grid-cols-3">
									{storyExamples.map((example, index) => (
										<div key={example.kicker} className="min-w-0">
											<div className="flex items-center gap-3">
												<span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
													{index + 1}
												</span>
												<p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
													{example.kicker}
												</p>
											</div>
											<h3
												className="mt-5 text-[clamp(2.2rem,5vw,4.4rem)] font-light leading-[0.9] text-foreground"
												style={{ fontFamily: font.family }}
											>
												{example.title}
											</h3>
											<p className="mt-5 text-base leading-relaxed text-muted-foreground">
												{example.body}
											</p>
										</div>
									))}
								</div>
							</section>

							<section className="border-t border-border/70 bg-muted/35 px-5 py-8 text-center sm:px-7">
								<p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
									Final CTA
								</p>
								<h3
									className="mx-auto mt-5 max-w-3xl text-[clamp(2.6rem,7vw,6rem)] font-light leading-[0.88] text-foreground"
									style={{ fontFamily: font.family }}
								>
									Ready to find your route?
								</h3>
								<p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
									Open the map, join the OOOC chat and make Fête weekend easier
									to follow.
								</p>
							</section>
						</article>
					))}
				</div>
			</div>
		</main>
	);
}
