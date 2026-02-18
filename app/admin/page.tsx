import {
	getAdminTokenSessions,
	getCollectedEmails,
	getAdminSessionStatus,
} from "@/features/auth/actions";
import {
	getEventSheetEditorData,
	getEventStoreBackupStatus,
	getEventStoreRecentBackups,
	getLiveSiteEventsSnapshot,
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
	const sessionStatus = await getAdminSessionStatus();
	const isAuthenticated =
		sessionStatus.success && sessionStatus.isValid === true;

	if (!isAuthenticated) {
		return <AdminAuthClient />;
	}

	const [
		runtimeDataStatus,
		emailsResult,
		tokenSessions,
		localStoreStatus,
		localStorePreview,
		localBackupStatus,
		localRecentBackups,
		editorData,
		liveSnapshot,
		featuredQueue,
		eventSubmissions,
		slidingBannerSettings,
	] = await Promise.all([
		getRuntimeDataStatus(),
		getCollectedEmails(),
		getAdminTokenSessions(),
		getLocalEventStoreStatus(),
		getLocalEventStorePreview(undefined, 2, { random: true }),
		getEventStoreBackupStatus(),
		getEventStoreRecentBackups(undefined, 30),
		getEventSheetEditorData(),
		getLiveSiteEventsSnapshot(undefined, 500),
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
		editorData,
		liveSnapshot,
		featuredQueue,
		eventSubmissions,
		slidingBannerSettings,
	};

	return <AdminDashboardClient initialData={initialData} />;
}
