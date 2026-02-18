"use client";

import { Button } from "@/components/ui/button";
import {
	exportCollectedEmailsCsv,
	getCollectedEmails,
	logoutAdminSession,
} from "@/features/auth/actions";
import {
	getRuntimeDataStatus,
	revalidatePages,
} from "@/features/data-management/actions";
import { env } from "@/lib/config/env";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AdminSessionStatus } from "./components/AdminSessionStatus";
import { RuntimeDataStatusCard } from "./components/RuntimeDataStatusCard";
import { EmailCollectionCard } from "./components/EmailCollectionCard";
import { EventSheetEditorCard } from "./components/EventSheetEditorCard";
import { FeaturedEventsManagerCard } from "./components/FeaturedEventsManagerCard";
import { LiveEventsSnapshotCard } from "./components/LiveEventsSnapshotCard";
import { LocalEventStoreCard } from "./components/LocalEventStoreCard";
import { SlidingBannerSettingsCard } from "./components/SlidingBannerSettingsCard";
import type {
	RuntimeDataStatus,
	EmailRecord,
	UserCollectionAnalytics,
	UserCollectionStoreSummary,
} from "./types";
import type { AdminInitialData } from "./types";

const basePath = env.NEXT_PUBLIC_BASE_PATH;

type AdminDashboardClientProps = {
	initialData: AdminInitialData;
};

export function AdminDashboardClient({
	initialData,
}: AdminDashboardClientProps) {
	const router = useRouter();
	const initialEmailsResult = initialData.emailsResult;
	const [runtimeDataStatus, setRuntimeDataStatus] = useState<RuntimeDataStatus>(
		initialData.runtimeDataStatus,
	);
	const [emails, setEmails] = useState<EmailRecord[]>(
		initialEmailsResult?.success
			? (initialEmailsResult.emails ?? [])
			: [],
	);
	const [emailStore, setEmailStore] =
		useState<UserCollectionStoreSummary | null>(
			initialEmailsResult?.success
				? (initialEmailsResult.store ?? null)
				: null,
		);
	const [emailAnalytics, setEmailAnalytics] =
		useState<UserCollectionAnalytics | null>(
			initialEmailsResult?.success
				? (initialEmailsResult.analytics ?? null)
				: null,
		);
	const [refreshing, setRefreshing] = useState(false);
	const [refreshMessage, setRefreshMessage] = useState("");
	const [statusRefreshing, setStatusRefreshing] = useState(false);

	const loadRuntimeDataStatus = useCallback(async () => {
		const status = await getRuntimeDataStatus();
		setRuntimeDataStatus(status);
		return status;
	}, []);

	const loadEmails = useCallback(async () => {
		const result = await getCollectedEmails();
		if (result.success) {
			setEmails(result.emails ?? []);
			setEmailStore(result.store ?? null);
			setEmailAnalytics(result.analytics ?? null);
		}
	}, []);

	useEffect(() => {
		if (initialEmailsResult?.success) {
			return;
		}
		void loadEmails();
	}, [initialEmailsResult?.success, loadEmails]);

	const handleLogout = useCallback(async () => {
		await logoutAdminSession();
		router.refresh();
	}, [router]);

	const handleStatusRefresh = useCallback(async () => {
		setStatusRefreshing(true);
		try {
			await Promise.all([loadRuntimeDataStatus(), loadEmails()]);
			setRefreshMessage("Status refreshed");
		} catch (statusError) {
			setRefreshMessage(
				`Failed to refresh status: ${
					statusError instanceof Error ? statusError.message : "Unknown error"
				}`,
			);
		} finally {
			setStatusRefreshing(false);
		}
	}, [loadRuntimeDataStatus, loadEmails]);

	const handleRefresh = useCallback(async () => {
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
			await Promise.all([loadRuntimeDataStatus(), loadEmails()]);
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
	}, [loadRuntimeDataStatus, loadEmails]);

	const exportAsCSV = useCallback(async () => {
		const result = await exportCollectedEmailsCsv();
		if (!result.success || !result.csv) return;
		const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download =
			result.filename ??
			`fete-finder-users-${new Date().toISOString().split("T")[0]}.csv`;
		document.body.appendChild(anchor);
		anchor.click();
		document.body.removeChild(anchor);
		URL.revokeObjectURL(url);
	}, []);

	const copyEmails = useCallback(() => {
		const emailList = emails.map((entry) => entry.email).join("\n");
		navigator.clipboard.writeText(emailList);
	}, [emails]);

	const handleBackToHome = useCallback(() => {
		router.push(basePath || "/");
	}, [router]);

	const onDataSaved = useCallback(async () => {
		await Promise.all([loadRuntimeDataStatus(), loadEmails()]);
	}, [loadRuntimeDataStatus, loadEmails]);

	return (
		<div className="ooo-admin-shell overflow-x-hidden">
			<div className="mx-auto w-full max-w-[1960px] px-4 py-8 sm:px-6 lg:px-8">
				<div className="mb-6 flex flex-wrap items-start justify-between gap-4">
					<div>
						<p className="ooo-admin-kicker">Out Of Office Collective</p>
						<h1 className="ooo-admin-title">Admin Workflow Console</h1>
						<p className="mt-1 text-sm text-muted-foreground">
							Postgres-first workflow with explicit fallback visibility and
							cleaner editing controls.
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<Button onClick={handleBackToHome} variant="outline" size="sm">
							Back to Home
						</Button>
						<Button
							onClick={handleStatusRefresh}
							variant="outline"
							size="sm"
							disabled={statusRefreshing || refreshing}
						>
							{statusRefreshing ? "Refreshing..." : "Refresh Status"}
						</Button>
					</div>
				</div>

				<div className="grid items-start gap-6 2xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)]">
					<div className="min-w-0 space-y-6">
						<RuntimeDataStatusCard
							runtimeDataStatus={runtimeDataStatus}
							refreshing={refreshing}
							refreshMessage={refreshMessage}
							onRefresh={handleRefresh}
						/>
						<EventSheetEditorCard
							isAuthenticated
							initialEditorData={initialData.editorData}
							onDataSaved={onDataSaved}
						/>
						<FeaturedEventsManagerCard onScheduleUpdated={onDataSaved} />
						<LiveEventsSnapshotCard
							isAuthenticated
							initialSnapshot={initialData.liveSnapshot}
						/>
					</div>

					<div className="min-w-0 space-y-6">
						<AdminSessionStatus
							initialSessionStatus={initialData.sessionStatus}
							initialTokenSessions={initialData.tokenSessions}
							onLogout={handleLogout}
						/>
						<LocalEventStoreCard
							isAuthenticated
							runtimeDataStatus={runtimeDataStatus}
							initialStatus={initialData.localStoreStatus}
							initialPreview={initialData.localStorePreview}
							onStoreUpdated={onDataSaved}
						/>
						<SlidingBannerSettingsCard
							initialSettings={initialData.slidingBannerSettings}
						/>
						<EmailCollectionCard
							emails={emails}
							store={emailStore}
							analytics={emailAnalytics}
							onCopyEmails={copyEmails}
							onExportCSV={() => void exportAsCSV()}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
