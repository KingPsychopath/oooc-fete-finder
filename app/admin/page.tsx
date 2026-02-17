import {
	getAdminSessionStatus,
	getAdminTokenSessions,
	getCollectedEmails,
} from "@/features/auth/actions";
import {
	getRuntimeDataStatus,
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
		runtimeDataStatus,
		emailsResult,
		tokenSessions,
		localStoreStatus,
		localStorePreview,
		slidingBannerSettings,
	] = await Promise.all([
		getRuntimeDataStatus(),
		getCollectedEmails(),
		getAdminTokenSessions(),
		getLocalEventStoreStatus(),
		getLocalEventStorePreview(undefined, 2, { random: true }),
		getAdminSlidingBannerSettings(),
	]);

	const initialData: AdminInitialData = {
		runtimeDataStatus,
		emailsResult,
		sessionStatus,
		tokenSessions,
		localStoreStatus,
		localStorePreview,
		slidingBannerSettings,
	};

	return <AdminDashboardClient initialData={initialData} />;
}
