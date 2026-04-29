import {
	FeteFinderSocialAssetClient,
	type SocialAssetVariant,
} from "@/app/social/_components/FeteFinderSocialAssetClient";
import type { Metadata } from "next";

const variant: SocialAssetVariant = "twitter";

export const metadata: Metadata = {
	title: "Fête Finder Twitter Asset",
	description:
		"Twitter social card explaining Fête Finder by Out Of Office Collective.",
	robots: {
		index: false,
		follow: false,
	},
};

export default function TwitterSocialAssetPage() {
	return (
		<div className="ooo-site-shell">
			<main id="main-content" tabIndex={-1}>
				<FeteFinderSocialAssetClient variant={variant} />
			</main>
		</div>
	);
}
