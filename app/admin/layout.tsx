import { env } from "@/lib/config/env";
import {
	generateMainOGImage,
	generateOGMetadata,
} from "@/lib/social/og-utils";
import type { Metadata } from "next";

// Get the site URL from environment or default
const siteUrl = env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = generateOGMetadata({
	title: "Admin Dashboard | Fête Finder - OOOC",
	description:
		"Event management dashboard for Fête Finder. Monitor runtime data status, manage data sources, and view collected user interactions.",
	ogImageUrl: generateMainOGImage(),
	url: `${siteUrl}/admin`,
	noIndex: true, // Don't index admin pages
});

export default function AdminLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return <>{children}</>;
}
