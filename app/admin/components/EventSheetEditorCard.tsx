"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	createMusicGenreFromEditor,
	getEventSheetEditorData,
	mapMusicGenreAliasFromEditor,
	removeMusicGenreAliasFromEditor,
	removeMusicGenreFromEditor,
	saveEventSheetEditorRows,
} from "@/features/data-management/actions";
import {
	createDateNormalizationContext,
	normalizeCsvDate,
} from "@/features/data-management/assembly/date-normalization";
import { DateTransformers } from "@/features/data-management/assembly/field-transformers";
import {
	type EditableSheetColumn,
	type EditableSheetRow,
	createBlankEditableSheetRow,
	createCustomColumnKey,
} from "@/features/data-management/csv/sheet-editor";
import {
	type CountryOption,
	filterCountryOptions,
} from "@/features/events/countries";
import {
	DEFAULT_GENRE_ALIASES,
	type GenreTaxonomyDefinition,
	type GenreTaxonomySnapshot,
	isRedundantGenreAlias,
	normalizeGenreInputText,
	normalizeGenreKey,
	resolveMusicGenre,
	toGenreLabel,
} from "@/features/events/genre-normalization";
import {
	normalizeSupportedNationalities,
	parseSupportedNationalities,
} from "@/features/events/nationality-utils";
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
type GenreAliasMapping = {
	alias: string;
	genreKey: string;
	genreLabel: string;
	isDefault: boolean;
};
type AreaOption = {
	value: string;
	label: string;
	group: "Paris arrondissements" | "Beyond Paris" | "Unconfirmed";
	description: string;
	aliases: string[];
};
type SimpleOption = {
	value: string;
	label: string;
	description: string;
};
type SheetHealthIssue = {
	rowIndex: number;
	column: string;
	message: string;
};
type FocusedCell = {
	rowIndex: number;
	columnKey: string;
};
type CellDraft = FocusedCell & {
	value: string;
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
const CURATED_COLUMN_KEY = "curated";
const DATE_COLUMN_KEY = "date";
const START_TIME_COLUMN_KEY = "startTime";
const END_TIME_COLUMN_KEY = "endTime";
const CATEGORY_COLUMN_KEY = "categories";
const AREA_COLUMN_KEY = "districtArea";
const AGE_COLUMN_KEY = "ageGuidance";
const PRICE_COLUMN_KEY = "price";
const PRIMARY_URL_COLUMN_KEY = "primaryUrl";
const SETTING_COLUMN_KEY = "setting";
const COUNTRY_COLUMN_KEYS = new Set(["hostCountry", "audienceCountry"]);
const TIME_COLUMN_KEYS = new Set([START_TIME_COLUMN_KEY, END_TIME_COLUMN_KEY]);
const CURATED_PICK_VALUE = "🌟";
const SETTING_OPTIONS: SimpleOption[] = [
	{
		value: "Indoor",
		label: "Indoor",
		description: "Club, bar, hall, venue or enclosed room",
	},
	{
		value: "Outdoor",
		label: "Outdoor",
		description: "Park, street, terrace, rooftop or open air",
	},
];
const AGE_OPTIONS: SimpleOption[] = [
	{ value: "18+", label: "18+", description: "Standard adult entry" },
	{ value: "21+", label: "21+", description: "Older crowd / stricter entry" },
	{ value: "20+", label: "20+", description: "Occasional venue policy" },
	{
		value: "All ages",
		label: "All ages",
		description: "No age restriction listed",
	},
	{ value: "TBC", label: "TBC", description: "Age policy still unknown" },
];
const AREA_OPTIONS: AreaOption[] = [
	...Array.from({ length: 20 }, (_, index) => {
		const value = String(index + 1);
		return {
			value,
			label: `${value}e`,
			group: "Paris arrondissements" as const,
			description: `${value}e arrondissement`,
			aliases: [value, `${value}e`, `${value}eme`, `${value} arrondissement`],
		};
	}),
	{
		value: "Greater Paris",
		label: "Greater Paris",
		group: "Beyond Paris",
		description: "Paris-adjacent / Ile-de-France venue",
		aliases: ["grand paris", "idf", "suburbs", "near paris"],
	},
	{
		value: "Outside Paris",
		label: "Outside Paris",
		group: "Beyond Paris",
		description: "Not a Paris or Paris-adjacent venue",
		aliases: ["outside", "out of paris", "not paris"],
	},
	{
		value: "Location TBC",
		label: "Location TBC",
		group: "Unconfirmed",
		description: "Venue or area still unconfirmed",
		aliases: ["tbc", "unknown", "-", "tba"],
	},
];
const DEFAULT_ALIAS_KEYS = new Set(
	DEFAULT_GENRE_ALIASES.map(
		([alias, genreKey]) => `${normalizeGenreKey(alias)}:${genreKey}`,
	),
);

const cellRefKey = (rowIndex: number, columnKey: string) =>
	`${rowIndex}:${columnKey}`;

const COUNTRY_FLAG_REGEX = /[\u{1f1e6}-\u{1f1ff}]{2}/u;
const COUNTRY_EXPLICIT_SEPARATOR_REGEX = /[\/,&+]/;
const COUNTRY_TOKEN_PREFIX_REGEX = new RegExp(
	`^((?:(?:${COUNTRY_FLAG_REGEX.source}|[A-Za-z]{2,3})\\s+)+)(\\S[\\s\\S]*)$`,
	"u",
);

const getCountrySearchSegment = (value: string): string => {
	const explicitParts = value.split(COUNTRY_EXPLICIT_SEPARATOR_REGEX);
	const segment = (explicitParts.at(-1) ?? value).trim();
	const tokenPrefixMatch = segment.match(COUNTRY_TOKEN_PREFIX_REGEX);
	return (tokenPrefixMatch?.[2] ?? segment).trim();
};

const splitCountryCell = (value: string): string[] =>
	normalizeSupportedNationalities(value)
		.split(",")
		.map((part) => part.trim())
		.filter((part) => part.length > 0);

const joinCountryCodes = (codes: string[]): string => codes.join(", ");

const getSelectedCountryCodes = (value: string): Set<string> =>
	new Set(splitCountryCell(value));

const GENRE_EXPLICIT_SEPARATOR_REGEX = /[,/&+]/;

const getGenreSearchSegment = (value: string): string => {
	const parts = value.split(GENRE_EXPLICIT_SEPARATOR_REGEX);
	return (parts.at(-1) ?? value).trim();
};

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

const getSelectedGenreKeys = (
	value: string,
	taxonomy?: GenreTaxonomySnapshot,
): Set<string> =>
	new Set(
		splitGenreCell(value, taxonomy)
			.map((part) => part.resolved)
			.filter((key): key is string => Boolean(key)),
	);

const getGenreLabel = (
	key: string,
	genres: GenreTaxonomyDefinition[],
): string =>
	genres.find((genre) => genre.key === key)?.label ?? toGenreLabel(key);

const normalizeAreaSearchText = (value: string): string =>
	value
		.trim()
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/ème/g, "eme")
		.replace(/\s+/g, " ");

const findAreaOption = (value: string): AreaOption | null => {
	const normalized = normalizeAreaSearchText(value);
	if (!normalized) return null;
	return (
		AREA_OPTIONS.find((option) =>
			[option.value, option.label, option.description, ...option.aliases]
				.map(normalizeAreaSearchText)
				.includes(normalized),
		) ?? null
	);
};

const normalizeAreaValue = (value: string): string =>
	findAreaOption(value)?.value ?? value;

const filterAreaOptions = (query: string): AreaOption[] => {
	const normalized = normalizeAreaSearchText(query);
	if (!normalized) return AREA_OPTIONS;
	return AREA_OPTIONS.filter((option) =>
		[option.value, option.label, option.description, ...option.aliases]
			.map(normalizeAreaSearchText)
			.some((candidate) => candidate.includes(normalized)),
	);
};

const normalizeCountryValue = (value: string): string =>
	normalizeSupportedNationalities(value) || value;

const SETTING_SEPARATOR_REGEX = /[,/&+\n\r]+/;

const splitSettingCell = (value: string): string[] =>
	value
		.split(SETTING_SEPARATOR_REGEX)
		.map((part) => part.trim().toLowerCase())
		.filter((part) => part.length > 0)
		.flatMap((part) => {
			if (part.includes("indoor") || part.includes("inside")) return ["Indoor"];
			if (
				part.includes("outdoor") ||
				part.includes("outside") ||
				part.includes("open air")
			) {
				return ["Outdoor"];
			}
			return [];
		})
		.filter((value, index, values) => values.indexOf(value) === index);

const normalizeSettingValue = (value: string): string => {
	const selected = splitSettingCell(value);
	return selected.length > 0 ? selected.join(", ") : value.trim();
};

const isCuratedValue = (value: string): boolean => {
	const normalized = value.trim().toLowerCase();
	return value.includes(CURATED_PICK_VALUE) || normalized.includes("pick");
};

const URL_SEPARATOR_REGEX = /[,\n\r|]+/;
const URL_SCHEME_REGEX = /^[a-z][a-z\d+\-.]*:\/\//i;
const DOMAIN_LIKE_REGEX =
	/^(?:www\.)?[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+(?:[/?#].*)?$/i;

const normalizeUrlPart = (value: string): string => {
	const trimmed = value.trim();
	if (!trimmed || /\s/.test(trimmed)) return trimmed;
	if (URL_SCHEME_REGEX.test(trimmed)) return trimmed;
	if (DOMAIN_LIKE_REGEX.test(trimmed)) return `https://${trimmed}`;
	return trimmed;
};

const normalizeUrlValue = (value: string): string =>
	value
		.split(URL_SEPARATOR_REGEX)
		.map(normalizeUrlPart)
		.filter((part) => part.length > 0)
		.join(", ");

const isValidHttpUrl = (value: string): boolean => {
	try {
		const url = new URL(value);
		return url.protocol === "http:" || url.protocol === "https:";
	} catch {
		return false;
	}
};

const normalizePriceValue = (value: string): string => {
	const trimmed = value.trim().replace(/\s+/g, " ");
	const normalized = trimmed.toLowerCase();
	if (!trimmed) return "";
	if (/^(?:free|0|0\.00|[€£$]0(?:\.00)?)$/.test(normalized)) return "Free";
	if (normalized === "tba") return "TBA";
	if (normalized === "tbc") return "TBC";
	return trimmed.replace(/\s*[-–—]\s*/g, " - ");
};

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
	const [saveScheduleVersion, setSaveScheduleVersion] = useState(0);
	const [newColumnLabel, setNewColumnLabel] = useState("");
	const [displayLimit, setDisplayLimit] = useState(50);
	const [pinnedColumnsCount, setPinnedColumnsCount] = useState(0);
	const [sortMode, setSortMode] = useState<SheetSortMode>(DEFAULT_SORT_MODE);
	const [canUndo, setCanUndo] = useState(false);
	const [canRedo, setCanRedo] = useState(false);
	const [genreTaxonomy, setGenreTaxonomy] = useState<
		GenreTaxonomySnapshot | undefined
	>(initialEditorData?.genreTaxonomy);
	const [isGenreManagerOpen, setIsGenreManagerOpen] = useState(false);
	const [newGenreLabel, setNewGenreLabel] = useState("");
	const [aliasInput, setAliasInput] = useState("");
	const [aliasGenreKey, setAliasGenreKey] = useState("");
	const [focusedCategoryRowIndex, setFocusedCategoryRowIndex] = useState<
		number | null
	>(null);
	const [focusedGenreCell, setFocusedGenreCell] = useState<FocusedCell | null>(
		null,
	);
	const [genreSearchQuery, setGenreSearchQuery] = useState("");
	const [highlightedGenreIndex, setHighlightedGenreIndex] = useState(0);
	const [focusedCountryCell, setFocusedCountryCell] =
		useState<FocusedCell | null>(null);
	const [countrySearchQuery, setCountrySearchQuery] = useState("");
	const [highlightedCountryIndex, setHighlightedCountryIndex] = useState(0);
	const [focusedAreaCell, setFocusedAreaCell] = useState<FocusedCell | null>(
		null,
	);
	const [areaSearchQuery, setAreaSearchQuery] = useState("");
	const [highlightedAreaIndex, setHighlightedAreaIndex] = useState(0);
	const [focusedSettingCell, setFocusedSettingCell] =
		useState<FocusedCell | null>(null);
	const [highlightedSettingIndex, setHighlightedSettingIndex] = useState(0);
	const [focusedAgeCell, setFocusedAgeCell] = useState<FocusedCell | null>(
		null,
	);
	const [highlightedAgeIndex, setHighlightedAgeIndex] = useState(0);
	const [activeCellDraft, setActiveCellDraft] = useState<CellDraft | null>(
		null,
	);

	const rowsRef = useRef<EditableSheetRow[]>([]);
	const columnsRef = useRef<EditableSheetColumn[]>([]);
	const pastRef = useRef<EditorSnapshot[]>([]);
	const futureRef = useRef<EditorSnapshot[]>([]);
	const cellDraftRef = useRef<CellDraft | null>(null);
	const activeCellEditRef = useRef<string | null>(null);
	const editVersionRef = useRef(0);
	const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const inputRefs = useRef<Record<string, HTMLElement | null>>({});

	const clearInlineHelpers = useCallback(() => {
		cellDraftRef.current = null;
		setActiveCellDraft(null);
		setFocusedGenreCell(null);
		setGenreSearchQuery("");
		setFocusedCountryCell(null);
		setCountrySearchQuery("");
		setFocusedAreaCell(null);
		setAreaSearchQuery("");
		setFocusedSettingCell(null);
		setFocusedAgeCell(null);
	}, []);

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
			clearInlineHelpers();
			columnsRef.current = nextColumns;
			rowsRef.current = nextRows;
			setColumns(nextColumns);
			setRows(nextRows);
			setHasUnsavedChanges(true);
			setSaveScheduleVersion((current) => current + 1);
			editVersionRef.current += 1;
			setStatusMessage(statusMessage);
		},
		[clearInlineHelpers],
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
			clearInlineHelpers();
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
	}, [clearInlineHelpers, isAuthenticated, refreshHistoryFlags]);

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
		if (
			!hasUnsavedChanges ||
			isSaving ||
			activeCellDraft ||
			saveScheduleVersion === 0
		) {
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
	}, [
		activeCellDraft,
		hasUnsavedChanges,
		isSaving,
		performSave,
		saveScheduleVersion,
	]);

	const markDirty = useCallback(() => {
		editVersionRef.current += 1;
		setHasUnsavedChanges(true);
		setSaveScheduleVersion((current) => current + 1);
	}, []);

	const commitSheetMutation = useCallback(
		(
			nextColumns: EditableSheetColumn[],
			nextRows: EditableSheetRow[],
			status: string,
		) => {
			pushHistorySnapshot();
			activeCellEditRef.current = null;
			clearInlineHelpers();
			columnsRef.current = nextColumns;
			rowsRef.current = nextRows;
			setColumns(nextColumns);
			setRows(nextRows);
			markDirty();
			setStatusMessage(status);
		},
		[clearInlineHelpers, markDirty, pushHistorySnapshot],
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

	const setCellDraft = useCallback((draft: CellDraft | null) => {
		cellDraftRef.current = draft;
		setActiveCellDraft(draft);
	}, []);

	const beginCellDraft = useCallback(
		(rowIndex: number, columnKey: string, value: string) => {
			setCellDraft({ rowIndex, columnKey, value });
		},
		[setCellDraft],
	);

	const updateCellDraft = useCallback(
		(rowIndex: number, columnKey: string, value: string) => {
			setCellDraft({ rowIndex, columnKey, value });
		},
		[setCellDraft],
	);

	const getDraftAwareCellValue = useCallback(
		(rowIndex: number, columnKey: string): string => {
			const draft = cellDraftRef.current;
			if (draft?.rowIndex === rowIndex && draft.columnKey === columnKey) {
				return draft.value;
			}
			return rowsRef.current[rowIndex]?.[columnKey] ?? "";
		},
		[],
	);

	const getCellDisplayValue = useCallback(
		(rowIndex: number, columnKey: string, storedValue: string): string => {
			if (
				activeCellDraft?.rowIndex === rowIndex &&
				activeCellDraft.columnKey === columnKey
			) {
				return activeCellDraft.value;
			}
			return storedValue;
		},
		[activeCellDraft],
	);

	const commitCellDraft = useCallback(
		(
			rowIndex: number,
			columnKey: string,
			normalizeValue?: (value: string) => string,
		) => {
			const rawValue = getDraftAwareCellValue(rowIndex, columnKey);
			const value = normalizeValue ? normalizeValue(rawValue) : rawValue;
			setCellDraft(null);
			handleCellChange(rowIndex, columnKey, value);
			if (activeCellEditRef.current === cellRefKey(rowIndex, columnKey)) {
				activeCellEditRef.current = null;
			}
			return value;
		},
		[getDraftAwareCellValue, handleCellChange, setCellDraft],
	);

	const normalizeDateCellValue = useCallback((value: string): string => {
		const trimmed = value.trim();
		if (!trimmed) return "";
		const context = createDateNormalizationContext(
			rowsRef.current.map((row) => ({ date: row.date ?? "" })),
		);
		const normalized = normalizeCsvDate(trimmed, context);
		if (normalized.isoDate) return normalized.isoDate;

		if (normalized.warning) {
			setStatusMessage(normalized.warning.message);
		}
		return trimmed;
	}, []);

	const normalizeValueForColumn = useCallback(
		(columnKey: string, value: string): string => {
			if (columnKey === DATE_COLUMN_KEY) {
				return normalizeDateCellValue(value);
			}
			if (TIME_COLUMN_KEYS.has(columnKey)) {
				return DateTransformers.convertToTime(value);
			}
			if (columnKey === PRIMARY_URL_COLUMN_KEY) {
				return normalizeUrlValue(value);
			}
			if (columnKey === PRICE_COLUMN_KEY) {
				return normalizePriceValue(value);
			}
			return value;
		},
		[normalizeDateCellValue],
	);

	const commitStandardCell = useCallback(
		(rowIndex: number, columnKey: string) => {
			const rawValue = rowsRef.current[rowIndex]?.[columnKey] ?? "";
			const normalizedValue = normalizeValueForColumn(columnKey, rawValue);
			handleCellChange(rowIndex, columnKey, normalizedValue);
			if (activeCellEditRef.current === cellRefKey(rowIndex, columnKey)) {
				activeCellEditRef.current = null;
			}
		},
		[handleCellChange, normalizeValueForColumn],
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

	const addGenreToRow = useCallback(
		(
			rowIndex: number,
			genreKey: string,
			taxonomyOverride?: GenreTaxonomySnapshot,
		) => {
			const row = rowsRef.current[rowIndex];
			if (!row) return;
			const taxonomy = taxonomyOverride ?? genreTaxonomy;
			const label = getGenreLabel(genreKey, taxonomy?.genres ?? []);
			const parts = splitGenreCell(row[CATEGORY_COLUMN_KEY] ?? "", taxonomy);
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

	const toggleGenreForCell = useCallback(
		(rowIndex: number, columnKey: string, genre: GenreTaxonomyDefinition) => {
			const row = rowsRef.current[rowIndex];
			if (!row) return;
			const currentValue = getDraftAwareCellValue(rowIndex, columnKey);
			const taxonomy = genreTaxonomy;
			const parts = splitGenreCell(currentValue, taxonomy);
			const isSelected = parts.some((part) => part.resolved === genre.key);
			const labels = isSelected
				? parts
						.filter((part) => part.resolved !== genre.key)
						.map((part) => part.label)
				: (() => {
						const nextLabels = parts.map((part) => part.label);
						const lastPart = parts.at(-1);
						const search = normalizeGenreInputText(genreSearchQuery);
						const shouldReplaceTypedSegment =
							Boolean(search) &&
							lastPart !== undefined &&
							!lastPart.resolved &&
							normalizeGenreInputText(lastPart.value) === search;
						if (shouldReplaceTypedSegment && nextLabels.length > 0) {
							nextLabels[nextLabels.length - 1] = genre.label;
							return nextLabels;
						}
						return [...nextLabels, genre.label];
					})();

			handleCellChange(rowIndex, columnKey, joinGenreLabels(labels));
			setCellDraft(null);
			setGenreSearchQuery("");
			setFocusedCategoryRowIndex(rowIndex);
			setFocusedGenreCell({ rowIndex, columnKey });
			window.setTimeout(() => {
				inputRefs.current[cellRefKey(rowIndex, columnKey)]?.focus();
			}, 0);
		},
		[
			genreSearchQuery,
			genreTaxonomy,
			getDraftAwareCellValue,
			handleCellChange,
			setCellDraft,
		],
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
				addGenreToRow(targetRowIndex, result.genreKey, result.genreTaxonomy);
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
		},
		[aliasGenreKey],
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

	const selectGenreForCell = useCallback(
		(rowIndex: number, columnKey: string, genre: GenreTaxonomyDefinition) => {
			toggleGenreForCell(rowIndex, columnKey, genre);
		},
		[toggleGenreForCell],
	);

	const countryOptionsForFocusedCell = useMemo((): CountryOption[] => {
		if (!focusedCountryCell) return [];
		return filterCountryOptions(countrySearchQuery, 8);
	}, [countrySearchQuery, focusedCountryCell]);

	const areaOptionsForFocusedCell = useMemo((): AreaOption[] => {
		if (!focusedAreaCell) return [];
		return filterAreaOptions(areaSearchQuery);
	}, [areaSearchQuery, focusedAreaCell]);

	const settingOptionsForFocusedCell = useMemo((): SimpleOption[] => {
		if (!focusedSettingCell) return [];
		return SETTING_OPTIONS;
	}, [focusedSettingCell]);

	const ageOptionsForFocusedCell = useMemo((): SimpleOption[] => {
		if (!focusedAgeCell) return [];
		return AGE_OPTIONS;
	}, [focusedAgeCell]);

	const toggleCuratedForCell = useCallback(
		(rowIndex: number, columnKey: string) => {
			const row = rowsRef.current[rowIndex];
			if (!row) return;
			const nextValue = isCuratedValue(row[columnKey] ?? "")
				? ""
				: CURATED_PICK_VALUE;
			handleCellChange(rowIndex, columnKey, nextValue);
		},
		[handleCellChange],
	);

	const selectSettingForCell = useCallback(
		(rowIndex: number, columnKey: string, setting: SimpleOption) => {
			const row = rowsRef.current[rowIndex];
			if (!row) return;
			const currentValue = getDraftAwareCellValue(rowIndex, columnKey);
			const selectedValues = splitSettingCell(currentValue);
			const nextValues = selectedValues.includes(setting.value)
				? selectedValues.filter((value) => value !== setting.value)
				: [...selectedValues, setting.value];

			handleCellChange(rowIndex, columnKey, nextValues.join(", "));
			setCellDraft(null);
			setFocusedSettingCell({ rowIndex, columnKey });
			window.setTimeout(() => {
				inputRefs.current[cellRefKey(rowIndex, columnKey)]?.focus();
			}, 0);
		},
		[getDraftAwareCellValue, handleCellChange, setCellDraft],
	);

	const selectAgeForCell = useCallback(
		(rowIndex: number, columnKey: string, age: SimpleOption | null) => {
			const row = rowsRef.current[rowIndex];
			if (!row) return;
			handleCellChange(rowIndex, columnKey, age?.value ?? "");
			setCellDraft(null);
			setFocusedAgeCell({ rowIndex, columnKey });
			window.setTimeout(() => {
				inputRefs.current[cellRefKey(rowIndex, columnKey)]?.focus();
			}, 0);
		},
		[handleCellChange, setCellDraft],
	);

	const selectCountryForCell = useCallback(
		(rowIndex: number, columnKey: string, country: CountryOption) => {
			const row = rowsRef.current[rowIndex];
			if (!row) return;
			const currentValue = getDraftAwareCellValue(rowIndex, columnKey);
			const selectedCodes = splitCountryCell(currentValue);
			const nextCodes = selectedCodes.includes(country.code)
				? selectedCodes.filter((code) => code !== country.code)
				: [...selectedCodes, country.code];

			handleCellChange(rowIndex, columnKey, joinCountryCodes(nextCodes));
			setCellDraft(null);
			setCountrySearchQuery("");
			setFocusedCountryCell({ rowIndex, columnKey });
			window.setTimeout(() => {
				inputRefs.current[cellRefKey(rowIndex, columnKey)]?.focus();
			}, 0);
		},
		[getDraftAwareCellValue, handleCellChange, setCellDraft],
	);

	const selectAreaForCell = useCallback(
		(rowIndex: number, columnKey: string, area: AreaOption) => {
			handleCellChange(rowIndex, columnKey, area.value);
			setCellDraft(null);
			setAreaSearchQuery(area.value);
			setFocusedAreaCell({ rowIndex, columnKey });
			window.setTimeout(() => {
				inputRefs.current[cellRefKey(rowIndex, columnKey)]?.focus();
			}, 0);
		},
		[handleCellChange, setCellDraft],
	);

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
	const genreOptionsForFocusedCell = useMemo(() => {
		if (!focusedGenreCell) return [];
		const query = normalizeGenreInputText(genreSearchQuery);
		const scored = availableGenres
			.map((genre) => {
				const haystack = [genre.label, genre.key, ...(genre.aliases ?? [])].map(
					normalizeGenreInputText,
				);
				const exact = haystack.some((value) => value === query);
				const startsWith = haystack.some((value) => value.startsWith(query));
				const includes = haystack.some((value) => value.includes(query));
				return {
					genre,
					score: !query ? 1 : exact ? 4 : startsWith ? 3 : includes ? 2 : 0,
				};
			})
			.filter((item) => item.score > 0)
			.sort(
				(left, right) =>
					right.score - left.score ||
					(left.genre.sortOrder ?? 1000) - (right.genre.sortOrder ?? 1000) ||
					left.genre.label.localeCompare(right.genre.label),
			);
		return scored.slice(0, 10).map((item) => item.genre);
	}, [availableGenres, focusedGenreCell, genreSearchQuery]);
	const aliasMappings = useMemo<GenreAliasMapping[]>(() => {
		const genreByKey = new Map(
			availableGenres.map((genre) => [genre.key, genre.label]),
		);
		return (genreTaxonomy?.aliases ?? [])
			.filter(
				(alias) =>
					!isRedundantGenreAlias(alias.alias, alias.genreKey) &&
					genreByKey.has(alias.genreKey),
			)
			.map((alias) => ({
				...alias,
				genreLabel: genreByKey.get(alias.genreKey) ?? alias.genreKey,
				isDefault: DEFAULT_ALIAS_KEYS.has(`${alias.alias}:${alias.genreKey}`),
			}))
			.sort(
				(left, right) =>
					Number(left.isDefault) - Number(right.isDefault) ||
					left.genreLabel.localeCompare(right.genreLabel) ||
					left.alias.localeCompare(right.alias),
			);
	}, [availableGenres, genreTaxonomy]);
	const customAliasCount = aliasMappings.filter(
		(alias) => !alias.isDefault,
	).length;
	const unknownGenres = useMemo(() => {
		if (!genreTaxonomy) return [];
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

	const sheetHealthIssues = useMemo((): SheetHealthIssue[] => {
		const referenceDate = new Date();
		const context = createDateNormalizationContext(
			rows.map((row) => ({ date: row.date ?? "" })),
			{ referenceDate },
		);
		const issues: SheetHealthIssue[] = [];

		rows.forEach((row, index) => {
			const rowNumber = index + 1;
			const dateValue = String(row[DATE_COLUMN_KEY] ?? "").trim();
			if (dateValue) {
				const normalized = normalizeCsvDate(dateValue, context);
				if (normalized.warning) {
					issues.push({
						rowIndex: rowNumber,
						column: "Date",
						message: normalized.warning.message,
					});
				}
			}

			for (const columnKey of TIME_COLUMN_KEYS) {
				const value = String(row[columnKey] ?? "").trim();
				if (!value || /^(?:tba|tbc)$/i.test(value)) continue;
				const normalized = DateTransformers.convertToTime(value);
				const isNormalizedTime = /^\d{2}:\d{2}$/.test(normalized);
				if (!isNormalizedTime && /\d/.test(value)) {
					issues.push({
						rowIndex: rowNumber,
						column:
							columnKey === START_TIME_COLUMN_KEY ? "Start Time" : "End Time",
						message: `Suspicious time value "${value}".`,
					});
				}
			}

			const urlValue = String(row[PRIMARY_URL_COLUMN_KEY] ?? "").trim();
			if (urlValue) {
				const invalidUrl = urlValue
					.split(URL_SEPARATOR_REGEX)
					.map(normalizeUrlPart)
					.find((part) => part.length > 0 && !isValidHttpUrl(part));
				if (invalidUrl) {
					issues.push({
						rowIndex: rowNumber,
						column: "Primary URL",
						message: `Invalid URL "${invalidUrl}".`,
					});
				}
			}

			for (const [columnKey, column] of [
				["hostCountry", "Host Country"],
				["audienceCountry", "Audience Country"],
			] as const) {
				const value = String(row[columnKey] ?? "").trim();
				if (!value) continue;
				const parsed = parseSupportedNationalities(value);
				if (parsed.unsupportedTokens.length > 0) {
					issues.push({
						rowIndex: rowNumber,
						column,
						message: `Unknown country token: ${parsed.unsupportedTokens.join(", ")}.`,
					});
				}
			}

			const settingValue = String(row[SETTING_COLUMN_KEY] ?? "").trim();
			if (settingValue && splitSettingCell(settingValue).length === 0) {
				issues.push({
					rowIndex: rowNumber,
					column: "Setting",
					message: 'Use "Indoor", "Outdoor", or both.',
				});
			}
		});

		return issues;
	}, [rows]);

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
			if (target instanceof HTMLInputElement) {
				target.select();
			}
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

				{sheetHealthIssues.length > 0 && (
					<details className="rounded-md border border-amber-300/70 bg-amber-50/75 px-3 py-2 text-xs text-amber-950">
						<summary className="cursor-pointer font-medium">
							Sheet health: {sheetHealthIssues.length} value
							{sheetHealthIssues.length === 1 ? "" : "s"} worth reviewing
						</summary>
						<div className="mt-2 space-y-1">
							{sheetHealthIssues.slice(0, 5).map((issue) => (
								<div
									key={`${issue.rowIndex}-${issue.column}-${issue.message}`}
									className="leading-snug"
								>
									Row {issue.rowIndex} · {issue.column}: {issue.message}
								</div>
							))}
							{sheetHealthIssues.length > 5 && (
								<div className="text-amber-900/80">
									+{sheetHealthIssues.length - 5} more. Use search or sort to
									review affected rows.
								</div>
							)}
						</div>
					</details>
				)}

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

					<div className="flex flex-wrap items-end gap-x-6 gap-y-4 border-t pt-3">
						<div className="min-w-fit space-y-2">
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

						<div className="min-w-fit space-y-2">
							<Label>Genre tools</Label>
							<div className="flex flex-wrap items-center gap-2">
								<Badge variant="outline" className="h-8 text-[10px]">
									{defaultGenres.length} default
								</Badge>
								<Badge variant="secondary" className="h-8 text-[10px]">
									{customGenres.length} custom
								</Badge>
								{unknownGenres.length > 0 && (
									<Badge
										variant="outline"
										className="h-8 border-amber-300 bg-amber-50 text-[10px] text-amber-900"
									>
										{unknownGenres.length} unknown
									</Badge>
								)}
								<Button
									type="button"
									size="sm"
									variant="outline"
									className="h-9"
									onClick={() => setIsGenreManagerOpen(true)}
								>
									Manage genres
								</Button>
							</div>
						</div>

						<div className="min-w-[min(100%,320px)] space-y-2">
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

						<div className="ml-0 min-w-fit space-y-2 xl:ml-auto">
							<Label>View options</Label>
							<div className="flex h-9 items-center overflow-hidden rounded-md border bg-background text-sm whitespace-nowrap">
								<span className="border-r px-3 text-muted-foreground whitespace-nowrap">
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

					{unknownGenres.length > 0 && (
						<div className="border-t pt-3">
							<div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
								<div className="flex flex-wrap items-center gap-2">
									<span className="font-medium">Unknown genre tags</span>
									<span className="text-amber-900">
										Highlighted in the sheet. Add or map before publishing so
										filters and genre chips stay consistent.
									</span>
									<Button
										type="button"
										size="sm"
										variant="outline"
										className="ml-auto h-8 border-amber-300 bg-amber-50"
										onClick={() => setIsGenreManagerOpen(true)}
									>
										Review all
									</Button>
								</div>
								<div className="mt-2 flex flex-wrap gap-2">
									{unknownGenres.slice(0, 6).map((genre) => (
										<div
											key={genre.value}
											className="flex items-center gap-1 rounded-full border border-amber-300 bg-background/80 px-2 py-1 text-xs text-amber-900"
										>
											<span>
												{genre.label} ({genre.count})
											</span>
											<Button
												type="button"
												size="sm"
												variant="ghost"
												className="h-5 px-1.5 text-[10px]"
												title="Add this as a custom genre everywhere it appears"
												onClick={() => void handleCreateGenre(genre.label)}
											>
												Add globally
											</Button>
											<Button
												type="button"
												size="sm"
												variant="ghost"
												className="h-5 px-1.5 text-[10px]"
												onClick={() => {
													setAliasInput(genre.label);
													setIsGenreManagerOpen(true);
												}}
											>
												Map
											</Button>
										</div>
									))}
									{unknownGenres.length > 6 && (
										<Button
											type="button"
											size="sm"
											variant="ghost"
											className="h-7 text-xs text-amber-950"
											onClick={() => setIsGenreManagerOpen(true)}
										>
											+{unknownGenres.length - 6} more
										</Button>
									)}
								</div>
							</div>
						</div>
					)}
				</div>

				<Dialog open={isGenreManagerOpen} onOpenChange={setIsGenreManagerOpen}>
					<DialogContent className="max-h-[88vh] w-[min(1040px,calc(100vw-2rem))] max-w-none overflow-y-auto p-5 sm:max-w-none sm:p-6">
						<DialogHeader className="pr-10">
							<DialogTitle className="text-xl">Manage genres</DialogTitle>
							<DialogDescription className="max-w-2xl text-base leading-relaxed">
								Default genres are protected. Custom genres and aliases apply
								across the whole sheet.
							</DialogDescription>
						</DialogHeader>

						<div className="space-y-4">
							<div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
								<div className="min-w-0 space-y-1.5">
									<Label htmlFor="new-genre-label">Add custom genre</Label>
									<Input
										id="new-genre-label"
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
									/>
								</div>
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

							<div className="grid gap-3 xl:grid-cols-2">
								<div className="min-w-0 space-y-1.5">
									<div className="flex items-center gap-2">
										<Label className="text-xs text-muted-foreground whitespace-nowrap">
											Default genres
										</Label>
										<Badge variant="outline" className="text-[10px]">
											{defaultGenres.length}
										</Badge>
									</div>
									<div className="flex max-h-56 min-h-24 flex-wrap content-start gap-1.5 overflow-y-auto rounded-md border border-border/70 bg-background/70 p-3">
										{defaultGenres.map((genre) => (
											<span
												key={genre.key}
												className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border/70 bg-background px-2.5 text-xs"
											>
												<span
													className={`h-2 w-2 rounded-full ${genre.color || "bg-stone-500"}`}
												/>
												{genre.label}
											</span>
										))}
										{availableGenres.length === 0 && (
											<span className="text-xs text-muted-foreground">
												Genre list unavailable. Check the Postgres connection.
											</span>
										)}
									</div>
								</div>

								<div className="min-w-0 space-y-1.5">
									<div className="flex items-center gap-2">
										<Label className="text-xs text-muted-foreground whitespace-nowrap">
											Custom genres
										</Label>
										<Badge variant="secondary" className="text-[10px]">
											{customGenres.length}
										</Badge>
									</div>
									<div className="flex max-h-56 min-h-24 flex-wrap content-start gap-1.5 overflow-y-auto rounded-md border border-border/70 bg-background/70 p-3">
										{customGenres.map((genre) => (
											<div
												key={genre.key}
												className="inline-flex h-7 items-center overflow-hidden rounded-full border border-border/70 bg-background text-xs"
											>
												<span className="inline-flex h-7 items-center gap-1.5 px-2.5">
													<span
														className={`h-2 w-2 rounded-full ${genre.color || "bg-stone-500"}`}
													/>
													{genre.label}
												</span>
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
										{unknownGenres.map((genre) => (
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
													title="Add this as a custom genre everywhere it appears"
													onClick={() => void handleCreateGenre(genre.label)}
												>
													Add globally
												</Button>
												<Button
													type="button"
													size="sm"
													variant="ghost"
													className="h-5 px-1.5 text-[10px]"
													onClick={() => setAliasInput(genre.label)}
												>
													Map
												</Button>
											</div>
										))}
									</div>
								</div>
							)}

							<div className="space-y-2 border-t pt-3">
								<Label>Alias mapping</Label>
								<div className="grid gap-2 md:grid-cols-[minmax(12rem,16rem)_minmax(12rem,1fr)_auto] md:items-end">
									<div className="min-w-0 space-y-1">
										<Label htmlFor="genre-alias-target">
											Treat typed genre as
										</Label>
										<select
											id="genre-alias-target"
											value={aliasGenreKey}
											onChange={(event) => setAliasGenreKey(event.target.value)}
											className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
										>
											<option value="">Choose genre</option>
											{availableGenres.map((genre) => (
												<option key={genre.key} value={genre.key}>
													{genre.label}
												</option>
											))}
										</select>
									</div>
									<div className="min-w-0 space-y-1">
										<Label htmlFor="genre-alias-input">Typed genre</Label>
										<Input
											id="genre-alias-input"
											value={aliasInput}
											onChange={(event) => setAliasInput(event.target.value)}
											placeholder="Afro Trap"
											className="h-9 w-full"
										/>
									</div>
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

							<div className="border-t pt-3">
								<Accordion>
									<AccordionItem value="genre-aliases" className="border-0">
										<AccordionTrigger className="rounded-md border border-border/70 bg-background/70 px-3 py-2 text-sm no-underline hover:bg-muted/40 hover:no-underline">
											<span className="flex min-w-0 flex-wrap items-center gap-2">
												<span>Current alias mappings</span>
												<Badge variant="outline" className="text-[10px]">
													{aliasMappings.length}
												</Badge>
												{customAliasCount > 0 && (
													<Badge variant="secondary" className="text-[10px]">
														{customAliasCount} custom
													</Badge>
												)}
											</span>
										</AccordionTrigger>
										<AccordionContent className="pt-2 pb-0">
											{aliasMappings.length > 0 ? (
												<div className="grid max-h-64 gap-2 overflow-y-auto rounded-md border border-border/70 bg-background/70 p-2 sm:grid-cols-2">
													{aliasMappings.map((alias) => (
														<div
															key={`${alias.alias}:${alias.genreKey}`}
															className="flex min-w-0 items-center justify-between gap-2 rounded-md border border-border/60 bg-background px-2.5 py-2 text-xs"
														>
															<span className="min-w-0 truncate">
																{toGenreLabel(alias.alias)} -&gt;{" "}
																{alias.genreLabel}
															</span>
															{alias.isDefault ? (
																<Badge
																	variant="outline"
																	className="text-[10px]"
																>
																	Built-in
																</Badge>
															) : (
																<button
																	type="button"
																	className="shrink-0 rounded-sm px-2 py-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
																	onClick={() =>
																		void handleRemoveAlias(alias.alias)
																	}
																	aria-label={`Remove ${alias.alias} alias`}
																	title={`Remove ${alias.alias} alias`}
																>
																	x
																</button>
															)}
														</div>
													))}
												</div>
											) : (
												<p className="rounded-md border border-border/70 bg-background/70 p-3 text-xs text-muted-foreground">
													No alias mappings are available yet.
												</p>
											)}
										</AccordionContent>
									</AccordionItem>
								</Accordion>
							</div>
						</div>
					</DialogContent>
				</Dialog>

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
					`Host Country` and `Audience Country` support country names, flags,
					and ISO codes. Focus either column to search and insert normalized
					country codes.
				</div>
				<div className="text-xs text-muted-foreground">
					`District/Area` supports an Area picker: choose `1`-`20`, `Greater
					Paris`, `Outside Paris`, or `Location TBC`.
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
									const categoryValue = getCellDisplayValue(
										rowIndex,
										CATEGORY_COLUMN_KEY,
										row[CATEGORY_COLUMN_KEY] ?? "",
									);
									const selectedGenreKeys = getSelectedGenreKeys(
										categoryValue,
										genreTaxonomy,
									);
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
													{column.key === CURATED_COLUMN_KEY ? (
														<button
															ref={(node) => {
																inputRefs.current[
																	cellRefKey(rowIndex, column.key)
																] = node;
															}}
															type="button"
															aria-pressed={isCuratedValue(
																row[column.key] ?? "",
															)}
															onClick={() =>
																toggleCuratedForCell(rowIndex, column.key)
															}
															onKeyDown={(event) => {
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
															className={`flex h-9 w-full items-center gap-2 px-2 text-left text-xs outline-none transition hover:bg-accent/60 focus:bg-muted/30 ${
																isCuratedValue(row[column.key] ?? "")
																	? "text-amber-700"
																	: "text-muted-foreground"
															}`}
														>
															<span className="text-base leading-none">
																{isCuratedValue(row[column.key] ?? "")
																	? CURATED_PICK_VALUE
																	: "☆"}
															</span>
															<span className="truncate">
																{isCuratedValue(row[column.key] ?? "")
																	? "OOOC Pick"
																	: "Not curated"}
															</span>
														</button>
													) : column.key === CATEGORY_COLUMN_KEY ? (
														<div className="relative min-h-9 bg-transparent">
															<input
																ref={(node) => {
																	inputRefs.current[
																		cellRefKey(rowIndex, column.key)
																	] = node;
																}}
																value={categoryValue}
																onFocus={() => {
																	beginCellDraft(
																		rowIndex,
																		column.key,
																		row[column.key] ?? "",
																	);
																	setFocusedCategoryRowIndex(rowIndex);
																	setFocusedGenreCell({
																		rowIndex,
																		columnKey: column.key,
																	});
																	setGenreSearchQuery("");
																	setHighlightedGenreIndex(0);
																}}
																onChange={(event) => {
																	setFocusedCategoryRowIndex(rowIndex);
																	setFocusedGenreCell((current) =>
																		current?.rowIndex === rowIndex &&
																		current.columnKey === column.key
																			? current
																			: { rowIndex, columnKey: column.key },
																	);
																	setGenreSearchQuery(
																		getGenreSearchSegment(event.target.value),
																	);
																	setHighlightedGenreIndex(0);
																	updateCellDraft(
																		rowIndex,
																		column.key,
																		event.target.value,
																	);
																}}
																onBlur={() => {
																	commitCellDraft(rowIndex, column.key);
																	window.setTimeout(() => {
																		setFocusedGenreCell((current) =>
																			current?.rowIndex === rowIndex &&
																			current.columnKey === column.key
																				? null
																				: current,
																		);
																	}, 120);
																}}
																onKeyDown={(event) => {
																	if (
																		event.key === "ArrowDown" &&
																		genreOptionsForFocusedCell.length > 0
																	) {
																		event.preventDefault();
																		setHighlightedGenreIndex((current) =>
																			Math.min(
																				current + 1,
																				genreOptionsForFocusedCell.length - 1,
																			),
																		);
																		return;
																	}
																	if (
																		event.key === "ArrowUp" &&
																		genreOptionsForFocusedCell.length > 0
																	) {
																		event.preventDefault();
																		setHighlightedGenreIndex((current) =>
																			Math.max(current - 1, 0),
																		);
																		return;
																	}
																	if (
																		event.key === "Enter" &&
																		genreOptionsForFocusedCell.length > 0
																	) {
																		event.preventDefault();
																		selectGenreForCell(
																			rowIndex,
																			column.key,
																			genreOptionsForFocusedCell[
																				highlightedGenreIndex
																			] ?? genreOptionsForFocusedCell[0],
																		);
																		return;
																	}
																	if (event.key === "Escape") {
																		event.preventDefault();
																		setCellDraft(null);
																		setFocusedGenreCell(null);
																		return;
																	}
																	if (event.key === "Enter") {
																		event.preventDefault();
																		commitCellDraft(rowIndex, column.key);
																		focusCell(rowIndex, column.key, 1, 0);
																	}
																	if (event.key === "ArrowDown") {
																		event.preventDefault();
																		commitCellDraft(rowIndex, column.key);
																		focusCell(rowIndex, column.key, 1, 0);
																	}
																	if (event.key === "ArrowUp") {
																		event.preventDefault();
																		commitCellDraft(rowIndex, column.key);
																		focusCell(rowIndex, column.key, -1, 0);
																	}
																	if (
																		event.key === "ArrowRight" &&
																		event.altKey
																	) {
																		event.preventDefault();
																		commitCellDraft(rowIndex, column.key);
																		focusCell(rowIndex, column.key, 0, 1);
																	}
																	if (
																		event.key === "ArrowLeft" &&
																		event.altKey
																	) {
																		event.preventDefault();
																		commitCellDraft(rowIndex, column.key);
																		focusCell(rowIndex, column.key, 0, -1);
																	}
																}}
																className="h-8 w-full border-0 bg-transparent px-2 text-xs outline-none focus:bg-muted/30"
																aria-autocomplete="list"
																aria-expanded={
																	focusedGenreCell?.rowIndex === rowIndex &&
																	focusedGenreCell.columnKey === column.key
																}
															/>
															{focusedGenreCell?.rowIndex === rowIndex &&
																focusedGenreCell.columnKey === column.key && (
																	<div className="absolute left-1 top-8 z-40 w-72 overflow-hidden rounded-md border border-border/80 bg-popover shadow-xl">
																		<div className="border-b px-2 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
																			Genres
																		</div>
																		<div className="max-h-60 overflow-y-auto p-1">
																			{genreOptionsForFocusedCell.map(
																				(genre, optionIndex) => {
																					const isSelected =
																						selectedGenreKeys.has(genre.key);
																					return (
																						<button
																							key={genre.key}
																							type="button"
																							onMouseDown={(event) => {
																								event.preventDefault();
																								selectGenreForCell(
																									rowIndex,
																									column.key,
																									genre,
																								);
																							}}
																							className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition ${
																								optionIndex ===
																								highlightedGenreIndex
																									? "bg-accent text-accent-foreground"
																									: isSelected
																										? "bg-muted text-foreground"
																										: "hover:bg-accent/70"
																							}`}
																						>
																							<span
																								className={`h-3 w-3 rounded-sm border ${
																									isSelected
																										? "border-foreground bg-foreground"
																										: "border-muted-foreground/40"
																								}`}
																								aria-hidden="true"
																							/>
																							<span
																								className={`h-2 w-2 rounded-full ${genre.color || "bg-stone-500"}`}
																							/>
																							<span className="min-w-0 flex-1 truncate">
																								{genre.label}
																							</span>
																							<span className="text-[10px] text-muted-foreground">
																								{genre.isDefault
																									? "Default"
																									: "Custom"}
																							</span>
																						</button>
																					);
																				},
																			)}
																			{genreOptionsForFocusedCell.length ===
																				0 && (
																				<div className="px-2 py-2 text-xs text-muted-foreground">
																					No matching genre. Keep typing or add
																					it from Unknown genres.
																				</div>
																			)}
																		</div>
																	</div>
																)}
															<div className="flex min-h-7 flex-wrap gap-1 px-1.5 pb-1.5">
																{splitGenreCell(
																	categoryValue,
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
													) : column.key === AREA_COLUMN_KEY ? (
														<div className="relative min-h-9 bg-transparent">
															<input
																ref={(node) => {
																	inputRefs.current[
																		cellRefKey(rowIndex, column.key)
																	] = node;
																}}
																value={getCellDisplayValue(
																	rowIndex,
																	column.key,
																	row[column.key] ?? "",
																)}
																onFocus={() => {
																	beginCellDraft(
																		rowIndex,
																		column.key,
																		row[column.key] ?? "",
																	);
																	setFocusedAreaCell({
																		rowIndex,
																		columnKey: column.key,
																	});
																	setAreaSearchQuery(row[column.key] ?? "");
																	setHighlightedAreaIndex(0);
																}}
																onChange={(event) => {
																	setFocusedAreaCell((current) =>
																		current?.rowIndex === rowIndex &&
																		current.columnKey === column.key
																			? current
																			: { rowIndex, columnKey: column.key },
																	);
																	setAreaSearchQuery(event.target.value);
																	setHighlightedAreaIndex(0);
																	updateCellDraft(
																		rowIndex,
																		column.key,
																		event.target.value,
																	);
																}}
																onBlur={() => {
																	commitCellDraft(
																		rowIndex,
																		column.key,
																		normalizeAreaValue,
																	);
																	window.setTimeout(() => {
																		setFocusedAreaCell((current) =>
																			current?.rowIndex === rowIndex &&
																			current.columnKey === column.key
																				? null
																				: current,
																		);
																	}, 120);
																}}
																onKeyDown={(event) => {
																	if (
																		event.key === "ArrowDown" &&
																		areaOptionsForFocusedCell.length > 0
																	) {
																		event.preventDefault();
																		setHighlightedAreaIndex((current) =>
																			Math.min(
																				current + 1,
																				areaOptionsForFocusedCell.length - 1,
																			),
																		);
																		return;
																	}
																	if (
																		event.key === "ArrowUp" &&
																		areaOptionsForFocusedCell.length > 0
																	) {
																		event.preventDefault();
																		setHighlightedAreaIndex((current) =>
																			Math.max(current - 1, 0),
																		);
																		return;
																	}
																	if (
																		event.key === "Enter" &&
																		areaOptionsForFocusedCell.length > 0
																	) {
																		event.preventDefault();
																		selectAreaForCell(
																			rowIndex,
																			column.key,
																			areaOptionsForFocusedCell[
																				highlightedAreaIndex
																			] ?? areaOptionsForFocusedCell[0],
																		);
																		return;
																	}
																	if (event.key === "Escape") {
																		event.preventDefault();
																		setCellDraft(null);
																		setFocusedAreaCell(null);
																		return;
																	}
																	if (event.key === "Enter") {
																		event.preventDefault();
																		commitCellDraft(
																			rowIndex,
																			column.key,
																			normalizeAreaValue,
																		);
																		focusCell(rowIndex, column.key, 1, 0);
																	}
																	if (
																		event.key === "ArrowRight" &&
																		event.altKey
																	) {
																		event.preventDefault();
																		commitCellDraft(
																			rowIndex,
																			column.key,
																			normalizeAreaValue,
																		);
																		focusCell(rowIndex, column.key, 0, 1);
																	}
																	if (
																		event.key === "ArrowLeft" &&
																		event.altKey
																	) {
																		event.preventDefault();
																		commitCellDraft(
																			rowIndex,
																			column.key,
																			normalizeAreaValue,
																		);
																		focusCell(rowIndex, column.key, 0, -1);
																	}
																}}
																className="h-9 w-full border-0 bg-transparent px-2 text-xs outline-none focus:bg-muted/30"
																placeholder="Choose area"
																aria-autocomplete="list"
																aria-expanded={
																	focusedAreaCell?.rowIndex === rowIndex &&
																	focusedAreaCell.columnKey === column.key
																}
															/>
															{focusedAreaCell?.rowIndex === rowIndex &&
																focusedAreaCell.columnKey === column.key && (
																	<div className="absolute left-1 top-8 z-40 w-72 overflow-hidden rounded-md border border-border/80 bg-popover shadow-xl">
																		<div className="border-b px-2 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
																			Area
																		</div>
																		<div className="border-b px-2 py-1.5 text-[11px] text-muted-foreground">
																			Choose arrondissement or area.
																		</div>
																		<div className="max-h-60 overflow-y-auto p-1">
																			{areaOptionsForFocusedCell.map(
																				(area, optionIndex) => {
																					const previousArea =
																						areaOptionsForFocusedCell[
																							optionIndex - 1
																						];
																					const isSelected =
																						normalizeAreaValue(
																							getCellDisplayValue(
																								rowIndex,
																								column.key,
																								row[column.key] ?? "",
																							),
																						) === area.value;
																					const showGroup =
																						!previousArea ||
																						previousArea.group !== area.group;
																					return (
																						<div key={area.value}>
																							{showGroup && (
																								<div className="px-2 pb-1 pt-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
																									{area.group}
																								</div>
																							)}
																							<button
																								type="button"
																								onMouseDown={(event) => {
																									event.preventDefault();
																									selectAreaForCell(
																										rowIndex,
																										column.key,
																										area,
																									);
																								}}
																								className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition ${
																									optionIndex ===
																									highlightedAreaIndex
																										? "bg-accent text-accent-foreground"
																										: isSelected
																											? "bg-muted text-foreground"
																											: "hover:bg-accent/70"
																								}`}
																							>
																								<span className="min-w-0 flex-1 truncate font-medium">
																									{area.label}
																								</span>
																								<span className="max-w-36 truncate text-[10px] text-muted-foreground">
																									{area.description}
																								</span>
																							</button>
																						</div>
																					);
																				},
																			)}
																			{areaOptionsForFocusedCell.length ===
																				0 && (
																				<div className="px-2 py-2 text-xs text-muted-foreground">
																					No matching area. Use `Greater Paris`,
																					`Outside Paris`, or `Location TBC`.
																				</div>
																			)}
																		</div>
																	</div>
																)}
														</div>
													) : column.key === SETTING_COLUMN_KEY ? (
														<div className="relative min-h-9 bg-transparent">
															<input
																ref={(node) => {
																	inputRefs.current[
																		cellRefKey(rowIndex, column.key)
																	] = node;
																}}
																value={getCellDisplayValue(
																	rowIndex,
																	column.key,
																	row[column.key] ?? "",
																)}
																onFocus={() => {
																	beginCellDraft(
																		rowIndex,
																		column.key,
																		row[column.key] ?? "",
																	);
																	setFocusedSettingCell({
																		rowIndex,
																		columnKey: column.key,
																	});
																	setHighlightedSettingIndex(0);
																}}
																onChange={(event) => {
																	setFocusedSettingCell((current) =>
																		current?.rowIndex === rowIndex &&
																		current.columnKey === column.key
																			? current
																			: { rowIndex, columnKey: column.key },
																	);
																	setHighlightedSettingIndex(0);
																	updateCellDraft(
																		rowIndex,
																		column.key,
																		event.target.value,
																	);
																}}
																onBlur={() => {
																	commitCellDraft(
																		rowIndex,
																		column.key,
																		normalizeSettingValue,
																	);
																	window.setTimeout(() => {
																		setFocusedSettingCell((current) =>
																			current?.rowIndex === rowIndex &&
																			current.columnKey === column.key
																				? null
																				: current,
																		);
																	}, 120);
																}}
																onKeyDown={(event) => {
																	if (
																		event.key === "ArrowDown" &&
																		settingOptionsForFocusedCell.length > 0
																	) {
																		event.preventDefault();
																		setHighlightedSettingIndex((current) =>
																			Math.min(
																				current + 1,
																				settingOptionsForFocusedCell.length - 1,
																			),
																		);
																		return;
																	}
																	if (
																		event.key === "ArrowUp" &&
																		settingOptionsForFocusedCell.length > 0
																	) {
																		event.preventDefault();
																		setHighlightedSettingIndex((current) =>
																			Math.max(current - 1, 0),
																		);
																		return;
																	}
																	if (
																		event.key === "Enter" &&
																		settingOptionsForFocusedCell.length > 0
																	) {
																		event.preventDefault();
																		selectSettingForCell(
																			rowIndex,
																			column.key,
																			settingOptionsForFocusedCell[
																				highlightedSettingIndex
																			] ?? settingOptionsForFocusedCell[0],
																		);
																		return;
																	}
																	if (event.key === "Escape") {
																		event.preventDefault();
																		setCellDraft(null);
																		setFocusedSettingCell(null);
																		return;
																	}
																	if (event.key === "Enter") {
																		event.preventDefault();
																		commitCellDraft(
																			rowIndex,
																			column.key,
																			normalizeSettingValue,
																		);
																		focusCell(rowIndex, column.key, 1, 0);
																	}
																	if (
																		event.key === "ArrowRight" &&
																		event.altKey
																	) {
																		event.preventDefault();
																		commitCellDraft(
																			rowIndex,
																			column.key,
																			normalizeSettingValue,
																		);
																		focusCell(rowIndex, column.key, 0, 1);
																	}
																	if (
																		event.key === "ArrowLeft" &&
																		event.altKey
																	) {
																		event.preventDefault();
																		commitCellDraft(
																			rowIndex,
																			column.key,
																			normalizeSettingValue,
																		);
																		focusCell(rowIndex, column.key, 0, -1);
																	}
																}}
																className="h-9 w-full border-0 bg-transparent px-2 text-xs outline-none focus:bg-muted/30"
																placeholder="Indoor / Outdoor"
																aria-autocomplete="list"
																aria-expanded={
																	focusedSettingCell?.rowIndex === rowIndex &&
																	focusedSettingCell.columnKey === column.key
																}
															/>
															{focusedSettingCell?.rowIndex === rowIndex &&
																focusedSettingCell.columnKey === column.key && (
																	<div className="absolute left-1 top-8 z-40 w-72 overflow-hidden rounded-md border border-border/80 bg-popover shadow-xl">
																		<div className="border-b px-2 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
																			Setting
																		</div>
																		<div className="border-b px-2 py-1.5 text-[11px] text-muted-foreground">
																			Select one or both.
																		</div>
																		<div className="p-1">
																			{settingOptionsForFocusedCell.map(
																				(setting, optionIndex) => {
																					const selectedValues =
																						splitSettingCell(
																							getCellDisplayValue(
																								rowIndex,
																								column.key,
																								row[column.key] ?? "",
																							),
																						);
																					const isSelected =
																						selectedValues.includes(
																							setting.value,
																						);
																					return (
																						<button
																							key={setting.value}
																							type="button"
																							onMouseDown={(event) => {
																								event.preventDefault();
																								selectSettingForCell(
																									rowIndex,
																									column.key,
																									setting,
																								);
																							}}
																							className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition ${
																								optionIndex ===
																								highlightedSettingIndex
																									? "bg-accent text-accent-foreground"
																									: isSelected
																										? "bg-muted text-foreground"
																										: "hover:bg-accent/70"
																							}`}
																						>
																							<span
																								className={`h-3 w-3 rounded-sm border ${
																									isSelected
																										? "border-foreground bg-foreground"
																										: "border-muted-foreground/40"
																								}`}
																								aria-hidden="true"
																							/>
																							<span className="min-w-0 flex-1 truncate font-medium">
																								{setting.label}
																							</span>
																							<span className="max-w-40 truncate text-[10px] text-muted-foreground">
																								{setting.description}
																							</span>
																						</button>
																					);
																				},
																			)}
																		</div>
																	</div>
																)}
														</div>
													) : column.key === AGE_COLUMN_KEY ? (
														<div className="relative min-h-9 bg-transparent">
															<input
																ref={(node) => {
																	inputRefs.current[
																		cellRefKey(rowIndex, column.key)
																	] = node;
																}}
																value={getCellDisplayValue(
																	rowIndex,
																	column.key,
																	row[column.key] ?? "",
																)}
																onFocus={() => {
																	beginCellDraft(
																		rowIndex,
																		column.key,
																		row[column.key] ?? "",
																	);
																	setFocusedAgeCell({
																		rowIndex,
																		columnKey: column.key,
																	});
																	setHighlightedAgeIndex(0);
																}}
																onChange={(event) => {
																	setFocusedAgeCell((current) =>
																		current?.rowIndex === rowIndex &&
																		current.columnKey === column.key
																			? current
																			: { rowIndex, columnKey: column.key },
																	);
																	setHighlightedAgeIndex(0);
																	updateCellDraft(
																		rowIndex,
																		column.key,
																		event.target.value,
																	);
																}}
																onBlur={() => {
																	commitCellDraft(
																		rowIndex,
																		column.key,
																		(value) => value.trim(),
																	);
																	window.setTimeout(() => {
																		setFocusedAgeCell((current) =>
																			current?.rowIndex === rowIndex &&
																			current.columnKey === column.key
																				? null
																				: current,
																		);
																	}, 120);
																}}
																onKeyDown={(event) => {
																	if (
																		event.key === "ArrowDown" &&
																		ageOptionsForFocusedCell.length > 0
																	) {
																		event.preventDefault();
																		setHighlightedAgeIndex((current) =>
																			Math.min(
																				current + 1,
																				ageOptionsForFocusedCell.length - 1,
																			),
																		);
																		return;
																	}
																	if (
																		event.key === "ArrowUp" &&
																		ageOptionsForFocusedCell.length > 0
																	) {
																		event.preventDefault();
																		setHighlightedAgeIndex((current) =>
																			Math.max(current - 1, 0),
																		);
																		return;
																	}
																	if (
																		event.key === "Enter" &&
																		ageOptionsForFocusedCell.length > 0
																	) {
																		event.preventDefault();
																		selectAgeForCell(
																			rowIndex,
																			column.key,
																			ageOptionsForFocusedCell[
																				highlightedAgeIndex
																			] ?? ageOptionsForFocusedCell[0],
																		);
																		return;
																	}
																	if (event.key === "Escape") {
																		event.preventDefault();
																		setCellDraft(null);
																		setFocusedAgeCell(null);
																		return;
																	}
																	if (event.key === "Enter") {
																		event.preventDefault();
																		commitCellDraft(
																			rowIndex,
																			column.key,
																			(value) => value.trim(),
																		);
																		focusCell(rowIndex, column.key, 1, 0);
																	}
																	if (
																		event.key === "ArrowRight" &&
																		event.altKey
																	) {
																		event.preventDefault();
																		commitCellDraft(
																			rowIndex,
																			column.key,
																			(value) => value.trim(),
																		);
																		focusCell(rowIndex, column.key, 0, 1);
																	}
																	if (
																		event.key === "ArrowLeft" &&
																		event.altKey
																	) {
																		event.preventDefault();
																		commitCellDraft(
																			rowIndex,
																			column.key,
																			(value) => value.trim(),
																		);
																		focusCell(rowIndex, column.key, 0, -1);
																	}
																}}
																className="h-9 w-full border-0 bg-transparent px-2 text-xs outline-none focus:bg-muted/30"
																placeholder="18+, 21+, TBC"
																aria-autocomplete="list"
																aria-expanded={
																	focusedAgeCell?.rowIndex === rowIndex &&
																	focusedAgeCell.columnKey === column.key
																}
															/>
															{focusedAgeCell?.rowIndex === rowIndex &&
																focusedAgeCell.columnKey === column.key && (
																	<div className="absolute left-1 top-8 z-40 w-64 overflow-hidden rounded-md border border-border/80 bg-popover shadow-xl">
																		<div className="border-b px-2 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
																			Age Guidance
																		</div>
																		<div className="max-h-56 overflow-y-auto p-1">
																			<button
																				type="button"
																				onMouseDown={(event) => {
																					event.preventDefault();
																					selectAgeForCell(
																						rowIndex,
																						column.key,
																						null,
																					);
																				}}
																				className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-muted-foreground transition hover:bg-accent/70"
																			>
																				Clear
																			</button>
																			{ageOptionsForFocusedCell.map(
																				(age, optionIndex) => {
																					const isSelected =
																						getCellDisplayValue(
																							rowIndex,
																							column.key,
																							row[column.key] ?? "",
																						)
																							.trim()
																							.toLowerCase() ===
																						age.value.toLowerCase();
																					return (
																						<button
																							key={age.value}
																							type="button"
																							onMouseDown={(event) => {
																								event.preventDefault();
																								selectAgeForCell(
																									rowIndex,
																									column.key,
																									age,
																								);
																							}}
																							className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition ${
																								optionIndex ===
																								highlightedAgeIndex
																									? "bg-accent text-accent-foreground"
																									: isSelected
																										? "bg-muted text-foreground"
																										: "hover:bg-accent/70"
																							}`}
																						>
																							<span className="min-w-0 flex-1 truncate font-medium">
																								{age.label}
																							</span>
																							<span className="max-w-36 truncate text-[10px] text-muted-foreground">
																								{age.description}
																							</span>
																						</button>
																					);
																				},
																			)}
																		</div>
																	</div>
																)}
														</div>
													) : COUNTRY_COLUMN_KEYS.has(column.key) ? (
														<div className="relative min-h-9 bg-transparent">
															<input
																ref={(node) => {
																	inputRefs.current[
																		cellRefKey(rowIndex, column.key)
																	] = node;
																}}
																value={getCellDisplayValue(
																	rowIndex,
																	column.key,
																	row[column.key] ?? "",
																)}
																onFocus={() => {
																	beginCellDraft(
																		rowIndex,
																		column.key,
																		row[column.key] ?? "",
																	);
																	setFocusedCountryCell({
																		rowIndex,
																		columnKey: column.key,
																	});
																	setCountrySearchQuery(
																		getCountrySearchSegment(
																			row[column.key] ?? "",
																		),
																	);
																	setHighlightedCountryIndex(0);
																}}
																onChange={(event) => {
																	setFocusedCountryCell((current) =>
																		current?.rowIndex === rowIndex &&
																		current.columnKey === column.key
																			? current
																			: { rowIndex, columnKey: column.key },
																	);
																	setCountrySearchQuery(
																		getCountrySearchSegment(event.target.value),
																	);
																	setHighlightedCountryIndex(0);
																	updateCellDraft(
																		rowIndex,
																		column.key,
																		event.target.value,
																	);
																}}
																onBlur={() => {
																	commitCellDraft(
																		rowIndex,
																		column.key,
																		normalizeCountryValue,
																	);
																	window.setTimeout(() => {
																		setFocusedCountryCell((current) =>
																			current?.rowIndex === rowIndex &&
																			current.columnKey === column.key
																				? null
																				: current,
																		);
																	}, 120);
																}}
																onKeyDown={(event) => {
																	if (
																		event.key === "ArrowDown" &&
																		countryOptionsForFocusedCell.length > 0
																	) {
																		event.preventDefault();
																		setHighlightedCountryIndex((current) =>
																			Math.min(
																				current + 1,
																				countryOptionsForFocusedCell.length - 1,
																			),
																		);
																		return;
																	}
																	if (
																		event.key === "ArrowUp" &&
																		countryOptionsForFocusedCell.length > 0
																	) {
																		event.preventDefault();
																		setHighlightedCountryIndex((current) =>
																			Math.max(current - 1, 0),
																		);
																		return;
																	}
																	if (
																		event.key === "Enter" &&
																		countryOptionsForFocusedCell.length > 0
																	) {
																		event.preventDefault();
																		selectCountryForCell(
																			rowIndex,
																			column.key,
																			countryOptionsForFocusedCell[
																				highlightedCountryIndex
																			] ?? countryOptionsForFocusedCell[0],
																		);
																		return;
																	}
																	if (event.key === "Escape") {
																		event.preventDefault();
																		setCellDraft(null);
																		setFocusedCountryCell(null);
																		return;
																	}
																	if (event.key === "Enter") {
																		event.preventDefault();
																		commitCellDraft(
																			rowIndex,
																			column.key,
																			normalizeCountryValue,
																		);
																		focusCell(rowIndex, column.key, 1, 0);
																	}
																	if (
																		event.key === "ArrowRight" &&
																		event.altKey
																	) {
																		event.preventDefault();
																		commitCellDraft(
																			rowIndex,
																			column.key,
																			normalizeCountryValue,
																		);
																		focusCell(rowIndex, column.key, 0, 1);
																	}
																	if (
																		event.key === "ArrowLeft" &&
																		event.altKey
																	) {
																		event.preventDefault();
																		commitCellDraft(
																			rowIndex,
																			column.key,
																			normalizeCountryValue,
																		);
																		focusCell(rowIndex, column.key, 0, -1);
																	}
																}}
																className="h-9 w-full border-0 bg-transparent px-2 text-xs outline-none focus:bg-muted/30"
																aria-autocomplete="list"
																aria-expanded={
																	focusedCountryCell?.rowIndex === rowIndex &&
																	focusedCountryCell.columnKey === column.key
																}
															/>
															{focusedCountryCell?.rowIndex === rowIndex &&
																focusedCountryCell.columnKey === column.key && (
																	<div className="absolute left-1 top-8 z-40 w-64 overflow-hidden rounded-md border border-border/80 bg-popover shadow-xl">
																		<div className="border-b px-2 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
																			Country
																		</div>
																		<div className="border-b px-2 py-1.5 text-[11px] text-muted-foreground">
																			Use comma, slash, +, or & for multiple
																			countries.
																		</div>
																		<div className="max-h-56 overflow-y-auto p-1">
																			{countryOptionsForFocusedCell.map(
																				(country, optionIndex) => {
																					const isSelected =
																						getSelectedCountryCodes(
																							getCellDisplayValue(
																								rowIndex,
																								column.key,
																								row[column.key] ?? "",
																							),
																						).has(country.code);
																					return (
																						<button
																							key={country.code}
																							type="button"
																							onMouseDown={(event) => {
																								event.preventDefault();
																								selectCountryForCell(
																									rowIndex,
																									column.key,
																									country,
																								);
																							}}
																							className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition ${
																								optionIndex ===
																								highlightedCountryIndex
																									? "bg-accent text-accent-foreground"
																									: isSelected
																										? "bg-muted text-foreground"
																										: "hover:bg-accent/70"
																							}`}
																						>
																							<span
																								className={`h-3 w-3 rounded-sm border ${
																									isSelected
																										? "border-foreground bg-foreground"
																										: "border-muted-foreground/40"
																								}`}
																								aria-hidden="true"
																							/>
																							<span className="text-sm">
																								{country.flag}
																							</span>
																							<span className="min-w-0 flex-1 truncate">
																								{country.label}
																							</span>
																							<span className="font-mono text-[10px] text-muted-foreground">
																								{country.code}
																							</span>
																						</button>
																					);
																				},
																			)}
																			{countryOptionsForFocusedCell.length ===
																				0 && (
																				<div className="px-2 py-2 text-xs text-muted-foreground">
																					No matching country. Keep typing a
																					code or name.
																				</div>
																			)}
																		</div>
																	</div>
																)}
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
																commitStandardCell(rowIndex, column.key);
															}}
															onKeyDown={(event) => {
																if (event.key === "Enter") {
																	event.preventDefault();
																	commitStandardCell(rowIndex, column.key);
																	focusCell(rowIndex, column.key, 1, 0);
																}
																if (event.key === "ArrowDown") {
																	event.preventDefault();
																	commitStandardCell(rowIndex, column.key);
																	focusCell(rowIndex, column.key, 1, 0);
																}
																if (event.key === "ArrowUp") {
																	event.preventDefault();
																	commitStandardCell(rowIndex, column.key);
																	focusCell(rowIndex, column.key, -1, 0);
																}
																if (
																	event.key === "ArrowRight" &&
																	event.altKey
																) {
																	event.preventDefault();
																	commitStandardCell(rowIndex, column.key);
																	focusCell(rowIndex, column.key, 0, 1);
																}
																if (event.key === "ArrowLeft" && event.altKey) {
																	event.preventDefault();
																	commitStandardCell(rowIndex, column.key);
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
