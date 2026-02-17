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
import type { AdminInitialData } from "./types";
import { AdminAuthClient } from "./AdminAuthClient";
import { AdminDashboardClient } from "./AdminDashboardClient";

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
	] = await Promise.all([
		getCacheStatus(),
		getCollectedEmails(),
		getAdminTokenSessions(),
		getLocalEventStoreStatus(),
		getLocalEventStorePreview(undefined, 2, { random: true }),
		getEventSheetEditorData(),
		getLiveSiteEventsSnapshot(undefined, 500),
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
	};

	return <AdminDashboardClient initialData={initialData} />;
}
