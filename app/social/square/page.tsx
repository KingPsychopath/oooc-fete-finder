import {
	FeteFinderSocialAssetClient,
	type SocialAssetVariant,
} from "@/app/social/_components/FeteFinderSocialAssetClient";
import { generateOGMetadata, generatePresetOGImage } from "@/lib/social/og-utils";
import type { Metadata } from "next";

const variant: SocialAssetVariant = "square";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = generateOGMetadata({
	title: "Fête Finder Square Asset",
	description:
		"Square social post asset explaining Fête Finder by Out Of Office Collective.",
	ogImageUrl: generatePresetOGImage("social-assets"),
	url: `${siteUrl}${basePath || ""}/social/square`,
	noIndex: true,
});

export default function SquareSocialAssetPage() {
	return (
		<div className="ooo-site-shell">
			<main id="main-content" tabIndex={-1}>
				<FeteFinderSocialAssetClient variant={variant} />
			</main>
		</div>
	);
}
