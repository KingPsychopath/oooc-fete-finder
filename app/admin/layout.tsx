import { getAdminSessionStatus } from "@/features/auth/actions";
import { env } from "@/lib/config/env";
import { getEventSubmissionRepository } from "@/lib/platform/postgres/event-submission-repository";
import { getPartnerActivationRepository } from "@/lib/platform/postgres/partner-activation-repository";
import {
	generateMainOGImage,
	generateOGMetadata,
} from "@/lib/social/og-utils";
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

const emptyNotificationSummary = {
	count: 0,
	oldestCreatedAt: null,
	newestCreatedAt: null,
};

const computeNotificationCounts = async () => {
	const eventSubmissionRepository = getEventSubmissionRepository();
	const partnerActivationRepository = getPartnerActivationRepository();
	const [eventSubmissionsResult, placementsResult] = await Promise.allSettled([
		eventSubmissionRepository?.getPendingNotificationSummary() ??
			Promise.resolve(emptyNotificationSummary),
		partnerActivationRepository?.getPendingNotificationSummary() ??
			Promise.resolve(emptyNotificationSummary),
	]);
	const eventSubmissionsSummary =
		eventSubmissionsResult.status === "fulfilled"
			? eventSubmissionsResult.value
			: emptyNotificationSummary;
	const placementsSummary =
		placementsResult.status === "fulfilled"
			? placementsResult.value
			: emptyNotificationSummary;

	return {
		pendingSubmissions: eventSubmissionsSummary.count,
		pendingPlacements: placementsSummary.count,
		oldestPendingSubmissionAt: eventSubmissionsSummary.oldestCreatedAt,
		oldestPendingPlacementAt: placementsSummary.oldestCreatedAt,
		newestPendingSubmissionAt: eventSubmissionsSummary.newestCreatedAt,
		newestPendingPlacementAt: placementsSummary.newestCreatedAt,
		lastUpdatedAt: new Date().toISOString(),
	};
};

export default async function AdminLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const sessionStatus = await getAdminSessionStatus();
	const isAuthenticated =
		sessionStatus.success && sessionStatus.isValid === true;

	if (!isAuthenticated) {
		return <AdminAuthClient />;
	}
	const notificationCounts = await computeNotificationCounts();

	return (
		<AdminShell
			notificationCounts={notificationCounts}
		>
			{children}
		</AdminShell>
	);
}
