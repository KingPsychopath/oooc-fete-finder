import type { Metadata } from "next";
import { generateAdminOGImage, generateOGMetadata } from "@/lib/social/og-utils";
import { env } from "@/lib/config/env";

// Get the site URL from environment or default
const siteUrl = env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = generateOGMetadata({
	title: "Admin Dashboard | Fête Finder - OOOC",
	description:
		"Event management dashboard for Fête Finder. Monitor cache status, manage data sources, and view collected user interactions.",
	ogImageUrl: generateAdminOGImage(),
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
