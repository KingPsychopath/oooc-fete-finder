/**
 * Pure CSV Parsing Utilities
 *
 * This module contains only pure CSV parsing functionality using PapaParse.
 * All business logic, domain-specific transformations, and Event object creation
 * is handled by the data-management assembly pipeline.
 */

import { clientLog } from "@/lib/platform/client-logger";
import Papa from "papaparse";

export const CSV_EVENT_COLUMNS = [
	"eventKey",
	"curated",
	"hostCountry",
	"audienceCountry",
	"title",
	"date",
	"startTime",
	"endTime",
	"location",
	"districtArea",
	"categories",
	"tags",
	"price",
	"primaryUrl",
	"ageGuidance",
	"setting",
	"notes",
] as const;

const COLUMN_MAPPINGS = {
	eventKey: ["Event Key", "eventKey"],
	curated: ["Curated", "curated"],
	hostCountry: ["Host Country", "hostCountry"],
	audienceCountry: ["Audience Country", "audienceCountry"],
	title: ["Title", "title"],
	date: ["Date", "date"],
	startTime: ["Start Time", "startTime"],
	endTime: ["End Time", "endTime"],
	location: ["Location", "location"],
	districtArea: ["District/Area", "districtArea"],
	categories: ["Categories", "categories"],
	tags: ["Tags", "tags"],
	price: ["Price", "price"],
	primaryUrl: ["Primary URL", "primaryUrl"],
	ageGuidance: ["Age Guidance", "ageGuidance"],
	setting: ["Setting", "setting"],
	notes: ["Notes", "notes"],
	verified: ["Verified", "verified"],
} as const;

type RawCSVRow = Record<string, string>;

type StructuralParseError = {
	code: string;
	row?: number;
	message: string;
};

export type CSVEventRow = {
	eventKey: string;
	curated: string;
	hostCountry: string;
	audienceCountry: string;
	title: string;
	date: string;
	startTime: string;
	endTime: string;
	location: string;
	districtArea: string;
	categories: string;
	tags: string;
	price: string;
	primaryUrl: string;
	ageGuidance: string;
	setting: string;
	notes: string;
	verified?: string;
};

const normalizeHeaderKey = (value: string): string => {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
};

const buildAliasLookup = (): Map<string, Array<keyof CSVEventRow>> => {
	const lookup = new Map<string, Array<keyof CSVEventRow>>();

	const appendAlias = (alias: string, field: keyof CSVEventRow): void => {
		const normalized = normalizeHeaderKey(alias);
		if (!normalized) return;
		const existing = lookup.get(normalized) ?? [];
		if (!existing.includes(field)) {
			lookup.set(normalized, [...existing, field]);
		}
	};

	for (const field of Object.keys(COLUMN_MAPPINGS) as Array<keyof CSVEventRow>) {
		appendAlias(field, field);
		for (const alias of COLUMN_MAPPINGS[field]) {
			appendAlias(alias, field);
		}
	}

	return lookup;
};

const HEADER_ALIAS_LOOKUP = buildAliasLookup();

const createColumnMapping = (
	headers: string[],
): Record<keyof CSVEventRow, string | null> => {
	const mapping: Record<keyof CSVEventRow, string | null> = {
		eventKey: null,
		curated: null,
		hostCountry: null,
		audienceCountry: null,
		title: null,
		date: null,
		startTime: null,
		endTime: null,
		location: null,
		districtArea: null,
		categories: null,
		tags: null,
		price: null,
		primaryUrl: null,
		ageGuidance: null,
		setting: null,
		notes: null,
		verified: null,
	};
	const ambiguousHeaders: Array<{ header: string; fields: string[] }> = [];
	const duplicateFieldMatches: Array<{
		field: keyof CSVEventRow;
		headers: string[];
	}> = [];

	for (const header of headers) {
		const normalized = normalizeHeaderKey(header);
		if (!normalized) continue;
		const matches = HEADER_ALIAS_LOOKUP.get(normalized) ?? [];
		if (matches.length === 0) continue;
		if (matches.length > 1) {
			ambiguousHeaders.push({
				header,
				fields: matches.map((field) => field.toString()),
			});
			continue;
		}

		const field = matches[0];
		if (mapping[field] && mapping[field] !== header) {
			duplicateFieldMatches.push({
				field,
				headers: [mapping[field] as string, header],
			});
			continue;
		}
		mapping[field] = header;
	}

	if (ambiguousHeaders.length > 0) {
		const summary = ambiguousHeaders
			.slice(0, 3)
			.map((entry) => `"${entry.header}" -> ${entry.fields.join("/")}`)
			.join("; ");
		throw new Error(
			`Ambiguous CSV headers detected. Rename conflicting columns: ${summary}`,
		);
	}

	if (duplicateFieldMatches.length > 0) {
		const summary = duplicateFieldMatches
			.slice(0, 3)
			.map(
				(entry) =>
					`field "${entry.field}" matched by ${entry.headers
						.map((value) => `"${value}"`)
						.join(" and ")}`,
			)
			.join("; ");
		throw new Error(`Duplicate CSV column mappings detected: ${summary}`);
	}

	return mapping;
};

const RECOVERABLE_TRAILING_FIELDS = new Set<keyof CSVEventRow>([
	"notes",
	"verified",
]);

const isRecoverableTooFewFieldsError = (
	error: StructuralParseError,
	rows: Array<RawCSVRow | null | undefined>,
	headers: string[],
	columnMapping: Record<keyof CSVEventRow, string | null>,
): boolean => {
	if (error.code !== "TooFewFields" || typeof error.row !== "number") {
		return false;
	}

	const row = rows[error.row];
	if (!row || typeof row !== "object") {
		return false;
	}

	if ("__parsed_extra" in row && Array.isArray(row.__parsed_extra)) {
		return false;
	}

	const missingHeaders = headers.filter((header) => row[header] === undefined);
	if (missingHeaders.length === 0) {
		return false;
	}

	const missingIndices = missingHeaders
		.map((header) => headers.indexOf(header))
		.filter((index) => index >= 0)
		.sort((left, right) => left - right);
	if (missingIndices.length === 0) {
		return false;
	}

	const firstMissing = missingIndices[0];
	const lastMissing = missingIndices[missingIndices.length - 1];
	const isContiguousTail =
		lastMissing === headers.length - 1 &&
		missingIndices.every((index, offset) => index === firstMissing + offset);
	if (!isContiguousTail) {
		return false;
	}

	const headerToField = new Map<string, keyof CSVEventRow>();
	for (const field of Object.keys(columnMapping) as Array<keyof CSVEventRow>) {
		const mappedHeader = columnMapping[field];
		if (mappedHeader) {
			headerToField.set(mappedHeader, field);
		}
	}

	return missingHeaders.every((header) => {
		const field = headerToField.get(header);
		if (!field) return true;
		return RECOVERABLE_TRAILING_FIELDS.has(field);
	});
};

export const parseCSVContent = (csvContent: string): CSVEventRow[] => {
	try {
		const parseResult = Papa.parse(csvContent, {
			header: true,
			transform: (value: string) => value.trim(),
			dynamicTyping: false,
			skipEmptyLines: "greedy",
		});

		const rawData = parseResult.data as Array<RawCSVRow | null | undefined>;
		const headers = (parseResult.meta.fields || [])
			.map((header) => String(header).trim())
			.filter((header) => header.length > 0);
		if (headers.length === 0) {
			throw new Error("CSV header row is missing or empty");
		}

		const columnMapping = createColumnMapping(headers);

		if (parseResult.errors.length > 0) {
			const fieldMismatchErrors = parseResult.errors.filter(
				(error) =>
					error.code === "TooFewFields" || error.code === "TooManyFields",
			);
			const unrecoverableFieldMismatchErrors = fieldMismatchErrors.filter(
				(error) =>
					!isRecoverableTooFewFieldsError(error, rawData, headers, columnMapping),
			);
			const recoveredCount =
				fieldMismatchErrors.length - unrecoverableFieldMismatchErrors.length;

			if (unrecoverableFieldMismatchErrors.length > 0) {
				const rowSummary = unrecoverableFieldMismatchErrors
					.slice(0, 5)
					.map((error) => {
						const rowNumber =
							typeof error.row === "number" ? error.row + 1 : null;
						return rowNumber ? `row ${rowNumber}` : "unknown row";
					})
					.join(", ");
				throw new Error(
					`CSV row structure mismatch in ${unrecoverableFieldMismatchErrors.length} row(s) (${rowSummary}). Ensure each row has the same number of columns as the header.`,
				);
			}

			if (recoveredCount > 0) {
				clientLog.warn(
					"csv-parser",
					"Recovered CSV rows with missing trailing optional columns",
					{ recoveredCount },
				);
			}

			const criticalErrors = parseResult.errors.filter(
				(error) =>
					error.code !== "TooFewFields" && error.code !== "TooManyFields",
			);
			if (criticalErrors.length > 0) {
				clientLog.warn("csv-parser", "Critical CSV parsing errors", {
					criticalErrors,
				});
			}
		}

		const essentialColumns = ["title", "date"] as const;
		const missingEssential = essentialColumns.filter(
			(column) => !columnMapping[column],
		);
		if (missingEssential.length > 0) {
			throw new Error(
				`Missing essential CSV columns: ${missingEssential.join(", ")}. Available headers: ${headers.join(", ")}`,
			);
		}

		const normalizedRows = rawData
			.filter((row): row is RawCSVRow =>
				Boolean(row && typeof row === "object"),
			)
			.map((row) => {
				const csvRow: CSVEventRow = {
					eventKey:
						(columnMapping.eventKey && row[columnMapping.eventKey]) || "",
					curated: (columnMapping.curated && row[columnMapping.curated]) || "",
					hostCountry:
						(columnMapping.hostCountry && row[columnMapping.hostCountry]) || "",
					audienceCountry:
						(columnMapping.audienceCountry &&
							row[columnMapping.audienceCountry]) ||
						"",
					title: (columnMapping.title && row[columnMapping.title]) || "",
					date: (columnMapping.date && row[columnMapping.date]) || "",
					startTime:
						(columnMapping.startTime && row[columnMapping.startTime]) || "",
					endTime: (columnMapping.endTime && row[columnMapping.endTime]) || "",
					location:
						(columnMapping.location && row[columnMapping.location]) || "",
					districtArea:
						(columnMapping.districtArea && row[columnMapping.districtArea]) ||
						"",
					categories:
						(columnMapping.categories && row[columnMapping.categories]) || "",
					tags: (columnMapping.tags && row[columnMapping.tags]) || "",
					price: (columnMapping.price && row[columnMapping.price]) || "",
					primaryUrl:
						(columnMapping.primaryUrl && row[columnMapping.primaryUrl]) || "",
					ageGuidance:
						(columnMapping.ageGuidance && row[columnMapping.ageGuidance]) || "",
					setting: (columnMapping.setting && row[columnMapping.setting]) || "",
					notes: (columnMapping.notes && row[columnMapping.notes]) || "",
					verified:
						(columnMapping.verified && row[columnMapping.verified]) || "",
				};
				return csvRow;
			})
			.filter((row) =>
				Object.values(row).some((value) => (value || "").trim().length > 0),
			);

		if (normalizedRows.length === 0) {
			throw new Error("CSV contains no non-empty data rows");
		}

		return normalizedRows;
	} catch (error) {
		clientLog.error("csv-parser", "Error parsing CSV content", undefined, error);
		throw new Error(
			`Failed to parse CSV: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
};
