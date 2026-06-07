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
	getExpandedEventStoreCsv,
	getLocalEventStoreCsv,
	getLocalEventStorePreview,
	getLocalEventStoreStatus,
	restoreLatestEventStoreBackup,
	saveLocalEventStoreCsv,
} from "@/features/data-management/actions";
import {
	formatAdminDateTime,
	formatAdminTime,
} from "@/lib/ui/admin-date-format";
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
	const [operationReason, setOperationReason] = useState("");
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

	useEffect(() => {
		const revealHashedBackup = () => {
			if (!window.location.hash.startsWith("#event-store-backup-")) return;
			setShowSnapshotPicker(true);
			window.setTimeout(() => {
				document
					.getElementById(window.location.hash.slice(1))
					?.scrollIntoView({ behavior: "smooth", block: "center" });
			}, 120);
		};

		revealHashedBackup();
		window.addEventListener("hashchange", revealHashedBackup);
		return () => window.removeEventListener("hashchange", revealHashedBackup);
	}, []);

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
		const reason = operationReason.trim();
		if (!reason) {
			setError("Add an operation note before restoring a snapshot.");
			return;
		}
		const latestBackup = backupStatus.latestBackup;
		if (!latestBackup) {
			setError("No backup is available to restore.");
			return;
		}

		const confirmed = window.confirm(
			`Restore latest backup from ${formatAdminDateTime(latestBackup.createdAt)}? This will overwrite current store data, featured schedule data, and collected emails when the snapshot includes them.`,
		);
		if (!confirmed) return;

		await withTask(async () => {
			const result = await restoreLatestEventStoreBackup(
				undefined,
				latestBackup.id,
				reason,
			);
			if (!result.success) {
				throw new Error(result.error || result.message);
			}

			setMessage(result.message);
			setOperationReason("");
			await loadStatusAndPreview();
		});
	};

	const handleRestoreSelectedSnapshot = async () => {
		const reason = operationReason.trim();
		if (!reason) {
			setError("Add an operation note before restoring a snapshot.");
			return;
		}
		const selectedBackup = recentBackups.find(
			(backup) => backup.id === selectedBackupId,
		);
		if (!selectedBackup) {
			setError("Pick a snapshot to restore first.");
			return;
		}

		const confirmed = window.confirm(
			`Restore snapshot from ${formatAdminDateTime(selectedBackup.createdAt)} (${selectedBackup.trigger}, ${selectedBackup.rowCount} rows, ${selectedBackup.userCollectionCount ?? "unknown"} emails)? This overwrites current store, featured schedule data, and collected emails when the snapshot includes them.`,
		);
		if (!confirmed) return;

		await withTask(async () => {
			const result = await restoreLatestEventStoreBackup(
				undefined,
				selectedBackup.id,
				reason,
			);
			if (!result.success) {
				throw new Error(result.error || result.message);
			}

			setMessage(result.message);
			setOperationReason("");
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

	const handleExportExpandedCsv = async () => {
		await withTask(async () => {
			const result = await getExpandedEventStoreCsv();
			if (!result.success) {
				throw new Error(
					result.error || "Failed to export generated events CSV",
				);
			}

			const csvContent = (result.csvContent || "").trim();
			if (!csvContent) {
				throw new Error("No generated event data exists in store");
			}

			const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = `oooc-events-expanded-${new Date().toISOString().split("T")[0]}.csv`;
			document.body.appendChild(anchor);
			anchor.click();
			document.body.removeChild(anchor);
			URL.revokeObjectURL(url);
			setMessage(`Generated events CSV exported (${result.count ?? 0} rows)`);
		});
	};

	const handleClearStore = async () => {
		const reason = operationReason.trim();
		if (!reason) {
			setError("Add an operation note before clearing the managed store.");
			return;
		}
		if (
			!window.confirm(
				`Clear ${status?.rowCount ?? 0} event row${(status?.rowCount ?? 0) === 1 ? "" : "s"} from the store? This cannot be undone.`,
			)
		) {
			return;
		}

		await withTask(async () => {
			const result = await clearLocalEventStoreCsv(undefined, reason);
			if (!result.success) {
				throw new Error(result.error || result.message);
			}

			setMessage(result.message);
			setOperationReason("");
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
			setSampleNote(`Sample shuffled at ${formatAdminTime(new Date())}`);
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
	const hasStoreRows = (status?.rowCount ?? 0) > 0;
	const latestBackup = backupStatus.latestBackup;
	const selectedBackup = recentBackups.find(
		(backup) => backup.id === selectedBackupId,
	);
	const hasOperationReason = operationReason.trim().length > 0;
	const restoreDisabled =
		isLoading || !backupSupported || !latestBackup || !hasOperationReason;
	const selectedRestoreDisabled =
		isLoading ||
		!backupSupported ||
		!selectedBackupId ||
		recentBackups.length === 0 ||
		!hasOperationReason;
	const uploadTitle = isLoading
		? "Wait for the current store task to finish"
		: "Upload a CSV file into the managed event store";
	const backupNowTitle = !backupSupported
		? backupReason || "Postgres-backed store is required for backups"
		: isLoading
			? "Wait for the current store task to finish"
			: "Create a snapshot of events, placements, paid orders, submissions, settings, and collected emails";
	const restoreLatestTitle = (() => {
		if (!backupSupported) {
			return backupReason || "Postgres-backed store is required for restores";
		}
		if (!latestBackup) return "No snapshot is available to restore";
		if (!hasOperationReason) {
			return "Add an operation note before restoring a snapshot";
		}
		return `Restore latest snapshot from ${formatAdminDateTime(latestBackup.createdAt)}`;
	})();
	const exportStoreTitle = hasStoreRows
		? `Export ${status?.rowCount ?? 0} raw store row${(status?.rowCount ?? 0) === 1 ? "" : "s"} as CSV`
		: "No store rows to export";
	const exportGeneratedTitle = hasStoreRows
		? "Export generated event rows as CSV"
		: "No generated event rows to export";
	const clearStoreTitle = hasStoreRows
		? hasOperationReason
			? `Clear ${status?.rowCount ?? 0} event row${(status?.rowCount ?? 0) === 1 ? "" : "s"} from the store`
			: "Add an operation note before clearing the managed store"
		: "No store rows to clear";
	const selectedRestoreTitle = (() => {
		if (!backupSupported) {
			return backupReason || "Postgres-backed store is required for restores";
		}
		if (recentBackups.length === 0) return "No snapshots are available to restore";
		if (!selectedBackupId) return "Pick a snapshot to restore";
		if (!hasOperationReason) {
			return "Add an operation note before restoring a snapshot";
		}
		if (selectedBackup) {
			return `Restore snapshot from ${formatAdminDateTime(selectedBackup.createdAt)}`;
		}
		return "Restore the selected snapshot";
	})();

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
								? formatAdminDateTime(status.updatedAt)
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
								? formatAdminDateTime(latestBackup.createdAt)
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

				<div className="space-y-2">
					<label
						htmlFor="event-store-operation-reason"
						className="text-sm font-medium"
					>
						Operation note
					</label>
					<textarea
						id="event-store-operation-reason"
						value={operationReason}
						onChange={(event) => setOperationReason(event.target.value)}
						placeholder="Required for restore and clear actions. Example: restoring before failed CSV import."
						className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
					/>
				</div>

				<div className="flex flex-wrap gap-2">
					<Button
						type="button"
						disabled={isLoading}
						onClick={handleSelectCsvUpload}
						title={uploadTitle}
					>
						Upload CSV to Store
					</Button>
					<Button
						type="button"
						variant="outline"
						disabled={isLoading || !backupSupported}
						onClick={handleBackupNow}
						title={backupNowTitle}
					>
						Backup Now
					</Button>
					<Button
						type="button"
						variant="outline"
						disabled={restoreDisabled}
						onClick={handleRestoreLatestBackup}
						title={restoreLatestTitle}
					>
						Restore Latest Backup
					</Button>
					<Button
						type="button"
						variant="outline"
						disabled={isLoading || !hasStoreRows}
						onClick={handleExportCsv}
						title={exportStoreTitle}
					>
						Export Store CSV
					</Button>
					<Button
						type="button"
						variant="outline"
						disabled={isLoading || !hasStoreRows}
						onClick={handleExportExpandedCsv}
						title={exportGeneratedTitle}
					>
						Export Generated CSV
					</Button>
					<Button
						type="button"
						variant="destructive"
						disabled={isLoading || !hasStoreRows || !hasOperationReason}
						onClick={handleClearStore}
						title={clearStoreTitle}
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
								title={
									recentBackups.length === 0
										? "No snapshots are available"
										: "Show or hide recent snapshots"
								}
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
									title="Choose which snapshot to restore"
								>
									{recentBackups.map((backup) => (
										<option key={backup.id} value={backup.id}>
											{formatAdminDateTime(backup.createdAt)} | {backup.trigger}{" "}
											| {backup.rowCount} rows |{" "}
											{backup.userCollectionCount ?? "unknown"} emails
										</option>
									))}
								</select>
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={selectedRestoreDisabled}
									onClick={handleRestoreSelectedSnapshot}
									title={selectedRestoreTitle}
								>
									Restore Selected Snapshot
								</Button>
							</div>
						)}
						{showSnapshotPicker && recentBackups.length > 0 && (
							<div className="mt-3 max-h-64 space-y-2 overflow-auto pr-1">
								{recentBackups.map((backup) => {
									const isSelected = backup.id === selectedBackupId;
									return (
										<button
											key={backup.id}
											id={`event-store-backup-${backup.id}`}
											type="button"
											onClick={() => setSelectedBackupId(backup.id)}
											className={`block w-full scroll-mt-44 rounded-md border px-3 py-2 text-left text-xs transition-colors ${
												isSelected
													? "border-foreground/40 bg-muted"
													: "bg-background/70 hover:bg-muted/45"
											}`}
											title={`Select snapshot from ${formatAdminDateTime(backup.createdAt)}`}
										>
											<span className="block font-medium text-foreground">
												{formatAdminDateTime(backup.createdAt)}
											</span>
											<span className="mt-0.5 block text-muted-foreground">
												{backup.trigger} · {backup.rowCount} rows ·{" "}
												{backup.featuredEntryCount} placements ·{" "}
												{backup.userCollectionCount ?? "unknown"} emails
											</span>
										</button>
									);
								})}
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
									title={
										canViewPreviousSample
											? "Show the previous two store rows"
											: "Already showing the first store sample"
									}
								>
									Previous
								</Button>
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={isLoading}
									onClick={handleShuffleSample}
									title="Show a random two-row store sample"
								>
									Shuffle
								</Button>
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={isLoading || !canViewNextSample}
									onClick={handleNextSample}
									title={
										canViewNextSample
											? "Show the next two store rows"
											: "Already showing the last store sample"
									}
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
