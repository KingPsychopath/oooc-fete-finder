/**
 * Pure CSV Parsing Utilities
 *
 * This module contains only pure CSV parsing functionality using PapaParse.
 * All business logic, domain-specific transformations, and Event object creation
 * has been moved to lib/data-management/events/event-assembler.ts
 */

import Papa from "papaparse";
import { clientLog } from "@/lib/platform/client-logger";

export const CSV_EVENT_COLUMNS = [
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
	"featured",
] as const;

// Define the expected CSV column headers and their possible variations
const COLUMN_MAPPINGS = {
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
	genre: ["Genre", "Music Genre", "genre", "Type", "Music"],
	price: ["Price", "Cost", "price", "Ticket Price", "Entry"],
	ticketLink: ["Ticket Link", "Link", "ticketLink", "URL", "Website"],
	age: ["Age", "Age Limit", "age", "Age Restriction"],
	indoorOutdoor: [
		"Indoor/Outdoor",
		"Indoor Outdoor",
		"Venue Type",
		"indoorOutdoor",
		"Type",
	],
	notes: ["Notes", "Description", "notes", "Details", "Info"],
	featured: ["Featured", "featured", "Feature", "Promoted", "Premium"],
} as const;

/**
 * Raw CSV row data as parsed by PapaParse - contains all columns as string values
 */
type RawCSVRow = Record<string, string>;

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
	/** Featured event indicator */
	featured: string;
};

/**
 * Finds the correct column name from a list of possible header variations.
 *
 * This function performs intelligent column matching by trying:
 * 1. Exact matches first
 * 2. Case-insensitive matches
 * 3. Partial/substring matches
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
const findColumnName = (
	headers: string[],
	possibleNames: readonly string[],
): string | null => {
	// Try exact matches first
	for (const possibleName of possibleNames) {
		const exactMatch = headers.find((header) => header.trim() === possibleName);
		if (exactMatch) return exactMatch;
	}

	// Try case-insensitive matches
	for (const possibleName of possibleNames) {
		const caseInsensitiveMatch = headers.find(
			(header) => header.trim().toLowerCase() === possibleName.toLowerCase(),
		);
		if (caseInsensitiveMatch) return caseInsensitiveMatch;
	}

	// Try partial matches
	for (const possibleName of possibleNames) {
		const partialMatch = headers.find(
			(header) =>
				header.trim().toLowerCase().includes(possibleName.toLowerCase()) ||
				possibleName.toLowerCase().includes(header.trim().toLowerCase()),
		);
		if (partialMatch) return partialMatch;
	}

	return null;
};

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
		oocPicks: findColumnName(headers, COLUMN_MAPPINGS.oocPicks),
		nationality: findColumnName(headers, COLUMN_MAPPINGS.nationality),
		name: findColumnName(headers, COLUMN_MAPPINGS.name),
		date: findColumnName(headers, COLUMN_MAPPINGS.date),
		startTime: findColumnName(headers, COLUMN_MAPPINGS.startTime),
		endTime: findColumnName(headers, COLUMN_MAPPINGS.endTime),
		location: findColumnName(headers, COLUMN_MAPPINGS.location),
		arrondissement: findColumnName(headers, COLUMN_MAPPINGS.arrondissement),
		genre: findColumnName(headers, COLUMN_MAPPINGS.genre),
		price: findColumnName(headers, COLUMN_MAPPINGS.price),
		ticketLink: findColumnName(headers, COLUMN_MAPPINGS.ticketLink),
		age: findColumnName(headers, COLUMN_MAPPINGS.age),
		indoorOutdoor: findColumnName(headers, COLUMN_MAPPINGS.indoorOutdoor),
		notes: findColumnName(headers, COLUMN_MAPPINGS.notes),
		featured: findColumnName(headers, COLUMN_MAPPINGS.featured),
	};

	return mapping;
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
 * - Intelligent column header matching with multiple naming variations
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

		if (parseResult.errors.length > 0) {
			// Filter out field mismatch errors for missing columns (they're not critical)
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

		const rawData = parseResult.data as Array<RawCSVRow | null | undefined>;
		const headers = (parseResult.meta.fields || [])
			.map((header) => String(header).trim())
			.filter((header) => header.length > 0);
		if (headers.length === 0) {
			throw new Error("CSV header row is missing or empty");
		}

		const columnMapping = createColumnMapping(headers);

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
			.filter((row): row is RawCSVRow => Boolean(row && typeof row === "object"))
			.map((row, index) => {
				const csvRow: CSVEventRow = {
					oocPicks:
						(columnMapping.oocPicks && row[columnMapping.oocPicks]) || "",
					nationality:
						(columnMapping.nationality && row[columnMapping.nationality]) || "",
					name: (columnMapping.name && row[columnMapping.name]) || "",
					date: (columnMapping.date && row[columnMapping.date]) || "",
					startTime:
						(columnMapping.startTime && row[columnMapping.startTime]) || "",
					endTime: (columnMapping.endTime && row[columnMapping.endTime]) || "",
					location: (columnMapping.location && row[columnMapping.location]) || "",
					arrondissement:
						(columnMapping.arrondissement && row[columnMapping.arrondissement]) ||
						"",
					genre: (columnMapping.genre && row[columnMapping.genre]) || "",
					price: (columnMapping.price && row[columnMapping.price]) || "",
					ticketLink:
						(columnMapping.ticketLink && row[columnMapping.ticketLink]) || "",
					age: (columnMapping.age && row[columnMapping.age]) || "",
					indoorOutdoor:
						(columnMapping.indoorOutdoor &&
							row[columnMapping.indoorOutdoor]) ||
						"",
					notes: (columnMapping.notes && row[columnMapping.notes]) || "",
					featured:
						(columnMapping.featured && row[columnMapping.featured]) || "",
				};

				return csvRow;
			})
			.filter((row) =>
				Object.values(row).some((value) => value.trim().length > 0),
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
