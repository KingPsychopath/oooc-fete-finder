import {
	getAdminSessionStatus,
} from "@/features/auth/actions";
import { getRuntimeDataStatus } from "@/features/data-management/actions";
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

	const runtimeDataStatus = await getRuntimeDataStatus();

	const initialData: AdminInitialData = {
		runtimeDataStatus,
		sessionStatus,
	};

	return <AdminDashboardClient initialData={initialData} />;
}
