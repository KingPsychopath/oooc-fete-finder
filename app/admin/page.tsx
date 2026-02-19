import { getAdminSessionStatus } from "@/features/auth/actions";
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

	const initialData: AdminInitialData = {
		sessionStatus,
	};

	return <AdminDashboardClient initialData={initialData} />;
}
