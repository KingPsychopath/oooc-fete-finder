import {
	getAdminSessionStatus,
	getAdminTokenSessions,
	getCollectedEmails,
} from "@/features/auth/actions";
import {
	getCacheStatus,
	getEventSheetEditorData,
	getLiveSiteEventsSnapshot,
	getLocalEventStorePreview,
	getLocalEventStoreStatus,
} from "@/features/data-management/actions";
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
		cacheStatus,
		emailsResult,
		tokenSessions,
		localStoreStatus,
		localStorePreview,
		editorData,
		liveSnapshot,
		slidingBannerSettings,
	] = await Promise.all([
		getCacheStatus(),
		getCollectedEmails(),
		getAdminTokenSessions(),
		getLocalEventStoreStatus(),
		getLocalEventStorePreview(undefined, 2, { random: true }),
		getEventSheetEditorData(),
		getLiveSiteEventsSnapshot(undefined, 500),
		getAdminSlidingBannerSettings(),
	]);

	const initialData: AdminInitialData = {
		cacheStatus,
		emailsResult,
		sessionStatus,
		tokenSessions,
		localStoreStatus,
		localStorePreview,
		editorData,
		liveSnapshot,
		slidingBannerSettings,
	};

	return <AdminDashboardClient initialData={initialData} />;
}
