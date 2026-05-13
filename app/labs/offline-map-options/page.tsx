import { generateMainOGImage, generateOGMetadata } from "@/lib/social/og-utils";
import type { Metadata } from "next";
import Link from "next/link";
import { OfflineMapOptionsClient } from "./OfflineMapOptionsClient";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = generateOGMetadata({
	title: "Offline Map Options Lab | Fête Finder",
	description: "Compare offline map rendering options for Fête Finder.",
	ogImageUrl: generateMainOGImage(),
	url: `${siteUrl}${basePath || ""}/labs/offline-map-options`,
	noIndex: true,
});

export default function OfflineMapOptionsPage() {
	return (
		<div className="ooo-site-shell min-h-screen px-4 py-8 sm:px-6">
			<div className="mx-auto w-full max-w-[1420px]">
				<div className="mb-6 flex flex-wrap items-center justify-between gap-3">
					<div>
						<p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
							Map Lab
						</p>
						<h1 className="text-3xl [font-family:var(--ooo-font-display)] font-light">
							Offline Map Directions
						</h1>
					</div>
					<Link
						href={basePath || "/"}
						className="rounded-full border border-border/75 bg-background/70 px-4 py-2 text-sm transition-colors hover:bg-accent"
					>
						Back to Home
					</Link>
				</div>

				<OfflineMapOptionsClient />
			</div>
		</div>
	);
}
