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
import { getSessionToken } from "@/lib/admin/admin-session";
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

	const loadStatusAndPreview = useCallback(async () => {
		const token = getSessionToken();
		if (!token) return;

		const [statusResult, previewResult] = await Promise.all([
			getLocalEventStoreStatus(token),
			getLocalEventStorePreview(token, 8),
		]);

		if (statusResult.success) {
			setStatus(statusResult.status);
		}

		if (previewResult.success) {
			setHeaders(previewResult.headers || []);
			setRows(previewResult.rows || []);
		}
	}, []);

	useEffect(() => {
		if (!isAuthenticated) return;
		loadStatusAndPreview();
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
			const token = getSessionToken();
			if (!token) throw new Error("No valid admin session");

			const result = await getLocalEventStoreCsv(token);
			if (!result.success) {
				throw new Error(result.error || "Failed to load local store CSV");
			}

			setCsvEditor(result.csvContent || "");
			setMessage("Loaded local store CSV into editor");
		});
	};

	const handleSaveCsv = async () => {
		await withTask(async () => {
			const token = getSessionToken();
			if (!token) throw new Error("No valid admin session");
			if (!csvEditor.trim()) throw new Error("CSV editor is empty");

			const result = await saveLocalEventStoreCsv(token, csvEditor);
			if (!result.success) {
				throw new Error(result.error || result.message);
			}

			setMessage(result.message);
			await loadStatusAndPreview();
		});
	};

	const handleImportRemote = async () => {
		await withTask(async () => {
			const token = getSessionToken();
			if (!token) throw new Error("No valid admin session");

			const result = await importRemoteCsvToLocalEventStore(token);
			if (!result.success) {
				throw new Error(result.error || result.message);
			}

			setMessage(result.message);
			await loadStatusAndPreview();
		});
	};

	const handleClearStore = async () => {
		await withTask(async () => {
			const token = getSessionToken();
			if (!token) throw new Error("No valid admin session");

			const result = await clearLocalEventStoreCsv(token);
			if (!result.success) {
				throw new Error(result.error || result.message);
			}

			setCsvEditor("");
			setMessage(result.message);
			await loadStatusAndPreview();
		});
	};

	const handleUpdatePreference = async (
		sourcePreference: "store-first" | "google-first",
	) => {
		await withTask(async () => {
			const token = getSessionToken();
			if (!token) throw new Error("No valid admin session");

			const result = await updateLocalEventStoreSettings(token, {
				sourcePreference,
			});
			if (!result.success) {
				throw new Error(result.error || "Failed to update source preference");
			}

			setStatus((current) => {
				if (!current) return current;
				return { ...current, sourcePreference };
			});
			setMessage(`Source preference updated to ${sourcePreference}`);
		});
	};

	const handleToggleAutoSync = async (enabled: boolean) => {
		await withTask(async () => {
			const token = getSessionToken();
			if (!token) throw new Error("No valid admin session");

			const result = await updateLocalEventStoreSettings(token, {
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
			const token = getSessionToken();
			if (!token) throw new Error("No valid admin session");

			const result = await getLocalEventStoreCsv(token);
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

	return (
		<Card className="border-white/20 bg-white/90 backdrop-blur-sm">
			<CardHeader>
				<CardTitle>Local Event Store Control Center</CardTitle>
				<CardDescription>
					Manage your primary CSV source, sync from Google when needed, and
					export clean copies for editors.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-5">
				<div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
					<p className="font-semibold">Recommended workflow</p>
					<p className="mt-1">
						Import once from Google, validate/edit in the Event Sheet Editor, then
						save and publish to keep the local store as source of truth.
					</p>
				</div>

				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
					<div className="rounded-md border bg-background/60 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Provider
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
							Row Count
						</p>
						<p className="text-sm">{status?.rowCount ?? 0}</p>
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
						<Label className="text-sm font-medium">Data Source Strategy</Label>
						<p className="text-xs text-muted-foreground">
							Choose whether the site should prioritize this local store or
							continue preferring Google.
						</p>
						<div className="flex gap-2">
							<Button
								type="button"
								variant={
									status?.sourcePreference === "store-first"
										? "default"
										: "outline"
								}
								size="sm"
								disabled={isLoading}
								onClick={() => handleUpdatePreference("store-first")}
							>
								Store First
							</Button>
							<Button
								type="button"
								variant={
									status?.sourcePreference === "google-first"
										? "default"
										: "outline"
								}
								size="sm"
								disabled={isLoading}
								onClick={() => handleUpdatePreference("google-first")}
							>
								Google First
							</Button>
						</div>
					</div>

					<div className="rounded-md border bg-background/60 p-3 space-y-2">
						<Label className="text-sm font-medium">Google Auto Sync</Label>
						<p className="text-xs text-muted-foreground">
							When enabled, remote fetches can refresh the local store
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
						<Label className="text-sm font-medium">Sync + Store Actions</Label>
						<div className="flex flex-wrap gap-2">
							<Button type="button" disabled={isLoading} onClick={handleImportRemote}>
								Import Remote CSV
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
								Save Editor to Store
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
					<Label htmlFor="event-store-csv-editor">Manual CSV Editor (Advanced)</Label>
					<Textarea
						id="event-store-csv-editor"
						value={csvEditor}
						onChange={(event) => setCsvEditor(event.target.value)}
						placeholder="Load Store CSV, edit values, then Save Editor to Store."
						className="min-h-[180px] font-mono text-xs"
					/>
				</div>

				<div className="space-y-2">
					<Label>Store Preview ({rows.length} rows)</Label>
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
