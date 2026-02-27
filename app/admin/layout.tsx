import { getAdminSessionStatus } from "@/features/auth/actions";
import { getEventSubmissionsDashboard } from "@/features/events/submissions/actions";
import { getPartnerActivationDashboard } from "@/features/partners/activation-actions";
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

	const [eventSubmissionsResult, placementsResult] = await Promise.allSettled([
		getEventSubmissionsDashboard(),
		getPartnerActivationDashboard(),
	]);

	const pendingSubmissions =
		eventSubmissionsResult.status === "fulfilled" &&
		eventSubmissionsResult.value.success
			? eventSubmissionsResult.value.pending.length
			: 0;

	const submissionPendingCreatedAt =
		eventSubmissionsResult.status === "fulfilled" &&
		eventSubmissionsResult.value.success
			? eventSubmissionsResult.value.pending
					.map((row) => row.createdAt)
					.filter((value) => Number.isFinite(new Date(value).getTime()))
			: [];

	const pendingPlacements =
		placementsResult.status === "fulfilled" && placementsResult.value.success
			? placementsResult.value.metrics.pending
			: 0;

	const placementPendingCreatedAt =
		placementsResult.status === "fulfilled" && placementsResult.value.success
			? placementsResult.value.items
					.filter((row) => row.status === "pending")
					.map((row) => row.createdAt)
					.filter((value) => Number.isFinite(new Date(value).getTime()))
			: [];

	const oldestPendingSubmissionAt =
		submissionPendingCreatedAt.length > 0 ?
			submissionPendingCreatedAt.reduce((oldest, current) =>
				new Date(current).getTime() < new Date(oldest).getTime() ? current : oldest,
			)
		:	null;

	const newestPendingSubmissionAt =
		submissionPendingCreatedAt.length > 0 ?
			submissionPendingCreatedAt.reduce((newest, current) =>
				new Date(current).getTime() > new Date(newest).getTime() ? current : newest,
			)
		:	null;

	const oldestPendingPlacementAt =
		placementPendingCreatedAt.length > 0 ?
			placementPendingCreatedAt.reduce((oldest, current) =>
				new Date(current).getTime() < new Date(oldest).getTime() ? current : oldest,
			)
		:	null;

	const newestPendingPlacementAt =
		placementPendingCreatedAt.length > 0 ?
			placementPendingCreatedAt.reduce((newest, current) =>
				new Date(current).getTime() > new Date(newest).getTime() ? current : newest,
			)
		:	null;

	return (
		<AdminShell
			notificationCounts={{
				pendingSubmissions,
				pendingPlacements,
				oldestPendingSubmissionAt,
				oldestPendingPlacementAt,
				newestPendingSubmissionAt,
				newestPendingPlacementAt,
				lastUpdatedAt: new Date().toISOString(),
			}}
		>
			{children}
		</AdminShell>
	);
}
