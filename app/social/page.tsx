import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
	title: "Fête Finder Social Assets",
	description:
		"Private social asset variants for sharing Fête Finder by Out Of Office Collective.",
	robots: {
		index: false,
		follow: false,
	},
};

const socialAssets = [
	{
		href: "/social/story",
		label: "Story",
		size: "1080 x 1920",
		description: "Instagram Stories and vertical social shares.",
	},
	{
		href: "/social/twitter",
		label: "Twitter",
		size: "1600 x 900",
		description: "Wide post cards, link previews and announcement threads.",
	},
	{
		href: "/social/square",
		label: "Square",
		size: "1080 x 1080",
		description: "Feed posts, WhatsApp previews and general-purpose shares.",
	},
] as const;

export default function SocialAssetsPage() {
	return (
		<div className="ooo-site-shell">
			<main
				id="main-content"
				className="container mx-auto max-w-5xl px-4 py-10 sm:py-14"
				tabIndex={-1}
			>
				<p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
					Fête Finder
				</p>
				<h1
					className="mt-2 text-4xl font-light tracking-tight text-foreground sm:text-5xl"
					style={{ fontFamily: "var(--ooo-font-display)" }}
				>
					Social assets
				</h1>
				<p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
					Clean export routes for the formats you are most likely to need.
				</p>
				<div className="mt-8 grid gap-3 sm:grid-cols-3">
					{socialAssets.map((asset) => (
						<Link
							key={asset.href}
							href={asset.href}
							className="group rounded-2xl border border-border/70 bg-card/72 p-5 shadow-[0_12px_36px_rgba(31,21,14,0.1)] transition-colors hover:bg-accent"
						>
							<div className="flex items-center justify-between gap-4">
								<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
									{asset.size}
								</p>
								<ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
							</div>
							<h2
								className="mt-5 text-2xl font-light text-foreground"
								style={{ fontFamily: "var(--ooo-font-display)" }}
							>
								{asset.label}
							</h2>
							<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
								{asset.description}
							</p>
						</Link>
					))}
				</div>
			</main>
		</div>
	);
}
