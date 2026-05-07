import { normalizeSupportedNationalities } from "@/features/events/nationality-utils";
import Papa from "papaparse";
import {
	createDateNormalizationContext,
	normalizeCsvDate,
} from "../assembly/date-normalization";
import { CSV_EVENT_COLUMNS } from "./parser";

export interface EditableSheetColumn {
	key: string;
	label: string;
	isCore: boolean;
	isRequired: boolean;
}

export type EditableSheetRow = Record<string, string>;

const HIDDEN_EVENT_COLUMNS = [
	{
		key: "sourceConfirmed",
		label: "Source Confirmed",
		aliases: ["Details Confirmed", "Verified"],
	},
	{
		key: "detailsQualityOverride",
		label: "Details Quality Override",
		aliases: ["Review Status"],
	},
] as const;

const normalizeKey = (value: string): string => {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "")
		.slice(0, 64);
};

const toCsvValue = (value: string): string => {
	if (value.includes('"') || value.includes(",") || value.includes("\n")) {
		return `"${value.replaceAll('"', '""')}"`;
	}
	return value;
};

export const formatIsoDateForEditableSheet = (isoDate: string): string => {
	const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!match) return isoDate;
	return `${match[3]}-${match[2]}-${match[1]}`;
};

const CORE_COLUMN_LABELS: Record<(typeof CSV_EVENT_COLUMNS)[number], string> = {
	eventKey: "Event Key",
	curated: "Curated",
	hostCountry: "Host Country",
	audienceCountry: "Audience Country",
	title: "Title",
	date: "Date",
	startTime: "Start Time",
	endTime: "End Time",
	location: "Location",
	districtArea: "District/Area",
	categories: "Categories",
	tags: "Tags",
	price: "Price",
	primaryUrl: "Primary URL",
	ageGuidance: "Age Guidance",
	setting: "Setting",
	notes: "Notes",
};

const REQUIRED_CORE_COLUMNS = new Set<string>(["title", "date"]);
const REQUIRED_CORE_COLUMN_KEYS = ["title", "date"] as const;
const LEGACY_FEATURED_COLUMN_KEY = "featured";
const CORE_COLUMN_SET = new Set<string>(CSV_EVENT_COLUMNS);
const HIDDEN_EVENT_COLUMN_SET = new Set<string>(
	HIDDEN_EVENT_COLUMNS.map((column) => column.key),
);
const COUNTRY_COLUMN_KEYS = new Set<string>(["hostCountry", "audienceCountry"]);
const TIME_COLUMN_KEYS = new Set<string>(["startTime", "endTime"]);
const DEFAULT_UNKNOWN_TIME_HOUR = 23;
const DEFAULT_UNKNOWN_TIME_MINUTE = 59;

const CORE_HEADER_LOOKUP = new Map<string, string>(
	CSV_EVENT_COLUMNS.flatMap((key) => [
		[normalizeKey(key), key],
		[normalizeKey(CORE_COLUMN_LABELS[key]), key],
	]),
);

const isCoreKey = (key: string): boolean => CORE_COLUMN_SET.has(key);
const isHiddenEventKey = (key: string): boolean =>
	HIDDEN_EVENT_COLUMN_SET.has(key);

const resolveCoreKeyFromHeader = (header: string): string | null => {
	const normalized = normalizeKey(header);
	return CORE_HEADER_LOOKUP.get(normalized) ?? null;
};

const buildBlankRow = (columns: EditableSheetColumn[]): EditableSheetRow => {
	return Object.fromEntries(columns.map((column) => [column.key, ""]));
};

export const isEditableSheetRowEmpty = (row: EditableSheetRow): boolean =>
	Object.values(row).every((value) => value.trim().length === 0);

export const pruneEmptyEditableSheetRows = (
	rows: EditableSheetRow[],
): EditableSheetRow[] =>
	rows
		.map((row) => ({ ...row }))
		.filter((row) => !isEditableSheetRowEmpty(row));

export const normalizeEditableSheetRowValues = (
	row: EditableSheetRow,
	context?: ReturnType<typeof createDateNormalizationContext>,
): EditableSheetRow => {
	const nextRow = { ...row };
	if (context) {
		const normalizedDate = normalizeCsvDate(nextRow.date ?? "", context);
		if (normalizedDate.isoDate) {
			nextRow.date = formatIsoDateForEditableSheet(normalizedDate.isoDate);
		}
	}
	for (const key of COUNTRY_COLUMN_KEYS) {
		const rawValue = nextRow[key] ?? "";
		const normalized = normalizeSupportedNationalities(rawValue);
		if (normalized) {
			nextRow[key] = normalized;
		}
	}
	for (const key of TIME_COLUMN_KEYS) {
		nextRow[key] = normalizeEditableSheetTimeValue(nextRow[key] ?? "");
	}
	return nextRow;
};

const toUTCDateOnlyTime = (date: Date): number =>
	Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

const parseSortableTime = (rawTime: string): [number, number] => {
	const normalized = rawTime.trim().toLowerCase();
	if (!normalized || normalized === "tbc") {
		return [DEFAULT_UNKNOWN_TIME_HOUR, DEFAULT_UNKNOWN_TIME_MINUTE];
	}

	const period = normalized.match(/(am|pm)\s*$/)?.[1] ?? null;
	const isAM = period === "am";
	const isPM = period === "pm";
	const cleaned = normalized
		.replace(/\s+/g, "")
		.replace(/[.-]/g, ":")
		.replace(/h/g, ":")
		.replace(/[;,]/g, ":")
		.replace(/:+/g, ":")
		.replace(/:$/, "")
		.replace(/(am|pm)$/g, "");
	const [hoursText, minutesText = "0"] = cleaned.split(":");
	const parsedHours = Number.parseInt(hoursText, 10);
	const parsedMinutes = Number.parseInt(minutesText, 10);

	if (
		!Number.isFinite(parsedHours) ||
		!Number.isFinite(parsedMinutes) ||
		parsedHours < 0 ||
		parsedHours > 23 ||
		parsedMinutes < 0 ||
		parsedMinutes > 59
	) {
		return [DEFAULT_UNKNOWN_TIME_HOUR, DEFAULT_UNKNOWN_TIME_MINUTE];
	}

	let hours = parsedHours;
	if (isPM && hours !== 12) hours += 12;
	if (isAM && hours === 12) hours = 0;

	return [hours, parsedMinutes];
};

const normalizeEditableSheetTimeValue = (rawTime: string): string => {
	const trimmed = rawTime.trim();
	if (!trimmed) return "";

	const normalized = trimmed.toLowerCase();
	if (normalized === "tbc" || normalized === "tba") {
		return normalized.toUpperCase();
	}

	const period = normalized.match(/(am|pm)\s*$/)?.[1] ?? null;
	const isAM = period === "am";
	const isPM = period === "pm";
	const cleaned = normalized
		.replace(/\s+/g, "")
		.replace(/[.-]/g, ":")
		.replace(/h/g, ":")
		.replace(/[;,]/g, ":")
		.replace(/:+/g, ":")
		.replace(/:$/, "");
	const amPmMatch = cleaned.match(/^(\d{1,2}):?(\d{2})?(am|pm)$/);
	const time24Match = cleaned.match(/^(\d{1,2})(?::?(\d{2}))?$/);
	const match = amPmMatch ?? time24Match;
	if (!match) return trimmed;

	let hours = Number.parseInt(match[1], 10);
	const minutes = match[2] ? Number.parseInt(match[2], 10) : 0;
	if (
		!Number.isFinite(hours) ||
		!Number.isFinite(minutes) ||
		hours < 0 ||
		hours > 23 ||
		minutes < 0 ||
		minutes > 59
	) {
		return trimmed;
	}

	if (isPM && hours !== 12) hours += 12;
	if (isAM && hours === 12) hours = 0;

	return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
};

export const toEditableSheetRowSortableDateTime = (
	row: EditableSheetRow,
	context: ReturnType<typeof createDateNormalizationContext>,
): number | null => {
	const normalized = normalizeCsvDate(row.date ?? "", context);
	if (!normalized.isoDate) return null;

	const [hours, minutes] = parseSortableTime(row.startTime ?? "");
	const time = Date.parse(
		`${normalized.isoDate}T${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:00.000Z`,
	);
	return Number.isNaN(time) ? null : time;
};

const buildCoreColumns = (): EditableSheetColumn[] => {
	return CSV_EVENT_COLUMNS.map((key) => ({
		key,
		label: CORE_COLUMN_LABELS[key],
		isCore: true,
		isRequired: REQUIRED_CORE_COLUMNS.has(key),
	}));
};

export const createBlankEditableSheetRow = (
	columns: EditableSheetColumn[],
): EditableSheetRow => {
	return buildBlankRow(columns);
};

export const createCustomColumnKey = (
	label: string,
	existingColumns: EditableSheetColumn[],
): string => {
	const preferredBase = normalizeKey(label) || "custom_column";
	const base = isCoreKey(preferredBase)
		? `custom_${preferredBase}`
		: preferredBase;
	const existing = new Set(existingColumns.map((column) => column.key));
	if (!existing.has(base)) return base;

	let index = 2;
	while (existing.has(`${base}_${index}`)) {
		index += 1;
	}
	return `${base}_${index}`;
};

export const stripLegacyFeaturedColumn = (
	columns: EditableSheetColumn[],
	rows: EditableSheetRow[],
): {
	columns: EditableSheetColumn[];
	rows: EditableSheetRow[];
} => {
	const hasLegacyFeatured = columns.some(
		(column) => column.key === LEGACY_FEATURED_COLUMN_KEY,
	);
	if (!hasLegacyFeatured) {
		return {
			columns: columns.map((column) => ({ ...column })),
			rows: rows.map((row) => ({ ...row })),
		};
	}

	const nextColumns = columns
		.filter((column) => column.key !== LEGACY_FEATURED_COLUMN_KEY)
		.map((column) => ({ ...column }));
	const nextRows = rows.map((row) => {
		const nextRow = { ...row };
		delete nextRow[LEGACY_FEATURED_COLUMN_KEY];
		return nextRow;
	});

	return { columns: nextColumns, rows: nextRows };
};

export const sortEditableSheetRowsByDefaultDate = (
	rows: EditableSheetRow[],
	options: {
		referenceDate?: Date;
	} = {},
): EditableSheetRow[] => {
	const referenceDate = options.referenceDate ?? new Date();
	const today = toUTCDateOnlyTime(referenceDate);
	const context = createDateNormalizationContext(
		rows.map((row) => ({ date: row.date ?? "" })),
		{ referenceDate },
	);

	return rows
		.map((row, index) => ({
			row: { ...row },
			index,
			dateTime: toEditableSheetRowSortableDateTime(row, context),
		}))
		.sort((left, right) => {
			if (left.dateTime === null && right.dateTime === null) {
				return left.index - right.index;
			}
			if (left.dateTime === null) return 1;
			if (right.dateTime === null) return -1;

			const leftIsPast = left.dateTime < today;
			const rightIsPast = right.dateTime < today;
			if (leftIsPast !== rightIsPast) {
				return leftIsPast ? 1 : -1;
			}

			const direction = leftIsPast ? -1 : 1;
			const dateComparison = (left.dateTime - right.dateTime) * direction;
			return dateComparison || left.index - right.index;
		})
		.map((item) => item.row);
};

export const ensureCoreColumns = (
	columns: EditableSheetColumn[],
	rows: EditableSheetRow[],
): {
	columns: EditableSheetColumn[];
	rows: EditableSheetRow[];
} => {
	const stripped = stripLegacyFeaturedColumn(columns, rows);
	const nextColumns = [...stripped.columns];
	const nextRows = pruneEmptyEditableSheetRows(stripped.rows);
	const existingKeys = new Set(nextColumns.map((column) => column.key));

	for (const coreKey of CSV_EVENT_COLUMNS) {
		if (existingKeys.has(coreKey)) continue;
		nextColumns.push({
			key: coreKey,
			label: CORE_COLUMN_LABELS[coreKey],
			isCore: true,
			isRequired: REQUIRED_CORE_COLUMNS.has(coreKey),
		});
		for (const row of nextRows) {
			row[coreKey] = "";
		}
	}
	for (const row of nextRows) {
		for (const column of HIDDEN_EVENT_COLUMNS) {
			row[column.key] = row[column.key] ?? "";
		}
	}

	const normalizedColumns = nextColumns.map((column) => {
		if (!isCoreKey(column.key)) return column;
		return {
			key: column.key,
			label: CORE_COLUMN_LABELS[column.key as keyof typeof CORE_COLUMN_LABELS],
			isCore: true,
			isRequired: REQUIRED_CORE_COLUMNS.has(column.key),
		};
	});

	return {
		columns: normalizedColumns,
		rows: nextRows,
	};
};

export const validateEditableSheet = (
	columns: EditableSheetColumn[],
	rows: EditableSheetRow[],
): {
	valid: boolean;
	error?: string;
	columns: EditableSheetColumn[];
	rows: EditableSheetRow[];
} => {
	const normalized = ensureCoreColumns(columns, rows);

	for (const requiredKey of REQUIRED_CORE_COLUMNS) {
		if (!normalized.columns.some((column) => column.key === requiredKey)) {
			return {
				valid: false,
				error: `Missing required column: ${requiredKey}`,
				...normalized,
			};
		}
	}

	const hasPopulatedRow = normalized.rows.some((row) =>
		Object.values(row).some((value) => value.trim().length > 0),
	);
	if (!hasPopulatedRow) {
		return {
			valid: false,
			error: "At least one non-empty row is required",
			...normalized,
		};
	}

	const incompleteRowIndex = normalized.rows.findIndex((row) =>
		REQUIRED_CORE_COLUMN_KEYS.some(
			(requiredKey) => !String(row[requiredKey] ?? "").trim(),
		),
	);
	if (incompleteRowIndex >= 0) {
		const row = normalized.rows[incompleteRowIndex];
		const missingColumns = REQUIRED_CORE_COLUMN_KEYS.filter(
			(requiredKey) => !String(row[requiredKey] ?? "").trim(),
		).map((requiredKey) => CORE_COLUMN_LABELS[requiredKey]);
		return {
			valid: false,
			error: `Row ${incompleteRowIndex + 1} is missing required ${missingColumns.join(" and ")}.`,
			...normalized,
		};
	}

	return {
		valid: true,
		...normalized,
	};
};

export const csvToEditableSheet = (
	csvContent: string | null,
): {
	columns: EditableSheetColumn[];
	rows: EditableSheetRow[];
} => {
	if (!csvContent || csvContent.trim().length === 0) {
		const columns = buildCoreColumns();
		return { columns, rows: [buildBlankRow(columns)] };
	}

	const result = Papa.parse<Record<string, string>>(csvContent, {
		header: true,
		skipEmptyLines: "greedy",
		transform: (value: string) => value.trim(),
	});

	const rawHeaders = result.meta.fields || [];
	const columns: EditableSheetColumn[] = [];
	const usedKeys = new Set<string>();
	const headerMappings: { header: string; key: string }[] = [];

	for (const header of rawHeaders) {
		const coreKey = resolveCoreKeyFromHeader(header);
		const normalizedHeader = normalizeKey(header);
		const hiddenKey = HIDDEN_EVENT_COLUMNS.find(
			(column) =>
				normalizeKey(column.label) === normalizedHeader ||
				normalizeKey(column.key) === normalizedHeader ||
				column.aliases.some((alias) => normalizeKey(alias) === normalizedHeader),
		)?.key;
		let key = coreKey || hiddenKey || normalizedHeader || "custom_column";
		if (isCoreKey(key)) {
			key = key;
		} else if (usedKeys.has(key)) {
			let suffix = 2;
			while (usedKeys.has(`${key}_${suffix}`)) {
				suffix += 1;
			}
			key = `${key}_${suffix}`;
		}

		usedKeys.add(key);
		headerMappings.push({ header, key });
		if (!isHiddenEventKey(key)) {
			columns.push({
				key,
				label: coreKey
					? CORE_COLUMN_LABELS[coreKey as keyof typeof CORE_COLUMN_LABELS]
					: header,
				isCore: isCoreKey(key),
				isRequired: REQUIRED_CORE_COLUMNS.has(key),
			});
		}
	}

	const rows = result.data.map((rawRow) => {
		const row: EditableSheetRow = {};
		for (const mapping of headerMappings) {
			row[mapping.key] = rawRow[mapping.header] ?? "";
		}
		return row;
	});

	const normalized = ensureCoreColumns(columns, rows);
	return {
		columns: normalized.columns,
		rows:
			normalized.rows.length > 0
				? normalized.rows
				: [buildBlankRow(normalized.columns)],
	};
};

export const editableSheetToCsv = (
	columns: EditableSheetColumn[],
	rows: EditableSheetRow[],
): string => {
	const withoutLegacyFeatured = stripLegacyFeaturedColumn(columns, rows);
	const normalized = ensureCoreColumns(
		withoutLegacyFeatured.columns,
		pruneEmptyEditableSheetRows(withoutLegacyFeatured.rows),
	);
	const metadataColumns = HIDDEN_EVENT_COLUMNS.filter((column) =>
		normalized.rows.some((row) => String(row[column.key] ?? "").trim()),
	);
	const csvColumns = [...normalized.columns, ...metadataColumns];
	const context = createDateNormalizationContext(
		normalized.rows.map((row) => ({ date: row.date ?? "" })),
	);
	const headerLine = csvColumns
		.map((column) => toCsvValue(column.label))
		.join(",");
	const dataLines = normalized.rows.map((row) => {
		const normalizedRow = normalizeEditableSheetRowValues(row, context);
		return csvColumns
			.map((column) => toCsvValue(normalizedRow[column.key] ?? ""))
			.join(",");
	});

	return [headerLine, ...dataLines].join("\n").trim();
};
