/**
 * Pure CSV Parsing Utilities
 *
 * This module contains only pure CSV parsing functionality using PapaParse.
 * All business logic, domain-specific transformations, and Event object creation
 * has been moved to lib/data-management/events/event-assembler.ts
 */

import { clientLog } from "@/lib/platform/client-logger";
import Papa from "papaparse";

export const CSV_EVENT_COLUMNS = [
	"eventKey",
	"oocPicks",
	"nationality",
	"name",
	"date",
	"startTime",
	"endTime",
	"location",
	"arrondissement",
	"genre",
	"price",
	"ticketLink",
	"age",
	"indoorOutdoor",
	"notes",
] as const;

// Define the expected CSV column headers and their possible variations
const COLUMN_MAPPINGS = {
	eventKey: ["Event Key", "eventKey", "Event ID", "eventId", "ID"],
	oocPicks: ["OOOC Picks", "OOC Picks", "oocPicks", "picks", "🌟"],
	nationality: [
		"GB/FR",
		"Host Country",
		"Country",
		"hostCountry",
		"Host",
		"Nationality",
	],
	name: ["Event Name", "Name", "name", "Event", "Title"],
	date: ["Date", "Day", "date", "Event Date"],
	startTime: ["Start Time", "Time", "startTime", "Start", "Event Time"],
	endTime: ["End Time", "endTime", "End", "Finish Time"],
	location: ["Location", "Venue", "location", "Place", "Address"],
	arrondissement: [
		"Arr",
		"Arr.",
		"Arrondissement",
		"arrondissement",
		"District",
	],
	genre: ["Genre", "Music Genre", "genre", "Music"],
	price: ["Price", "Cost", "price", "Ticket Price", "Entry"],
	ticketLink: ["Ticket Link", "Link", "ticketLink", "URL", "Website"],
	age: ["Age", "Age Limit", "age", "Age Restriction"],
	indoorOutdoor: [
		"Indoor/Outdoor",
		"Indoor Outdoor",
		"Venue Type",
		"indoorOutdoor",
	],
	notes: ["Notes", "Description", "notes", "Details", "Info"],
	verified: ["Verified", "verified", "Is Verified", "isVerified"],
} as const;

/**
 * Raw CSV row data as parsed by PapaParse - contains all columns as string values
 */
type RawCSVRow = Record<string, string>;

type StructuralParseError = {
	code: string;
	row?: number;
	message: string;
};

/**
 * Structured CSV event row type representing raw parsed CSV data.
 *
 * This type represents the standardized format of event data extracted from CSV files.
 * All fields are strings as they come directly from CSV parsing and require further
 * transformation and validation before being converted to Event objects.
 *
 * @example
 * ```typescript
 * const csvRow: CSVEventRow = {
 *   name: "Jazz Concert",
 *   date: "2024-01-15",
 *   startTime: "20:00",
 *   location: "Blue Note Paris",
 *   // ... other fields
 * };
 * ```
 */
export type CSVEventRow = {
	/** Immutable canonical event identifier used for deep links */
	eventKey: string;
	/** OOOC picks indicator - special events curated by the platform */
	oocPicks: string;
	/** Event nationality/host country (e.g., "GB", "FR") */
	nationality: string;
	/** Event name/title */
	name: string;
	/** Event date in string format */
	date: string;
	/** Event start time */
	startTime: string;
	/** Event end time */
	endTime: string;
	/** Venue location/address */
	location: string;
	/** Paris arrondissement or district */
	arrondissement: string;
	/** Music or event genre */
	genre: string;
	/** Ticket price information */
	price: string;
	/** Link to purchase tickets */
	ticketLink: string;
	/** Age restrictions or requirements */
	age: string;
	/** Indoor or outdoor venue type */
	indoorOutdoor: string;
	/** Additional notes or description */
	notes: string;
	/** Optional explicit verification override */
	verified?: string;
};

/**
 * Finds the correct column name from a list of possible header variations.
 *
 * This function performs deterministic alias matching:
 * 1. Normalize headers (case/spacing/punctuation agnostic)
 * 2. Match against known aliases only
 * 3. Fail fast on ambiguous/duplicate mappings
 *
 * @param headers - Array of actual CSV column headers
 * @param possibleNames - Array of possible column name variations to match against
 * @returns The matched column name from headers, or null if no match found
 *
 * @example
 * ```typescript
 * const headers = ["Event Name", "Date", "Venue"];
 * const result = findColumnName(headers, ["Name", "Event", "Title"]);
 * // Returns "Event Name"
 * ```
 */
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

/**
 * Creates a mapping between standardized field names and actual CSV column headers.
 *
 * This function analyzes the CSV headers and attempts to map them to our standardized
 * CSVEventRow field names using intelligent matching. It logs the mapping for debugging
 * purposes and handles cases where columns might be missing.
 *
 * @param headers - Array of actual CSV column headers from the parsed file
 * @returns Object mapping CSVEventRow field names to their corresponding CSV column headers
 *
 * @example
 * ```typescript
 * const headers = ["Event Name", "Date", "Venue"];
 * const mapping = createColumnMapping(headers);
 * // Returns: { name: "Event Name", date: "Date", location: "Venue", ... }
 * ```
 */
const createColumnMapping = (
	headers: string[],
): Record<keyof CSVEventRow, string | null> => {
	const mapping: Record<keyof CSVEventRow, string | null> = {
		eventKey: null,
		oocPicks: null,
		nationality: null,
		name: null,
		date: null,
		startTime: null,
		endTime: null,
		location: null,
		arrondissement: null,
		genre: null,
		price: null,
		ticketLink: null,
		age: null,
		indoorOutdoor: null,
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

	const missingFields = missingHeaders
		.map((header) => headerToField.get(header))
		.filter((field): field is keyof CSVEventRow => Boolean(field));
	if (missingFields.length !== missingHeaders.length) {
		return false;
	}

	return missingFields.every((field) => RECOVERABLE_TRAILING_FIELDS.has(field));
};

/**
 * Parses CSV content into structured CSVEventRow objects using PapaParse.
 *
 * This function performs pure CSV parsing without any business logic transformations.
 * It handles various CSV formats and column naming conventions, providing intelligent
 * column mapping and graceful error handling. The resulting CSVEventRow objects
 * contain raw string data that needs to be transformed into proper Event objects
 * using the event-assembler module.
 *
 * Features:
 * - Deterministic column header matching with strict aliasing
 * - Graceful handling of missing optional columns
 * - Validation of essential columns (name, date)
 * - Detailed logging for debugging and monitoring
 * - Error filtering to distinguish critical vs. informational issues
 *
 * @param csvContent - Raw CSV content as a string
 * @returns Array of CSVEventRow objects with standardized field names
 *
 * @throws {Error} When CSV parsing fails or essential columns are missing
 *
 * @example
 * ```typescript
 * const csvData = "Event Name,Date,Venue\nJazz Concert,2024-01-15,Blue Note";
 * const events = parseCSVContent(csvData);
 * // Returns: [{ name: "Jazz Concert", date: "2024-01-15", location: "Blue Note", ... }]
 * ```
 */
export const parseCSVContent = (csvContent: string): CSVEventRow[] => {
	try {
		const parseResult = Papa.parse(csvContent, {
			header: true,
			transform: (value: string) => value.trim(),
			// Handle variable column counts gracefully
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

		// Validate that we have at least the essential columns
		const essentialColumns = ["name", "date"] as const;
		const missingEssential = essentialColumns.filter(
			(col) => !columnMapping[col],
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
					oocPicks:
						(columnMapping.oocPicks && row[columnMapping.oocPicks]) || "",
					nationality:
						(columnMapping.nationality && row[columnMapping.nationality]) || "",
					name: (columnMapping.name && row[columnMapping.name]) || "",
					date: (columnMapping.date && row[columnMapping.date]) || "",
					startTime:
						(columnMapping.startTime && row[columnMapping.startTime]) || "",
					endTime: (columnMapping.endTime && row[columnMapping.endTime]) || "",
					location:
						(columnMapping.location && row[columnMapping.location]) || "",
					arrondissement:
						(columnMapping.arrondissement &&
							row[columnMapping.arrondissement]) ||
						"",
					genre: (columnMapping.genre && row[columnMapping.genre]) || "",
					price: (columnMapping.price && row[columnMapping.price]) || "",
					ticketLink:
						(columnMapping.ticketLink && row[columnMapping.ticketLink]) || "",
					age: (columnMapping.age && row[columnMapping.age]) || "",
					indoorOutdoor:
						(columnMapping.indoorOutdoor && row[columnMapping.indoorOutdoor]) ||
						"",
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
