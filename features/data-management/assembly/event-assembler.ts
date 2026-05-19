/**
 * Event Assembler
 *
 * Orchestrates field transformers to assemble complete Event objects from CSV data.
 * This replaces the massive event-transformer.ts with a cleaner, more maintainable approach.
 */

import type { GenreTaxonomySnapshot } from "@/features/events/genre-normalization";
import {
	type Event,
	type ParisArrondissement,
	getEventTypeForDate,
	normalizeEventExperienceCategory,
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
	MetadataTransformers,
	NationalityTransformers,
	VenueTransformers,
	splitLocationList,
} from "./field-transformers";

const EVENT_KEY_FINGERPRINT_FIELDS: readonly (keyof CSVEventRow)[] = [
	"title",
	"date",
	"startTime",
	"location",
	"districtArea",
];

const parseSourceConfirmation = (value: string | undefined): boolean | null => {
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

type DetailsQuality = "complete" | "review" | "blocking";

const parseDetailsQualityOverride = (
	value: string | undefined,
): DetailsQuality | null => {
	if (!value) return null;
	const normalized = value.trim().toLowerCase();
	if (!normalized || normalized === "auto" || normalized === "inferred") {
		return null;
	}
	if (["complete", "details complete"].includes(normalized)) return "complete";
	if (
		[
			"review",
			"needs review",
			"details need review",
			"details may change",
		].includes(normalized)
	) {
		return "review";
	}
	if (["blocking", "blocked", "required"].includes(normalized)) {
		return "blocking";
	}
	return null;
};

const determineDetailsQuality = (
	csvRow: CSVEventRow,
	assembledFields: {
		arrondissement: ParisArrondissement;
		time: string;
		mainLink: string;
		normalizedDate: string;
	},
): {
	quality: DetailsQuality;
	source: "inferred" | "manual";
} => {
	const override = parseDetailsQualityOverride(csvRow.detailsQualityOverride);
	if (override) {
		return { quality: override, source: "manual" };
	}

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

	if (!csvRow.title.trim() || !hasValidDate) {
		return { quality: "blocking", source: "inferred" };
	}

	const coreDataComplete =
		hasValidLocation && hasValidArrondissement && hasValidDate;
	const detailCount = [hasValidTime, hasValidLink, hasValidPrice].filter(
		Boolean,
	).length;
	const hasEssentialDetails = detailCount >= 2;

	return {
		quality: coreDataComplete && hasEssentialDetails ? "complete" : "review",
		source: "inferred",
	};
};

export interface EventAssemblyOptions {
	dateNormalizationContext?: DateNormalizationContext;
	referenceDate?: Date;
	genreTaxonomy?: GenreTaxonomySnapshot;
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
	const hostCountries = NationalityTransformers.convertToNationality(
		csvRow.hostCountry,
	);
	const audienceCountries = NationalityTransformers.convertToNationality(
		csvRow.audienceCountry,
	);
	const genre = GenreTransformers.convertToMusicGenres(
		csvRow.categories,
		options.genreTaxonomy,
	);
	const tags = MetadataTransformers.parseTags(csvRow.tags);
	const venueTypes = VenueTransformers.convertToVenueTypes(csvRow.setting);
	const eventCategory =
		normalizeEventExperienceCategory(csvRow.eventCategory) ?? undefined;
	const locations = splitLocationList(csvRow.location);
	const location =
		arrondissement === "multiple-locations" && locations.length > 1
			? "Multiple locations"
			: csvRow.location.trim() || undefined;

	// Determine the event's festival phase from its date.
	const type = getEventTypeForDate(date);

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
	const detailsQuality = determineDetailsQuality(csvRow, {
		arrondissement,
		time,
		mainLink,
		normalizedDate: date,
	});
	const explicitConfirmation = parseSourceConfirmation(csvRow.sourceConfirmed);
	const sourceConfirmed = explicitConfirmation === true;

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
		location,
		locations: locations.length > 1 ? locations : undefined,
		link: mainLink,
		links: ticketLinks.length > 1 ? ticketLinks : undefined,
		description: csvRow.notes.trim() || undefined,
		type,
		eventCategory,
		genre,
		tags,
		venueTypes,
		indoor, // Legacy field
		detailsQuality: detailsQuality.quality,
		detailsQualitySource: detailsQuality.source,
		sourceConfirmed,
		price: csvRow.price.trim() || undefined,
		age: csvRow.ageGuidance.trim() || undefined,
		isOOOCPick,
		isFeatured,
		featuredAt,
		isPromoted,
		promotedAt,
		promotedEndsAt,
		nationality,
		hostCountries,
		audienceCountries,
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
