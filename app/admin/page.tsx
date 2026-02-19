import { getAdminSessionStatus } from "@/features/auth/actions";
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

	const initialData: AdminInitialData = {
		sessionStatus,
	};

	return <AdminDashboardClient initialData={initialData} />;
}
