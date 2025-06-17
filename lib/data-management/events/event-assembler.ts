/**
 * Event Assembler
 *
 * Orchestrates field transformers to assemble complete Event objects from CSV data.
 * This replaces the massive event-transformer.ts with a cleaner, more maintainable approach.
 */

import type { Event, EventType, ParisArrondissement } from "@/types/events";
import type { CSVEventRow } from "../csv/parser";

// Import our focused transformers
import {
	BusinessLogicHelpers,
	DateTransformers,
	GenreTransformers,
	LocationTransformers,
	NationalityTransformers,
	VenueTransformers,
} from "./field-transformers";

/**
 * Generate a unique event ID from CSV row data
 */
const generateEventId = (csvRow: CSVEventRow, index: number): string => {
	const nameSlug = csvRow.name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.substring(0, 30);

	const dateSlug = csvRow.date.replace(/[^0-9]/g, "").substring(0, 8);

	return `${nameSlug}-${dateSlug}-${index}`;
};

/**
 * Determine event type based on name and time
 */
const determineEventType = (name: string, startTime: string): EventType => {
	return BusinessLogicHelpers.isAfterParty(name, startTime)
		? "After Party"
		: "Day Party";
};

/**
 * Process featured column to extract featured status and timestamp
 */
const processFeaturedColumn = (
	featuredStr: string,
	_eventName: string = "Unknown Event",
	_rowIndex: number = 0,
): { isFeatured: boolean; featuredAt?: string } => {
	if (!featuredStr || featuredStr.trim() === "") {
		return { isFeatured: false };
	}

	const cleaned = featuredStr.trim();

	// Simple boolean check for now - can be expanded
	const isFeatured =
		cleaned.toLowerCase() === "true" ||
		cleaned === "1" ||
		cleaned.toLowerCase() === "yes" ||
		cleaned.toLowerCase().includes("featured");

	// If it looks like a timestamp, use it
	const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[Z.]?/;
	const featuredAt = timestampPattern.test(cleaned) ? cleaned : undefined;

	return { isFeatured, featuredAt };
};

/**
 * Determine if an event should be considered "verified" based on data completeness
 */
const determineVerificationStatus = (csvRow: CSVEventRow, assembledFields: {
	arrondissement: ParisArrondissement;
	time: string;
	mainLink: string;
}): boolean => {
	// Core completeness criteria for verification
	const hasValidLocation = 
		csvRow.location !== undefined &&
		csvRow.location.trim() !== "" && 
		csvRow.location.toLowerCase() !== "tba" &&
		csvRow.location.toLowerCase() !== "tbc";
	
	const hasValidArrondissement = assembledFields.arrondissement !== "unknown";
	
	const hasValidTime = 
		assembledFields.time !== undefined &&
		assembledFields.time.trim() !== "" &&
		assembledFields.time.toLowerCase() !== "tbc";
	
	const hasValidLink = 
		assembledFields.mainLink !== undefined &&
		assembledFields.mainLink !== "#" && 
		assembledFields.mainLink.trim() !== "";
	
	const hasValidDate = 
		csvRow.date !== undefined &&
		csvRow.date.trim() !== "" && 
		csvRow.date.toLowerCase() !== "tbc";
	
	const hasValidPrice = 
		csvRow.price !== undefined &&
		csvRow.price.trim() !== "" && 
		csvRow.price.toLowerCase() !== "tbc" &&
		csvRow.price.toLowerCase() !== "tba";
	
	// Event is verified if it has:
	// 1. Valid location AND arrondissement
	// 2. Valid date
	// 3. At least two of: valid time, valid link, OR valid price
	const coreDataComplete = hasValidLocation && hasValidArrondissement && hasValidDate;
	const hasEssentialDetails = hasValidTime || hasValidLink || hasValidPrice;
	
	return coreDataComplete && hasEssentialDetails;
};

/**
 * Main event assembly function
 * Converts a CSV row into a complete Event object
 */
export const assembleEvent = (csvRow: CSVEventRow, index: number): Event => {
	// Generate unique ID
	const id = generateEventId(csvRow, index);

	// Transform individual fields using our focused transformers
	const day = DateTransformers.convertToEventDay(csvRow.date);
	const date = DateTransformers.convertToISODate(csvRow.date);
	const time = DateTransformers.convertToTime(csvRow.startTime);
	const endTime = DateTransformers.convertToTime(csvRow.endTime);

	const arrondissement = LocationTransformers.convertToArrondissement(
		csvRow.arrondissement,
		csvRow.location,
	);

	const nationality = NationalityTransformers.convertToNationality(
		csvRow.nationality,
	);
	const genre = GenreTransformers.convertToMusicGenres(csvRow.genre);
	const venueTypes = VenueTransformers.convertToVenueTypes(
		csvRow.indoorOutdoor,
	);

	// Determine event type
	const type = determineEventType(csvRow.name, time);

	// Process featured status
	const { isFeatured, featuredAt } = processFeaturedColumn(
		csvRow.featured,
		csvRow.name,
		index,
	);

	// Process ticket links
	const ticketLinks = BusinessLogicHelpers.processTicketLinks(
		csvRow.ticketLink,
		csvRow.name,
	);
	const mainLink = ticketLinks[0] || csvRow.ticketLink || "";

	// Determine OOOC pick status
	const isOOOCPick =
		csvRow.oocPicks.includes("🌟") ||
		csvRow.oocPicks.toLowerCase().includes("pick");

	// Handle legacy indoor field (backwards compatibility)
	const indoor = venueTypes.includes("indoor");

	// Assemble the complete event
	const event: Event = {
		id,
		name: csvRow.name.trim(),
		day,
		date,
		time: time || undefined,
		endTime: endTime || undefined,
		arrondissement,
		location: csvRow.location.trim() || undefined,
		link: mainLink,
		links: ticketLinks.length > 1 ? ticketLinks : undefined,
		description: csvRow.notes.trim() || undefined,
		type,
		genre,
		venueTypes,
		indoor, // Legacy field
		verified: determineVerificationStatus(csvRow, {
			arrondissement,
			time,
			mainLink,
		}),
		price: csvRow.price.trim() || undefined,
		age: csvRow.age.trim() || undefined,
		isOOOCPick,
		isFeatured,
		featuredAt,
		nationality,
	};

	return event;
};

/**
 * Batch processing function for multiple CSV rows
 */
export const assembleEvents = (csvRows: CSVEventRow[]): Event[] => {
	return csvRows.map((row, index) => assembleEvent(row, index));
};

/**
 * Event assembler with error handling and logging
 */
export const assembleEventSafely = (
	csvRow: CSVEventRow,
	index: number,
): Event | null => {
	try {
		return assembleEvent(csvRow, index);
	} catch (error) {
		console.error(`Error assembling event at row ${index}:`, error);
		console.error("CSV Row data:", csvRow);
		return null;
	}
};

/**
 * Batch processing with error handling
 */
export const assembleEventsSafely = (
	csvRows: CSVEventRow[],
): {
	events: Event[];
	errors: { index: number; error: string; csvRow: CSVEventRow }[];
} => {
	const events: Event[] = [];
	const errors: { index: number; error: string; csvRow: CSVEventRow }[] = [];

	for (let i = 0; i < csvRows.length; i++) {
		try {
			const event = assembleEvent(csvRows[i], i);
			events.push(event);
		} catch (error) {
			errors.push({
				index: i,
				error: error instanceof Error ? error.message : String(error),
				csvRow: csvRows[i],
			});
		}
	}

	return { events, errors };
};
