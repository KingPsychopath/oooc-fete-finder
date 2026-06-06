import { getAdminUsersDashboard } from "@/features/users/admin-actions";
import { unstable_noStore as noStore } from "next/cache";
import { UsersDashboardClient } from "./UsersDashboardClient";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
	noStore();

	const initialDashboard = await getAdminUsersDashboard();
	return <UsersDashboardClient initialDashboard={initialDashboard} />;
}
