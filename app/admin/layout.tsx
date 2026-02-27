import { getAdminSessionStatus } from "@/features/auth/actions";
import { env } from "@/lib/config/env";
import {
	generateMainOGImage,
	generateOGMetadata,
} from "@/lib/social/og-utils";
import { unstable_noStore as noStore } from "next/cache";
import type { Metadata } from "next";
import { AdminAuthClient } from "./AdminAuthClient";
import { AdminShell } from "./components/AdminShell";

const siteUrl = env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = generateOGMetadata({
	title: "Admin Dashboard | Fête Finder - OOOC",
	description:
		"Event management dashboard for Fête Finder. Monitor runtime data status, manage data sources, and view collected user interactions.",
	ogImageUrl: generateMainOGImage(),
	url: `${siteUrl}/admin`,
	noIndex: true,
});

export const dynamic = "force-dynamic";

export default async function AdminLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	noStore();

	const sessionStatus = await getAdminSessionStatus();
	const isAuthenticated =
		sessionStatus.success && sessionStatus.isValid === true;

	if (!isAuthenticated) {
		return <AdminAuthClient />;
	}

	return <AdminShell>{children}</AdminShell>;
}
