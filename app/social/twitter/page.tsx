import {
	FeteFinderSocialAssetClient,
	type SocialAssetVariant,
} from "@/app/social/_components/FeteFinderSocialAssetClient";
import { buildSiteUrl } from "@/lib/site-url";
import {
	generateOGMetadata,
	generatePresetOGImage,
} from "@/lib/social/og-utils";
import type { Metadata } from "next";

const variant: SocialAssetVariant = "twitter";

export const metadata: Metadata = generateOGMetadata({
	title: "Fête Finder Twitter Asset",
	description:
		"Twitter social card explaining Fête Finder by Out Of Office Collective.",
	ogImageUrl: generatePresetOGImage("social-assets"),
	url: buildSiteUrl("/social/twitter"),
	noIndex: true,
});

export default function TwitterSocialAssetPage() {
	return (
		<div className="ooo-site-shell">
			<main id="main-content" tabIndex={-1}>
				<FeteFinderSocialAssetClient variant={variant} />
			</main>
		</div>
	);
}
