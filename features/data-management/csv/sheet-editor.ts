import { normalizeSupportedNationalities } from "@/features/events/nationality-utils";
import {
	formatEventExperienceCategory,
	normalizeEventExperienceCategory,
} from "@/features/events/types";
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

export const isPlainRecord = (
	value: unknown,
): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

export const isEditableSheetColumn = (
	value: unknown,
): value is EditableSheetColumn => {
	if (!isPlainRecord(value)) return false;
	return (
		typeof value.key === "string" &&
		typeof value.label === "string" &&
		typeof value.isCore === "boolean" &&
		typeof value.isRequired === "boolean"
	);
};

export const isEditableSheetRow = (
	value: unknown,
): value is EditableSheetRow => {
	if (!isPlainRecord(value)) return false;
	return Object.values(value).every((item) => typeof item === "string");
};

const HIDDEN_EVENT_COLUMNS = [
	{
		key: "locationAddress",
		label: "Address",
		aliases: ["Location Address"],
	},
	{
		key: "postalCode",
		label: "Postal Code",
		aliases: ["Postcode", "Code Postal"],
	},
	{
		key: "city",
		label: "City",
		aliases: ["Ville"],
	},
	{
		key: "countryCode",
		label: "Country Code",
		aliases: ["Location Country"],
	},
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
	seriesKey: "Series Key",
	curated: "Curated",
	eventCategory: "Event Category",
	hostCountry: "Host Country",
	audienceCountry: "Audience Country",
	title: "Title",
	date: "Date",
	dateTo: "Date To",
	startTime: "Start Time",
	endTime: "End Time",
	location: "Location",
	area: "Area",
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
const IDENTITY_COLUMN_ORDER = ["seriesKey", "eventKey"] as const;
const IDENTITY_COLUMN_SET = new Set<string>(IDENTITY_COLUMN_ORDER);
const HIDDEN_EVENT_COLUMN_SET = new Set<string>(
	HIDDEN_EVENT_COLUMNS.map((column) => column.key),
);
const HIDDEN_EVENT_HEADER_LOOKUP = new Map<string, string>(
	HIDDEN_EVENT_COLUMNS.flatMap((column) => [
		[normalizeKey(column.key), column.key],
		[normalizeKey(column.label), column.key],
		...column.aliases.map(
			(alias) => [normalizeKey(alias), column.key] as const,
		),
	]),
);
const COUNTRY_COLUMN_KEYS = new Set<string>(["hostCountry", "audienceCountry"]);
const TIME_COLUMN_KEYS = new Set<string>(["startTime", "endTime"]);
const DATE_COLUMN_KEYS = new Set<string>(["date", "dateTo"]);
const DEFAULT_UNKNOWN_TIME_HOUR = 23;
const DEFAULT_UNKNOWN_TIME_MINUTE = 59;
const SERIES_KEY_PATTERN = /^ser_[a-z0-9]{12,20}$/;

const CORE_HEADER_LOOKUP = new Map<string, string>(
	CSV_EVENT_COLUMNS.flatMap((key) => [
		[normalizeKey(key), key],
		[normalizeKey(CORE_COLUMN_LABELS[key]), key],
	]),
);
CORE_HEADER_LOOKUP.set(normalizeKey("District/Area"), "area");
CORE_HEADER_LOOKUP.set(normalizeKey("Arrondissement"), "area");
CORE_HEADER_LOOKUP.set(normalizeKey("districtArea"), "area");

const isCoreKey = (key: string): boolean => CORE_COLUMN_SET.has(key);
const isHiddenEventKey = (key: string): boolean =>
	HIDDEN_EVENT_COLUMN_SET.has(key);

const resolveCoreKeyFromHeader = (header: string): string | null => {
	const normalized = normalizeKey(header);
	return CORE_HEADER_LOOKUP.get(normalized) ?? null;
};

const stripGeneratedColumnSuffix = (value: string): string =>
	value.replace(/_\d+$/, "");

const resolveHiddenEventKeyFromHeader = (header: string): string | null => {
	const normalized = normalizeKey(header);
	return (
		HIDDEN_EVENT_HEADER_LOOKUP.get(normalized) ??
		HIDDEN_EVENT_HEADER_LOOKUP.get(stripGeneratedColumnSuffix(normalized)) ??
		null
	);
};

const resolveHiddenEventKeyFromColumn = (
	column: EditableSheetColumn,
): string | null =>
	resolveHiddenEventKeyFromHeader(column.key) ??
	resolveHiddenEventKeyFromHeader(column.label);

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
		for (const key of DATE_COLUMN_KEYS) {
			const value = nextRow[key] ?? "";
			if (!value.trim()) continue;
			const normalizedDate = normalizeCsvDate(value, context);
			if (normalizedDate.isoDate) {
				nextRow[key] = formatIsoDateForEditableSheet(normalizedDate.isoDate);
			}
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
	const eventCategory = normalizeEventExperienceCategory(
		nextRow.eventCategory ?? "",
	);
	if (eventCategory) {
		nextRow.eventCategory = formatEventExperienceCategory(eventCategory);
	}
	nextRow.postalCode = (nextRow.postalCode ?? "").trim().replace(/\s+/g, "");
	nextRow.city = (nextRow.city ?? "").trim().replace(/\s+/g, " ");
	const countryCode = (nextRow.countryCode ?? "").trim().toUpperCase();
	nextRow.countryCode = /^[A-Z]{2}$/.test(countryCode) ? countryCode : "";
	return nextRow;
};

const toUTCDateOnlyTime = (date: Date): number =>
	Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

const addDays = (isoDate: string, days: number): string => {
	const date = new Date(`${isoDate}T00:00:00.000Z`);
	date.setUTCDate(date.getUTCDate() + days);
	return date.toISOString().slice(0, 10);
};

const hashText = (value: string): string => {
	let hash = 0x811c9dc5;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}
	return (hash >>> 0).toString(16).padStart(8, "0");
};

export const normalizeEditableSheetSeriesKey = (
	value: string | null | undefined,
): string | null => {
	if (!value) return null;
	const normalized = value.trim().toLowerCase();
	return SERIES_KEY_PATTERN.test(normalized) ? normalized : null;
};

export const generateEditableSheetSeriesKey = (
	row: EditableSheetRow,
): string => {
	const fingerprint = [
		row.title,
		row.startTime,
		row.location,
		row.area,
		row.primaryUrl,
	]
		.map((value) =>
			String(value ?? "")
				.trim()
				.toLowerCase()
				.replace(/\s+/g, " "),
		)
		.join("|");
	return `ser_${hashText(`series|${fingerprint}`)}${hashText(fingerprint).slice(0, 8)}`;
};

export const getEditableSheetDateRangeDates = (
	row: EditableSheetRow,
	context: ReturnType<typeof createDateNormalizationContext>,
): string[] => {
	const start = normalizeCsvDate(row.date ?? "", context);
	if (!start.isoDate) return [];
	const endValue = String(row.dateTo ?? "").trim();
	if (!endValue) return [start.isoDate];
	const end = normalizeCsvDate(endValue, context);
	if (!end.isoDate || end.isoDate <= start.isoDate) return [start.isoDate];

	const dates: string[] = [];
	for (
		let cursor = start.isoDate;
		cursor <= end.isoDate;
		cursor = addDays(cursor, 1)
	) {
		dates.push(cursor);
	}
	return dates;
};

export const splitEditableSheetRangeRow = (
	rows: EditableSheetRow[],
	rowIndex: number,
	selectedDate?: string,
): EditableSheetRow[] => {
	const row = rows[rowIndex];
	if (!row) return rows.map((item) => ({ ...item }));
	const context = createDateNormalizationContext(
		rows.map((item) => ({ date: item.date ?? "", dateTo: item.dateTo ?? "" })),
	);
	const dates = getEditableSheetDateRangeDates(row, context);
	if (dates.length <= 1) return rows.map((item) => ({ ...item }));

	const chosenDate =
		selectedDate && dates.includes(selectedDate) ? selectedDate : null;
	const seriesKey =
		normalizeEditableSheetSeriesKey(row.seriesKey) ??
		generateEditableSheetSeriesKey(row);
	const makeRow = (
		startDate: string,
		endDate: string | null,
		eventKey: string,
	): EditableSheetRow => ({
		...row,
		eventKey,
		seriesKey,
		date: formatIsoDateForEditableSheet(startDate),
		dateTo:
			endDate && endDate !== startDate
				? formatIsoDateForEditableSheet(endDate)
				: "",
	});

	const replacementRows: EditableSheetRow[] = [];
	if (!chosenDate) {
		dates.forEach((date, index) => {
			replacementRows.push(
				makeRow(date, null, index === 0 ? (row.eventKey ?? "") : ""),
			);
		});
	} else {
		const selectedIndex = dates.indexOf(chosenDate);
		if (selectedIndex > 0) {
			replacementRows.push(
				makeRow(dates[0], dates[selectedIndex - 1], row.eventKey ?? ""),
			);
		}
		replacementRows.push(
			makeRow(
				chosenDate,
				null,
				selectedIndex === 0 ? (row.eventKey ?? "") : "",
			),
		);
		if (selectedIndex < dates.length - 1) {
			replacementRows.push(
				makeRow(dates[selectedIndex + 1], dates.at(-1) ?? "", ""),
			);
		}
	}

	return [
		...rows.slice(0, rowIndex).map((item) => ({ ...item })),
		...replacementRows,
		...rows.slice(rowIndex + 1).map((item) => ({ ...item })),
	];
};

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

const getSheetCoreColumnOrder = (): Array<
	(typeof CSV_EVENT_COLUMNS)[number]
> => [
	...CSV_EVENT_COLUMNS.filter((key) => !IDENTITY_COLUMN_SET.has(key)),
	...IDENTITY_COLUMN_ORDER,
];

const orderEditableSheetColumns = (
	columns: EditableSheetColumn[],
): EditableSheetColumn[] => {
	const identityColumns = new Map(
		IDENTITY_COLUMN_ORDER.map((key) => [
			key,
			columns.find((column) => column.key === key),
		]),
	);
	return [
		...columns
			.filter((column) => !IDENTITY_COLUMN_SET.has(column.key))
			.map((column) => ({ ...column })),
		...IDENTITY_COLUMN_ORDER.flatMap((key) => {
			const column = identityColumns.get(key);
			return column ? [{ ...column }] : [];
		}),
	];
};

const buildCoreColumns = (): EditableSheetColumn[] => {
	return getSheetCoreColumnOrder().map((key) => ({
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

const absorbHiddenMetadataColumns = (
	columns: EditableSheetColumn[],
	rows: EditableSheetRow[],
): {
	columns: EditableSheetColumn[];
	rows: EditableSheetRow[];
} => {
	const nextRows = rows.map((row) => ({ ...row }));
	const nextColumns: EditableSheetColumn[] = [];

	for (const column of columns) {
		const hiddenKey = resolveHiddenEventKeyFromColumn(column);
		if (!hiddenKey) {
			nextColumns.push({ ...column });
			continue;
		}

		for (const row of nextRows) {
			const sourceValue = String(row[column.key] ?? "");
			const canonicalValue = String(row[hiddenKey] ?? "");
			if (!canonicalValue.trim() && sourceValue.trim()) {
				row[hiddenKey] = sourceValue;
			} else {
				row[hiddenKey] = canonicalValue;
			}
			if (column.key !== hiddenKey) {
				delete row[column.key];
			}
		}
	}

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
		rows.map((row) => ({
			date: row.date ?? "",
			dateTo: row.dateTo ?? "",
		})),
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
	const absorbed = absorbHiddenMetadataColumns(stripped.columns, stripped.rows);
	const nextColumns = [...absorbed.columns];
	const nextRows = pruneEmptyEditableSheetRows(absorbed.rows);
	const existingKeys = new Set(nextColumns.map((column) => column.key));

	for (const coreKey of getSheetCoreColumnOrder()) {
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
		columns: orderEditableSheetColumns(normalizedColumns),
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
		const hiddenKey = resolveHiddenEventKeyFromHeader(header);
		let key = coreKey || hiddenKey || normalizedHeader || "custom_column";
		if (isCoreKey(key)) {
			key = key;
		} else if (isHiddenEventKey(key)) {
			key = hiddenKey ?? key;
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
			const value = rawRow[mapping.header] ?? "";
			if (
				isHiddenEventKey(mapping.key) &&
				String(row[mapping.key] ?? "").trim()
			) {
				continue;
			}
			row[mapping.key] = value;
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
		normalized.rows.map((row) => ({
			date: row.date ?? "",
			dateTo: row.dateTo ?? "",
		})),
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
