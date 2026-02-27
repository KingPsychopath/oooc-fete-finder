"use client";

import { logoutAdminSession } from "@/features/auth/actions";
import {
	getRuntimeDataStatus,
	revalidatePages,
} from "@/features/data-management/actions";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { AdminSessionStatus } from "../components/AdminSessionStatus";
import { LiveEventsSnapshotCard } from "../components/LiveEventsSnapshotCard";
import { LocalEventStoreCard } from "../components/LocalEventStoreCard";
import { RuntimeDataStatusCard } from "../components/RuntimeDataStatusCard";
import { SystemResetCard } from "../components/SystemResetCard";
import type {
	AdminOperationsInitialData,
	RuntimeDataStatus,
} from "../types";

const FALLBACK_RUNTIME_DATA_STATUS: RuntimeDataStatus = {
	lastFetchTime: null,
	lastRemoteErrorMessage: "",
	dataSource: "store",
	eventCount: 0,
	configuredDataSource: "remote",
	remoteConfigured: false,
	hasLocalStoreData: false,
	storeProvider: "memory",
	storeProviderLocation: "Loading...",
	storeRowCount: 0,
	storeUpdatedAt: null,
	storeKeyCount: 0,
};

type OperationsDashboardClientProps = {
	initialData: AdminOperationsInitialData;
};

export function OperationsDashboardClient({
	initialData,
}: OperationsDashboardClientProps) {
	const router = useRouter();
	const [runtimeDataStatus, setRuntimeDataStatus] = useState<RuntimeDataStatus>(
		initialData.runtimeDataStatus ?? FALLBACK_RUNTIME_DATA_STATUS,
	);
	const [refreshing, setRefreshing] = useState(false);
	const [refreshMessage, setRefreshMessage] = useState("");
	const [statusRefreshing, setStatusRefreshing] = useState(false);

	const loadRuntimeDataStatus = useCallback(async () => {
		const status = await getRuntimeDataStatus();
		setRuntimeDataStatus(status);
		return status;
	}, []);

	const handleLogout = useCallback(async () => {
		await logoutAdminSession();
		router.refresh();
	}, [router]);

	const handleStatusRefresh = useCallback(async () => {
		setStatusRefreshing(true);
		try {
			await loadRuntimeDataStatus();
			setRefreshMessage("Status refreshed");
			router.refresh();
		} catch (statusError) {
			setRefreshMessage(
				`Failed to refresh status: ${
					statusError instanceof Error ? statusError.message : "Unknown error"
				}`,
			);
		} finally {
			setStatusRefreshing(false);
		}
	}, [loadRuntimeDataStatus, router]);

	const handleHomepageRevalidate = useCallback(async () => {
		setRefreshing(true);
		setRefreshMessage("Revalidating homepage with latest runtime data...");
		try {
			const revalidateResult = await revalidatePages(undefined, "/");
			if (!revalidateResult.success) {
				setRefreshMessage(
					`Revalidation failed: ${revalidateResult.error || "Unknown error"}`,
				);
				return;
			}
			await loadRuntimeDataStatus();
			setRefreshMessage(
				`Revalidated in ${revalidateResult.processingTimeMs ?? 0}ms`,
			);
		} catch (refreshError) {
			setRefreshMessage(
				`Refresh failed: ${
					refreshError instanceof Error ? refreshError.message : "Unknown error"
				}`,
			);
		} finally {
			setRefreshing(false);
		}
	}, [loadRuntimeDataStatus]);

	const onStoreUpdated = useCallback(async () => {
		await loadRuntimeDataStatus();
	}, [loadRuntimeDataStatus]);

	return (
		<div className="space-y-6">
			<section id="events-data-status" className="scroll-mt-24">
				<RuntimeDataStatusCard
					runtimeDataStatus={runtimeDataStatus}
					refreshing={refreshing}
					refreshMessage={refreshMessage}
					onRefresh={handleHomepageRevalidate}
				/>
			</section>

			<section id="live-site-snapshot" className="scroll-mt-24">
				<LiveEventsSnapshotCard
					isAuthenticated
					initialSnapshot={initialData.liveSnapshot}
				/>
			</section>

			<section id="data-store-controls" className="scroll-mt-24">
				<LocalEventStoreCard
					isAuthenticated
					runtimeDataStatus={runtimeDataStatus}
					initialStatus={initialData.localStoreStatus}
					initialPreview={initialData.localStorePreview}
					initialBackupStatus={initialData.localBackupStatus}
					initialRecentBackups={initialData.localRecentBackups}
					onStoreUpdated={onStoreUpdated}
				/>
			</section>

			<section id="admin-session" className="scroll-mt-24">
				<AdminSessionStatus
					initialSessionStatus={initialData.sessionStatus}
					initialTokenSessions={initialData.tokenSessions}
					onLogout={handleLogout}
				/>
			</section>

			<section id="factory-reset" className="scroll-mt-24">
				<SystemResetCard
					onResetCompleted={
						statusRefreshing ? undefined : handleStatusRefresh
					}
				/>
			</section>
		</div>
	);
}
