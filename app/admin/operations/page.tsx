import {
	getAdminSessionStatus,
	getAdminTokenSessions,
} from "@/features/auth/actions";
import {
	getEventStoreBackupStatus,
	getEventStoreRecentBackups,
	getLiveSiteEventsSnapshot,
	getLocalEventStorePreview,
	getLocalEventStoreStatus,
	getRuntimeDataStatus,
} from "@/features/data-management/actions";
import { unstable_noStore as noStore } from "next/cache";
import type { AdminOperationsInitialData } from "../types";
import { OperationsDashboardClient } from "./OperationsDashboardClient";

export const dynamic = "force-dynamic";

export default async function AdminOperationsPage() {
	noStore();

	const [
		runtimeDataStatusResult,
		sessionStatusResult,
		tokenSessionsResult,
		liveSnapshotResult,
		localStoreStatus,
		localStorePreview,
		localBackupStatus,
		localRecentBackups,
	] = await Promise.allSettled([
		getRuntimeDataStatus(),
		getAdminSessionStatus(),
		getAdminTokenSessions(),
		getLiveSiteEventsSnapshot(),
		getLocalEventStoreStatus(),
		getLocalEventStorePreview(undefined, 2, { random: true }),
		getEventStoreBackupStatus(),
		getEventStoreRecentBackups(undefined, 30),
	]);

	const initialData: AdminOperationsInitialData = {
		runtimeDataStatus:
			runtimeDataStatusResult.status === "fulfilled"
				? runtimeDataStatusResult.value
				: undefined,
		sessionStatus:
			sessionStatusResult.status === "fulfilled"
				? sessionStatusResult.value
				: undefined,
		tokenSessions:
			tokenSessionsResult.status === "fulfilled"
				? tokenSessionsResult.value
				: undefined,
		liveSnapshot:
			liveSnapshotResult.status === "fulfilled"
				? liveSnapshotResult.value
				: undefined,
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
	};

	return <OperationsDashboardClient initialData={initialData} />;
}
