"use client";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	clearLocalEventStoreCsv,
	createEventStoreBackup,
	getEventStoreBackupStatus,
	getEventStoreRecentBackups,
	getLocalEventStoreCsv,
	getLocalEventStorePreview,
	getLocalEventStoreStatus,
	restoreLatestEventStoreBackup,
	saveLocalEventStoreCsv,
} from "@/features/data-management/actions";
import {
	type ChangeEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import type { RuntimeDataStatus } from "../types";

type LocalEventStoreCardProps = {
	isAuthenticated: boolean;
	runtimeDataStatus?: RuntimeDataStatus;
	initialStatus?: Awaited<ReturnType<typeof getLocalEventStoreStatus>>;
	initialPreview?: Awaited<ReturnType<typeof getLocalEventStorePreview>>;
	initialBackupStatus?: Awaited<ReturnType<typeof getEventStoreBackupStatus>>;
	initialRecentBackups?: Awaited<ReturnType<typeof getEventStoreRecentBackups>>;
	onStoreUpdated?: () => Promise<void> | void;
};

type StatusState = NonNullable<
	Awaited<ReturnType<typeof getLocalEventStoreStatus>>["status"]
>;
type PreviewRows = NonNullable<
	Awaited<ReturnType<typeof getLocalEventStorePreview>>["rows"]
>;
type BackupStatusState = NonNullable<
	Awaited<ReturnType<typeof getEventStoreBackupStatus>>["status"]
>;
type RecentBackupState = NonNullable<
	Awaited<ReturnType<typeof getEventStoreRecentBackups>>["backups"]
>[number];

const EMPTY_BACKUP_STATUS: BackupStatusState = {
	backupCount: 0,
	latestBackup: null,
};

export const LocalEventStoreCard = ({
	isAuthenticated,
	runtimeDataStatus,
	initialStatus,
	initialPreview,
	initialBackupStatus,
	initialRecentBackups,
	onStoreUpdated,
}: LocalEventStoreCardProps) => {
	const initialRecentBackupsList = initialRecentBackups?.success
		? (initialRecentBackups.backups ?? [])
		: [];
	const [status, setStatus] = useState<StatusState | undefined>(() =>
		initialStatus?.success ? initialStatus.status : undefined,
	);
	const [headers, setHeaders] = useState<readonly string[]>(() =>
		initialPreview?.success ? (initialPreview.headers ?? []) : [],
	);
	const [rows, setRows] = useState<PreviewRows>(() =>
		initialPreview?.success ? (initialPreview.rows ?? []) : [],
	);
	const [sampleHistory, setSampleHistory] = useState<PreviewRows[]>(() =>
		initialPreview?.success && initialPreview.rows ? [initialPreview.rows] : [],
	);
	const [sampleIndex, setSampleIndex] = useState(0);
	const [backupStatus, setBackupStatus] = useState<BackupStatusState>(() =>
		initialBackupStatus?.success
			? (initialBackupStatus.status ?? EMPTY_BACKUP_STATUS)
			: EMPTY_BACKUP_STATUS,
	);
	const [backupSupported, setBackupSupported] = useState(
		initialBackupStatus?.success
			? initialBackupStatus.supported !== false
			: true,
	);
	const [backupReason, setBackupReason] = useState(
		initialBackupStatus?.success ? (initialBackupStatus.reason ?? "") : "",
	);
	const [recentBackups, setRecentBackups] = useState<RecentBackupState[]>(
		initialRecentBackupsList,
	);
	const [selectedBackupId, setSelectedBackupId] = useState(
		initialRecentBackupsList[0]?.id ?? "",
	);
	const [showSnapshotPicker, setShowSnapshotPicker] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");
	const [sampleNote, setSampleNote] = useState("");
	const fileInputRef = useRef<HTMLInputElement | null>(null);

	const loadBackupState = useCallback(async () => {
		const [backupStatusResult, recentBackupsResult] = await Promise.all([
			getEventStoreBackupStatus(),
			getEventStoreRecentBackups(undefined, 30),
		]);

		if (backupStatusResult.success) {
			setBackupSupported(backupStatusResult.supported !== false);
			setBackupReason(backupStatusResult.reason || "");
			setBackupStatus(backupStatusResult.status || EMPTY_BACKUP_STATUS);
		}

		if (!recentBackupsResult.success) {
			throw new Error(
				recentBackupsResult.error || "Failed to load recent snapshots",
			);
		}

		const backups = recentBackupsResult.backups ?? [];
		setRecentBackups(backups);
		setSelectedBackupId((current) => {
			if (current && backups.some((backup) => backup.id === current)) {
				return current;
			}
			return backups[0]?.id ?? "";
		});
	}, []);

	const loadStoreStatusAndPreview = useCallback(async () => {
		const [statusResult, previewResult] = await Promise.all([
			getLocalEventStoreStatus(),
			getLocalEventStorePreview(undefined, 2, { random: true }),
		]);

		if (statusResult.success) {
			setStatus(statusResult.status);
		}

		if (!previewResult.success) {
			throw new Error(previewResult.error || "Failed to load store sample");
		}

		setHeaders(previewResult.headers || []);
		const nextRows = previewResult.rows || [];
		setRows(nextRows);
		setSampleHistory(nextRows.length > 0 ? [nextRows] : []);
		setSampleIndex(0);
	}, []);

	const loadStatusAndPreview = useCallback(async () => {
		await Promise.all([loadStoreStatusAndPreview(), loadBackupState()]);
	}, [loadBackupState, loadStoreStatusAndPreview]);

	useEffect(() => {
		if (!isAuthenticated) {
			return;
		}

		const shouldLoadStoreSample = !(initialStatus && initialPreview);
		const shouldLoadBackupState = !(
			initialBackupStatus?.success && initialRecentBackups?.success
		);
		const pendingLoads = [
			...(shouldLoadBackupState ? [loadBackupState()] : []),
			...(shouldLoadStoreSample ? [loadStoreStatusAndPreview()] : []),
		];
		if (pendingLoads.length === 0) {
			return;
		}

		Promise.all(pendingLoads).catch((loadError) => {
			setError(
				loadError instanceof Error
					? loadError.message
					: "Failed to load store status",
			);
		});
	}, [
		isAuthenticated,
		initialStatus,
		initialPreview,
		initialBackupStatus?.success,
		initialRecentBackups?.success,
		loadBackupState,
		loadStoreStatusAndPreview,
	]);

	if (!isAuthenticated) {
		return null;
	}

	const withTask = async (task: () => Promise<void>) => {
		setIsLoading(true);
		setMessage("");
		setError("");
		try {
			await task();
			if (onStoreUpdated) {
				await onStoreUpdated();
			}
		} catch (taskError) {
			setError(
				taskError instanceof Error
					? taskError.message
					: "Unknown error occurred",
			);
		} finally {
			setIsLoading(false);
		}
	};

	const handleSelectCsvUpload = () => {
		fileInputRef.current?.click();
	};

	const handleCsvFileSelected = async (
		event: ChangeEvent<HTMLInputElement>,
	) => {
		const file = event.target.files?.[0];
		event.currentTarget.value = "";
		if (!file) return;

		await withTask(async () => {
			const content = await file.text();
			if (!content.trim()) {
				throw new Error("The selected CSV file is empty");
			}

			const result = await saveLocalEventStoreCsv(undefined, content);
			if (!result.success) {
				throw new Error(result.error || result.message);
			}

			setMessage(
				`Uploaded ${file.name} to store (${result.rowCount ?? 0} rows)`,
			);
			await loadStatusAndPreview();
		});
	};

	const handleBackupNow = async () => {
		await withTask(async () => {
			const result = await createEventStoreBackup();
			if (!result.success) {
				throw new Error(result.error || result.message);
			}

			if (result.backup) {
				const createdBackup = result.backup;
				setBackupStatus((current) => ({
					backupCount: Math.max(current.backupCount + 1, 1),
					latestBackup: createdBackup,
				}));
				setRecentBackups((current) => {
					const deduped = current.filter(
						(backup) => backup.id !== createdBackup.id,
					);
					return [createdBackup, ...deduped].slice(0, 30);
				});
				setSelectedBackupId((current) => current || createdBackup.id);
				setShowSnapshotPicker(true);
			}

			setMessage(result.message);
			await loadBackupState();
		});
	};

	const handleRestoreLatestBackup = async () => {
		const latestBackup = backupStatus.latestBackup;
		if (!latestBackup) {
			setError("No backup is available to restore.");
			return;
		}

		const confirmed = window.confirm(
			`Restore latest backup from ${new Date(latestBackup.createdAt).toLocaleString()}? This will overwrite current store data, featured schedule data, and collected emails when the snapshot includes them.`,
		);
		if (!confirmed) return;

		await withTask(async () => {
			const result = await restoreLatestEventStoreBackup(
				undefined,
				latestBackup.id,
			);
			if (!result.success) {
				throw new Error(result.error || result.message);
			}

			setMessage(result.message);
			await loadStatusAndPreview();
		});
	};

	const handleRestoreSelectedSnapshot = async () => {
		const selectedBackup = recentBackups.find(
			(backup) => backup.id === selectedBackupId,
		);
		if (!selectedBackup) {
			setError("Pick a snapshot to restore first.");
			return;
		}

		const confirmed = window.confirm(
			`Restore snapshot from ${new Date(selectedBackup.createdAt).toLocaleString()} (${selectedBackup.trigger}, ${selectedBackup.rowCount} rows, ${selectedBackup.userCollectionCount ?? "legacy"} emails)? This overwrites current store, featured schedule data, and collected emails when the snapshot includes them.`,
		);
		if (!confirmed) return;

		await withTask(async () => {
			const result = await restoreLatestEventStoreBackup(
				undefined,
				selectedBackup.id,
			);
			if (!result.success) {
				throw new Error(result.error || result.message);
			}

			setMessage(result.message);
			await loadStatusAndPreview();
		});
	};

	const handleExportCsv = async () => {
		await withTask(async () => {
			const result = await getLocalEventStoreCsv();
			if (!result.success) {
				throw new Error(result.error || "Failed to export CSV");
			}

			const csvContent = (result.csvContent || "").trim();
			if (!csvContent) {
				throw new Error("No CSV data exists in store");
			}

			const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = `oooc-events-store-${new Date().toISOString().split("T")[0]}.csv`;
			document.body.appendChild(anchor);
			anchor.click();
			document.body.removeChild(anchor);
			URL.revokeObjectURL(url);
			setMessage("Store exported to CSV");
		});
	};

	const handleClearStore = async () => {
		if (
			!window.confirm("Clear all event data from store? This cannot be undone.")
		) {
			return;
		}

		await withTask(async () => {
			const result = await clearLocalEventStoreCsv();
			if (!result.success) {
				throw new Error(result.error || result.message);
			}

			setMessage(result.message);
			await loadStatusAndPreview();
		});
	};

	const handleShuffleSample = async () => {
		await withTask(async () => {
			const result = await getLocalEventStorePreview(undefined, 2, {
				random: true,
			});
			if (!result.success) {
				throw new Error(result.error || "Failed to shuffle sample");
			}

			setHeaders(result.headers || []);
			const nextRows = result.rows || [];
			setSampleHistory((current) => {
				const nextHistory = [...current, nextRows];
				setSampleIndex(nextHistory.length - 1);
				return nextHistory;
			});
			setRows(nextRows);
			setSampleNote(`Sample shuffled at ${new Date().toLocaleTimeString()}`);
		});
	};

	const canViewPreviousSample = sampleIndex > 0;
	const canViewNextSample = sampleIndex < sampleHistory.length - 1;

	const handlePreviousSample = () => {
		if (!canViewPreviousSample) return;
		const nextIndex = sampleIndex - 1;
		setSampleIndex(nextIndex);
		setRows(sampleHistory[nextIndex] ?? []);
		setSampleNote(`Viewing sample ${nextIndex + 1} of ${sampleHistory.length}`);
	};

	const handleNextSample = () => {
		if (!canViewNextSample) return;
		const nextIndex = sampleIndex + 1;
		setSampleIndex(nextIndex);
		setRows(sampleHistory[nextIndex] ?? []);
		setSampleNote(`Viewing sample ${nextIndex + 1} of ${sampleHistory.length}`);
	};

	const fallbackActive =
		runtimeDataStatus?.configuredDataSource === "remote" &&
		runtimeDataStatus.dataSource !== "store";
	const latestBackup = backupStatus.latestBackup;
	const restoreDisabled = isLoading || !backupSupported || !latestBackup;
	const selectedRestoreDisabled =
		isLoading ||
		!backupSupported ||
		!selectedBackupId ||
		recentBackups.length === 0;

	return (
		<Card className="ooo-admin-card min-w-0 overflow-hidden">
			<CardHeader className="space-y-2">
				<CardTitle>Event Store Controls</CardTitle>
				<CardDescription>
					Manage the live event store and import CSV backups when needed.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-5">
				<div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-5">
					<div className="rounded-md border bg-background/60 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Store Rows (CSV)
						</p>
						<p className="mt-1 text-base font-semibold">
							{status?.rowCount ?? 0}
						</p>
					</div>
					<div className="rounded-md border bg-background/60 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							This Year&apos;s Events
						</p>
						<p className="mt-1 text-base font-semibold">
							{runtimeDataStatus?.currentYearEventCount ?? 0}
						</p>
					</div>
					<div className="rounded-md border bg-background/60 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Updated
						</p>
						<p className="mt-1 text-sm leading-snug">
							{status?.updatedAt
								? new Date(status.updatedAt).toLocaleString()
								: "Never"}
						</p>
					</div>
					<div className="rounded-md border bg-background/60 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Store Location
						</p>
						<p className="mt-1 text-xs leading-snug text-muted-foreground">
							{status?.providerLocation || "Unavailable"}
						</p>
					</div>
					<div className="rounded-md border bg-background/60 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Last Backup
						</p>
						<p className="mt-1 text-sm leading-snug">
							{latestBackup?.createdAt
								? new Date(latestBackup.createdAt).toLocaleString()
								: "Never"}
						</p>
					</div>
				</div>

				<div className="rounded-md border bg-background/60 p-3 text-sm text-muted-foreground">
					<p className="font-medium text-foreground">Workflow</p>
					<p className="mt-1">1. Upload CSV into store.</p>
					<p>2. Edit in Event Sheet Editor and revalidate homepage.</p>
					<p>
						3. Backup now periodically; snapshots include events, placements,
						paid orders, submissions, settings, and collected emails.
					</p>
					<p>4. Export CSV anytime for external workflows.</p>
				</div>
				<div className="rounded-md border bg-background/60 p-3 text-sm text-muted-foreground">
					<p className="font-medium text-foreground">Backup Schedule</p>
					<p className="mt-1">
						Cron creates one snapshot daily at 04:20 UTC. Manual restores create
						a pre-restore snapshot first.
					</p>
					<p>
						Retention keeps the newest 30 snapshots by created time and removes
						older ones after each successful backup/pre-restore snapshot.
					</p>
				</div>

				{fallbackActive && (
					<div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
						Live site is currently serving local CSV fallback, not store-backed
						data.
					</div>
				)}
				{!backupSupported && (
					<div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
						Backups unavailable:{" "}
						{backupReason || "Postgres-backed store is required."}
					</div>
				)}

				<div className="flex flex-wrap gap-2">
					<Button
						type="button"
						disabled={isLoading}
						onClick={handleSelectCsvUpload}
					>
						Upload CSV to Store
					</Button>
					<Button
						type="button"
						variant="outline"
						disabled={isLoading || !backupSupported}
						onClick={handleBackupNow}
					>
						Backup Now
					</Button>
					<Button
						type="button"
						variant="outline"
						disabled={restoreDisabled}
						onClick={handleRestoreLatestBackup}
					>
						Restore Latest Backup
					</Button>
					<Button
						type="button"
						variant="outline"
						disabled={isLoading}
						onClick={handleExportCsv}
					>
						Export Store CSV
					</Button>
					<Button
						type="button"
						variant="destructive"
						disabled={isLoading}
						onClick={handleClearStore}
					>
						Clear Store
					</Button>
					<input
						ref={fileInputRef}
						type="file"
						accept=".csv,text/csv"
						onChange={handleCsvFileSelected}
						className="hidden"
					/>
				</div>
				{backupSupported && (
					<div className="rounded-md border bg-background/60 p-3">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<p className="text-xs text-muted-foreground">
								Recent snapshots: {recentBackups.length}
							</p>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								disabled={isLoading || recentBackups.length === 0}
								onClick={() => setShowSnapshotPicker((current) => !current)}
							>
								{showSnapshotPicker ? "Hide snapshots" : "Show snapshots"}
							</Button>
						</div>
						{recentBackups.length === 0 && (
							<p className="mt-1 text-xs text-muted-foreground">
								No snapshots yet. Click{" "}
								<span className="font-medium">Backup Now</span> to create the
								first one.
							</p>
						)}
						{showSnapshotPicker && (
							<div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
								<select
									value={selectedBackupId}
									onChange={(event) => setSelectedBackupId(event.target.value)}
									className="h-9 w-full rounded-md border bg-background px-2 text-xs sm:max-w-xl"
								>
									{recentBackups.map((backup) => (
										<option key={backup.id} value={backup.id}>
											{new Date(backup.createdAt).toLocaleString()} |{" "}
											{backup.trigger} | {backup.rowCount} rows |{" "}
											{backup.userCollectionCount ?? "legacy"} emails
										</option>
									))}
								</select>
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={selectedRestoreDisabled}
									onClick={handleRestoreSelectedSnapshot}
								>
									Restore Selected Snapshot
								</Button>
							</div>
						)}
					</div>
				)}

				<div className="grid gap-4 2xl:grid-cols-2">
					<div className="min-w-0 overflow-hidden rounded-md border bg-background/60 p-3">
						<div className="mb-2 flex items-center justify-between gap-3">
							<p className="text-sm font-medium">Store Sample (2 rows)</p>
							<div className="flex items-center gap-3">
								{sampleNote && (
									<span className="text-xs text-muted-foreground">
										{sampleNote}
									</span>
								)}
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={isLoading || !canViewPreviousSample}
									onClick={handlePreviousSample}
								>
									Previous
								</Button>
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={isLoading}
									onClick={handleShuffleSample}
								>
									Shuffle
								</Button>
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={isLoading || !canViewNextSample}
									onClick={handleNextSample}
								>
									Next
								</Button>
							</div>
						</div>
						<div className="relative w-full max-w-full overflow-x-auto overscroll-x-contain rounded-md border">
							<table className="w-max min-w-full text-xs">
								<thead className="bg-muted/40">
									<tr>
										{headers.map((header) => (
											<th
												key={header}
												className="px-2 py-2 text-left font-medium"
											>
												{header}
											</th>
										))}
									</tr>
								</thead>
								<tbody>
									{rows.length === 0 ? (
										<tr>
											<td
												colSpan={Math.max(headers.length, 1)}
												className="px-2 py-4 text-center text-muted-foreground"
											>
												No store rows available
											</td>
										</tr>
									) : (
										rows.map((row, rowIndex) => (
											<tr key={`store-row-${rowIndex}`} className="border-t">
												{headers.map((header) => (
													<td
														key={`${header}-${rowIndex}`}
														className="px-2 py-2 align-top whitespace-normal break-all"
													>
														{row[header as keyof typeof row]}
													</td>
												))}
											</tr>
										))
									)}
								</tbody>
							</table>
						</div>
					</div>
				</div>

				{message && (
					<div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
						{message}
					</div>
				)}
				{error && (
					<div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
						{error}
					</div>
				)}
			</CardContent>
		</Card>
	);
};
