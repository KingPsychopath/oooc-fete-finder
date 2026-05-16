import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { generateMainOGImage, generateOGMetadata } from "@/lib/social/og-utils";
import type { Metadata } from "next";
import Link from "next/link";
import { OfflineMapOptionsClient } from "./OfflineMapOptionsClient";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const previewImagePath = path.join(
	process.cwd(),
	"public",
	"maps",
	"paris-map-preview.jpg",
);
const arrondissementGeoJsonPath = path.join(
	process.cwd(),
	"data",
	"paris-arr-v2.json",
);

export const metadata: Metadata = generateOGMetadata({
	title: "Offline Map Options Lab | Fête Finder",
	description: "Compare offline map rendering options for Fête Finder.",
	ogImageUrl: generateMainOGImage(),
	url: `${siteUrl}${basePath || ""}/labs/offline-map-options`,
	noIndex: true,
});

const assetSize = async (filePath: string) => {
	try {
		const stats = await stat(filePath);
		return stats.size;
	} catch {
		return null;
	}
};

const gzipAssetSize = async (filePath: string) => {
	try {
		const contents = await readFile(filePath);
		return gzipSync(contents).length;
	} catch {
		return null;
	}
};

export default async function OfflineMapOptionsPage() {
	const [
		previewImageBytes,
		arrondissementGeoJsonBytes,
		previewImageGzipBytes,
		arrondissementGeoJsonGzipBytes,
	] = await Promise.all([
		assetSize(previewImagePath),
		assetSize(arrondissementGeoJsonPath),
		gzipAssetSize(previewImagePath),
		gzipAssetSize(arrondissementGeoJsonPath),
	]);

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

				<OfflineMapOptionsClient
					assetStats={{
						previewImageBytes,
						arrondissementGeoJsonBytes,
						previewImageGzipBytes,
						arrondissementGeoJsonGzipBytes,
					}}
				/>
			</div>
		</div>
	);
}
