/**
 * Event Assembler
 *
 * Orchestrates field transformers to assemble complete Event objects from CSV data.
 * This replaces the massive event-transformer.ts with a cleaner, more maintainable approach.
 */

import type {
	Event,
	EventType,
	ParisArrondissement,
} from "@/features/events/types";
import { log } from "@/lib/platform/logger";
import type { CSVEventRow } from "../csv/parser";
import { WarningSystem } from "../validation/date-warnings";
import {
	type DateNormalizationContext,
	type DateNormalizationWarning,
	createDateNormalizationContext,
	normalizeCsvDate,
} from "./date-normalization";
import {
	buildEventSlug,
	ensureUniqueEventKeys,
	generateEventKeyFromRow,
	normalizeEventKey,
} from "./event-key";

// Import our focused transformers
import {
	BusinessLogicHelpers,
	DateTransformers,
	GenreTransformers,
	LocationTransformers,
	NationalityTransformers,
	VenueTransformers,
} from "./field-transformers";

const EVENT_KEY_FINGERPRINT_FIELDS: readonly (keyof CSVEventRow)[] = [
	"title",
	"date",
	"startTime",
	"location",
	"districtArea",
];

/**
 * Determine event type based on name and time
 */
const determineEventType = (name: string, startTime: string): EventType => {
	return BusinessLogicHelpers.isAfterParty(name, startTime)
		? "After Party"
		: "Day Party";
};

const parseVerificationOverride = (
	value: string | undefined,
): boolean | null => {
	if (!value) return null;

	const normalized = value.trim().toLowerCase();
	if (!normalized) return null;

	if (["true", "yes", "y", "1", "verified"].includes(normalized)) {
		return true;
	}

	if (["false", "no", "n", "0", "unverified"].includes(normalized)) {
		return false;
	}

	return null;
};

/**
 * Determine if an event should be considered "verified" based on data completeness
 */
const determineVerificationStatus = (
	csvRow: CSVEventRow,
	assembledFields: {
		arrondissement: ParisArrondissement;
		time: string;
		mainLink: string;
		normalizedDate: string;
	},
): boolean => {
	const explicitVerification = parseVerificationOverride(csvRow.verified);
	if (explicitVerification !== null) {
		return explicitVerification;
	}

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
		assembledFields.normalizedDate !== undefined &&
		assembledFields.normalizedDate.trim() !== "" &&
		assembledFields.normalizedDate.toLowerCase() !== "tbc";

	const hasValidPrice =
		csvRow.price !== undefined &&
		csvRow.price.trim() !== "" &&
		csvRow.price.toLowerCase() !== "tbc" &&
		csvRow.price.toLowerCase() !== "tba";

	// Event is verified if it has:
	// 1. Valid location AND arrondissement
	// 2. Valid date
	// 3. At least two of: valid time, valid link, OR valid price
	const coreDataComplete =
		hasValidLocation && hasValidArrondissement && hasValidDate;
	const detailCount = [hasValidTime, hasValidLink, hasValidPrice].filter(
		Boolean,
	).length;
	const hasEssentialDetails = detailCount >= 2;

	return coreDataComplete && hasEssentialDetails;
};

export interface EventAssemblyOptions {
	dateNormalizationContext?: DateNormalizationContext;
	referenceDate?: Date;
}

const toWarningType = (
	warning: DateNormalizationWarning,
): "ambiguous" | "invalid" | "unparseable" | "inferred_year" => {
	return warning.type;
};

const emitDateWarning = (
	warning: DateNormalizationWarning,
	csvRow: CSVEventRow,
	index: number,
): void => {
	WarningSystem.addDateFormatWarning({
		originalValue: csvRow.date,
		eventName: csvRow.title,
		columnType: "date",
		warningType: toWarningType(warning),
		potentialFormats: {
			us: {
				date: warning.potentialFormats?.us ?? "",
				description: warning.potentialFormats?.us
					? "US-style interpretation"
					: "",
			},
			uk: {
				date: warning.potentialFormats?.uk ?? "",
				description: warning.potentialFormats?.uk
					? "UK-style interpretation"
					: "",
			},
			iso: warning.potentialFormats?.iso ?? "",
		},
		detectedFormat: warning.detectedFormat,
		recommendedAction: warning.recommendedAction,
		rowIndex: index + 2,
	});
};

/**
 * Main event assembly function
 * Converts a CSV row into a complete Event object
 */
export const assembleEvent = (
	csvRow: CSVEventRow,
	index: number,
	options: EventAssemblyOptions = {},
): Event => {
	const eventKey =
		normalizeEventKey(csvRow.eventKey) ??
		generateEventKeyFromRow(csvRow, {
			stableKeys: EVENT_KEY_FINGERPRINT_FIELDS,
			salt: index,
		});

	const dateContext =
		options.dateNormalizationContext ??
		createDateNormalizationContext([csvRow], {
			referenceDate: options.referenceDate,
		});
	const normalizedDate = normalizeCsvDate(csvRow.date, dateContext);
	if (normalizedDate.warning) {
		emitDateWarning(normalizedDate.warning, csvRow, index);
	}

	// Transform individual fields using our focused transformers
	const day = normalizedDate.day;
	const date = normalizedDate.isoDate;
	const time = DateTransformers.convertToTime(csvRow.startTime);
	const endTime = DateTransformers.convertToTime(csvRow.endTime);

	const arrondissement = LocationTransformers.convertToArrondissement(
		csvRow.districtArea,
		csvRow.location,
	);

	const nationalityInput = [csvRow.hostCountry, csvRow.audienceCountry]
		.map((value) => value.trim())
		.filter((value) => value.length > 0)
		.join(" / ");
	const nationality =
		NationalityTransformers.convertToNationality(nationalityInput);
	const genre = GenreTransformers.convertToMusicGenres(csvRow.categories);
	const venueTypes = VenueTransformers.convertToVenueTypes(csvRow.setting);

	// Determine event type
	const type = determineEventType(csvRow.title, time);

	// Featured state is managed through the dedicated scheduler service.
	const isFeatured = false;
	const featuredAt = undefined;
	const isPromoted = false;
	const promotedAt = undefined;
	const promotedEndsAt = undefined;

	// Process ticket links
	const ticketLinks = BusinessLogicHelpers.processTicketLinks(
		csvRow.primaryUrl,
		csvRow.title,
	);
	const mainLink = ticketLinks[0] || csvRow.primaryUrl || "";

	// Determine OOOC pick status
	const isOOOCPick =
		csvRow.curated.includes("🌟") ||
		csvRow.curated.toLowerCase().includes("pick");

	// Handle legacy indoor field (backwards compatibility)
	const indoor = venueTypes.includes("indoor");

	// Assemble the complete event
	const event: Event = {
		eventKey,
		slug: buildEventSlug(csvRow.title.trim()),
		id: eventKey,
		name: csvRow.title.trim(),
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
			normalizedDate: date,
		}),
		price: csvRow.price.trim() || undefined,
		age: csvRow.ageGuidance.trim() || undefined,
		isOOOCPick,
		isFeatured,
		featuredAt,
		isPromoted,
		promotedAt,
		promotedEndsAt,
		nationality,
	};

	return event;
};

/**
 * Batch processing function for multiple CSV rows
 */
export const assembleEvents = (
	csvRows: CSVEventRow[],
	options: EventAssemblyOptions = {},
): Event[] => {
	const withEventKeys = ensureUniqueEventKeys(csvRows, {
		stableKeys: EVENT_KEY_FINGERPRINT_FIELDS,
	});
	const dateContext =
		options.dateNormalizationContext ??
		createDateNormalizationContext(withEventKeys.rows, {
			referenceDate: options.referenceDate,
		});
	return withEventKeys.rows.map((row, index) =>
		assembleEvent(row, index, {
			...options,
			dateNormalizationContext: dateContext,
		}),
	);
};

/**
 * Event assembler with error handling and logging
 */
export const assembleEventSafely = (
	csvRow: CSVEventRow,
	index: number,
	options: EventAssemblyOptions = {},
): Event | null => {
	try {
		return assembleEvent(csvRow, index, options);
	} catch (error) {
		log.error(
			"event-assembler",
			"Error assembling event row",
			{ rowIndex: index, csvRow },
			error,
		);
		return null;
	}
};

/**
 * Batch processing with error handling
 */
export const assembleEventsSafely = (
	csvRows: CSVEventRow[],
	options: EventAssemblyOptions = {},
): {
	events: Event[];
	errors: { index: number; error: string; csvRow: CSVEventRow }[];
} => {
	const events: Event[] = [];
	const errors: { index: number; error: string; csvRow: CSVEventRow }[] = [];
	const withEventKeys = ensureUniqueEventKeys(csvRows, {
		stableKeys: EVENT_KEY_FINGERPRINT_FIELDS,
	});
	const dateContext =
		options.dateNormalizationContext ??
		createDateNormalizationContext(withEventKeys.rows, {
			referenceDate: options.referenceDate,
		});

	for (let i = 0; i < csvRows.length; i++) {
		try {
			const event = assembleEvent(withEventKeys.rows[i], i, {
				...options,
				dateNormalizationContext: dateContext,
			});
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
