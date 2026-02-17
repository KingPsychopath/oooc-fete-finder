"use client";

import { Button } from "@/components/ui/button";
import {
	createAdminSession,
	exportCollectedEmailsCsv,
	getAdminSessionStatus,
	getCollectedEmails,
	logoutAdminSession,
} from "@/features/auth/actions";
import { revalidatePages } from "@/lib/cache/actions";
import { env } from "@/lib/config/env";
import { getCacheStatus } from "@/features/data-management/actions";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { AdminSessionStatus } from "./components/AdminSessionStatus";
import { AuthForm } from "./components/AuthForm";
import { CacheManagementCard } from "./components/CacheManagementCard";
import { EmailCollectionCard } from "./components/EmailCollectionCard";
import { EventSheetEditorCard } from "./components/EventSheetEditorCard";
import { LiveEventsSnapshotCard } from "./components/LiveEventsSnapshotCard";
import { LocalEventStoreCard } from "./components/LocalEventStoreCard";
import type {
	CacheStatus,
	EmailRecord,
	UserCollectionAnalytics,
	UserCollectionMirrorStatus,
	UserCollectionStoreSummary,
} from "./types";

const basePath = env.NEXT_PUBLIC_BASE_PATH;

export default function AdminPage() {
	const router = useRouter();
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const [adminKey, setAdminKey] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	const [emails, setEmails] = useState<EmailRecord[]>([]);
	const [emailStore, setEmailStore] = useState<UserCollectionStoreSummary | null>(
		null,
	);
	const [emailAnalytics, setEmailAnalytics] =
		useState<UserCollectionAnalytics | null>(null);
	const [emailMirror, setEmailMirror] = useState<UserCollectionMirrorStatus | null>(
		null,
	);
	const [cacheStatus, setCacheStatus] = useState<CacheStatus | null>(null);
	const [refreshing, setRefreshing] = useState(false);
	const [refreshMessage, setRefreshMessage] = useState("");
	const [statusRefreshing, setStatusRefreshing] = useState(false);

	const loadCacheStatus = useCallback(async () => {
		const status = await getCacheStatus();
		setCacheStatus(status);
		return status;
	}, []);

	const loadEmails = useCallback(async (credential?: string) => {
		const result = await getCollectedEmails(credential);
		if (result.success) {
			setEmails(result.emails || []);
			setEmailStore(result.store || null);
			setEmailAnalytics(result.analytics || null);
			setEmailMirror(result.mirror || null);
		}
	}, []);

	const handleSubmit = async (event: FormEvent) => {
		event.preventDefault();
		setIsLoading(true);
		setError("");

		try {
			const sessionResult = await createAdminSession(adminKey);
			if (!sessionResult.success) {
				setError(sessionResult.error || "Invalid admin key");
				return;
			}

			setIsAuthenticated(true);
			await Promise.all([loadCacheStatus(), loadEmails(adminKey)]);
			setRefreshMessage("Admin session started");
			setAdminKey("");
		} catch (submitError) {
			setError(
				submitError instanceof Error ?
					submitError.message
				: 	"Something went wrong",
			);
		} finally {
			setIsLoading(false);
		}
	};

	const handleLogout = useCallback(async () => {
		await logoutAdminSession();
		setIsAuthenticated(false);
		setAdminKey("");
		setEmails([]);
		setEmailStore(null);
		setEmailAnalytics(null);
		setEmailMirror(null);
		setCacheStatus(null);
		setError("");
		setRefreshMessage("");
	}, []);

	const handleStatusRefresh = useCallback(async () => {
		setStatusRefreshing(true);
		try {
			await Promise.all([loadCacheStatus(), loadEmails()]);
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
	}, [loadCacheStatus, loadEmails]);

	const handleRefresh = async () => {
		setRefreshing(true);
		setRefreshMessage("Refreshing cache and revalidating routes...");
		try {
			const revalidateResult = await revalidatePages(undefined, "/");
			if (!revalidateResult.success) {
				setRefreshMessage(
					`Revalidation failed: ${revalidateResult.error || "Unknown error"}`,
				);
				return;
			}

			await Promise.all([loadCacheStatus(), loadEmails()]);
			setRefreshMessage(
				`Revalidated in ${revalidateResult.processingTimeMs || 0}ms`,
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
	};

	const exportAsCSV = async () => {
		const result = await exportCollectedEmailsCsv();
		if (!result.success || !result.csv) {
			return;
		}

		const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download =
			result.filename || `fete-finder-users-${new Date().toISOString().split("T")[0]}.csv`;
		document.body.appendChild(anchor);
		anchor.click();
		document.body.removeChild(anchor);
		URL.revokeObjectURL(url);
	};

	const copyEmails = () => {
		const emailList = emails.map((entry) => entry.email).join("\n");
		navigator.clipboard.writeText(emailList);
	};

	const handleBackToHome = () => {
		router.push(basePath || "/");
	};

	useEffect(() => {
		const checkExistingSession = async () => {
			try {
				const status = await getAdminSessionStatus();
				if (!status.success || !status.isValid) {
					setIsAuthenticated(false);
					return;
				}

				setIsAuthenticated(true);
				await Promise.all([loadCacheStatus(), loadEmails()]);
				setRefreshMessage("Session restored");
			} catch {
				setIsAuthenticated(false);
			}
		};

		void checkExistingSession();
	}, [loadCacheStatus, loadEmails]);

	if (!isAuthenticated) {
		return (
			<AuthForm
				onSubmit={handleSubmit}
				isLoading={isLoading}
				error={error}
				adminKey={adminKey}
				setAdminKey={setAdminKey}
			/>
		);
	}

	if (!cacheStatus) {
		return (
			<div className="ooo-admin-shell overflow-x-hidden">
				<div className="mx-auto w-full max-w-[1960px] px-6 py-10">
					<div className="flex items-center justify-between">
						<h1 className="ooo-admin-title">Admin Workflow Console</h1>
						<Button onClick={handleBackToHome} variant="outline" size="sm">
							Back to Home
						</Button>
					</div>
					<div className="mt-4 text-sm text-muted-foreground">
						Loading admin status...
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="ooo-admin-shell overflow-x-hidden">
			<div className="mx-auto w-full max-w-[1960px] px-4 py-8 sm:px-6 lg:px-8">
				<div className="mb-6 flex flex-wrap items-start justify-between gap-4">
					<div>
						<p className="ooo-admin-kicker">Out Of Office Collective</p>
						<h1 className="ooo-admin-title">Admin Workflow Console</h1>
						<p className="mt-1 text-sm text-muted-foreground">
							Postgres-first workflow with explicit fallback visibility and cleaner
							editing controls.
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
						<CacheManagementCard
							cacheStatus={cacheStatus}
							refreshing={refreshing}
							refreshMessage={refreshMessage}
							onRefresh={handleRefresh}
						/>

						<EventSheetEditorCard
							isAuthenticated={isAuthenticated}
							onDataSaved={async () => {
								await Promise.all([loadCacheStatus(), loadEmails()]);
							}}
						/>

						<LiveEventsSnapshotCard isAuthenticated={isAuthenticated} />
					</div>

					<div className="min-w-0 space-y-6">
						<AdminSessionStatus onLogout={handleLogout} />

						<LocalEventStoreCard
							isAuthenticated={isAuthenticated}
							cacheStatus={cacheStatus}
							onStoreUpdated={async () => {
								await Promise.all([loadCacheStatus(), loadEmails()]);
							}}
						/>

						<EmailCollectionCard
							emails={emails}
							store={emailStore}
							analytics={emailAnalytics}
							mirror={emailMirror}
							onCopyEmails={copyEmails}
							onExportCSV={() => void exportAsCSV()}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
