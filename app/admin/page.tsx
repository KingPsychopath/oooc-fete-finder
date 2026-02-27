import { getAdminSessionStatus } from "@/features/auth/actions";
import { getCollectedEmails } from "@/features/auth/actions";
import {
	getEventStoreBackupStatus,
	getEventStoreRecentBackups,
	getLocalEventStorePreview,
	getLocalEventStoreStatus,
	getRuntimeDataStatus,
} from "@/features/data-management/actions";
import { getEventEngagementDashboard } from "@/features/events/engagement/actions";
import { listFeaturedQueue } from "@/features/events/featured/actions";
import { listPromotedQueue } from "@/features/events/promoted/actions";
import { getEventSubmissionsDashboard } from "@/features/events/submissions/actions";
import { getPartnerActivationDashboard } from "@/features/partners/activation-actions";
import { getAdminSlidingBannerSettings } from "@/features/site-settings/actions";
import { unstable_noStore as noStore } from "next/cache";
import { AdminAuthClient } from "./AdminAuthClient";
import { AdminDashboardClient } from "./AdminDashboardClient";
import type { AdminInitialData } from "./types";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
	noStore();

	const sessionStatus = await getAdminSessionStatus();
	const isAuthenticated =
		sessionStatus.success && sessionStatus.isValid === true;

	if (!isAuthenticated) {
		return <AdminAuthClient />;
	}

	const [
		runtimeDataStatusResult,
		emailsResult,
		localStoreStatus,
		localStorePreview,
		localBackupStatus,
		localRecentBackups,
		featuredQueue,
		promotedQueue,
		eventEngagementDashboard,
		partnerActivations,
		eventSubmissions,
		slidingBannerSettings,
	] = await Promise.allSettled([
		getRuntimeDataStatus(),
		getCollectedEmails(),
		getLocalEventStoreStatus(),
		getLocalEventStorePreview(undefined, 2, { random: true }),
		getEventStoreBackupStatus(),
		getEventStoreRecentBackups(undefined, 30),
		listFeaturedQueue(),
		listPromotedQueue(),
		getEventEngagementDashboard(30),
		getPartnerActivationDashboard(),
		getEventSubmissionsDashboard(),
		getAdminSlidingBannerSettings(),
	]);

	const initialData: AdminInitialData = {
		sessionStatus,
		runtimeDataStatus:
			runtimeDataStatusResult.status === "fulfilled"
				? runtimeDataStatusResult.value
				: undefined,
		emailsResult:
			emailsResult.status === "fulfilled" ? emailsResult.value : undefined,
		localStoreStatus:
			localStoreStatus.status === "fulfilled"
				? localStoreStatus.value
				: undefined,
		localStorePreview:
			localStorePreview.status === "fulfilled"
				? localStorePreview.value
				: undefined,
		localBackupStatus:
			localBackupStatus.status === "fulfilled"
				? localBackupStatus.value
				: undefined,
		localRecentBackups:
			localRecentBackups.status === "fulfilled"
				? localRecentBackups.value
				: undefined,
		featuredQueue:
			featuredQueue.status === "fulfilled" ? featuredQueue.value : undefined,
		promotedQueue:
			promotedQueue.status === "fulfilled" ? promotedQueue.value : undefined,
		eventEngagementDashboard:
			eventEngagementDashboard.status === "fulfilled"
				? eventEngagementDashboard.value
				: undefined,
		partnerActivations:
			partnerActivations.status === "fulfilled"
				? partnerActivations.value
				: undefined,
		eventSubmissions:
			eventSubmissions.status === "fulfilled"
				? eventSubmissions.value
				: undefined,
		slidingBannerSettings:
			slidingBannerSettings.status === "fulfilled"
				? slidingBannerSettings.value
				: undefined,
	};

	return <AdminDashboardClient initialData={initialData} />;
}
