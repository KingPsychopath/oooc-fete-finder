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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	clearLocalEventStoreCsv,
	getLocalEventStoreCsv,
	getLocalEventStorePreview,
	getLocalEventStoreStatus,
	importRemoteCsvToLocalEventStore,
	saveLocalEventStoreCsv,
	updateLocalEventStoreSettings,
} from "@/lib/data-management/actions";
import { useCallback, useEffect, useState } from "react";

type LocalEventStoreCardProps = {
	isAuthenticated: boolean;
	onStoreUpdated?: () => void;
};

type StatusState = NonNullable<
	Awaited<ReturnType<typeof getLocalEventStoreStatus>>["status"]
>;
type PreviewRows = NonNullable<
	Awaited<ReturnType<typeof getLocalEventStorePreview>>["rows"]
>;

const toCsvValue = (value: string): string => {
	if (value.includes('"') || value.includes(",") || value.includes("\n")) {
		return `"${value.replaceAll('"', '""')}"`;
	}
	return value;
};

export const LocalEventStoreCard = ({
	isAuthenticated,
	onStoreUpdated,
}: LocalEventStoreCardProps) => {
	const [status, setStatus] = useState<StatusState | undefined>(undefined);
	const [headers, setHeaders] = useState<readonly string[]>([]);
	const [rows, setRows] = useState<PreviewRows>([]);
	const [csvEditor, setCsvEditor] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");

	const loadPreview = useCallback(async () => {
		const previewResult = await getLocalEventStorePreview(undefined, 2, {
			random: true,
		});
		if (!previewResult.success) {
			throw new Error(previewResult.error || "Failed to load random preview");
		}
		setHeaders(previewResult.headers || []);
		setRows(previewResult.rows || []);
	}, []);

	const loadStatusAndPreview = useCallback(async () => {
		const [statusResult, previewResult] = await Promise.all([
			getLocalEventStoreStatus(),
			getLocalEventStorePreview(undefined, 2, { random: true }),
		]);

		if (statusResult.success) {
			setStatus(statusResult.status);
		}

		if (!previewResult.success) {
			throw new Error(previewResult.error || "Failed to load random preview");
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
				:	"Failed to load store status",
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
				onStoreUpdated();
			}
		} catch (taskError) {
			setError(
				taskError instanceof Error ? taskError.message : "Unknown error occurred",
			);
		} finally {
			setIsLoading(false);
		}
	};

	const handleLoadCsv = async () => {
		await withTask(async () => {
			const result = await getLocalEventStoreCsv();
			if (!result.success) {
				throw new Error(result.error || "Failed to load local store CSV");
			}

			setCsvEditor(result.csvContent || "");
			setMessage("Loaded local store CSV into editor");
		});
	};

	const handleSaveCsv = async () => {
		await withTask(async () => {
			if (!csvEditor.trim()) throw new Error("CSV editor is empty");

			const result = await saveLocalEventStoreCsv(undefined, csvEditor);
			if (!result.success) {
				throw new Error(result.error || result.message);
			}

			setMessage(result.message);
			await loadStatusAndPreview();
		});
	};

	const handleImportRemote = async () => {
		await withTask(async () => {
			const result = await importRemoteCsvToLocalEventStore();
			if (!result.success) {
				throw new Error(result.error || result.message);
			}

			setMessage(result.message);
			await loadStatusAndPreview();
		});
	};

	const handleClearStore = async () => {
		await withTask(async () => {
			const result = await clearLocalEventStoreCsv();
			if (!result.success) {
				throw new Error(result.error || result.message);
			}

			setCsvEditor("");
			setMessage(result.message);
			await loadStatusAndPreview();
		});
	};

	const handleToggleAutoSync = async (enabled: boolean) => {
		await withTask(async () => {
			const result = await updateLocalEventStoreSettings(undefined, {
				autoSyncFromGoogle: enabled,
			});
			if (!result.success) {
				throw new Error(result.error || "Failed to update auto-sync setting");
			}

			setStatus((current) => {
				if (!current) return current;
				return { ...current, autoSyncFromGoogle: enabled };
			});
			setMessage(`Auto-sync from Google ${enabled ? "enabled" : "disabled"}`);
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
				throw new Error("No CSV data available in local event store");
			}

			const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `oooc-events-store-${new Date().toISOString().split("T")[0]}.csv`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
			setMessage("CSV exported");
		});
	};

	const handleExportPreview = async () => {
		if (rows.length === 0 || headers.length === 0) {
			setError("No preview data to export");
			return;
		}

		const csvRows = [
			headers.join(","),
			...rows.map((row) =>
				headers.map((header) => toCsvValue(row[header as keyof typeof row])).join(","),
			),
		];

		const blob = new Blob([csvRows.join("\n")], {
			type: "text/csv;charset=utf-8;",
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `oooc-events-preview-${new Date().toISOString().split("T")[0]}.csv`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		setMessage("Preview CSV exported");
	};

	const handleRefreshPreview = async () => {
		await withTask(async () => {
			await loadPreview();
			setMessage("Preview shuffled with another random 2 rows");
		});
	};

	return (
		<Card className="border-white/20 bg-white/90 backdrop-blur-sm">
			<CardHeader>
				<CardTitle>Data Store Controls</CardTitle>
				<CardDescription>
					Manage the primary remote data store (Postgres when configured), mirror
					from Google fallback when needed, and export CSV anytime.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-5">
				<div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
					<p className="font-semibold">Recommended workflow</p>
					<p className="mt-1">
						Import once from Google backup, validate/edit in the Event Sheet
						Editor, then publish to keep Postgres store as source of truth.
					</p>
				</div>

				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
					<div className="rounded-md border bg-background/60 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Remote Provider
						</p>
						{status ? (
							<div className="space-y-1">
								<Badge variant="secondary" className="text-xs">
									{status.provider}
								</Badge>
								<p className="break-all text-[11px] leading-relaxed text-muted-foreground">
									{status.providerLocation}
								</p>
							</div>
						) : (
							<p className="text-sm">Loading...</p>
						)}
					</div>
					<div className="rounded-md border bg-background/60 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Store Data
						</p>
						<p className="text-sm">{status?.hasStoreData ? "Available" : "Empty"}</p>
					</div>
					<div className="rounded-md border bg-background/60 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Store CSV Rows
						</p>
						<p className="text-sm">{status?.rowCount ?? 0}</p>
						<p className="mt-1 text-[11px] text-muted-foreground">
							Raw rows in stored CSV (before parsing/filtering)
						</p>
					</div>
					<div className="rounded-md border bg-background/60 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Updated At
						</p>
						<p className="text-sm leading-relaxed">
							{status?.updatedAt
								? new Date(status.updatedAt).toLocaleString()
								: "Never"}
						</p>
					</div>
				</div>

				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					<div className="rounded-md border bg-background/60 p-3 space-y-2">
						<Label className="text-sm font-medium">Remote Mode Contract</Label>
						<p className="text-xs text-muted-foreground">
							Postgres store is prioritized first. File/memory are emergency local
							fallbacks only when Postgres is unreachable. Remote CSV is fallback
							only when store is empty or unavailable.
						</p>
						<Badge variant="outline" className="w-fit">
							Store-first enforced
						</Badge>
					</div>

					<div className="rounded-md border bg-background/60 p-3 space-y-2">
						<Label className="text-sm font-medium">Google Mirror Sync</Label>
						<p className="text-xs text-muted-foreground">
							When enabled, remote CSV fetches can mirror into Postgres store
							automatically.
						</p>
						<div className="flex gap-2">
							<Button
								type="button"
								variant={status?.autoSyncFromGoogle ? "default" : "outline"}
								size="sm"
								disabled={isLoading}
								onClick={() => handleToggleAutoSync(true)}
							>
								Enable
							</Button>
							<Button
								type="button"
								variant={!status?.autoSyncFromGoogle ? "default" : "outline"}
								size="sm"
								disabled={isLoading}
								onClick={() => handleToggleAutoSync(false)}
							>
								Disable
							</Button>
						</div>
					</div>
				</div>

				<div className="grid gap-4 lg:grid-cols-2">
					<div className="rounded-md border bg-background/60 p-3 space-y-3">
						<Label className="text-sm font-medium">Import + Store Actions</Label>
						<div className="flex flex-wrap gap-2">
							<Button type="button" disabled={isLoading} onClick={handleImportRemote}>
								Import Google CSV
							</Button>
							<Button
								type="button"
								variant="outline"
								disabled={isLoading}
								onClick={handleLoadCsv}
							>
								Load Store CSV
							</Button>
							<Button type="button" disabled={isLoading} onClick={handleSaveCsv}>
								Save CSV to Store
							</Button>
							<Button
								type="button"
								variant="outline"
								disabled={isLoading}
								onClick={loadStatusAndPreview}
							>
								Refresh Store Status
							</Button>
						</div>
					</div>

					<div className="rounded-md border bg-background/60 p-3 space-y-3">
						<Label className="text-sm font-medium">Export + Reset</Label>
						<div className="flex flex-wrap gap-2">
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
								variant="outline"
								disabled={isLoading}
								onClick={handleExportPreview}
							>
								Export Preview CSV
							</Button>
							<Button
								type="button"
								variant="destructive"
								disabled={isLoading}
								onClick={handleClearStore}
							>
								Clear Store
							</Button>
						</div>
					</div>
				</div>

				<div className="space-y-2">
					<Label htmlFor="event-store-csv-editor">Store CSV Editor (Advanced)</Label>
					<Textarea
						id="event-store-csv-editor"
						value={csvEditor}
						onChange={(event) => setCsvEditor(event.target.value)}
						placeholder="Load Store CSV, edit values, then save back to store."
						className="min-h-[180px] font-mono text-xs"
					/>
				</div>

				<div className="space-y-2">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<Label>Store Preview ({rows.length} random rows)</Label>
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={isLoading}
							onClick={handleRefreshPreview}
						>
							Show Another Random 2
						</Button>
					</div>
					<div className="overflow-x-auto rounded-md border">
						<table className="w-full text-xs">
							<thead className="bg-muted/60">
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
											No preview rows available
										</td>
									</tr>
								) : (
									rows.map((row, index) => (
										<tr key={`${row.name}-${index}`} className="border-t">
											{headers.map((header) => (
												<td key={`${header}-${index}`} className="px-2 py-2">
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
