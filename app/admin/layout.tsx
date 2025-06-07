import type { Metadata } from "next";
import { generateAdminOGImage, generateOGMetadata } from "@/lib/og-utils";

// Get the site URL from environment or default
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://your-domain.com";

export const metadata: Metadata = generateOGMetadata({
	title: "Admin Dashboard | Fête Finder - OOOC",
	description: "Event management dashboard for Fête Finder. Monitor cache status, manage data sources, and view collected user interactions.",
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