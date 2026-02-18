import {
	getAdminSessionOverview,
	getCollectedEmails,
} from "@/features/auth/actions";
import {
	getEventStoreBackupStatus,
	getEventStoreRecentBackups,
	getLocalEventStorePreview,
	getLocalEventStoreStatus,
	getRuntimeDataStatus,
} from "@/features/data-management/actions";
import { listFeaturedQueue } from "@/features/events/featured/actions";
import { getEventSubmissionsDashboard } from "@/features/events/submissions/actions";
import { getAdminSlidingBannerSettings } from "@/features/site-settings/actions";
import { AdminAuthClient } from "./AdminAuthClient";
import { AdminDashboardClient } from "./AdminDashboardClient";
import type { AdminInitialData } from "./types";

export default async function AdminPage() {
	const sessionOverview = await getAdminSessionOverview();
	const sessionStatus = sessionOverview.sessionStatus;
	const isAuthenticated =
		sessionStatus.success && sessionStatus.isValid === true;

	if (!isAuthenticated) {
		return <AdminAuthClient />;
	}
	const tokenSessions =
		sessionOverview.success ?
			{
				success: true,
				sessions: sessionOverview.tokenSessions ?? [],
				count: (sessionOverview.tokenSessions ?? []).length,
				currentTokenVersion: sessionOverview.currentTokenVersion ?? 1,
			}
		:	{
				success: false,
				error: sessionOverview.error || "Unauthorized",
			};

	const [
		runtimeDataStatus,
		emailsResult,
		localStoreStatus,
		localStorePreview,
		localBackupStatus,
		localRecentBackups,
		featuredQueue,
		eventSubmissions,
		slidingBannerSettings,
	] = await Promise.all([
		getRuntimeDataStatus(),
		getCollectedEmails(),
		getLocalEventStoreStatus(),
		getLocalEventStorePreview(undefined, 2, { random: true }),
		getEventStoreBackupStatus(),
		getEventStoreRecentBackups(undefined, 30),
		listFeaturedQueue(),
		getEventSubmissionsDashboard(),
		getAdminSlidingBannerSettings(),
	]);

	const initialData: AdminInitialData = {
		runtimeDataStatus,
		emailsResult,
		sessionStatus,
		tokenSessions,
		localStoreStatus,
		localStorePreview,
		localBackupStatus,
		localRecentBackups,
		featuredQueue,
		eventSubmissions,
		slidingBannerSettings,
	};

	return <AdminDashboardClient initialData={initialData} />;
}
