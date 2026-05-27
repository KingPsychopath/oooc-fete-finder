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
import {
	deriveAreaFromPostalCodeCity,
	normalizeCity,
	normalizeCountryCode,
	normalizePostalCode,
} from "@/features/locations/location-utils";
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
	generateSeriesKeyFromRow,
	normalizeEventKey,
	normalizeSeriesKey,
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
	splitAreaList,
	splitLocationList,
	splitLocationMetadataList,
} from "./field-transformers";

const EVENT_KEY_FINGERPRINT_FIELDS: readonly (keyof CSVEventRow)[] = [
	"title",
	"date",
	"startTime",
	"location",
	"area",
];
const SERIES_KEY_FINGERPRINT_FIELDS: readonly (keyof CSVEventRow)[] = [
	"title",
	"startTime",
	"location",
	"area",
	"primaryUrl",
];

type DateWarningColumnType = "date" | "dateTo";
type NormalizedDate = ReturnType<typeof normalizeCsvDate>;

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
	columnType: DateWarningColumnType = "date",
	originalValue: string = csvRow.date,
): void => {
	WarningSystem.addDateFormatWarning({
		originalValue,
		eventName: csvRow.title,
		columnType,
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

const buildEmptyDateWarning = (): DateNormalizationWarning => ({
	type: "unparseable",
	detectedFormat: "empty",
	message: "Date value is empty.",
	recommendedAction: "Provide a valid event date in the Date column.",
});

const buildInvalidDatePlaceholder = (): NormalizedDate => ({
	isoDate: "",
	day: "tbc",
	year: null,
	usedInferredYear: false,
	warning: buildEmptyDateWarning(),
});

const uniqueKnownAreas = (
	areas: ParisArrondissement[],
): ParisArrondissement[] => {
	const seen = new Set<ParisArrondissement>();
	for (const area of areas) {
		if (area === "unknown" || area === "multiple-locations") continue;
		seen.add(area);
	}
	return [...seen];
};

const pickMetadataPart = (
	values: string[],
	index: number,
): string | undefined => {
	if (values.length === 0) return undefined;
	if (values.length === 1) return values[0];
	return values[index];
};

const normalizeDateColumnValue = (
	csvRow: CSVEventRow,
	dateContext: DateNormalizationContext,
	index: number,
	columnType: DateWarningColumnType,
): NormalizedDate | null => {
	const rawValue =
		columnType === "dateTo" ? (csvRow.dateTo ?? "") : csvRow.date;
	const trimmed = rawValue.trim();
	if (columnType === "dateTo" && !trimmed) return null;
	const normalized = normalizeCsvDate(trimmed, dateContext);
	if (normalized.warning) {
		emitDateWarning(normalized.warning, csvRow, index, columnType, trimmed);
	}
	return normalized;
};

const buildDateSeries = (
	csvRow: CSVEventRow,
	dateContext: DateNormalizationContext,
	index: number,
): NormalizedDate[] => {
	const start = normalizeDateColumnValue(csvRow, dateContext, index, "date");
	if (!start?.isoDate) return [start ?? buildInvalidDatePlaceholder()];

	const end = normalizeDateColumnValue(csvRow, dateContext, index, "dateTo");
	if (!end?.isoDate || end.isoDate === start.isoDate) return [start];

	if (end.isoDate < start.isoDate) {
		emitDateWarning(
			{
				type: "invalid",
				detectedFormat: "date-range",
				message: `Date To "${end.isoDate}" is before Date "${start.isoDate}".`,
				recommendedAction:
					"Set Date To to the same date or a later date for this range.",
				potentialFormats: {
					us: "",
					uk: "",
					iso: "",
				},
			},
			csvRow,
			index,
			"dateTo",
			csvRow.dateTo ?? "",
		);
		return [start];
	}

	const dates: NormalizedDate[] = [];
	for (
		let cursor = new Date(`${start.isoDate}T00:00:00.000Z`);
		cursor.getTime() <= new Date(`${end.isoDate}T00:00:00.000Z`).getTime();
		cursor = new Date(
			Date.UTC(
				cursor.getUTCFullYear(),
				cursor.getUTCMonth(),
				cursor.getUTCDate() + 1,
			),
		)
	) {
		const isoDate = cursor.toISOString().slice(0, 10);
		dates.push({
			isoDate,
			day: DateTransformers.convertToEventDay(isoDate),
			year: Number.parseInt(isoDate.slice(0, 4), 10),
			usedInferredYear: false,
		});
	}
	return dates.length > 0 ? dates : [start];
};

const getOccurrenceEventKey = (
	csvRow: CSVEventRow,
	rowIndex: number,
	occurrenceIndex: number,
	occurrenceDate: string,
): string => {
	const explicitEventKey = normalizeEventKey(csvRow.eventKey);
	if (occurrenceIndex === 0 && explicitEventKey) return explicitEventKey;

	return generateEventKeyFromRow(
		{
			...csvRow,
			eventKey: "",
			date: occurrenceDate,
			dateTo: "",
		},
		{
			stableKeys: EVENT_KEY_FINGERPRINT_FIELDS,
			salt: rowIndex + occurrenceIndex,
		},
	);
};

const getSeriesKey = (
	csvRow: CSVEventRow,
	occurrenceCount: number,
): string | undefined => {
	const explicitSeriesKey = normalizeSeriesKey(csvRow.seriesKey);
	if (explicitSeriesKey) return explicitSeriesKey;
	if (occurrenceCount <= 1) return undefined;
	return generateSeriesKeyFromRow(
		{
			...csvRow,
			eventKey: "",
			date: "",
			dateTo: "",
			seriesKey: "",
		},
		{ stableKeys: SERIES_KEY_FINGERPRINT_FIELDS },
	);
};

const assembleEventFromNormalizedDate = (
	csvRow: CSVEventRow,
	index: number,
	normalizedDate: NormalizedDate,
	options: EventAssemblyOptions,
	rangeContext?: {
		eventKey: string;
		seriesKey?: string;
		sourceEventKey?: string;
		occurrenceIndex: number;
		occurrenceCount: number;
		dateRangeStart?: string;
		dateRangeEnd?: string;
	},
): Event => {
	const eventKey =
		rangeContext?.eventKey ??
		normalizeEventKey(csvRow.eventKey) ??
		generateEventKeyFromRow(csvRow, {
			stableKeys: EVENT_KEY_FINGERPRINT_FIELDS,
			salt: index,
		});

	// Transform individual fields using our focused transformers
	const day = normalizedDate.day;
	const date = normalizedDate.isoDate;
	const time = DateTransformers.convertToTime(csvRow.startTime);
	const endTime = DateTransformers.convertToTime(csvRow.endTime);
	const locations = splitLocationList(csvRow.location);
	const locationAddresses = splitLocationMetadataList(csvRow.locationAddress);
	const postalCodes = splitLocationMetadataList(csvRow.postalCode);
	const cities = splitLocationMetadataList(csvRow.city);
	const countryCodes = splitLocationMetadataList(csvRow.countryCode);
	const normalizedPostalCode =
		locations.length <= 1 ? normalizePostalCode(csvRow.postalCode) : "";
	const normalizedCity =
		locations.length <= 1 ? normalizeCity(csvRow.city) : "";
	const normalizedCountryCode =
		csvRow.countryCode?.trim() && locations.length <= 1
			? normalizeCountryCode(csvRow.countryCode)
			: undefined;
	const locationAreas = splitAreaList(csvRow.area);

	const baseArrondissement = LocationTransformers.convertToArrondissement(
		csvRow.area,
		csvRow.location,
		{
			postalCode: normalizedPostalCode,
			city: normalizedCity,
		},
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
	const locationEntries =
		locations.length > 1
			? locations.map((name, locationIndex) => {
					const entryPostalCode = normalizePostalCode(
						pickMetadataPart(postalCodes, locationIndex),
					);
					const entryCity = normalizeCity(
						pickMetadataPart(cities, locationIndex),
					);
					const entryCountryCode = pickMetadataPart(
						countryCodes,
						locationIndex,
					)?.trim()
						? normalizeCountryCode(
								pickMetadataPart(countryCodes, locationIndex),
							)
						: undefined;
					const derivedArea = deriveAreaFromPostalCodeCity(
						entryPostalCode,
						entryCity,
					);
					const entryArea =
						locationAreas.length === locations.length
							? locationAreas[locationIndex]
							: locationAreas.length === 1
								? locationAreas[0]
								: derivedArea;
					return {
						name,
						...(entryArea ? { arrondissement: entryArea } : {}),
						...(pickMetadataPart(locationAddresses, locationIndex)
							? {
									address: pickMetadataPart(locationAddresses, locationIndex),
								}
							: {}),
						...(entryPostalCode ? { postalCode: entryPostalCode } : {}),
						...(entryCity ? { city: entryCity } : {}),
						...(entryCountryCode ? { countryCode: entryCountryCode } : {}),
					};
				})
			: undefined;
	const locationEntryAreas = uniqueKnownAreas(
		locationEntries
			?.map((entry) => entry.arrondissement)
			.filter((area): area is ParisArrondissement => Boolean(area)) ?? [],
	);
	const arrondissement =
		locations.length > 1
			? locationEntryAreas.length === 1
				? locationEntryAreas[0]
				: "multiple-locations"
			: baseArrondissement;
	const location =
		locations.length > 1
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
		seriesKey: rangeContext?.seriesKey,
		sourceEventKey: rangeContext?.sourceEventKey,
		occurrenceIndex: rangeContext?.occurrenceIndex,
		occurrenceCount: rangeContext?.occurrenceCount,
		dateRangeStart: rangeContext?.dateRangeStart,
		dateRangeEnd: rangeContext?.dateRangeEnd,
		slug: buildEventSlug(csvRow.title.trim()),
		id: eventKey,
		name: csvRow.title.trim(),
		day,
		date,
		time: time || undefined,
		endTime: endTime || undefined,
		arrondissement,
		location,
		locationAddress: csvRow.locationAddress?.trim() || undefined,
		postalCode: normalizedPostalCode || undefined,
		city: normalizedCity || undefined,
		countryCode: normalizedCountryCode,
		locations: locations.length > 1 ? locations : undefined,
		locationEntries,
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
 * Main event assembly function
 * Converts a CSV row into the first Event object represented by that row.
 * Batch assembly expands Date To ranges into all public occurrences.
 */
export const assembleEvent = (
	csvRow: CSVEventRow,
	index: number,
	options: EventAssemblyOptions = {},
): Event => {
	const dateContext =
		options.dateNormalizationContext ??
		createDateNormalizationContext([csvRow], {
			referenceDate: options.referenceDate,
		});
	const [normalizedDate] = buildDateSeries(csvRow, dateContext, index);
	return assembleEventFromNormalizedDate(
		csvRow,
		index,
		normalizedDate,
		options,
		{
			eventKey: getOccurrenceEventKey(csvRow, index, 0, normalizedDate.isoDate),
			seriesKey: getSeriesKey(csvRow, 1),
			sourceEventKey: normalizeEventKey(csvRow.eventKey) ?? undefined,
			occurrenceIndex: 0,
			occurrenceCount: 1,
		},
	);
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

	const events: Event[] = [];
	for (let rowIndex = 0; rowIndex < withEventKeys.rows.length; rowIndex += 1) {
		const row = withEventKeys.rows[rowIndex];
		const normalizedDates = buildDateSeries(row, dateContext, rowIndex);
		const occurrenceCount = normalizedDates.length;
		const seriesKey = getSeriesKey(row, occurrenceCount);
		const sourceEventKey = normalizeEventKey(row.eventKey) ?? undefined;
		const dateRangeStart =
			occurrenceCount > 1 ? normalizedDates[0]?.isoDate : undefined;
		const dateRangeEnd =
			occurrenceCount > 1
				? normalizedDates[occurrenceCount - 1]?.isoDate
				: undefined;

		for (
			let occurrenceIndex = 0;
			occurrenceIndex < normalizedDates.length;
			occurrenceIndex += 1
		) {
			const normalizedDate = normalizedDates[occurrenceIndex];
			const occurrenceDate = normalizedDate.isoDate;
			events.push(
				assembleEventFromNormalizedDate(
					{ ...row, date: occurrenceDate, dateTo: "" },
					rowIndex,
					normalizedDate,
					options,
					{
						eventKey: getOccurrenceEventKey(
							row,
							rowIndex,
							occurrenceIndex,
							occurrenceDate,
						),
						seriesKey,
						sourceEventKey,
						occurrenceIndex,
						occurrenceCount,
						dateRangeStart,
						dateRangeEnd,
					},
				),
			);
		}
	}

	return events;
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

	for (let i = 0; i < withEventKeys.rows.length; i += 1) {
		const row = withEventKeys.rows[i];
		try {
			const normalizedDates = buildDateSeries(row, dateContext, i);
			const occurrenceCount = normalizedDates.length;
			const seriesKey = getSeriesKey(row, occurrenceCount);
			const sourceEventKey = normalizeEventKey(row.eventKey) ?? undefined;
			const dateRangeStart =
				occurrenceCount > 1 ? normalizedDates[0]?.isoDate : undefined;
			const dateRangeEnd =
				occurrenceCount > 1
					? normalizedDates[occurrenceCount - 1]?.isoDate
					: undefined;

			for (
				let occurrenceIndex = 0;
				occurrenceIndex < normalizedDates.length;
				occurrenceIndex += 1
			) {
				const normalizedDate = normalizedDates[occurrenceIndex];
				const occurrenceDate = normalizedDate.isoDate;
				events.push(
					assembleEventFromNormalizedDate(
						{ ...row, date: occurrenceDate, dateTo: "" },
						i,
						normalizedDate,
						options,
						{
							eventKey: getOccurrenceEventKey(
								row,
								i,
								occurrenceIndex,
								occurrenceDate,
							),
							seriesKey,
							sourceEventKey,
							occurrenceIndex,
							occurrenceCount,
							dateRangeStart,
							dateRangeEnd,
						},
					),
				);
			}
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
