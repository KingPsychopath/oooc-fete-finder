"use client";

import { Badge } from "@/components/ui/badge";
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
	getLocalEventStoreCsv,
	getLocalEventStorePreview,
	getLocalEventStoreStatus,
	importRemoteCsvToLocalEventStore,
	previewRemoteCsvForAdmin,
	saveLocalEventStoreCsv,
} from "@/lib/data-management/actions";
import type { EditableSheetColumn, EditableSheetRow } from "@/lib/data-management/csv/sheet-editor";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import type { CacheStatus } from "../types";

type LocalEventStoreCardProps = {
	isAuthenticated: boolean;
	cacheStatus?: CacheStatus;
	onStoreUpdated?: () => Promise<void> | void;
};

type StatusState = NonNullable<
	Awaited<ReturnType<typeof getLocalEventStoreStatus>>["status"]
>;
type PreviewRows = NonNullable<
	Awaited<ReturnType<typeof getLocalEventStorePreview>>["rows"]
>;

type RemotePreviewState = {
	columns: EditableSheetColumn[];
	rows: EditableSheetRow[];
	totalRows: number;
	fetchedAt: string;
};

export const LocalEventStoreCard = ({
	isAuthenticated,
	cacheStatus,
	onStoreUpdated,
}: LocalEventStoreCardProps) => {
	const [status, setStatus] = useState<StatusState | undefined>(undefined);
	const [headers, setHeaders] = useState<readonly string[]>([]);
	const [rows, setRows] = useState<PreviewRows>([]);
	const [remotePreview, setRemotePreview] = useState<RemotePreviewState | null>(
		null,
	);
	const [isLoading, setIsLoading] = useState(false);
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");
	const [sampleNote, setSampleNote] = useState("");
	const fileInputRef = useRef<HTMLInputElement | null>(null);

	const loadStatusAndPreview = useCallback(async () => {
		const [statusResult, previewResult] = await Promise.all([
			getLocalEventStoreStatus(),
			getLocalEventStorePreview(undefined, 2, { random: true }),
		]);

		if (statusResult.success) {
			setStatus(statusResult.status);
		}

		if (!previewResult.success) {
			throw new Error(previewResult.error || "Failed to load Postgres sample");
		}

		setHeaders(previewResult.headers || []);
		setRows(previewResult.rows || []);
	}, []);

	useEffect(() => {
		if (!isAuthenticated) return;
		loadStatusAndPreview().catch((loadError) => {
			setError(
				loadError instanceof Error ?
					loadError.message
				: 	"Failed to load store status",
			);
		});
	}, [isAuthenticated, loadStatusAndPreview]);

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
				taskError instanceof Error ? taskError.message : "Unknown error occurred",
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
				`Uploaded ${file.name} to Postgres store (${result.rowCount ?? 0} rows)`,
			);
			await loadStatusAndPreview();
		});
	};

	const handleImportGoogle = async () => {
		await withTask(async () => {
			const result = await importRemoteCsvToLocalEventStore();
			if (!result.success) {
				throw new Error(result.error || result.message);
			}

			setMessage(result.message);
			await loadStatusAndPreview();
		});
	};

	const handlePreviewGoogle = async () => {
		await withTask(async () => {
			const result = await previewRemoteCsvForAdmin(undefined, 5);
			if (!result.success || !result.columns || !result.rows) {
				throw new Error(result.error || "Failed to preview Google backup source");
			}

			setRemotePreview({
				columns: result.columns,
				rows: result.rows,
				totalRows: result.totalRows || result.rows.length,
				fetchedAt: result.fetchedAt || new Date().toISOString(),
			});
			setMessage("Google backup preview refreshed");
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
				throw new Error("No CSV data exists in Postgres store");
			}

			const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download =
				`oooc-events-store-${new Date().toISOString().split("T")[0]}.csv`;
			document.body.appendChild(anchor);
			anchor.click();
			document.body.removeChild(anchor);
			URL.revokeObjectURL(url);
			setMessage("Postgres store exported to CSV");
		});
	};

	const handleClearStore = async () => {
		if (
			!window.confirm(
				"Clear all event data from Postgres store? This cannot be undone.",
			)
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

	const handleRefreshSample = async () => {
		await withTask(async () => {
			const result = await getLocalEventStorePreview(undefined, 2, { random: true });
			if (!result.success) {
				throw new Error(result.error || "Failed to refresh sample");
			}

			setHeaders(result.headers || []);
			setRows(result.rows || []);
			setSampleNote(`Sample refreshed at ${new Date().toLocaleTimeString()}`);
		});
	};

	const fallbackActive =
		cacheStatus?.configuredDataSource === "remote" &&
		cacheStatus.dataSource !== "store";

	return (
		<Card className="ooo-admin-card">
			<CardHeader className="space-y-2">
				<CardTitle>Data Store Controls</CardTitle>
				<CardDescription>
					Postgres is the source of truth for live events. Google CSV remains a
					backup import source only.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-5">
				<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
					<div className="rounded-md border bg-background/60 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Provider
						</p>
						<Badge variant="secondary" className="mt-2 text-xs">
							{status?.provider || "unknown"}
						</Badge>
					</div>
					<div className="rounded-md border bg-background/60 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Store Rows (CSV)
						</p>
						<p className="mt-1 text-base font-semibold">{status?.rowCount ?? 0}</p>
					</div>
					<div className="rounded-md border bg-background/60 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Live Events
						</p>
						<p className="mt-1 text-base font-semibold">
							{cacheStatus?.eventCount ?? 0}
						</p>
					</div>
					<div className="rounded-md border bg-background/60 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Updated
						</p>
						<p className="mt-1 text-sm leading-snug">
							{status?.updatedAt ? new Date(status.updatedAt).toLocaleString() : "Never"}
						</p>
					</div>
				</div>

				<div className="rounded-md border bg-background/60 p-3 text-sm text-muted-foreground">
					<p className="font-medium text-foreground">Workflow</p>
					<p className="mt-1">1. Upload CSV or import from Google backup into Postgres.</p>
					<p>2. Edit in Event Sheet Editor and publish to live cache.</p>
					<p>3. Export CSV anytime for external workflows.</p>
				</div>

				{fallbackActive && (
					<div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
						Live site is currently serving local CSV fallback, not Postgres.
					</div>
				)}

				<div className="flex flex-wrap gap-2">
					<Button type="button" disabled={isLoading} onClick={handleSelectCsvUpload}>
						Upload CSV to Postgres
					</Button>
					<Button
						type="button"
						variant="outline"
						disabled={isLoading}
						onClick={handleImportGoogle}
					>
						Import Google Backup
					</Button>
					<Button
						type="button"
						variant="outline"
						disabled={isLoading}
						onClick={handlePreviewGoogle}
					>
						Preview Google Backup
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

				<div className="grid gap-4 xl:grid-cols-2">
					<div className="rounded-md border bg-background/60 p-3">
						<div className="mb-2 flex items-center justify-between gap-3">
							<p className="text-sm font-medium">Postgres Store Sample (2 rows)</p>
							<div className="flex items-center gap-3">
								{sampleNote && (
									<span className="text-xs text-muted-foreground">{sampleNote}</span>
								)}
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={isLoading}
									onClick={handleRefreshSample}
								>
									Refresh sample
								</Button>
							</div>
						</div>
						<div className="overflow-x-auto rounded-md border">
							<table className="w-full text-xs">
								<thead className="bg-muted/40">
									<tr>
										{headers.map((header) => (
											<th key={header} className="px-2 py-2 text-left font-medium">
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
													<td key={`${header}-${rowIndex}`} className="px-2 py-2">
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

					<div className="rounded-md border bg-background/60 p-3">
						<div className="mb-2 flex items-center justify-between gap-3">
							<p className="text-sm font-medium">Google Backup Preview</p>
							{remotePreview?.fetchedAt && (
								<span className="text-xs text-muted-foreground">
									{new Date(remotePreview.fetchedAt).toLocaleTimeString()}
								</span>
							)}
						</div>
						{!remotePreview ? (
							<div className="rounded-md border border-dashed p-4 text-xs text-muted-foreground">
								Run "Preview Google Backup" to compare the backup source without
								changing Postgres.
							</div>
						) : (
							<>
								<p className="mb-2 text-xs text-muted-foreground">
									Showing {remotePreview.rows.length} of {remotePreview.totalRows} rows.
								</p>
								<div className="overflow-x-auto rounded-md border">
									<table className="w-full text-xs">
										<thead className="bg-muted/40">
											<tr>
												{remotePreview.columns.map((column) => (
													<th
														key={column.key}
														className="px-2 py-2 text-left font-medium"
													>
														{column.label}
													</th>
												))}
											</tr>
										</thead>
										<tbody>
											{remotePreview.rows.map((row, rowIndex) => (
												<tr key={`remote-row-${rowIndex}`} className="border-t">
													{remotePreview.columns.map((column) => (
														<td
															key={`${column.key}-${rowIndex}`}
															className="px-2 py-2"
														>
															{row[column.key] ?? ""}
														</td>
													))}
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</>
						)}
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
