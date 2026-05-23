import {
	FeteFinderSocialAssetClient,
	type SocialAssetVariant,
} from "@/app/social/_components/FeteFinderSocialAssetClient";
import { generateOGMetadata, generatePresetOGImage } from "@/lib/social/og-utils";
import { buildSiteUrl } from "@/lib/site-url";
import type { Metadata } from "next";

const variant: SocialAssetVariant = "story";

export const metadata: Metadata = generateOGMetadata({
	title: "Fête Finder Story Asset",
	description:
		"Instagram Story asset explaining Fête Finder by Out Of Office Collective.",
	ogImageUrl: generatePresetOGImage("social-assets"),
	url: buildSiteUrl("/social/story"),
	noIndex: true,
});

export default function StorySocialAssetPage() {
	return (
		<div className="ooo-site-shell">
			<main id="main-content" tabIndex={-1}>
				<FeteFinderSocialAssetClient variant={variant} />
			</main>
		</div>
	);
}
