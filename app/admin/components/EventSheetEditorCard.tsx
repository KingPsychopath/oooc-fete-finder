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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	getEventSheetEditorData,
	saveEventSheetEditorRows,
} from "@/lib/data-management/actions";
import {
	createBlankEditableSheetRow,
	createCustomColumnKey,
	type EditableSheetColumn,
	type EditableSheetRow,
} from "@/lib/data-management/csv/sheet-editor";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type EventSheetEditorCardProps = {
	isAuthenticated: boolean;
	onDataSaved?: () => Promise<void> | void;
};

type EditorPayload = Awaited<ReturnType<typeof getEventSheetEditorData>>;
type EditorSnapshot = {
	columns: EditableSheetColumn[];
	rows: EditableSheetRow[];
};

const ROW_DELETE_CONFIRMATION =
	"Delete this row from the event sheet? This will be removed on next save.";
const COLUMN_DELETE_CONFIRMATION =
	"Delete this custom column? This will remove values for this column from all rows.";
const HISTORY_LIMIT = 120;
const ROW_NUMBER_COLUMN_WIDTH = 56;
const DATA_COLUMN_WIDTH = 170;
const MAX_FROZEN_COLUMNS = 4;

const cellRefKey = (rowIndex: number, columnKey: string) =>
	`${rowIndex}:${columnKey}`;

export const EventSheetEditorCard = ({
	isAuthenticated,
	onDataSaved,
}: EventSheetEditorCardProps) => {
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [rows, setRows] = useState<EditableSheetRow[]>([]);
	const [columns, setColumns] = useState<EditableSheetColumn[]>([]);
	const [query, setQuery] = useState("");
	const [statusMessage, setStatusMessage] = useState("Loading sheet...");
	const [errorMessage, setErrorMessage] = useState("");
	const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
	const [newColumnLabel, setNewColumnLabel] = useState("");
	const [displayLimit, setDisplayLimit] = useState(50);
	const [pinnedColumnsCount, setPinnedColumnsCount] = useState(0);
	const [canUndo, setCanUndo] = useState(false);
	const [canRedo, setCanRedo] = useState(false);

	const rowsRef = useRef<EditableSheetRow[]>([]);
	const columnsRef = useRef<EditableSheetColumn[]>([]);
	const pastRef = useRef<EditorSnapshot[]>([]);
	const futureRef = useRef<EditorSnapshot[]>([]);
	const activeCellEditRef = useRef<string | null>(null);
	const editVersionRef = useRef(0);
	const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

	useEffect(() => {
		rowsRef.current = rows;
	}, [rows]);

	useEffect(() => {
		columnsRef.current = columns;
	}, [columns]);

	const cloneSnapshot = useCallback(
		(
			sourceColumns: EditableSheetColumn[],
			sourceRows: EditableSheetRow[],
		): EditorSnapshot => ({
			columns: sourceColumns.map((column) => ({ ...column })),
			rows: sourceRows.map((row) => ({ ...row })),
		}),
		[],
	);

	const refreshHistoryFlags = useCallback(() => {
		setCanUndo(pastRef.current.length > 0);
		setCanRedo(futureRef.current.length > 0);
	}, []);

	const pushHistorySnapshot = useCallback(() => {
		pastRef.current.push(cloneSnapshot(columnsRef.current, rowsRef.current));
		if (pastRef.current.length > HISTORY_LIMIT) {
			pastRef.current.shift();
		}
		futureRef.current = [];
		refreshHistoryFlags();
	}, [cloneSnapshot, refreshHistoryFlags]);

	const applySnapshot = useCallback(
		(snapshot: EditorSnapshot, statusMessage: string) => {
			const nextColumns = snapshot.columns.map((column) => ({ ...column }));
			const nextRows = snapshot.rows.map((row) => ({ ...row }));
			activeCellEditRef.current = null;
			columnsRef.current = nextColumns;
			rowsRef.current = nextRows;
			setColumns(nextColumns);
			setRows(nextRows);
			setHasUnsavedChanges(true);
			editVersionRef.current += 1;
			setStatusMessage(statusMessage);
		},
		[],
	);

	const loadEditorData = useCallback(async () => {
		if (!isAuthenticated) return;

		setIsLoading(true);
		setErrorMessage("");
		try {
			const result: EditorPayload = await getEventSheetEditorData();
			if (!result.success || !result.columns || !result.rows) {
				throw new Error(result.error || "Failed to load sheet data");
			}

			setColumns(result.columns);
			setRows(result.rows);
			setLastSavedAt(result.status?.updatedAt ?? null);
			setHasUnsavedChanges(false);
			pastRef.current = [];
			futureRef.current = [];
			activeCellEditRef.current = null;
			refreshHistoryFlags();
			setStatusMessage(
				`Loaded ${result.rows.length} rows and ${result.columns.length} columns from Postgres store`,
			);
		} catch (error) {
			setErrorMessage(
				error instanceof Error ? error.message : "Unknown load error",
			);
			setStatusMessage("Failed to load sheet");
		} finally {
			setIsLoading(false);
		}
	}, [isAuthenticated, refreshHistoryFlags]);

	useEffect(() => {
		void loadEditorData();
	}, [loadEditorData]);

	const performSave = useCallback(
		async (mode: "auto" | "manual") => {
			const versionToSave = editVersionRef.current;
			setIsSaving(true);
			setErrorMessage("");

			try {
				const result = await saveEventSheetEditorRows(
					undefined,
					columnsRef.current,
					rowsRef.current,
					{ refreshCache: mode === "manual" },
				);
				if (!result.success) {
					throw new Error(result.error || result.message);
				}

				if (versionToSave === editVersionRef.current) {
					setHasUnsavedChanges(false);
				}
				setLastSavedAt(result.updatedAt || new Date().toISOString());
				setStatusMessage(
					mode === "auto"
						? "Autosaved to Postgres (cache publish pending)"
						: "Saved to Postgres and cache refreshed",
				);

				if (onDataSaved && mode === "manual") {
					await onDataSaved();
				}
			} catch (error) {
				setErrorMessage(
					error instanceof Error ? error.message : "Unknown save error",
				);
			} finally {
				setIsSaving(false);
			}
		},
		[onDataSaved],
	);

	useEffect(() => {
		if (!hasUnsavedChanges || isSaving) {
			return;
		}

		if (autosaveTimerRef.current) {
			clearTimeout(autosaveTimerRef.current);
		}

		autosaveTimerRef.current = setTimeout(() => {
			void performSave("auto");
		}, 850);

		return () => {
			if (autosaveTimerRef.current) {
				clearTimeout(autosaveTimerRef.current);
			}
		};
	}, [hasUnsavedChanges, isSaving, performSave]);

	const markDirty = useCallback(() => {
		editVersionRef.current += 1;
		setHasUnsavedChanges(true);
	}, []);

	const commitSheetMutation = useCallback(
		(
			nextColumns: EditableSheetColumn[],
			nextRows: EditableSheetRow[],
			status: string,
		) => {
			pushHistorySnapshot();
			activeCellEditRef.current = null;
			columnsRef.current = nextColumns;
			rowsRef.current = nextRows;
			setColumns(nextColumns);
			setRows(nextRows);
			markDirty();
			setStatusMessage(status);
		},
		[markDirty, pushHistorySnapshot],
	);

	const handleCellChange = useCallback(
		(rowIndex: number, columnKey: string, value: string) => {
			const currentRows = rowsRef.current;
			const targetRow = currentRows[rowIndex];
			if (!targetRow || targetRow[columnKey] === value) {
				return;
			}

			const editKey = cellRefKey(rowIndex, columnKey);
			if (activeCellEditRef.current !== editKey) {
				pushHistorySnapshot();
				activeCellEditRef.current = editKey;
			}

			const nextRows = currentRows.map((row, index) =>
				index === rowIndex ? { ...row, [columnKey]: value } : row,
			);
			rowsRef.current = nextRows;
			setRows(nextRows);
			markDirty();
		},
		[markDirty, pushHistorySnapshot],
	);

	const handleAddRow = () => {
		const nextRows = [
			...rowsRef.current.map((row) => ({ ...row })),
			createBlankEditableSheetRow(columnsRef.current),
		];
		commitSheetMutation(
			columnsRef.current.map((column) => ({ ...column })),
			nextRows,
			"New row added",
		);
	};

	const handleDeleteRow = (rowIndex: number) => {
		if (!window.confirm(ROW_DELETE_CONFIRMATION)) {
			return;
		}
		const nextRows = rowsRef.current
			.map((row) => ({ ...row }))
			.filter((_, index) => index !== rowIndex);
		commitSheetMutation(
			columnsRef.current.map((column) => ({ ...column })),
			nextRows,
			"Row deleted",
		);
	};

	const handleAddColumn = () => {
		const label = newColumnLabel.trim();
		if (!label) {
			setErrorMessage("Column label is required");
			return;
		}

		setErrorMessage("");
		const currentColumns = columnsRef.current;
		const key = createCustomColumnKey(label, currentColumns);
		const nextColumns = [
			...currentColumns.map((column) => ({ ...column })),
			{
				key,
				label,
				isCore: false,
				isRequired: false,
			},
		];
		const nextRows = rowsRef.current.map((row) => ({
			...row,
			[key]: row[key] ?? "",
		}));

		commitSheetMutation(nextColumns, nextRows, `Column "${label}" added`);
		setNewColumnLabel("");
	};

	const handleDeleteColumn = (column: EditableSheetColumn) => {
		if (column.isCore) {
			setErrorMessage("Core columns are required and cannot be removed");
			return;
		}
		if (!window.confirm(COLUMN_DELETE_CONFIRMATION)) {
			return;
		}

		const nextColumns = columnsRef.current
			.filter((item) => item.key !== column.key)
			.map((item) => ({ ...item }));
		const nextRows = rowsRef.current.map((row) => {
			const nextRow = { ...row };
			delete nextRow[column.key];
			return nextRow;
		});

		commitSheetMutation(nextColumns, nextRows, `Column "${column.label}" deleted`);
	};

	const handleRenameColumn = (columnKey: string, nextLabel: string) => {
		const label = nextLabel.trim();
		if (!label) return;

		const currentColumns = columnsRef.current;
		const currentColumn = currentColumns.find((column) => column.key === columnKey);
		if (!currentColumn || currentColumn.isCore || currentColumn.label === label) {
			return;
		}

		const nextColumns = currentColumns.map((column) =>
			column.key === columnKey ? { ...column, label } : { ...column },
		);
		commitSheetMutation(
			nextColumns,
			rowsRef.current.map((row) => ({ ...row })),
			`Column renamed to "${label}"`,
		);
	};

	const handleMoveColumn = (columnKey: string, direction: -1 | 1) => {
		const currentColumns = columnsRef.current;
		const currentIndex = currentColumns.findIndex(
			(column) => column.key === columnKey,
		);
		if (currentIndex < 0) return;

		const nextIndex = currentIndex + direction;
		if (nextIndex < 0 || nextIndex >= currentColumns.length) {
			return;
		}

		const reordered = currentColumns.map((column) => ({ ...column }));
		const [moved] = reordered.splice(currentIndex, 1);
		reordered.splice(nextIndex, 0, moved);

		commitSheetMutation(
			reordered,
			rowsRef.current.map((row) => ({ ...row })),
			`Column "${moved.label}" moved`,
		);
	};

	const handleUndo = () => {
		const previous = pastRef.current.pop();
		if (!previous) return;

		futureRef.current.push(cloneSnapshot(columnsRef.current, rowsRef.current));
		refreshHistoryFlags();
		applySnapshot(previous, "Undid last change");
	};

	const handleRedo = () => {
		const next = futureRef.current.pop();
		if (!next) return;

		pastRef.current.push(cloneSnapshot(columnsRef.current, rowsRef.current));
		refreshHistoryFlags();
		applySnapshot(next, "Redid last change");
	};

	const handleManualSave = async () => {
		await performSave("manual");
	};

	const filteredRowIndexes = useMemo(() => {
		if (!query.trim()) {
			return rows.map((_, index) => index);
		}

		const needle = query.trim().toLowerCase();
		return rows
			.map((row, index) => {
				const hasMatch = Object.values(row).some((value) =>
					value.toLowerCase().includes(needle),
				);
				return hasMatch ? index : -1;
			})
			.filter((index) => index >= 0);
	}, [query, rows]);

	const visibleRowIndexes = useMemo(() => {
		return filteredRowIndexes.slice(0, displayLimit);
	}, [filteredRowIndexes, displayLimit]);

	const canShowMoreRows = filteredRowIndexes.length > visibleRowIndexes.length;

	const focusCell = (
		rowIndex: number,
		columnKey: string,
		deltaRow: number,
		deltaColumn: number,
	) => {
		const columnIndex = columns.findIndex((column) => column.key === columnKey);
		if (columnIndex < 0) return;

		const nextRowIndex = rowIndex + deltaRow;
		const nextColumnIndex = columnIndex + deltaColumn;
		const nextColumn = columns[nextColumnIndex];
		if (!nextColumn) return;

		const targetKey = cellRefKey(nextRowIndex, nextColumn.key);
		const target = inputRefs.current[targetKey];
		if (target) {
			target.focus();
			target.select();
		}
	};

	const safePinnedCount = Math.max(
		0,
		Math.min(pinnedColumnsCount, columns.length, MAX_FROZEN_COLUMNS),
	);

	const getPinnedColumnStyle = (
		columnIndex: number,
		layer: "header" | "cell",
	): CSSProperties | undefined => {
		if (columnIndex >= safePinnedCount) {
			return undefined;
		}

		return {
			position: "sticky",
			left: `${ROW_NUMBER_COLUMN_WIDTH + columnIndex * DATA_COLUMN_WIDTH}px`,
			zIndex: layer === "header" ? 22 : 8,
			background: "color-mix(in oklab, var(--background) 94%, transparent)",
			boxShadow:
				columnIndex === safePinnedCount - 1 ?
					"1px 0 0 rgba(0,0,0,0.1), 8px 0 14px -14px rgba(0,0,0,0.4)"
				:	undefined,
		};
	};

	if (!isAuthenticated) {
		return null;
	}

	return (
		<Card className="ooo-admin-card-soft">
			<CardHeader>
				<CardTitle className="text-2xl tracking-tight">Event Sheet Editor</CardTitle>
				<CardDescription>
					Spreadsheet editing with dynamic custom columns and autosave to
					Postgres.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="flex flex-wrap items-center gap-2" role="status">
					{isSaving ? (
						<Badge variant="secondary">Saving...</Badge>
					) : hasUnsavedChanges ? (
						<Badge variant="outline">Unsaved changes</Badge>
					) : (
						<Badge variant="default">All changes saved</Badge>
					)}
					<Badge variant="outline">Source of truth: Postgres</Badge>
					<span className="text-xs text-muted-foreground">{statusMessage}</span>
					{lastSavedAt && (
						<span className="text-xs text-muted-foreground">
							Last saved: {new Date(lastSavedAt).toLocaleString()}
						</span>
					)}
				</div>

				<div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto_auto]">
					<div className="space-y-2">
						<Label htmlFor="sheet-search">Search rows</Label>
						<Input
							id="sheet-search"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder="Search events, dates, genres..."
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="new-column-label">New column label</Label>
						<Input
							id="new-column-label"
							value={newColumnLabel}
							onChange={(event) => setNewColumnLabel(event.target.value)}
							placeholder="e.g. Promoter"
						/>
					</div>
					<div className="flex items-end">
						<Button
							onClick={handleAddColumn}
							variant="outline"
							disabled={isSaving || isLoading}
						>
							Add column
						</Button>
					</div>
					<div className="flex items-end">
						<Button
							onClick={handleManualSave}
							disabled={isSaving || !hasUnsavedChanges}
						>
							Publish to live cache
						</Button>
					</div>
					<div className="flex items-end gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={handleUndo}
							disabled={!canUndo || isSaving}
						>
							Undo
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={handleRedo}
							disabled={!canRedo || isSaving}
						>
							Redo
						</Button>
					</div>
				</div>

				<div className="flex flex-wrap gap-2">
					<Button onClick={handleAddRow} variant="outline" size="sm">
						Add row
					</Button>
					<Button
						onClick={() => void loadEditorData()}
						disabled={isSaving}
						variant="outline"
						size="sm"
					>
						Reload
					</Button>
					<Button
						onClick={() => setDisplayLimit((current) => current + 50)}
						disabled={!canShowMoreRows}
						variant="outline"
						size="sm"
					>
						Show 50 more rows
					</Button>
					<div className="flex items-center gap-2 rounded-md border px-2 py-1 text-xs">
						<span className="text-muted-foreground">Frozen columns</span>
						<Button
							type="button"
							size="sm"
							variant="ghost"
							className="h-7 px-2"
							onClick={() =>
								setPinnedColumnsCount((current) => Math.max(0, current - 1))
							}
							disabled={safePinnedCount <= 0}
						>
							-
						</Button>
						<span className="min-w-5 text-center font-medium">{safePinnedCount}</span>
						<Button
							type="button"
							size="sm"
							variant="ghost"
							className="h-7 px-2"
							onClick={() =>
								setPinnedColumnsCount((current) =>
									Math.min(columns.length, MAX_FROZEN_COLUMNS, current + 1),
								)
							}
							disabled={
								safePinnedCount >= columns.length ||
								safePinnedCount >= MAX_FROZEN_COLUMNS
							}
						>
							+
						</Button>
						<Button
							type="button"
							size="sm"
							variant="ghost"
							className="h-7 px-2"
							onClick={() => setPinnedColumnsCount(0)}
							disabled={safePinnedCount === 0}
						>
							Unfreeze
						</Button>
					</div>
				</div>

				{errorMessage && (
					<div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
						{errorMessage}
					</div>
				)}

				<div className="text-xs text-muted-foreground">
					Showing {visibleRowIndexes.length} of {filteredRowIndexes.length} filtered
					rows ({rows.length} total).
				</div>
				<div className="overflow-auto rounded-md border max-h-[70vh]">
					<table className="min-w-max table-fixed border-separate border-spacing-0 text-xs">
						<colgroup>
							<col style={{ width: `${ROW_NUMBER_COLUMN_WIDTH}px` }} />
							{columns.map((column) => (
								<col
									key={`col-${column.key}`}
									style={{ width: `${DATA_COLUMN_WIDTH}px` }}
								/>
							))}
							<col style={{ width: "96px" }} />
						</colgroup>
						<thead className="sticky top-0 z-20 bg-background/95 backdrop-blur-[2px]">
							<tr>
								<th
									className="sticky z-30 border-b border-r bg-background px-2 py-2 text-left"
									style={{ left: 0, width: `${ROW_NUMBER_COLUMN_WIDTH}px` }}
								>
									#
								</th>
								{columns.map((column, columnIndex) => (
									<th
										key={column.key}
										className="w-[170px] border-b border-r bg-background px-2 py-2 text-left align-top"
										style={getPinnedColumnStyle(columnIndex, "header")}
									>
										<div className="space-y-1">
											{column.isCore ? (
												<div className="font-medium">{column.label}</div>
											) : (
												<Input
													key={`${column.key}-${column.label}`}
													defaultValue={column.label}
													onBlur={(event) =>
														handleRenameColumn(column.key, event.target.value)
													}
													onKeyDown={(event) => {
														if (event.key === "Enter") {
															event.currentTarget.blur();
														}
													}}
													className="h-7 text-xs"
													aria-label={`Rename column ${column.label}`}
												/>
											)}
											<div className="flex items-center gap-1">
												{column.isCore ? (
													<Badge variant="outline" className="text-[10px]">
														Core
													</Badge>
												) : (
													<Button
														type="button"
														size="sm"
														variant="ghost"
														className="h-6 px-2 text-[10px]"
														onClick={() => handleDeleteColumn(column)}
													>
														Remove
													</Button>
												)}
												{column.isRequired && (
													<Badge variant="secondary" className="text-[10px]">
														Required
													</Badge>
													)}
												</div>
												<div className="flex items-center gap-1">
													<Button
														type="button"
														size="sm"
														variant="ghost"
														className="h-6 px-2 text-[10px]"
														onClick={() => handleMoveColumn(column.key, -1)}
														disabled={columnIndex === 0}
													>
														←
													</Button>
													<Button
														type="button"
														size="sm"
														variant="ghost"
														className="h-6 px-2 text-[10px]"
														onClick={() => handleMoveColumn(column.key, 1)}
														disabled={columnIndex === columns.length - 1}
													>
														→
													</Button>
												</div>
											</div>
										</th>
									))}
								<th className="w-24 border-b bg-background px-2 py-2 text-left">
									Action
								</th>
							</tr>
						</thead>
						<tbody>
							{isLoading ? (
								<tr>
									<td
										colSpan={columns.length + 2}
										className="px-3 py-8 text-center text-muted-foreground"
									>
										Loading editor data...
									</td>
								</tr>
							) : visibleRowIndexes.length === 0 ? (
								<tr>
									<td
										colSpan={columns.length + 2}
										className="px-3 py-8 text-center text-muted-foreground"
									>
										No rows match your search.
									</td>
								</tr>
								) : (
									visibleRowIndexes.map((rowIndex) => {
										const row = rows[rowIndex];
										return (
											<tr key={`row-${rowIndex}`} className="align-top">
												<td
													className="sticky z-10 border-r border-b bg-background px-2 py-1 font-mono text-[11px] text-muted-foreground"
													style={{ left: 0, width: `${ROW_NUMBER_COLUMN_WIDTH}px` }}
												>
													{rowIndex + 1}
												</td>
												{columns.map((column, columnIndex) => (
													<td
														key={`row-${rowIndex}-${column.key}`}
														className="w-[170px] border-b border-r p-0"
														style={getPinnedColumnStyle(columnIndex, "cell")}
													>
														<input
															ref={(node) => {
																inputRefs.current[cellRefKey(rowIndex, column.key)] =
																node;
														}}
														value={row[column.key] ?? ""}
														onChange={(event) =>
															handleCellChange(
																rowIndex,
																column.key,
																event.target.value,
																)
															}
															onBlur={() => {
																const key = cellRefKey(rowIndex, column.key);
																if (activeCellEditRef.current === key) {
																	activeCellEditRef.current = null;
																}
															}}
															onKeyDown={(event) => {
																if (event.key === "Enter") {
																	event.preventDefault();
																focusCell(rowIndex, column.key, 1, 0);
															}
															if (event.key === "ArrowDown") {
																event.preventDefault();
																focusCell(rowIndex, column.key, 1, 0);
															}
															if (event.key === "ArrowUp") {
																event.preventDefault();
																focusCell(rowIndex, column.key, -1, 0);
															}
															if (event.key === "ArrowRight" && event.altKey) {
																event.preventDefault();
																focusCell(rowIndex, column.key, 0, 1);
															}
															if (event.key === "ArrowLeft" && event.altKey) {
																event.preventDefault();
																focusCell(rowIndex, column.key, 0, -1);
															}
														}}
														className="h-9 w-full border-0 bg-transparent px-2 text-xs outline-none focus:bg-muted/30"
													/>
												</td>
											))}
											<td className="border-b px-2 py-1">
												<Button
													type="button"
													size="sm"
													variant="ghost"
													onClick={() => handleDeleteRow(rowIndex)}
												>
													Delete
												</Button>
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>
			</CardContent>
		</Card>
	);
};
