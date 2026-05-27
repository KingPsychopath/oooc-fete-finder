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
	"seriesKey",
	"curated",
	"eventCategory",
	"hostCountry",
	"audienceCountry",
	"title",
	"date",
	"dateTo",
	"startTime",
	"endTime",
	"location",
	"area",
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
	seriesKey: ["Series Key", "seriesKey", "Event Series", "Series"],
	curated: ["Curated", "curated", "OOOC Picks", "OOOC Pick"],
	eventCategory: [
		"Event Category",
		"eventCategory",
		"Experience Category",
		"Experience Type",
		"Party / Activity",
		"Party or Activity",
	],
	hostCountry: ["Host Country", "hostCountry", "GB/FR"],
	audienceCountry: ["Audience Country", "audienceCountry"],
	title: ["Title", "title", "Name", "Event Name"],
	date: ["Date", "date"],
	dateTo: ["Date To", "Date To (End)", "Date Until", "End Date", "dateTo"],
	startTime: ["Start Time", "startTime", "Start time"],
	endTime: ["End Time", "endTime", "End time"],
	location: ["Location", "location"],
	locationAddress: ["Address", "Location Address", "locationAddress"],
	postalCode: ["Postal Code", "Postcode", "Code Postal", "postalCode"],
	city: ["City", "Ville", "city"],
	countryCode: ["Country Code", "countryCode"],
	area: [
		"Area",
		"District/Area",
		"area",
		"districtArea",
		"Arr.",
		"Arrondissement",
	],
	categories: ["Categories", "categories", "Genre", "Genres"],
	tags: ["Tags", "tags"],
	price: ["Price", "price"],
	primaryUrl: ["Primary URL", "primaryUrl", "Ticket link", "Ticket Link"],
	ageGuidance: ["Age Guidance", "ageGuidance", "Age"],
	setting: ["Setting", "setting", "Indoor/Outdoor"],
	notes: ["Notes", "notes"],
	sourceConfirmed: [
		"Source Confirmed",
		"sourceConfirmed",
		"Details Confirmed",
		"detailsConfirmed",
		"Verified",
		"verified",
	],
	detailsQualityOverride: [
		"Details Quality Override",
		"detailsQualityOverride",
		"Review Status",
	],
} as const;

type RawCSVRow = Record<string, string>;
type ColumnMapping = Record<keyof CSVEventRow, string[]>;

type StructuralParseError = {
	code: string;
	row?: number;
	message: string;
};

export type CSVEventRow = {
	eventKey: string;
	seriesKey?: string;
	curated: string;
	eventCategory?: string;
	hostCountry: string;
	audienceCountry: string;
	title: string;
	date: string;
	dateTo?: string;
	startTime: string;
	endTime: string;
	location: string;
	locationAddress?: string;
	postalCode?: string;
	city?: string;
	countryCode?: string;
	area: string;
	categories: string;
	tags: string;
	price: string;
	primaryUrl: string;
	ageGuidance: string;
	setting: string;
	notes: string;
	sourceConfirmed?: string;
	detailsQualityOverride?: string;
};

const normalizeHeaderKey = (value: string): string => {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
};

const stripGeneratedHeaderSuffix = (value: string): string =>
	value.replace(/\s+\d+$/, "");

const isGeneratedHeader = (header: string): boolean => {
	const normalized = normalizeHeaderKey(header);
	return stripGeneratedHeaderSuffix(normalized) !== normalized;
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

	for (const field of Object.keys(COLUMN_MAPPINGS) as Array<
		keyof CSVEventRow
	>) {
		appendAlias(field, field);
		for (const alias of COLUMN_MAPPINGS[field]) {
			appendAlias(alias, field);
		}
	}

	return lookup;
};

const HEADER_ALIAS_LOOKUP = buildAliasLookup();

const createColumnMapping = (headers: string[]): ColumnMapping => {
	const mapping: ColumnMapping = {
		eventKey: [],
		seriesKey: [],
		curated: [],
		eventCategory: [],
		hostCountry: [],
		audienceCountry: [],
		title: [],
		date: [],
		dateTo: [],
		startTime: [],
		endTime: [],
		location: [],
		locationAddress: [],
		postalCode: [],
		city: [],
		countryCode: [],
		area: [],
		categories: [],
		tags: [],
		price: [],
		primaryUrl: [],
		ageGuidance: [],
		setting: [],
		notes: [],
		sourceConfirmed: [],
		detailsQualityOverride: [],
	};
	const ambiguousHeaders: Array<{ header: string; fields: string[] }> = [];
	const duplicateFieldMatches: Array<{
		field: keyof CSVEventRow;
		headers: string[];
	}> = [];

	for (const header of headers) {
		const normalized = normalizeHeaderKey(header);
		if (!normalized) continue;
		const matches =
			HEADER_ALIAS_LOOKUP.get(normalized) ??
			HEADER_ALIAS_LOOKUP.get(stripGeneratedHeaderSuffix(normalized)) ??
			[];
		if (matches.length === 0) continue;
		if (matches.length > 1) {
			ambiguousHeaders.push({
				header,
				fields: matches.map((field) => field.toString()),
			});
			continue;
		}

		const field = matches[0];
		const mappedHeaders = mapping[field];
		if (mappedHeaders.length > 0) {
			const currentIsGenerated = isGeneratedHeader(header);
			const hasCanonicalHeader = mappedHeaders.some(
				(mappedHeader) => !isGeneratedHeader(mappedHeader),
			);
			if (currentIsGenerated) {
				mappedHeaders.push(header);
				continue;
			}
			if (!hasCanonicalHeader) {
				mappedHeaders.unshift(header);
				continue;
			}
			duplicateFieldMatches.push({
				field,
				headers: [mappedHeaders[0], header],
			});
			continue;
		}
		mappedHeaders.push(header);
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
	"dateTo",
	"locationAddress",
	"postalCode",
	"city",
	"countryCode",
	"notes",
	"sourceConfirmed",
	"detailsQualityOverride",
]);

const isRecoverableTooFewFieldsError = (
	error: StructuralParseError,
	rows: Array<RawCSVRow | null | undefined>,
	headers: string[],
	columnMapping: ColumnMapping,
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
		for (const mappedHeader of columnMapping[field]) {
			headerToField.set(mappedHeader, field);
		}
	}

	return missingHeaders.every((header) => {
		const field = headerToField.get(header);
		if (!field) return true;
		return RECOVERABLE_TRAILING_FIELDS.has(field);
	});
};

const getMappedValue = (
	row: RawCSVRow,
	columnMapping: ColumnMapping,
	field: keyof CSVEventRow,
): string => {
	for (const header of columnMapping[field]) {
		const value = row[header] ?? "";
		if (value.trim()) return value;
	}
	return "";
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
					!isRecoverableTooFewFieldsError(
						error,
						rawData,
						headers,
						columnMapping,
					),
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
			(column) => columnMapping[column].length === 0,
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
					eventKey: getMappedValue(row, columnMapping, "eventKey"),
					seriesKey: getMappedValue(row, columnMapping, "seriesKey"),
					curated: getMappedValue(row, columnMapping, "curated"),
					eventCategory: getMappedValue(row, columnMapping, "eventCategory"),
					hostCountry: getMappedValue(row, columnMapping, "hostCountry"),
					audienceCountry: getMappedValue(
						row,
						columnMapping,
						"audienceCountry",
					),
					title: getMappedValue(row, columnMapping, "title"),
					date: getMappedValue(row, columnMapping, "date"),
					dateTo: getMappedValue(row, columnMapping, "dateTo"),
					startTime: getMappedValue(row, columnMapping, "startTime"),
					endTime: getMappedValue(row, columnMapping, "endTime"),
					location: getMappedValue(row, columnMapping, "location"),
					locationAddress: getMappedValue(
						row,
						columnMapping,
						"locationAddress",
					),
					postalCode: getMappedValue(row, columnMapping, "postalCode"),
					city: getMappedValue(row, columnMapping, "city"),
					countryCode: getMappedValue(row, columnMapping, "countryCode"),
					area: getMappedValue(row, columnMapping, "area"),
					categories: getMappedValue(row, columnMapping, "categories"),
					tags: getMappedValue(row, columnMapping, "tags"),
					price: getMappedValue(row, columnMapping, "price"),
					primaryUrl: getMappedValue(row, columnMapping, "primaryUrl"),
					ageGuidance: getMappedValue(row, columnMapping, "ageGuidance"),
					setting: getMappedValue(row, columnMapping, "setting"),
					notes: getMappedValue(row, columnMapping, "notes"),
					sourceConfirmed: getMappedValue(
						row,
						columnMapping,
						"sourceConfirmed",
					),
					detailsQualityOverride: getMappedValue(
						row,
						columnMapping,
						"detailsQualityOverride",
					),
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
		clientLog.error(
			"csv-parser",
			"Error parsing CSV content",
			undefined,
			error,
		);
		throw new Error(
			`Failed to parse CSV: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
};
