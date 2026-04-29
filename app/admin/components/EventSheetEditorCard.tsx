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
	createMusicGenreFromEditor,
	getEventSheetEditorData,
	getMusicGenreTaxonomy,
	mapMusicGenreAliasFromEditor,
	removeMusicGenreAliasFromEditor,
	removeMusicGenreFromEditor,
	saveEventSheetEditorRows,
} from "@/features/data-management/actions";
import {
	createDateNormalizationContext,
	normalizeCsvDate,
} from "@/features/data-management/assembly/date-normalization";
import {
	type EditableSheetColumn,
	type EditableSheetRow,
	createBlankEditableSheetRow,
	createCustomColumnKey,
} from "@/features/data-management/csv/sheet-editor";
import {
	DEFAULT_GENRE_ALIASES,
	type GenreTaxonomyDefinition,
	type GenreTaxonomySnapshot,
	normalizeGenreInputText,
	normalizeGenreKey,
	resolveMusicGenre,
	toGenreLabel,
} from "@/features/events/genre-normalization";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type EventSheetEditorCardProps = {
	isAuthenticated: boolean;
	initialEditorData?: EditorPayload;
	onDataSaved?: () => Promise<void> | void;
};

type EditorPayload = Awaited<ReturnType<typeof getEventSheetEditorData>>;
type EditorSnapshot = {
	columns: EditableSheetColumn[];
	rows: EditableSheetRow[];
};
type SheetSortMode = "smart-date" | "date-asc" | "date-desc" | "sheet-order";
type GenreCellPart = {
	value: string;
	resolved: string | null;
	label: string;
};

const ROW_DELETE_CONFIRMATION =
	"Delete this row from the event sheet? This will be removed on next save.";
const COLUMN_DELETE_CONFIRMATION =
	"Delete this custom column? This will remove values for this column from all rows.";
const HISTORY_LIMIT = 120;
const ROW_NUMBER_COLUMN_WIDTH = 56;
const DATA_COLUMN_WIDTH = 170;
const MAX_FROZEN_COLUMNS = 4;
const SYSTEM_MANAGED_COLUMN_KEYS = new Set(["eventKey"]);
const DEFAULT_SORT_MODE: SheetSortMode = "smart-date";
const CATEGORY_COLUMN_KEY = "categories";
const DEFAULT_ALIAS_KEYS = new Set(
	DEFAULT_GENRE_ALIASES.map(
		([alias, genreKey]) => `${normalizeGenreKey(alias)}:${genreKey}`,
	),
);

const cellRefKey = (rowIndex: number, columnKey: string) =>
	`${rowIndex}:${columnKey}`;

const splitGenreCell = (
	value: string,
	taxonomy?: GenreTaxonomySnapshot,
): GenreCellPart[] =>
	normalizeGenreInputText(value)
		.split(/[,/&+]/)
		.map((part) => part.trim())
		.filter((part) => part.length > 0)
		.map((part) => ({
			value: part,
			resolved: resolveMusicGenre(part, taxonomy),
			label: toGenreLabel(part),
		}));

const joinGenreLabels = (values: string[]): string => values.join(", ");

const getGenreLabel = (
	key: string,
	genres: GenreTaxonomyDefinition[],
): string =>
	genres.find((genre) => genre.key === key)?.label ?? toGenreLabel(key);

const toUTCDateOnlyTime = (date: Date): number =>
	Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

const getRowDateTime = (
	row: EditableSheetRow,
	context: ReturnType<typeof createDateNormalizationContext>,
): number | null => {
	const normalized = normalizeCsvDate(row.date ?? "", context);
	if (!normalized.isoDate) return null;

	const time = Date.parse(`${normalized.isoDate}T00:00:00.000Z`);
	return Number.isNaN(time) ? null : time;
};

const sortRowIndexes = (
	indexes: number[],
	rows: EditableSheetRow[],
	sortMode: SheetSortMode,
): number[] => {
	if (sortMode === "sheet-order") {
		return indexes;
	}

	const referenceDate = new Date();
	const today = toUTCDateOnlyTime(referenceDate);
	const context = createDateNormalizationContext(
		rows.map((row) => ({ date: row.date ?? "" })),
		{ referenceDate },
	);
	const dateTimes = new Map<number, number | null>(
		indexes.map((index) => [index, getRowDateTime(rows[index], context)]),
	);

	return [...indexes].sort((leftIndex, rightIndex) => {
		const leftTime = dateTimes.get(leftIndex) ?? null;
		const rightTime = dateTimes.get(rightIndex) ?? null;
		if (leftTime === null && rightTime === null) {
			return leftIndex - rightIndex;
		}
		if (leftTime === null) return 1;
		if (rightTime === null) return -1;

		if (sortMode === "date-asc") {
			return leftTime - rightTime || leftIndex - rightIndex;
		}
		if (sortMode === "date-desc") {
			return rightTime - leftTime || leftIndex - rightIndex;
		}

		const leftIsPast = leftTime < today;
		const rightIsPast = rightTime < today;
		if (leftIsPast !== rightIsPast) {
			return leftIsPast ? 1 : -1;
		}

		const direction = leftIsPast ? -1 : 1;
		const dateComparison = (leftTime - rightTime) * direction;
		return dateComparison || leftIndex - rightIndex;
	});
};

function initialEditorState(initialEditorData?: EditorPayload): {
	loading: boolean;
	columns: EditableSheetColumn[];
	rows: EditableSheetRow[];
	statusMessage: string;
	lastSavedAt: string | null;
} {
	const hasInitial =
		initialEditorData?.success &&
		initialEditorData.columns &&
		initialEditorData.rows;
	return {
		loading: !hasInitial,
		columns: hasInitial ? (initialEditorData.columns ?? []) : [],
		rows: hasInitial ? (initialEditorData.rows ?? []) : [],
		statusMessage: hasInitial
			? `Loaded ${initialEditorData.rows?.length ?? 0} rows and ${initialEditorData.columns?.length ?? 0} columns from Postgres store`
			: "Loading sheet...",
		lastSavedAt: hasInitial
			? (initialEditorData.status?.updatedAt ?? null)
			: null,
	};
}

export const EventSheetEditorCard = ({
	isAuthenticated,
	initialEditorData,
	onDataSaved,
}: EventSheetEditorCardProps) => {
	const initial = initialEditorState(initialEditorData);
	const [isLoading, setIsLoading] = useState(initial.loading);
	const [isSaving, setIsSaving] = useState(false);
	const [rows, setRows] = useState<EditableSheetRow[]>(initial.rows);
	const [columns, setColumns] = useState<EditableSheetColumn[]>(
		initial.columns,
	);
	const [query, setQuery] = useState("");
	const [statusMessage, setStatusMessage] = useState(initial.statusMessage);
	const [errorMessage, setErrorMessage] = useState("");
	const [lastSavedAt, setLastSavedAt] = useState<string | null>(
		initial.lastSavedAt,
	);
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
	const [newColumnLabel, setNewColumnLabel] = useState("");
	const [displayLimit, setDisplayLimit] = useState(50);
	const [pinnedColumnsCount, setPinnedColumnsCount] = useState(0);
	const [sortMode, setSortMode] = useState<SheetSortMode>(DEFAULT_SORT_MODE);
	const [canUndo, setCanUndo] = useState(false);
	const [canRedo, setCanRedo] = useState(false);
	const [genreTaxonomy, setGenreTaxonomy] = useState<
		GenreTaxonomySnapshot | undefined
	>(initialEditorData?.genreTaxonomy);
	const [newGenreLabel, setNewGenreLabel] = useState("");
	const [aliasInput, setAliasInput] = useState("");
	const [aliasGenreKey, setAliasGenreKey] = useState("");
	const [focusedCategoryRowIndex, setFocusedCategoryRowIndex] = useState<
		number | null
	>(null);

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
			setGenreTaxonomy(result.genreTaxonomy);
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

	const hasInitialEditorData = Boolean(
		initialEditorData?.success &&
			initialEditorData.columns &&
			initialEditorData.rows,
	);

	useEffect(() => {
		if (hasInitialEditorData) {
			return;
		}
		void loadEditorData();
	}, [hasInitialEditorData, loadEditorData]);

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
					{ revalidateHomepage: mode === "manual" },
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
						? "Autosaved to Postgres (homepage revalidation pending)"
						: "Saved to Postgres and homepage revalidated",
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
			createBlankEditableSheetRow(columnsRef.current),
			...rowsRef.current.map((row) => ({ ...row })),
		];
		commitSheetMutation(
			columnsRef.current.map((column) => ({ ...column })),
			nextRows,
			"New row added at the top",
		);
		setSortMode("sheet-order");
		setQuery("");
		window.setTimeout(() => {
			const firstEditableColumn =
				columnsRef.current.find(
					(column) => !SYSTEM_MANAGED_COLUMN_KEYS.has(column.key),
				) ?? columnsRef.current[0];
			if (!firstEditableColumn) return;

			inputRefs.current[cellRefKey(0, firstEditableColumn.key)]?.focus();
		}, 0);
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

		commitSheetMutation(
			nextColumns,
			nextRows,
			`Column "${column.label}" deleted`,
		);
	};

	const handleRenameColumn = (columnKey: string, nextLabel: string) => {
		const label = nextLabel.trim();
		if (!label) return;

		const currentColumns = columnsRef.current;
		const currentColumn = currentColumns.find(
			(column) => column.key === columnKey,
		);
		if (
			!currentColumn ||
			currentColumn.isCore ||
			currentColumn.label === label
		) {
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

	const refreshGenreTaxonomy = useCallback(async () => {
		const result = await getMusicGenreTaxonomy();
		if (result.success && result.genreTaxonomy) {
			setGenreTaxonomy(result.genreTaxonomy);
		}
	}, []);

	const addGenreToRow = useCallback(
		(rowIndex: number, genreKey: string) => {
			const row = rowsRef.current[rowIndex];
			if (!row) return;
			const label = getGenreLabel(genreKey, genreTaxonomy?.genres ?? []);
			const parts = splitGenreCell(
				row[CATEGORY_COLUMN_KEY] ?? "",
				genreTaxonomy,
			);
			if (parts.some((part) => part.resolved === genreKey)) {
				return;
			}
			handleCellChange(
				rowIndex,
				CATEGORY_COLUMN_KEY,
				joinGenreLabels([...parts.map((part) => part.label), label]),
			);
			setFocusedCategoryRowIndex(rowIndex);
		},
		[genreTaxonomy, handleCellChange],
	);

	const handleCreateGenre = useCallback(
		async (labelInput: string, rowIndex?: number) => {
			const label = labelInput.trim();
			if (!label) {
				setErrorMessage("Genre label is required");
				return;
			}

			setErrorMessage("");
			const result = await createMusicGenreFromEditor(label);
			if (!result.success || !result.genreTaxonomy || !result.genreKey) {
				setErrorMessage(result.error || "Failed to add genre");
				return;
			}

			setGenreTaxonomy(result.genreTaxonomy);
			setNewGenreLabel("");
			setStatusMessage(result.message || "Genre added");
			const targetRowIndex = rowIndex ?? focusedCategoryRowIndex;
			if (targetRowIndex !== null) {
				addGenreToRow(targetRowIndex, result.genreKey);
			}
		},
		[addGenreToRow, focusedCategoryRowIndex],
	);

	const handleRemoveCustomGenre = useCallback(
		async (genre: GenreTaxonomyDefinition) => {
			if (genre.isDefault) {
				setErrorMessage("Default genres cannot be removed");
				return;
			}
			if (
				!window.confirm(
					`Remove "${genre.label}" from custom genres? Existing sheet cells using it will become unknown until remapped.`,
				)
			) {
				return;
			}

			setErrorMessage("");
			const result = await removeMusicGenreFromEditor(genre.key);
			if (!result.success || !result.genreTaxonomy) {
				setErrorMessage(result.error || "Failed to remove genre");
				return;
			}

			setGenreTaxonomy(result.genreTaxonomy);
			setStatusMessage(result.message || "Custom genre removed");
		},
		[],
	);

	const handleMapAlias = useCallback(
		async (aliasInput: string) => {
			const alias = aliasInput.trim();
			if (!alias || !aliasGenreKey) {
				setErrorMessage("Choose an unknown genre and a target genre");
				return;
			}

			setErrorMessage("");
			const result = await mapMusicGenreAliasFromEditor(alias, aliasGenreKey);
			if (!result.success || !result.genreTaxonomy) {
				setErrorMessage(result.error || "Failed to map genre alias");
				return;
			}

			setGenreTaxonomy(result.genreTaxonomy);
			setAliasInput("");
			setStatusMessage(result.message || "Genre alias saved");
			await refreshGenreTaxonomy();
		},
		[aliasGenreKey, refreshGenreTaxonomy],
	);

	const handleRemoveAlias = useCallback(async (alias: string) => {
		setErrorMessage("");
		const result = await removeMusicGenreAliasFromEditor(alias);
		if (!result.success || !result.genreTaxonomy) {
			setErrorMessage(result.error || "Failed to remove alias");
			return;
		}

		setGenreTaxonomy(result.genreTaxonomy);
		setStatusMessage(result.message || "Genre alias removed");
	}, []);

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

	const sortedRowIndexes = useMemo(() => {
		return sortRowIndexes(filteredRowIndexes, rows, sortMode);
	}, [filteredRowIndexes, rows, sortMode]);

	const visibleRowIndexes = useMemo(() => {
		return sortedRowIndexes.slice(0, displayLimit);
	}, [sortedRowIndexes, displayLimit]);

	const canShowMoreRows = sortedRowIndexes.length > visibleRowIndexes.length;
	const availableGenres = useMemo(
		() =>
			(genreTaxonomy?.genres ?? [])
				.filter((genre) => genre.isActive !== false)
				.sort(
					(left, right) =>
						(left.sortOrder ?? 1000) - (right.sortOrder ?? 1000) ||
						left.label.localeCompare(right.label),
				),
		[genreTaxonomy],
	);
	const defaultGenres = useMemo(
		() => availableGenres.filter((genre) => genre.isDefault),
		[availableGenres],
	);
	const customGenres = useMemo(
		() => availableGenres.filter((genre) => !genre.isDefault),
		[availableGenres],
	);
	const customAliases = useMemo(() => {
		const genreByKey = new Map(
			availableGenres.map((genre) => [genre.key, genre.label]),
		);
		return (genreTaxonomy?.aliases ?? [])
			.filter(
				(alias) =>
					!DEFAULT_ALIAS_KEYS.has(`${alias.alias}:${alias.genreKey}`) &&
					genreByKey.has(alias.genreKey),
			)
			.map((alias) => ({
				...alias,
				genreLabel: genreByKey.get(alias.genreKey) ?? alias.genreKey,
			}))
			.sort(
				(left, right) =>
					left.genreLabel.localeCompare(right.genreLabel) ||
					left.alias.localeCompare(right.alias),
			);
	}, [availableGenres, genreTaxonomy]);
	const unknownGenres = useMemo(() => {
		const unknown = new Map<string, { label: string; count: number }>();
		for (const row of rows) {
			for (const part of splitGenreCell(
				row[CATEGORY_COLUMN_KEY] ?? "",
				genreTaxonomy,
			)) {
				if (part.resolved) continue;
				const existing = unknown.get(part.value);
				unknown.set(part.value, {
					label: part.label,
					count: (existing?.count ?? 0) + 1,
				});
			}
		}
		return Array.from(unknown.entries())
			.map(([value, meta]) => ({ value, ...meta }))
			.sort(
				(left, right) =>
					right.count - left.count || left.label.localeCompare(right.label),
			);
	}, [genreTaxonomy, rows]);

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
				columnIndex === safePinnedCount - 1
					? "1px 0 0 rgba(0,0,0,0.1), 8px 0 14px -14px rgba(0,0,0,0.4)"
					: undefined,
		};
	};

	if (!isAuthenticated) {
		return null;
	}

	return (
		<Card className="ooo-admin-card-soft min-w-0 overflow-hidden">
			<CardHeader>
				<CardTitle className="text-2xl tracking-tight">
					Event Sheet Editor
				</CardTitle>
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

				<div className="space-y-3 rounded-md border bg-background/55 p-3">
					<div className="grid items-end gap-3 xl:grid-cols-[minmax(280px,1fr)_220px_auto]">
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
							<Label htmlFor="sheet-sort">Sort rows</Label>
							<select
								id="sheet-sort"
								value={sortMode}
								onChange={(event) =>
									setSortMode(event.target.value as SheetSortMode)
								}
								className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
							>
								<option value="smart-date">Upcoming first</option>
								<option value="date-asc">Date ascending</option>
								<option value="date-desc">Date descending</option>
								<option value="sheet-order">Sheet order</option>
							</select>
						</div>
						<div className="flex flex-wrap items-center justify-start gap-2 xl:justify-end">
							<Button
								onClick={handleManualSave}
								disabled={isSaving || !hasUnsavedChanges}
								className="h-10"
							>
								Save and Revalidate Homepage
							</Button>
							<Button
								type="button"
								variant="outline"
								onClick={handleUndo}
								disabled={!canUndo || isSaving}
								className="h-10"
							>
								Undo
							</Button>
							<Button
								type="button"
								variant="outline"
								onClick={handleRedo}
								disabled={!canRedo || isSaving}
								className="h-10"
							>
								Redo
							</Button>
						</div>
					</div>

					<div className="flex flex-wrap items-end gap-4 border-t pt-3">
						<div className="space-y-2">
							<Label>Sheet actions</Label>
							<div className="flex flex-wrap gap-2">
								<Button
									onClick={handleAddRow}
									variant="outline"
									size="sm"
									className="h-9"
								>
									Add row at top
								</Button>
								<Button
									onClick={() => void loadEditorData()}
									disabled={isSaving}
									variant="outline"
									size="sm"
									className="h-9"
								>
									Reload
								</Button>
								<Button
									onClick={() => setDisplayLimit((current) => current + 50)}
									disabled={!canShowMoreRows}
									variant="outline"
									size="sm"
									className="h-9"
								>
									Show 50 more rows
								</Button>
							</div>
						</div>

						<div className="hidden h-9 w-px bg-border lg:block" />

						<div className="space-y-2">
							<Label htmlFor="new-column-label">New column</Label>
							<div className="flex flex-wrap gap-2">
								<Input
									id="new-column-label"
									value={newColumnLabel}
									onChange={(event) => setNewColumnLabel(event.target.value)}
									placeholder="e.g. Promoter"
									className="h-9 w-[min(100%,260px)]"
								/>
								<Button
									onClick={handleAddColumn}
									variant="outline"
									size="sm"
									disabled={isSaving || isLoading}
									className="h-9"
								>
									Add column
								</Button>
							</div>
						</div>

						<div className="ml-0 space-y-2 xl:ml-auto">
							<Label>View options</Label>
							<div className="flex h-9 items-center overflow-hidden rounded-md border bg-background text-sm">
								<span className="border-r px-3 text-muted-foreground">
									Frozen columns
								</span>
								<Button
									type="button"
									size="sm"
									variant="ghost"
									className="h-9 rounded-none px-3"
									onClick={() =>
										setPinnedColumnsCount((current) => Math.max(0, current - 1))
									}
									disabled={safePinnedCount <= 0}
									aria-label="Decrease frozen columns"
								>
									-
								</Button>
								<span className="min-w-8 px-2 text-center font-medium">
									{safePinnedCount}
								</span>
								<Button
									type="button"
									size="sm"
									variant="ghost"
									className="h-9 rounded-none px-3"
									onClick={() =>
										setPinnedColumnsCount((current) =>
											Math.min(columns.length, MAX_FROZEN_COLUMNS, current + 1),
										)
									}
									disabled={
										safePinnedCount >= columns.length ||
										safePinnedCount >= MAX_FROZEN_COLUMNS
									}
									aria-label="Increase frozen columns"
								>
									+
								</Button>
								<Button
									type="button"
									size="sm"
									variant="ghost"
									className="h-9 rounded-none border-l px-3"
									onClick={() => setPinnedColumnsCount(0)}
									disabled={safePinnedCount === 0}
								>
									Unfreeze
								</Button>
							</div>
						</div>
					</div>
				</div>

				<div className="space-y-2 rounded-md border bg-background/55 p-3">
					<div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-center">
						<div className="flex flex-wrap items-center gap-2">
							<Label>Genre library</Label>
							<Badge variant="outline" className="text-[10px]">
								{defaultGenres.length} default
							</Badge>
							<Badge variant="secondary" className="text-[10px]">
								{customGenres.length} custom
							</Badge>
						</div>
						<div className="grid grid-cols-[minmax(12rem,16rem)_auto] items-center gap-2">
							<Input
								value={newGenreLabel}
								onChange={(event) => setNewGenreLabel(event.target.value)}
								placeholder="French Pop"
								className="h-9"
								onKeyDown={(event) => {
									if (event.key === "Enter") {
										event.preventDefault();
										void handleCreateGenre(newGenreLabel);
									}
								}}
								aria-label="New genre label"
							/>
							<Button
								type="button"
								size="sm"
								variant="outline"
								className="h-9"
								onClick={() => void handleCreateGenre(newGenreLabel)}
								disabled={isSaving || isLoading}
							>
								Add custom
							</Button>
						</div>
					</div>

					<div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.42fr)]">
						<div className="space-y-1.5">
							<Label className="text-xs text-muted-foreground">
								Default genres
							</Label>
							<div className="flex max-h-24 flex-wrap content-start gap-1.5 overflow-y-auto rounded-md border border-border/70 bg-background/70 p-2">
								{defaultGenres.map((genre) => (
									<button
										key={genre.key}
										type="button"
										onClick={() => {
											if (focusedCategoryRowIndex !== null) {
												addGenreToRow(focusedCategoryRowIndex, genre.key);
											}
										}}
										disabled={focusedCategoryRowIndex === null}
										className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border/70 bg-background px-2.5 text-xs transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-55"
										title={
											focusedCategoryRowIndex === null
												? "Focus a Categories cell first"
												: `Add ${genre.label}`
										}
									>
										<span
											className={`h-2 w-2 rounded-full ${genre.color || "bg-stone-500"}`}
										/>
										{genre.label}
									</button>
								))}
								{availableGenres.length === 0 && (
									<span className="text-xs text-muted-foreground">
										Genre list unavailable. Check the Postgres connection.
									</span>
								)}
							</div>
						</div>

						<div className="space-y-1.5">
							<Label className="text-xs text-muted-foreground">
								Custom genres
							</Label>
							<div className="flex max-h-24 flex-wrap content-start gap-1.5 overflow-y-auto rounded-md border border-border/70 bg-background/70 p-2">
								{customGenres.map((genre) => (
									<div
										key={genre.key}
										className="inline-flex h-7 items-center overflow-hidden rounded-full border border-border/70 bg-background text-xs"
									>
										<button
											type="button"
											onClick={() => {
												if (focusedCategoryRowIndex !== null) {
													addGenreToRow(focusedCategoryRowIndex, genre.key);
												}
											}}
											disabled={focusedCategoryRowIndex === null}
											className="inline-flex h-7 items-center gap-1.5 px-2.5 transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-55"
											title={
												focusedCategoryRowIndex === null
													? "Focus a Categories cell first"
													: `Add ${genre.label}`
											}
										>
											<span
												className={`h-2 w-2 rounded-full ${genre.color || "bg-stone-500"}`}
											/>
											{genre.label}
										</button>
										<button
											type="button"
											className="h-7 border-l px-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
											onClick={() => void handleRemoveCustomGenre(genre)}
											aria-label={`Remove ${genre.label}`}
											title={`Remove ${genre.label}`}
										>
											x
										</button>
									</div>
								))}
								{customGenres.length === 0 && (
									<span className="text-xs text-muted-foreground">
										No custom genres yet.
									</span>
								)}
							</div>
						</div>
					</div>

					{unknownGenres.length > 0 && (
						<div className="space-y-2 border-t pt-3">
							<Label>Unknown genres in the sheet</Label>
							<div className="flex flex-wrap gap-2">
								{unknownGenres.slice(0, 12).map((genre) => (
									<div
										key={genre.value}
										className="flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-900"
									>
										<span>
											{genre.label} ({genre.count})
										</span>
										<Button
											type="button"
											size="sm"
											variant="ghost"
											className="h-5 px-1.5 text-[10px]"
											onClick={() => void handleCreateGenre(genre.label)}
										>
											Add custom
										</Button>
										<Button
											type="button"
											size="sm"
											variant="ghost"
											className="h-5 px-1.5 text-[10px]"
											onClick={() => {
												setAliasInput(genre.label);
												setNewGenreLabel(genre.label);
											}}
										>
											Map
										</Button>
									</div>
								))}
							</div>
							<div className="flex flex-wrap items-end gap-2">
								<div className="space-y-1">
									<Label htmlFor="genre-alias-target">Map typed genre to</Label>
									<select
										id="genre-alias-target"
										value={aliasGenreKey}
										onChange={(event) => setAliasGenreKey(event.target.value)}
										className="h-9 w-48 rounded-md border border-input bg-background px-3 text-sm"
									>
										<option value="">Choose genre</option>
										{availableGenres.map((genre) => (
											<option key={genre.key} value={genre.key}>
												{genre.label}
											</option>
										))}
									</select>
								</div>
								<Input
									value={aliasInput}
									onChange={(event) => setAliasInput(event.target.value)}
									placeholder="Afrotrap"
									className="h-9 w-[min(100%,220px)]"
									aria-label="Alias to map"
								/>
								<Button
									type="button"
									size="sm"
									variant="outline"
									className="h-9"
									onClick={() => void handleMapAlias(aliasInput)}
									disabled={!aliasInput.trim() || !aliasGenreKey}
								>
									Save mapping
								</Button>
							</div>
						</div>
					)}

					{customAliases.length > 0 && (
						<div className="space-y-2 border-t pt-3">
							<Label>Custom alias mappings</Label>
							<div className="flex flex-wrap gap-2">
								{customAliases.map((alias) => (
									<div
										key={`${alias.alias}:${alias.genreKey}`}
										className="inline-flex h-7 items-center overflow-hidden rounded-full border border-border/70 bg-background text-xs"
									>
										<span className="px-2.5">
											{toGenreLabel(alias.alias)} -&gt; {alias.genreLabel}
										</span>
										<button
											type="button"
											className="h-7 border-l px-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
											onClick={() => void handleRemoveAlias(alias.alias)}
											aria-label={`Remove ${alias.alias} alias`}
											title={`Remove ${alias.alias} alias`}
										>
											x
										</button>
									</div>
								))}
							</div>
						</div>
					)}
				</div>

				{errorMessage && (
					<div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
						{errorMessage}
					</div>
				)}

				<div className="text-xs text-muted-foreground">
					`Event Key` is system-managed for stable share links and is read-only.
				</div>
				<div className="text-xs text-muted-foreground">
					When missing, Event Key is generated from canonical identity fields:
					`Title`, `Date`, `Start Time`, `Location`, `District/Area`.
				</div>
				<div className="text-xs text-amber-700">
					`Featured` column is legacy-only. Manage featured scheduling in
					`Spotlight & Promoted Scheduler`.
				</div>
				<div className="text-xs text-muted-foreground">
					`Host Country` and `Audience Country` support `FR`, `UK`, `CA`, `NL`
					(flags, ISO codes, or common names). Unknown tokens are flagged in
					schema preflight.
				</div>

				<div className="text-xs text-muted-foreground">
					Showing {visibleRowIndexes.length} of {filteredRowIndexes.length}{" "}
					filtered rows ({rows.length} total).
				</div>
				<div className="max-w-full overflow-auto rounded-md border max-h-[70vh]">
					<table className="w-max min-w-full table-fixed border-separate border-spacing-0 text-xs">
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
												{SYSTEM_MANAGED_COLUMN_KEYS.has(column.key) && (
													<Badge variant="outline" className="text-[10px]">
														System
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
												style={{
													left: 0,
													width: `${ROW_NUMBER_COLUMN_WIDTH}px`,
												}}
											>
												{rowIndex + 1}
											</td>
											{columns.map((column, columnIndex) => (
												<td
													key={`row-${rowIndex}-${column.key}`}
													className="w-[170px] border-b border-r p-0"
													style={getPinnedColumnStyle(columnIndex, "cell")}
												>
													{column.key === CATEGORY_COLUMN_KEY ? (
														<div className="min-h-9 bg-transparent">
															<input
																ref={(node) => {
																	inputRefs.current[
																		cellRefKey(rowIndex, column.key)
																	] = node;
																}}
																value={row[column.key] ?? ""}
																onFocus={() =>
																	setFocusedCategoryRowIndex(rowIndex)
																}
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
																	if (
																		event.key === "ArrowRight" &&
																		event.altKey
																	) {
																		event.preventDefault();
																		focusCell(rowIndex, column.key, 0, 1);
																	}
																	if (
																		event.key === "ArrowLeft" &&
																		event.altKey
																	) {
																		event.preventDefault();
																		focusCell(rowIndex, column.key, 0, -1);
																	}
																}}
																className="h-8 w-full border-0 bg-transparent px-2 text-xs outline-none focus:bg-muted/30"
															/>
															<div className="flex min-h-7 flex-wrap gap-1 px-1.5 pb-1.5">
																{splitGenreCell(
																	row[column.key] ?? "",
																	genreTaxonomy,
																).map((part) => (
																	<span
																		key={`${rowIndex}-${part.value}`}
																		className={`inline-flex h-5 max-w-full items-center rounded-full border px-1.5 text-[10px] ${
																			part.resolved
																				? "border-border/70 bg-muted/45 text-foreground/80"
																				: "border-amber-300 bg-amber-50 text-amber-900"
																		}`}
																		title={
																			part.resolved
																				? `Maps to ${part.resolved}`
																				: "Unknown genre"
																		}
																	>
																		<span className="truncate">
																			{part.label}
																		</span>
																	</span>
																))}
															</div>
														</div>
													) : (
														<input
															ref={(node) => {
																inputRefs.current[
																	cellRefKey(rowIndex, column.key)
																] = node;
															}}
															value={row[column.key] ?? ""}
															readOnly={SYSTEM_MANAGED_COLUMN_KEYS.has(
																column.key,
															)}
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
																if (
																	event.key === "ArrowRight" &&
																	event.altKey
																) {
																	event.preventDefault();
																	focusCell(rowIndex, column.key, 0, 1);
																}
																if (event.key === "ArrowLeft" && event.altKey) {
																	event.preventDefault();
																	focusCell(rowIndex, column.key, 0, -1);
																}
															}}
															className={`h-9 w-full border-0 bg-transparent px-2 text-xs outline-none focus:bg-muted/30 ${
																SYSTEM_MANAGED_COLUMN_KEYS.has(column.key)
																	? "cursor-not-allowed bg-muted/25 text-muted-foreground"
																	: ""
															}`}
														/>
													)}
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
