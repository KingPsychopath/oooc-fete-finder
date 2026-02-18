import Papa from "papaparse";
import { CSV_EVENT_COLUMNS } from "./parser";

export interface EditableSheetColumn {
	key: string;
	label: string;
	isCore: boolean;
	isRequired: boolean;
}

export type EditableSheetRow = Record<string, string>;

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
const LEGACY_FEATURED_COLUMN_KEY = "featured";
const LEGACY_CORE_KEY_MAP = new Map<string, string>([
	["oocPicks", "curated"],
	["nationality", "hostCountry"],
	["name", "title"],
	["arrondissement", "districtArea"],
	["genre", "categories"],
	["ticketLink", "primaryUrl"],
	["age", "ageGuidance"],
	["indoorOutdoor", "setting"],
]);

const CORE_COLUMN_SET = new Set<string>(CSV_EVENT_COLUMNS);

const CORE_ALIAS_MAP = new Map<string, string>(
	[
		["event key", "eventKey"],
		["eventkey", "eventKey"],
		["event id", "eventKey"],
		["curated", "curated"],
		["ooc picks", "curated"],
		["oooc picks", "curated"],
		["oocpicks", "curated"],
		["host country", "hostCountry"],
		["hostcountry", "hostCountry"],
		["nationality", "hostCountry"],
		["gb/fr", "hostCountry"],
		["audience country", "audienceCountry"],
		["audiencecountry", "audienceCountry"],
		["title", "title"],
		["name", "title"],
		["start time", "startTime"],
		["end time", "endTime"],
		["arr", "districtArea"],
		["arr.", "districtArea"],
		["arrondissement", "districtArea"],
		["district area", "districtArea"],
		["districtarea", "districtArea"],
		["category", "categories"],
		["categories", "categories"],
		["genre", "categories"],
		["primary url", "primaryUrl"],
		["primaryurl", "primaryUrl"],
		["url", "primaryUrl"],
		["website", "primaryUrl"],
		["link", "primaryUrl"],
		["ticket link", "primaryUrl"],
		["ticketlink", "primaryUrl"],
		["age guidance", "ageGuidance"],
		["ageguidance", "ageGuidance"],
		["age", "ageGuidance"],
		["setting", "setting"],
		["venue type", "setting"],
		["indoor outdoor", "setting"],
		["indooroutdoor", "setting"],
	]
		.map(([left, right]) => [normalizeKey(left), right]),
);

const isCoreKey = (key: string): boolean => CORE_COLUMN_SET.has(key);

const resolveCoreKeyFromHeader = (header: string): string | null => {
	const normalized = normalizeKey(header);
	if (CORE_COLUMN_SET.has(normalized)) {
		return normalized;
	}

	const aliasHit = CORE_ALIAS_MAP.get(normalized);
	if (aliasHit) {
		return aliasHit;
	}

	for (const [coreKey, label] of Object.entries(CORE_COLUMN_LABELS)) {
		if (normalizeKey(label) === normalized) {
			return coreKey;
		}
	}

	return null;
};

const buildBlankRow = (columns: EditableSheetColumn[]): EditableSheetRow => {
	return Object.fromEntries(columns.map((column) => [column.key, ""]));
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
	const base = isCoreKey(preferredBase) ? `custom_${preferredBase}` : preferredBase;
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

const migrateLegacyCoreKeys = (
	columns: EditableSheetColumn[],
	rows: EditableSheetRow[],
): {
	columns: EditableSheetColumn[];
	rows: EditableSheetRow[];
} => {
	const remapKey = (key: string): string => LEGACY_CORE_KEY_MAP.get(key) ?? key;
	const seen = new Set<string>();

	const nextColumns: EditableSheetColumn[] = [];
	for (const column of columns) {
		const key = remapKey(column.key);
		if (seen.has(key)) continue;
		seen.add(key);
		nextColumns.push({
			...column,
			key,
		});
	}

	const nextRows = rows.map((row) => {
		const nextRow = { ...row };
		for (const [legacyKey, migratedKey] of LEGACY_CORE_KEY_MAP) {
			if (!(legacyKey in nextRow)) continue;
			const legacyValue = String(nextRow[legacyKey] ?? "");
			const migratedValue = String(nextRow[migratedKey] ?? "");
			if (!migratedValue.trim() && legacyValue.trim()) {
				nextRow[migratedKey] = legacyValue;
			} else if (!(migratedKey in nextRow)) {
				nextRow[migratedKey] = legacyValue;
			}
			delete nextRow[legacyKey];
		}
		return nextRow;
	});

	return { columns: nextColumns, rows: nextRows };
};

export const ensureCoreColumns = (
	columns: EditableSheetColumn[],
	rows: EditableSheetRow[],
): {
	columns: EditableSheetColumn[];
	rows: EditableSheetRow[];
} => {
	const migrated = migrateLegacyCoreKeys(columns, rows);
	const stripped = stripLegacyFeaturedColumn(migrated.columns, migrated.rows);
	const nextColumns = [...stripped.columns];
	const nextRows = stripped.rows.map((row) => ({ ...row }));
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
		let key = coreKey || normalizeKey(header) || "custom_column";
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
		columns.push({
			key,
			label: coreKey
				? CORE_COLUMN_LABELS[coreKey as keyof typeof CORE_COLUMN_LABELS]
				: header,
			isCore: isCoreKey(key),
			isRequired: REQUIRED_CORE_COLUMNS.has(key),
		});
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
		rows: normalized.rows.length > 0 ?
			normalized.rows : [buildBlankRow(normalized.columns)],
	};
};

export const editableSheetToCsv = (
	columns: EditableSheetColumn[],
	rows: EditableSheetRow[],
): string => {
	const withoutLegacyFeatured = stripLegacyFeaturedColumn(columns, rows);
	const normalized = ensureCoreColumns(
		withoutLegacyFeatured.columns,
		withoutLegacyFeatured.rows,
	);
	const csvColumns = normalized.columns;
	const headerLine = csvColumns.map((column) => toCsvValue(column.label)).join(",");
	const dataLines = normalized.rows.map((row) =>
		csvColumns.map((column) => toCsvValue(row[column.key] ?? "")).join(","),
	);

	return [headerLine, ...dataLines].join("\n").trim();
};
