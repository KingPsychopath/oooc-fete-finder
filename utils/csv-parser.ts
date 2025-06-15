/**
 * Pure CSV Parsing Utilities
 * 
 * This module contains only pure CSV parsing functionality using PapaParse.
 * All business logic, domain-specific transformations, and Event object creation
 * has been moved to lib/data-management/event-transformer.ts
 */

import Papa from "papaparse";

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

// Type for raw CSV row data
type RawCSVRow = Record<string, string>;

// Enhanced CSV event row type - represents raw parsed CSV data
export type CSVEventRow = {
	oocPicks: string;
	nationality: string;
	name: string;
	date: string;
	startTime: string;
	endTime: string;
	location: string;
	arrondissement: string;
	genre: string;
	price: string;
	ticketLink: string;
	age: string;
	indoorOutdoor: string;
	notes: string;
	featured: string;
};

/**
 * Find the correct column name from possible variations
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
 * Create column mapping from CSV headers
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

	// Log mapping for debugging
	console.log("CSV Column Mapping:", mapping);

	return mapping;
};

/**
 * Parse CSV content into CSVEventRow objects using papaparse
 * 
 * This function performs pure CSV parsing without any business logic transformations.
 * The resulting CSVEventRow objects contain raw string data that needs to be transformed
 * into proper Event objects using the event-transformer module.
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
				console.warn("Critical CSV parsing errors:", criticalErrors);
			}

			// Log field mismatch errors as info rather than warnings
			const fieldErrors = parseResult.errors.filter(
				(error) =>
					error.code === "TooFewFields" || error.code === "TooManyFields",
			);

			if (fieldErrors.length > 0) {
				console.log(
					`ℹ️ ${fieldErrors.length} rows have missing columns (this is normal if your sheet doesn't have all optional columns)`,
				);
			}
		}

		const rawData = parseResult.data as RawCSVRow[];
		const headers = Object.keys(rawData[0] || {});
		console.log("CSV Headers found:", headers);

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

		return rawData.map((row: RawCSVRow, index: number) => {
			const csvRow: CSVEventRow = {
				oocPicks: (columnMapping.oocPicks && row[columnMapping.oocPicks]) || "",
				nationality:
					(columnMapping.nationality && row[columnMapping.nationality]) || "",
				name:
					(columnMapping.name && row[columnMapping.name]) ||
					`Event ${index + 1}`,
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
					(columnMapping.indoorOutdoor && row[columnMapping.indoorOutdoor]) ||
					"",
				// Handle missing notes column gracefully
				notes: (columnMapping.notes && row[columnMapping.notes]) || "",
				// Handle missing featured column gracefully
				featured: (columnMapping.featured && row[columnMapping.featured]) || "",
			};

			// Log first few rows for debugging
			if (index < 3) {
				console.log(`CSV Row ${index + 1}:`, csvRow);
				// Special debug for featured field
				if (csvRow.featured) {
					console.log(`📅 Row ${index + 1} featured: "${csvRow.featured}"`);
				}
			}

			return csvRow;
		});
	} catch (error) {
		console.error("Error parsing CSV content:", error);
		throw new Error(
			`Failed to parse CSV: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
};
