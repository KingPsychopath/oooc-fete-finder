"use client";

import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	createDateNormalizationContext,
	normalizeCsvDate,
} from "@/features/data-management/assembly/date-normalization";
import { DateTransformers } from "@/features/data-management/assembly/field-transformers";
import {
	type EditableSheetColumn,
	type EditableSheetRow,
	createBlankEditableSheetRow,
	createCustomColumnKey,
	formatIsoDateForEditableSheet,
	generateEditableSheetSeriesKey,
	getEditableSheetDateRangeDates,
	isEditableSheetColumn,
	isEditableSheetRow,
	isEditableSheetRowEmpty,
	isPlainRecord,
	normalizeEditableSheetRowValues,
	pruneEmptyEditableSheetRows,
	splitEditableSheetRangeRow,
	toEditableSheetRowSortableDateTime,
} from "@/features/data-management/csv/sheet-editor";
import type {
	EventRowLifecycleMetadata,
	EventSheetRevisionRecord,
} from "@/features/data-management/event-sheet-revision-types";
import {
	type CountryOption,
	filterCountryOptions,
	getCountryOption,
} from "@/features/events/countries";
import {
	DEFAULT_GENRE_ALIASES,
	type GenreTaxonomyDefinition,
	type GenreTaxonomySnapshot,
	isRedundantGenreAlias,
	normalizeGenreInputText,
	normalizeGenreKey,
	resolveMusicGenre,
	toGenreLabel,
} from "@/features/events/genre-normalization";
import {
	normalizeSupportedNationalities,
	parseSupportedNationalities,
} from "@/features/events/nationality-utils";
import {
	formatRecentlyAddedLabel,
	isRecentlyAddedEvent,
} from "@/features/events/recently-added";
import {
	formatRecentlyUpdatedLabel,
	isRecentlyUpdatedEvent,
} from "@/features/events/recently-updated";
import {
	EVENT_EXPERIENCE_CATEGORIES,
	type EventExperienceCategory,
	type EventExperienceCategoryDefinition,
	type ParisArrondissement,
	formatEventExperienceCategory,
	normalizeEventExperienceCategory,
} from "@/features/events/types";
import {
	type LocationAliasCandidate,
	type LocationAliasMatch,
	type SheetLocationResolution,
	type SheetLocationResolutionIndex,
	type SheetLocationTrustState,
	findLikelyLocationAliases,
	getSheetLocationResolutionKey,
	getSheetLocationTrustState,
} from "@/features/locations/location-sheet-status";
import {
	deriveAreaFromPostalCodeCity,
	isCoordinateResolvableInput,
	normalizeCity,
	normalizeCountryCode,
	normalizePostalCode,
} from "@/features/locations/location-utils";
import {
	AlertCircle,
	ArrowDown,
	ArrowUp,
	CalendarDays,
	Copy,
	Eye,
	EyeOff,
	History,
	Link2,
	PanelRightOpen,
	Plus,
	RefreshCw,
	Sparkles,
	Trash2,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EventSheetOcrDraftModal } from "./EventSheetOcrDraftModal";
import { ADMIN_EVENT_SHEET_REFRESH_EVENT } from "./admin-content-events";

type EventSheetEditorCardProps = {
	isAuthenticated: boolean;
	initialDeploymentId: string;
	initialEditorData?: EditorPayload;
	pendingEventReviews?: Array<{
		eventKey: string;
		submissionId: string;
		submissionType?: "event_update" | "price_flag" | "new_event";
	}>;
	onDataSaved?: () => Promise<void> | void;
};
type PendingEventReviewType = NonNullable<
	EventSheetEditorCardProps["pendingEventReviews"]
>[number]["submissionType"];

type EditorPayload = {
	success: boolean;
	columns?: EditableSheetColumn[];
	rows?: EditableSheetRow[];
	locationResolutionIndex?: SheetLocationResolutionIndex;
	rowMetadata?: EventRowLifecycleMetadata[];
	genreTaxonomy?: GenreTaxonomySnapshot;
	sheetRevisions?: EventSheetRevisionRecord[];
	sheetRevisionSupported?: boolean;
	status?: {
		updatedAt?: string | null;
	};
	sheetSource?: "store";
	error?: string;
};
type SaveEventSheetResult = {
	success: boolean;
	message: string;
	columns?: EditableSheetColumn[];
	rows?: EditableSheetRow[];
	locationResolutionIndex?: SheetLocationResolutionIndex;
	rowCount?: number;
	updatedAt?: string;
	rowMetadata?: EventRowLifecycleMetadata[];
	revision?: EventSheetRevisionRecord | null;
	error?: string;
};
type RevisionSnapshotPayload = {
	success: boolean;
	revision?: EventSheetRevisionRecord;
	columns?: EditableSheetColumn[];
	rows?: EditableSheetRow[];
	error?: string;
};
type GenreMutationResult = {
	success: boolean;
	genreTaxonomy?: GenreTaxonomySnapshot;
	genreKey?: string;
	message?: string;
	error?: string;
};
type EditorSnapshot = {
	columns: EditableSheetColumn[];
	rows: EditableSheetRow[];
};
type StoredEditorDraft = EditorSnapshot & {
	savedAt: string;
	deploymentId: string;
};
type SheetSortMode =
	| "soonest-upcoming"
	| "latest-upcoming"
	| "date-asc"
	| "date-desc"
	| "fresh-lifecycle"
	| "sheet-order";
type GenreCellPart = {
	value: string;
	resolved: string | null;
	label: string;
};
type GenreAliasMapping = {
	alias: string;
	genreKey: string;
	genreLabel: string;
	isDefault: boolean;
};
type AreaOption = {
	value: string;
	label: string;
	group: "Paris arrondissements" | "Beyond Paris" | "Unconfirmed";
	description: string;
	aliases: string[];
};
type SimpleOption = {
	value: string;
	label: string;
	description: string;
};
type DateSuggestionOption = {
	value: string;
	label: string;
	description: string;
};
type DateSuggestionGroup = {
	label: string;
	options: DateSuggestionOption[];
};
type DateInputPreview = {
	tone: "success" | "warning";
	message: string;
};
type TimeInputPreview = {
	tone: "success" | "muted";
	message: string;
};
type RowLifecycleBadge = {
	label: string;
	shortLabel: string;
	title: string;
	tone: "added" | "updated";
};
type RowLifecycleOptions = {
	suppressUpdated?: boolean;
};
type LocationSuggestion = {
	value: string;
	area: string;
	address: string;
	postalCode: string;
	city: string;
	countryCode: string;
	count: number;
	isAreaMatch: boolean;
};
type LocationCellPartStatus = {
	name: string;
	arrondissement: ParisArrondissement;
	key: string;
	resolution: SheetLocationResolution | null;
	trustState: SheetLocationTrustState;
	aliases: LocationAliasMatch[];
};
type LocationCellStatus = {
	parts: LocationCellPartStatus[];
	trustState: SheetLocationTrustState;
	label: string;
	title: string;
	hasAliasWarning: boolean;
};
type SeriesKeySuggestion = {
	rowIndex: number;
	seriesKey: string;
	title: string;
	date: string;
	location: string;
	rowCount: number;
	willCreateSeriesKey: boolean;
};
type ParsedUrlPart = {
	raw: string;
	normalized: string;
	isValid: boolean;
	host: string | null;
};
type DateSuggestionState = {
	preview: DateInputPreview | null;
	groups: DateSuggestionGroup[];
};
type SheetHealthIssue = {
	rowIndex: number;
	column: string;
	message: string;
	severity: "blocking" | "warning";
};
type RowQualityValue = "complete" | "review" | "blocking" | "draft";
type RowQualityAssessment = {
	value: RowQualityValue;
	source: "inferred" | "manual" | "submission";
	label: string;
	sourceLabel: string;
	description: string;
	checks: Array<{ label: string; passed: boolean }>;
	issues: SheetHealthIssue[];
	isConfirmed: boolean;
};
type QualityPopoverState = {
	rowIndex: number;
	top: number;
	left: number;
};

type EventCategoryPopoverState = {
	rowIndex: number;
	columnKey: string;
	top: number;
	left: number;
};
type FocusedCell = {
	rowIndex: number;
	columnKey: string;
};
type CellDraft = FocusedCell & {
	value: string;
};
type CellPopoverProps = {
	children: ReactNode;
	className: string;
	style: CSSProperties;
};

const ROW_DELETE_CONFIRMATION =
	"Delete this row from the event sheet? This will be removed on next save.";
const DATE_RANGE_HELPER_MESSAGE =
	"Use Date To for identical multi-day runs. The app generates one public occurrence per day; split a range when one day needs different details.";
const COLUMN_DELETE_CONFIRMATION =
	"Delete this custom column? This will remove values for this column from all rows.";
const HISTORY_LIMIT = 120;
const ROW_NUMBER_COLUMN_WIDTH = 156;
const DATA_COLUMN_WIDTH = 170;
const MAX_FROZEN_COLUMNS = 4;
const AUTOSAVE_RETRY_BACKOFF_MS = 15_000;
const CELL_EDIT_BATCH_WINDOW_MS = 140;
const SYSTEM_MANAGED_COLUMN_KEYS = new Set(["eventKey"]);
const ADVANCED_COLUMN_KEYS = new Set(["area", "seriesKey", "eventKey"]);
const DEFAULT_SORT_MODE: SheetSortMode = "soonest-upcoming";
const CURATED_COLUMN_KEY = "curated";
const EVENT_CATEGORY_COLUMN_KEY = "eventCategory";
const TITLE_COLUMN_KEY = "title";
const DATE_COLUMN_KEY = "date";
const DATE_TO_COLUMN_KEY = "dateTo";
const SERIES_KEY_COLUMN_KEY = "seriesKey";
const START_TIME_COLUMN_KEY = "startTime";
const END_TIME_COLUMN_KEY = "endTime";
const CATEGORY_COLUMN_KEY = "categories";
const TAGS_COLUMN_KEY = "tags";
const LOCATION_COLUMN_KEY = "location";
const AREA_COLUMN_KEY = "area";
const LOCATION_ADDRESS_COLUMN_KEY = "locationAddress";
const POSTAL_CODE_COLUMN_KEY = "postalCode";
const CITY_COLUMN_KEY = "city";
const COUNTRY_CODE_COLUMN_KEY = "countryCode";
const AGE_COLUMN_KEY = "ageGuidance";
const PRICE_COLUMN_KEY = "price";
const PRIMARY_URL_COLUMN_KEY = "primaryUrl";
const SETTING_COLUMN_KEY = "setting";
const SOURCE_CONFIRMED_COLUMN_KEY = "sourceConfirmed";
const DETAILS_QUALITY_OVERRIDE_COLUMN_KEY = "detailsQualityOverride";
const COUNTRY_COLUMN_KEYS = new Set(["hostCountry", "audienceCountry"]);
const TIME_COLUMN_KEYS = new Set([START_TIME_COLUMN_KEY, END_TIME_COLUMN_KEY]);
const CURATED_PICK_VALUE = "🌟";
const DETAIL_COMMON_COUNTRY_CODES = [
	"FR",
	"GB",
	"US",
	"NG",
	"JM",
	"TT",
	"BR",
	"ES",
	"PT",
] as const;
const EVENT_CATEGORY_POPOVER_WIDTH = 288;
const EVENT_CATEGORY_POPOVER_HEIGHT = 270;
const EVENT_CATEGORY_POPOVER_PADDING = 12;
const CELL_POPOVER_VIEWPORT_PADDING = 8;
const SERIES_KEY_POPOVER_WIDTH = 360;

const CellPopover = ({ children, className, style }: CellPopoverProps) => {
	if (typeof document === "undefined") return null;

	return createPortal(
		<div className={className} style={style}>
			{children}
		</div>,
		document.body,
	);
};

const getRequiredSheetHealthIssues = (
	rows: EditableSheetRow[],
): SheetHealthIssue[] => {
	const issues: SheetHealthIssue[] = [];
	rows.forEach((row, index) => {
		if (isEditableSheetRowEmpty(row)) return;
		const rowNumber = index + 1;
		for (const [columnKey, column] of [
			[TITLE_COLUMN_KEY, "Title"],
			[DATE_COLUMN_KEY, "Date"],
		] as const) {
			const value = String(row[columnKey] ?? "").trim();
			if (!value) {
				issues.push({
					rowIndex: rowNumber,
					column,
					message: `${column} is required before publishing.`,
					severity: "blocking",
				});
			}
		}
	});
	return issues;
};
const parseBooleanCellValue = (value: string | undefined): boolean => {
	const normalized = String(value ?? "")
		.trim()
		.toLowerCase();
	return ["true", "yes", "y", "1", "confirmed", "verified"].includes(
		normalized,
	);
};
const parseQualityOverride = (
	value: string | undefined,
): RowQualityValue | null => {
	const normalized = String(value ?? "")
		.trim()
		.toLowerCase();
	if (!normalized || normalized === "auto" || normalized === "inferred") {
		return null;
	}
	if (normalized === "complete") return "complete";
	if (normalized === "review" || normalized === "needs review") return "review";
	if (normalized === "blocking" || normalized === "blocked") return "blocking";
	if (normalized === "draft") return "draft";
	return null;
};
const getQualityLabel = (value: RowQualityValue): string => {
	if (value === "complete") return "Details complete";
	if (value === "blocking") return "Needs fix";
	if (value === "draft") return "Draft (admin only)";
	return "Review recommended";
};
const getQualityDescription = (value: RowQualityValue): string => {
	if (value === "complete") return "Enough public-facing details are present.";
	if (value === "blocking")
		return "Important public-facing details are missing.";
	if (value === "draft")
		return "Saved in admin, hidden from public events until changed to Auto, Review, or Complete.";
	return "Usable, but one or more details should be checked.";
};
const getPendingReviewQualityLabel = (
	submissionType: PendingEventReviewType,
): string => {
	if (submissionType === "price_flag") return "Needs price check";
	if (submissionType === "event_update") return "Needs update review";
	if (submissionType === "new_event") return "Needs event review";
	return "Needs submission review";
};
const getPendingReviewSourceLabel = (
	submissionType: PendingEventReviewType,
): string => {
	if (submissionType === "price_flag") return "Price flag";
	if (submissionType === "event_update") return "Update request";
	if (submissionType === "new_event") return "New event";
	return "Submission";
};
const getPendingReviewDescription = (
	submissionType: PendingEventReviewType,
): string => {
	if (submissionType === "price_flag") {
		return "A visitor flagged the listed price. Check the ticket/proof page, update Price if needed, then clear the flag.";
	}
	if (submissionType === "event_update") {
		return "A visitor submitted a pending change for this event. Review the submission, patch the row if needed, then clear the request.";
	}
	if (submissionType === "new_event") {
		return "A visitor submitted this event. Review the submission, patch the row if needed, then clear the request.";
	}
	return "A visitor submitted a pending review for this event. Review it, patch the row if needed, then clear the request.";
};
const getQualityDotClassName = (value: RowQualityValue): string => {
	if (value === "complete") return "border-green-600 bg-green-600";
	if (value === "blocking") return "border-red-600 bg-red-600";
	if (value === "draft") return "border-muted-foreground/45 bg-transparent";
	return "border-amber-500 bg-amber-500";
};
const getQualityFilterDescription = (value: RowQualityValue): string => {
	if (value === "complete") return "details complete rows";
	if (value === "blocking") return "rows that need fixes";
	if (value === "draft") return "admin-only draft rows";
	return "rows recommended for review";
};
const hasUsableTextValue = (value: string | undefined): boolean => {
	const normalized = String(value ?? "")
		.trim()
		.toLowerCase();
	return Boolean(normalized) && !["tba", "tbc", "#"].includes(normalized);
};
const isKnownAreaCellValue = (value: string | undefined): boolean => {
	const parts = String(value ?? "")
		.split(/[\n\r|;]+/)
		.map((part) => part.trim())
		.filter(Boolean);
	if (parts.length === 0) return false;
	return parts.every((part) => Boolean(findAreaOption(part)));
};
const splitKnownAreaMetadataValue = (value: string | undefined): string[] =>
	String(value ?? "")
		.split(/[\n\r|;]+/)
		.map((part) => part.trim());

const hasKnownAreaForRow = (row: EditableSheetRow): boolean => {
	if (splitKnownAreaMetadataValue(row[AREA_COLUMN_KEY]).some(Boolean)) {
		return isKnownAreaCellValue(row[AREA_COLUMN_KEY]);
	}
	const locationCount = splitKnownAreaMetadataValue(
		row[LOCATION_COLUMN_KEY],
	).filter(Boolean).length;
	const postalCodes = splitKnownAreaMetadataValue(row[POSTAL_CODE_COLUMN_KEY]);
	const cities = splitKnownAreaMetadataValue(row[CITY_COLUMN_KEY]);
	const metadataCount = Math.max(
		locationCount,
		postalCodes.length,
		cities.length,
	);
	if (metadataCount <= 1) {
		return Boolean(
			deriveAreaFromPostalCodeCity(
				normalizePostalCode(postalCodes[0]),
				normalizeCity(cities[0]),
			),
		);
	}
	return Array.from({ length: metadataCount }).every((_, index) =>
		Boolean(
			deriveAreaFromPostalCodeCity(
				normalizePostalCode(
					postalCodes.length === 1 ? postalCodes[0] : postalCodes[index],
				),
				normalizeCity(cities.length === 1 ? cities[0] : cities[index]),
			),
		),
	);
};
const getRowQualityAssessment = (
	row: EditableSheetRow,
	issues: SheetHealthIssue[],
	options?: {
		hasPendingSubmissionReview?: boolean;
		pendingSubmissionType?: PendingEventReviewType;
	},
): RowQualityAssessment => {
	if (isEditableSheetRowEmpty(row)) {
		return {
			value: "draft",
			source: "inferred",
			label: getQualityLabel("draft"),
			sourceLabel: "Auto",
			description: getQualityDescription("draft"),
			checks: [],
			issues,
			isConfirmed: false,
		};
	}

	const titlePresent = hasUsableTextValue(row[TITLE_COLUMN_KEY]);
	const hasBlockingIssue = issues.some(
		(issue) => issue.severity === "blocking",
	);
	const datePresent =
		hasUsableTextValue(row[DATE_COLUMN_KEY]) &&
		!issues.some((issue) => issue.column === "Date");
	const locationPresent = hasUsableTextValue(row[LOCATION_COLUMN_KEY]);
	const areaKnown = hasKnownAreaForRow(row);
	const startTimePresent = hasUsableTextValue(row[START_TIME_COLUMN_KEY]);
	const urlPresent = hasUsableTextValue(row[PRIMARY_URL_COLUMN_KEY]);
	const pricePresent = hasUsableTextValue(row[PRICE_COLUMN_KEY]);
	const detailCount = [startTimePresent, urlPresent, pricePresent].filter(
		Boolean,
	).length;
	const inferredValue: RowQualityValue =
		hasBlockingIssue || !titlePresent || !datePresent
			? "blocking"
			: locationPresent && areaKnown && detailCount >= 2
				? "complete"
				: "review";
	const manualValue = parseQualityOverride(
		row[DETAILS_QUALITY_OVERRIDE_COLUMN_KEY],
	);
	const hasPendingSubmissionReview =
		options?.hasPendingSubmissionReview === true ||
		Boolean(options?.pendingSubmissionType);
	const value = hasPendingSubmissionReview
		? "blocking"
		: (manualValue ?? inferredValue);
	const source = hasPendingSubmissionReview
		? "submission"
		: manualValue
			? "manual"
			: "inferred";

	return {
		value,
		source,
		label: hasPendingSubmissionReview
			? getPendingReviewQualityLabel(options?.pendingSubmissionType)
			: getQualityLabel(value),
		sourceLabel: hasPendingSubmissionReview
			? getPendingReviewSourceLabel(options?.pendingSubmissionType)
			: source === "manual"
				? "Manual"
				: "Auto",
		description: hasPendingSubmissionReview
			? getPendingReviewDescription(options?.pendingSubmissionType)
			: getQualityDescription(value),
		checks: [
			{ label: "Title present", passed: titlePresent },
			{ label: "Date valid", passed: datePresent },
			{ label: "Location present", passed: locationPresent },
			{ label: "Area known", passed: areaKnown },
			{ label: "Start time present", passed: startTimePresent },
			{ label: "Primary URL present", passed: urlPresent },
			{ label: "Price present", passed: pricePresent },
		],
		issues,
		isConfirmed: parseBooleanCellValue(row[SOURCE_CONFIRMED_COLUMN_KEY]),
	};
};
const SETTING_OPTIONS: SimpleOption[] = [
	{
		value: "Indoor",
		label: "Indoor",
		description: "Club, bar, hall, venue or enclosed room",
	},
	{
		value: "Outdoor",
		label: "Outdoor",
		description: "Park, street, terrace, rooftop or open air",
	},
];
const EVENT_CATEGORY_OPTIONS: readonly EventExperienceCategoryDefinition[] =
	EVENT_EXPERIENCE_CATEGORIES;
const EVENT_CATEGORY_ADMIN_OPTION_CLASSES: Record<
	EventExperienceCategory,
	{ dot: string; selected: string; highlighted: string }
> = {
	party: {
		dot: "bg-amber-500",
		selected:
			"border-amber-500/35 bg-amber-500/10 text-amber-950 dark:border-amber-300/28 dark:bg-amber-300/12 dark:text-amber-100",
		highlighted:
			"border-amber-500/45 bg-amber-500/15 text-amber-950 dark:border-amber-300/34 dark:bg-amber-300/16 dark:text-amber-100",
	},
	activity: {
		dot: "bg-sky-500",
		selected:
			"border-sky-500/35 bg-sky-500/10 text-sky-950 dark:border-sky-300/28 dark:bg-sky-300/12 dark:text-sky-100",
		highlighted:
			"border-sky-500/45 bg-sky-500/15 text-sky-950 dark:border-sky-300/34 dark:bg-sky-300/16 dark:text-sky-100",
	},
	culture: {
		dot: "bg-violet-500",
		selected:
			"border-violet-500/35 bg-violet-500/10 text-violet-950 dark:border-violet-300/28 dark:bg-violet-300/12 dark:text-violet-100",
		highlighted:
			"border-violet-500/45 bg-violet-500/15 text-violet-950 dark:border-violet-300/34 dark:bg-violet-300/16 dark:text-violet-100",
	},
	food: {
		dot: "bg-emerald-500",
		selected:
			"border-emerald-500/35 bg-emerald-500/10 text-emerald-950 dark:border-emerald-300/28 dark:bg-emerald-300/12 dark:text-emerald-100",
		highlighted:
			"border-emerald-500/45 bg-emerald-500/15 text-emerald-950 dark:border-emerald-300/34 dark:bg-emerald-300/16 dark:text-emerald-100",
	},
	wellness: {
		dot: "bg-teal-500",
		selected:
			"border-teal-500/35 bg-teal-500/10 text-teal-950 dark:border-teal-300/28 dark:bg-teal-300/12 dark:text-teal-100",
		highlighted:
			"border-teal-500/45 bg-teal-500/15 text-teal-950 dark:border-teal-300/34 dark:bg-teal-300/16 dark:text-teal-100",
	},
};
const getEventCategoryAdminOptionClassName = (
	category: EventExperienceCategory,
	isSelected: boolean,
	isHighlighted: boolean,
): string => {
	const accent = EVENT_CATEGORY_ADMIN_OPTION_CLASSES[category];
	const baseClassName =
		"flex w-full items-center gap-2 rounded border px-2 py-1.5 text-left text-xs transition";
	if (isHighlighted) return `${baseClassName} ${accent.highlighted}`;
	if (isSelected) return `${baseClassName} ${accent.selected}`;
	return `${baseClassName} border-transparent hover:bg-accent/70`;
};
const AGE_OPTIONS: SimpleOption[] = [
	{ value: "18+", label: "18+", description: "Standard adult entry" },
	{ value: "21+", label: "21+", description: "Older crowd / stricter entry" },
	{ value: "20+", label: "20+", description: "Occasional venue policy" },
	{
		value: "All ages",
		label: "All ages",
		description: "No age restriction listed",
	},
	{ value: "TBC", label: "TBC", description: "Age policy still unknown" },
];
const FETE_DATE_OFFSETS = [-2, -1, 0, 1, 2] as const;
const AREA_OPTIONS: AreaOption[] = [
	...Array.from({ length: 20 }, (_, index) => {
		const value = String(index + 1);
		return {
			value,
			label: `${value}e`,
			group: "Paris arrondissements" as const,
			description: `${value}e arrondissement`,
			aliases: [value, `${value}e`, `${value}eme`, `${value} arrondissement`],
		};
	}),
	{
		value: "Greater Paris",
		label: "Greater Paris",
		group: "Beyond Paris",
		description: "Paris-adjacent / Ile-de-France venue",
		aliases: ["grand paris", "idf", "suburbs", "near paris"],
	},
	{
		value: "Outside Paris",
		label: "Outside Paris",
		group: "Beyond Paris",
		description: "Not a Paris or Paris-adjacent venue",
		aliases: ["outside", "out of paris", "not paris"],
	},
	{
		value: "Multiple Locations",
		label: "Multiple Locations",
		group: "Unconfirmed",
		description: "Several venues, route, or exact locations not confirmed",
		aliases: [
			"multiple",
			"multiple locations",
			"multi location",
			"various",
			"various locations",
		],
	},
	{
		value: "Location TBC",
		label: "Location TBC",
		group: "Unconfirmed",
		description: "Venue or area still unconfirmed",
		aliases: ["tbc", "unknown", "-", "tba"],
	},
];
const DEFAULT_ALIAS_KEYS = new Set(
	DEFAULT_GENRE_ALIASES.map(
		([alias, genreKey]) => `${normalizeGenreKey(alias)}:${genreKey}`,
	),
);
const EVENT_SHEET_DRAFT_KEY = "oooc-admin:event-sheet-draft:v1";
const DEPLOYMENT_STATUS_ENDPOINT = "/api/admin/deployment-status";
const EVENT_SHEET_ENDPOINT = "/api/admin/event-sheet";
const MUSIC_GENRE_TAXONOMY_ENDPOINT = "/api/admin/music-genre-taxonomy";
const DEPLOYMENT_POLL_INTERVAL_MS = 30_000;

const cellRefKey = (rowIndex: number, columnKey: string) =>
	`${rowIndex}:${columnKey}`;

const urlPartRefKey = (
	rowIndex: number,
	columnKey: string,
	partIndex: number,
) => `${rowIndex}:${columnKey}:${partIndex}`;

const locationPartRefKey = (
	rowIndex: number,
	columnKey: string,
	partIndex: number,
) => `${rowIndex}:${columnKey}:${partIndex}`;

const getBasePath = (): string =>
	process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? "";

const buildApiPath = (path: string): string => `${getBasePath()}${path}`;

const isStoredEditorDraft = (value: unknown): value is StoredEditorDraft => {
	if (!isPlainRecord(value)) return false;
	return (
		typeof value.savedAt === "string" &&
		typeof value.deploymentId === "string" &&
		Array.isArray(value.columns) &&
		value.columns.every(isEditableSheetColumn) &&
		Array.isArray(value.rows) &&
		value.rows.every(isEditableSheetRow)
	);
};

const readStoredEditorDraft = (): StoredEditorDraft | null => {
	if (typeof window === "undefined") return null;
	const raw = window.sessionStorage.getItem(EVENT_SHEET_DRAFT_KEY);
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as unknown;
		return isStoredEditorDraft(parsed) ? parsed : null;
	} catch {
		return null;
	}
};

const writeStoredEditorDraft = (draft: StoredEditorDraft): void => {
	if (typeof window === "undefined") return;
	try {
		window.sessionStorage.setItem(EVENT_SHEET_DRAFT_KEY, JSON.stringify(draft));
	} catch {
		// Session draft storage is best-effort; server saves remain source of truth.
	}
};

const clearStoredEditorDraft = (): void => {
	if (typeof window === "undefined") return;
	window.sessionStorage.removeItem(EVENT_SHEET_DRAFT_KEY);
};

const fetchEditorData = async (): Promise<EditorPayload> => {
	const response = await fetch(buildApiPath(EVENT_SHEET_ENDPOINT), {
		method: "GET",
		credentials: "same-origin",
		headers: {
			Accept: "application/json",
		},
		cache: "no-store",
	});
	const payload = (await response.json()) as EditorPayload;
	if (!response.ok) {
		return {
			success: false,
			error: payload.error || `Sheet load failed (${response.status})`,
		};
	}
	return payload;
};

const saveEditorData = async (
	columns: EditableSheetColumn[],
	rows: EditableSheetRow[],
	options: { revalidateHomepage: boolean; restoreRevisionId?: string },
): Promise<SaveEventSheetResult> => {
	const response = await fetch(buildApiPath(EVENT_SHEET_ENDPOINT), {
		method: "POST",
		credentials: "same-origin",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json",
		},
		cache: "no-store",
		body: JSON.stringify({ columns, rows, options }),
	});
	const payload = (await response.json()) as SaveEventSheetResult;
	if (!response.ok) {
		return {
			success: false,
			message: payload.message || `Sheet save failed (${response.status})`,
			error: payload.error,
		};
	}
	return payload;
};

const fetchRevisionSnapshot = async (
	revisionId: string,
): Promise<RevisionSnapshotPayload> => {
	const params = new URLSearchParams({ revisionId });
	const response = await fetch(
		`${buildApiPath(EVENT_SHEET_ENDPOINT)}?${params.toString()}`,
		{
			method: "GET",
			credentials: "same-origin",
			headers: {
				Accept: "application/json",
			},
			cache: "no-store",
		},
	);
	const payload = (await response.json()) as RevisionSnapshotPayload;
	if (!response.ok) {
		return {
			success: false,
			error: payload.error || `Revision load failed (${response.status})`,
		};
	}
	return payload;
};

const formatRevisionTime = (isoDate: string): string => {
	const time = new Date(isoDate).getTime();
	if (!Number.isFinite(time)) return "Unknown time";
	const diffMs = Date.now() - time;
	if (diffMs < 45_000) return "just now";
	const minutes = Math.floor(diffMs / 60_000);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	return formatAdminDateTime(isoDate);
};

const formatAdminDateTime = (isoDate: string): string => {
	const time = new Date(isoDate).getTime();
	if (!Number.isFinite(time)) return "Unknown time";
	return new Intl.DateTimeFormat("en-GB", {
		dateStyle: "short",
		timeStyle: "medium",
		timeZone: "Europe/London",
	}).format(time);
};

const formatRevisionStats = (revision: EventSheetRevisionRecord): string => {
	const parts = [
		revision.addedRows > 0 ? `+${revision.addedRows}` : null,
		revision.deletedRows > 0 ? `-${revision.deletedRows}` : null,
		revision.changedRows > 0 ? `${revision.changedRows} changed` : null,
	].filter((part): part is string => Boolean(part));
	return parts.length > 0 ? parts.join(" · ") : "No row diff";
};

const postGenreTaxonomyAction = async (
	payload:
		| { action: "create-genre"; label: string }
		| { action: "remove-genre"; genreKey: string }
		| { action: "map-alias"; alias: string; genreKey: string }
		| { action: "remove-alias"; alias: string },
): Promise<GenreMutationResult> => {
	const response = await fetch(buildApiPath(MUSIC_GENRE_TAXONOMY_ENDPOINT), {
		method: "POST",
		credentials: "same-origin",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json",
		},
		cache: "no-store",
		body: JSON.stringify(payload),
	});
	const result = (await response.json()) as GenreMutationResult;
	if (!response.ok) {
		return {
			success: false,
			error: result.error || `Genre update failed (${response.status})`,
		};
	}
	return result;
};

const COUNTRY_FLAG_REGEX = /[\u{1f1e6}-\u{1f1ff}]{2}/u;
const COUNTRY_EXPLICIT_SEPARATOR_REGEX = /[\/,&+]/;
const COUNTRY_TOKEN_PREFIX_REGEX = new RegExp(
	`^((?:(?:${COUNTRY_FLAG_REGEX.source}|[A-Za-z]{2,3})\\s+)+)(\\S[\\s\\S]*)$`,
	"u",
);

const getCountrySearchSegment = (value: string): string => {
	const explicitParts = value.split(COUNTRY_EXPLICIT_SEPARATOR_REGEX);
	const segment = (explicitParts.at(-1) ?? value).trim();
	const tokenPrefixMatch = segment.match(COUNTRY_TOKEN_PREFIX_REGEX);
	return (tokenPrefixMatch?.[2] ?? segment).trim();
};

const splitCountryCell = (value: string): string[] =>
	normalizeSupportedNationalities(value)
		.split(",")
		.map((part) => part.trim())
		.filter((part) => part.length > 0);

const joinCountryCodes = (codes: string[]): string => codes.join(", ");

const getSelectedCountryCodes = (value: string): Set<string> =>
	new Set(splitCountryCell(value));

const GENRE_EXPLICIT_SEPARATOR_REGEX = /[,/&+]/;

const getGenreSearchSegment = (value: string): string => {
	const parts = value.split(GENRE_EXPLICIT_SEPARATOR_REGEX);
	return (parts.at(-1) ?? value).trim();
};

const splitGenreCell = (
	value: string,
	taxonomy?: GenreTaxonomySnapshot,
): GenreCellPart[] =>
	normalizeGenreInputText(value)
		.split(/[,/&+]/)
		.map((part) => part.trim())
		.filter((part) => part.length > 0)
		.map((part) => ({
			value: part,
			resolved: resolveMusicGenre(part, taxonomy),
			label: toGenreLabel(part),
		}));

const joinGenreLabels = (values: string[]): string => values.join(", ");

const getSelectedGenreKeys = (
	value: string,
	taxonomy?: GenreTaxonomySnapshot,
): Set<string> =>
	new Set(
		splitGenreCell(value, taxonomy)
			.map((part) => part.resolved)
			.filter((key): key is string => Boolean(key)),
	);

const getGenreLabel = (
	key: string,
	genres: GenreTaxonomyDefinition[],
): string =>
	genres.find((genre) => genre.key === key)?.label ?? toGenreLabel(key);

const normalizeAreaSearchText = (value: string): string =>
	value
		.trim()
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/ème/g, "eme")
		.replace(/\s+/g, " ");

const findAreaOption = (value: string): AreaOption | null => {
	const normalized = normalizeAreaSearchText(value);
	if (!normalized) return null;
	return (
		AREA_OPTIONS.find((option) =>
			[option.value, option.label, option.description, ...option.aliases]
				.map(normalizeAreaSearchText)
				.includes(normalized),
		) ?? null
	);
};

const normalizeAreaValue = (value: string): string =>
	findAreaOption(value)?.value ?? value;

const areaOptionToArrondissement = (
	option: AreaOption | null,
): ParisArrondissement => {
	if (!option) return "unknown";
	const numeric = Number(option.value);
	if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 20) {
		return numeric as ParisArrondissement;
	}
	if (option.value === "Greater Paris") return "greater-paris";
	if (option.value === "Outside Paris") return "outside-paris";
	if (option.value === "Multiple Locations") return "multiple-locations";
	return "unknown";
};

const filterAreaOptions = (query: string): AreaOption[] => {
	const normalized = normalizeAreaSearchText(query);
	if (!normalized) return AREA_OPTIONS;
	return AREA_OPTIONS.filter((option) =>
		[option.value, option.label, option.description, ...option.aliases]
			.map(normalizeAreaSearchText)
			.some((candidate) => candidate.includes(normalized)),
	);
};

const normalizeCountryValue = (value: string): string =>
	normalizeSupportedNationalities(value) || value;

const normalizePlaceCountryCodeInput = (value: string): string =>
	value
		.trim()
		.toUpperCase()
		.replace(/[^A-Z]/g, "")
		.slice(0, 2);

const SETTING_SEPARATOR_REGEX = /[,/&+\n\r]+/;

const splitSettingCell = (value: string): string[] =>
	value
		.split(SETTING_SEPARATOR_REGEX)
		.map((part) => part.trim().toLowerCase())
		.filter((part) => part.length > 0)
		.flatMap((part) => {
			if (part.includes("indoor") || part.includes("inside")) return ["Indoor"];
			if (
				part.includes("outdoor") ||
				part.includes("outside") ||
				part.includes("open air")
			) {
				return ["Outdoor"];
			}
			return [];
		})
		.filter((value, index, values) => values.indexOf(value) === index);

const normalizeSettingValue = (value: string): string => {
	const selected = splitSettingCell(value);
	return selected.length > 0 ? selected.join(", ") : value.trim();
};

const normalizeEventCategoryValue = (value: string): string => {
	const category = normalizeEventExperienceCategory(value);
	return category ? formatEventExperienceCategory(category) : value.trim();
};

const isCuratedValue = (value: string): boolean => {
	const normalized = value.trim().toLowerCase();
	return value.includes(CURATED_PICK_VALUE) || normalized.includes("pick");
};

const URL_SEPARATOR_REGEX = /[,\n\r|]+/;
const URL_SCHEME_REGEX = /^[a-z][a-z\d+\-.]*:\/\//i;
const DOMAIN_LIKE_REGEX =
	/^(?:www\.)?[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+(?:[/?#].*)?$/i;

const normalizeUrlPart = (value: string): string => {
	const trimmed = value.trim();
	if (!trimmed || /\s/.test(trimmed)) return trimmed;
	if (URL_SCHEME_REGEX.test(trimmed)) return trimmed;
	if (DOMAIN_LIKE_REGEX.test(trimmed)) return `https://${trimmed}`;
	return trimmed;
};

const normalizeUrlValue = (value: string): string =>
	value
		.split(URL_SEPARATOR_REGEX)
		.map(normalizeUrlPart)
		.filter((part) => part.length > 0)
		.join(", ");

const splitUrlRawParts = (value: string): string[] =>
	value
		.split(URL_SEPARATOR_REGEX)
		.map((part) => part.trim())
		.filter((part) => part.length > 0);

const parseUrlParts = (value: string): ParsedUrlPart[] =>
	splitUrlRawParts(value).map((raw) => {
		const normalized = normalizeUrlPart(raw);
		try {
			const url = new URL(normalized);
			const isValid = url.protocol === "http:" || url.protocol === "https:";
			return {
				raw,
				normalized,
				isValid,
				host: isValid ? url.hostname.replace(/^www\./, "") : null,
			};
		} catch {
			return { raw, normalized, isValid: false, host: null };
		}
	});

const isValidHttpUrl = (value: string): boolean => {
	try {
		const url = new URL(value);
		return url.protocol === "http:" || url.protocol === "https:";
	} catch {
		return false;
	}
};

const normalizePriceValue = (value: string): string => {
	const trimmed = value.trim().replace(/\s+/g, " ");
	const normalized = trimmed.toLowerCase();
	if (!trimmed) return "";
	if (/^(?:free|0|0\.00|[€£$]0(?:\.00)?)$/.test(normalized)) return "Free";
	if (normalized === "tba") return "TBA";
	if (normalized === "tbc") return "TBC";
	return trimmed.replace(/\s*[-–—]\s*/g, " - ");
};

const normalizeLocationSearchText = (value: string): string =>
	value
		.trim()
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.replace(/\s+/g, " ")
		.trim();

const splitLocationRawParts = (value: string): string[] =>
	value
		.split(/[\n\r|;]+/)
		.map((part) => part.trim())
		.filter((part) => part.length > 0);

const joinLocationParts = (values: string[]): string =>
	values
		.map((value) => value.trim())
		.filter((value) => value.length > 0)
		.join(" | ");

const splitAreaRawParts = (value: string): string[] =>
	value
		.split(/[\n\r|;]+/)
		.map((part) => normalizeAreaValue(part.trim()))
		.filter((part) => part.length > 0);

const joinAreaParts = (values: string[]): string =>
	values
		.map((value) => normalizeAreaValue(value.trim()))
		.filter((value) => value.length > 0)
		.join(" | ");

const buildLocationAreaPairs = (
	locationValue: string,
	areaValue: string,
): Array<{ location: string; area: string }> => {
	const locations = splitLocationRawParts(locationValue);
	const areas = splitAreaRawParts(areaValue);
	return locations.map((location, index) => ({
		location,
		area:
			areas.length === locations.length
				? (areas[index] ?? "")
				: areas.length === 1 && areas[0] !== "Multiple Locations"
					? areas[0]
					: "",
	}));
};

const splitMetadataRawParts = (value: string | undefined): string[] =>
	(value ?? "").split(/[\n\r|;]+/).map((part) => part.trim());

const joinMetadataParts = (values: string[], minLength = 0): string => {
	const parts = values.map((value) => value.trim());
	if (!parts.some(Boolean)) return "";
	while (parts.length > minLength && !parts[parts.length - 1]) {
		parts.pop();
	}
	return parts.join(" | ");
};

const getMetadataPart = (
	value: string | undefined,
	index: number,
): string | undefined => {
	const parts = splitMetadataRawParts(value);
	if (parts.length === 0) return undefined;
	if (parts.length === 1) return parts[0];
	return parts[index];
};

const buildLocationPlaceContext = (
	row: EditableSheetRow,
	index: number = 0,
) => ({
	address: getMetadataPart(row[LOCATION_ADDRESS_COLUMN_KEY], index),
	postalCode: normalizePostalCode(
		getMetadataPart(row[POSTAL_CODE_COLUMN_KEY], index),
	),
	city: normalizeCity(getMetadataPart(row[CITY_COLUMN_KEY], index)),
	countryCode: row[COUNTRY_CODE_COLUMN_KEY]?.trim()
		? normalizeCountryCode(getMetadataPart(row[COUNTRY_CODE_COLUMN_KEY], index))
		: undefined,
});

const deriveAreaLabelFromRow = (
	row: EditableSheetRow,
	index: number = 0,
): string => {
	const context = buildLocationPlaceContext(row, index);
	const derived = deriveAreaFromPostalCodeCity(
		context.postalCode,
		context.city,
	);
	if (!derived) return "";
	if (typeof derived === "number") return String(derived);
	if (derived === "greater-paris") return "Greater Paris";
	if (derived === "outside-paris") return "Outside Paris";
	return "";
};

const getEffectiveAreaLabelFromRow = (
	row: EditableSheetRow,
	index: number = 0,
): string => {
	const area = buildLocationAreaPairs(
		row[LOCATION_COLUMN_KEY] ?? "",
		row[AREA_COLUMN_KEY] ?? "",
	)[index]?.area;
	return area || deriveAreaLabelFromRow(row, index);
};

const getLocationTrustRank = (state: SheetLocationTrustState): number => {
	if (state === "unresolved") return 0;
	if (state === "approximate") return 1;
	if (state === "geocoded") return 2;
	return 3;
};

const getLocationCellLabel = (
	state: SheetLocationTrustState,
	hasAliasWarning: boolean,
): string => {
	if (hasAliasWarning) return "Check similar location";
	if (state === "manual") return "Manual coordinates";
	if (state === "geocoded") return "Geocoded";
	if (state === "approximate") return "Approximate";
	return "Unresolved";
};

const getLocationDotClassName = (
	state: SheetLocationTrustState,
	hasAliasWarning: boolean,
): string => {
	if (hasAliasWarning) return "border-amber-500 bg-amber-500";
	if (state === "manual") return "border-emerald-700 bg-emerald-700";
	if (state === "geocoded") return "border-emerald-500 bg-emerald-500";
	if (state === "approximate") return "border-amber-400 bg-transparent";
	return "border-muted-foreground/35 bg-transparent";
};

const buildLocationCellTitle = (status: LocationCellStatus): string => {
	const lines = status.parts.map((part) => {
		const base = `${part.name || "Location TBC"}: ${getLocationCellLabel(
			part.trustState,
			part.aliases.length > 0,
		)}`;
		const address = part.resolution?.formattedAddress
			? ` (${part.resolution.formattedAddress})`
			: "";
		const aliases =
			part.aliases.length > 0
				? `; similar: ${part.aliases.map((alias) => alias.name).join(", ")}`
				: "";
		return `${base}${address}${aliases}`;
	});
	return lines.join("\n");
};

const toUTCDateOnlyTime = (date: Date): number =>
	Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

const formatDateSuggestionLabel = (isoDate: string): string => {
	const parsed = new Date(`${isoDate}T00:00:00.000Z`);
	if (Number.isNaN(parsed.getTime())) return isoDate;
	return parsed.toLocaleDateString("en-GB", {
		weekday: "short",
		day: "2-digit",
		month: "short",
		timeZone: "UTC",
	});
};

const normalizeSeriesSearchText = (value: string): string =>
	value
		.trim()
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();

const buildSeriesKeySuggestions = (
	currentRowIndex: number,
	rows: EditableSheetRow[],
): SeriesKeySuggestion[] => {
	const currentRow = rows[currentRowIndex];
	if (!currentRow) return [];

	const currentSeriesKey = String(
		currentRow[SERIES_KEY_COLUMN_KEY] ?? "",
	).trim();
	const rawQuery =
		currentSeriesKey ||
		[
			currentRow[TITLE_COLUMN_KEY],
			currentRow[DATE_COLUMN_KEY],
			currentRow[LOCATION_COLUMN_KEY],
		]
			.filter(Boolean)
			.join(" ");
	const query = normalizeSeriesSearchText(rawQuery);
	const explicitSeriesCounts = new Map<string, number>();
	for (const row of rows) {
		const key = String(row[SERIES_KEY_COLUMN_KEY] ?? "").trim();
		if (!key) continue;
		explicitSeriesCounts.set(key, (explicitSeriesCounts.get(key) ?? 0) + 1);
	}

	const suggestions = new Map<string, SeriesKeySuggestion>();
	rows.forEach((row, rowIndex) => {
		if (rowIndex === currentRowIndex) return;
		const explicitSeriesKey = String(row[SERIES_KEY_COLUMN_KEY] ?? "").trim();
		if (explicitSeriesKey && explicitSeriesKey === currentSeriesKey) return;
		const seriesKey = explicitSeriesKey || generateEditableSheetSeriesKey(row);
		const mapKey = explicitSeriesKey || `row:${rowIndex}`;
		if (suggestions.has(mapKey)) return;

		const title = String(row[TITLE_COLUMN_KEY] ?? "").trim();
		const date = String(row[DATE_COLUMN_KEY] ?? "").trim();
		const location = String(row[LOCATION_COLUMN_KEY] ?? "").trim();
		const haystack = normalizeSeriesSearchText(
			[title, date, location, seriesKey].join(" "),
		);
		const isDirectMatch = query.length === 0 || haystack.includes(query);
		const titleTokens = normalizeSeriesSearchText(
			String(currentRow[TITLE_COLUMN_KEY] ?? ""),
		)
			.split(" ")
			.filter((token) => token.length >= 4);
		const hasTitleOverlap =
			titleTokens.length > 0 &&
			titleTokens.some((token) => haystack.includes(token));
		if (!isDirectMatch && !hasTitleOverlap) return;

		suggestions.set(mapKey, {
			rowIndex,
			seriesKey,
			title: title || "Untitled row",
			date,
			location,
			rowCount: explicitSeriesKey
				? (explicitSeriesCounts.get(explicitSeriesKey) ?? 1)
				: 1,
			willCreateSeriesKey: !explicitSeriesKey,
		});
	});

	return Array.from(suggestions.values())
		.sort((left, right) => {
			const leftExisting = left.willCreateSeriesKey ? 1 : 0;
			const rightExisting = right.willCreateSeriesKey ? 1 : 0;
			return (
				leftExisting - rightExisting ||
				right.rowCount - left.rowCount ||
				left.title.localeCompare(right.title) ||
				left.rowIndex - right.rowIndex
			);
		})
		.slice(0, 8);
};

const parseNormalizedTimeParts = (
	value: string,
): { hours: number; minutes: number } | null => {
	const match = value.trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);
	if (!match) return null;
	return {
		hours: Number.parseInt(match[1], 10),
		minutes: Number.parseInt(match[2], 10),
	};
};

const formatTwelveHourTime = (value: string): string | null => {
	const parts = parseNormalizedTimeParts(value);
	if (!parts) return null;

	const period = parts.hours >= 12 ? "pm" : "am";
	const displayHours = parts.hours % 12 || 12;
	return `${displayHours}:${parts.minutes.toString().padStart(2, "0")} ${period}`;
};

const getTimeInputPreview = (value: string): TimeInputPreview | null => {
	const trimmed = value.trim();
	if (!trimmed) return null;

	const normalized = DateTransformers.convertToTime(trimmed);
	const normalizedLower = normalized.toLowerCase();
	if (normalizedLower === "tbc" || normalizedLower === "tba") {
		return {
			tone: "success",
			message: `Will save as ${normalized.toUpperCase()}`,
		};
	}

	const twelveHour = formatTwelveHourTime(normalized);
	if (twelveHour) {
		return {
			tone: "success",
			message:
				normalized === trimmed
					? `Valid time: ${normalized} (${twelveHour})`
					: `Will save as ${normalized} (${twelveHour})`,
		};
	}

	return {
		tone: "muted",
		message: "Will save as typed",
	};
};

const getNormalizedSheetDate = (
	value: string,
	context: ReturnType<typeof createDateNormalizationContext>,
): string | null => {
	const normalized = normalizeCsvDate(value, context);
	return normalized.isoDate || null;
};

const formatDateCellHint = (
	value: string,
	context: ReturnType<typeof createDateNormalizationContext>,
): string | null => {
	const normalized = normalizeCsvDate(value, context);
	if (!normalized.isoDate) return null;

	const parsed = new Date(`${normalized.isoDate}T00:00:00.000Z`);
	if (Number.isNaN(parsed.getTime())) return null;

	return parsed.toLocaleDateString("en-GB", {
		weekday: "short",
		day: "2-digit",
		month: "short",
		year: "numeric",
		timeZone: "UTC",
	});
};

const buildCommonFeteDates = (year: number): DateSuggestionOption[] =>
	FETE_DATE_OFFSETS.map((offset) => {
		const date = new Date(Date.UTC(year, 5, 21 + offset));
		const value = date.toISOString().slice(0, 10);
		return {
			value,
			label: formatDateSuggestionLabel(value),
			description: offset === 0 ? "Fete day" : "Fete week",
		};
	});

const pickUsefulFeteYear = (
	focusedRowIndex: number,
	rows: EditableSheetRow[],
	context: ReturnType<typeof createDateNormalizationContext>,
): number => {
	const adjacentYears = [rows[focusedRowIndex - 1], rows[focusedRowIndex + 1]]
		.map((row) =>
			row ? getNormalizedSheetDate(row[DATE_COLUMN_KEY] ?? "", context) : null,
		)
		.filter((date): date is string => Boolean(date))
		.map((date) => Number.parseInt(date.slice(0, 4), 10))
		.filter(Number.isInteger);
	if (adjacentYears.length > 0) return adjacentYears[0];

	const currentYear = new Date().getFullYear();
	const sheetYearCounts = new Map<number, number>();
	for (const row of rows) {
		const normalized = getNormalizedSheetDate(
			row[DATE_COLUMN_KEY] ?? "",
			context,
		);
		if (!normalized) continue;
		const year = Number.parseInt(normalized.slice(0, 4), 10);
		if (!Number.isInteger(year)) continue;
		sheetYearCounts.set(year, (sheetYearCounts.get(year) ?? 0) + 1);
	}

	const sortedSheetYears = Array.from(sheetYearCounts.entries()).sort(
		([leftYear, leftCount], [rightYear, rightCount]) => {
			const leftIsCurrentOrFuture = leftYear >= currentYear;
			const rightIsCurrentOrFuture = rightYear >= currentYear;
			if (leftIsCurrentOrFuture !== rightIsCurrentOrFuture) {
				return leftIsCurrentOrFuture ? -1 : 1;
			}
			if (leftCount !== rightCount) return rightCount - leftCount;
			return (
				Math.abs(leftYear - currentYear) - Math.abs(rightYear - currentYear)
			);
		},
	);
	if (sortedSheetYears.length > 0) return sortedSheetYears[0][0];

	return Math.max(context.inferredYear, currentYear);
};

const getRowDateTime = (
	row: EditableSheetRow,
	context: ReturnType<typeof createDateNormalizationContext>,
): number | null => {
	return toEditableSheetRowSortableDateTime(row, context);
};

const getRowLifecycleTime = (
	row: EditableSheetRow,
	metadataByEventKey: Map<string, EventRowLifecycleMetadata>,
	options: RowLifecycleOptions = {},
): number => {
	const eventKey = row.eventKey?.trim();
	const metadata = eventKey ? metadataByEventKey.get(eventKey) : undefined;
	if (!options.suppressUpdated) {
		const changedTime = Date.parse(metadata?.lastMeaningfulChangeAt ?? "");
		if (Number.isFinite(changedTime)) return changedTime;
	}
	const firstSeenTime = Date.parse(metadata?.firstSeenAt ?? "");
	return Number.isFinite(firstSeenTime) ? firstSeenTime : 0;
};

const getLifecycleMinuteKey = (value: string): string | null => {
	const time = Date.parse(value);
	if (!Number.isFinite(time)) return null;
	return new Date(Math.floor(time / 60_000) * 60_000).toISOString();
};

const hasLifecycleUpdateFlood = (
	metadata: EventRowLifecycleMetadata[],
): boolean => {
	if (metadata.length < 20) return false;
	const updatedMinuteCounts = new Map<string, number>();

	for (const record of metadata) {
		if (!isRecentlyUpdatedEvent(record)) continue;
		const minuteKey = getLifecycleMinuteKey(record.lastMeaningfulChangeAt);
		if (!minuteKey) continue;
		updatedMinuteCounts.set(
			minuteKey,
			(updatedMinuteCounts.get(minuteKey) ?? 0) + 1,
		);
	}

	const largestBucket = Math.max(0, ...updatedMinuteCounts.values());
	return (
		largestBucket >= 20 && largestBucket / Math.max(1, metadata.length) >= 0.35
	);
};

const getRowLifecycleBadge = (
	row: EditableSheetRow,
	metadataByEventKey: Map<string, EventRowLifecycleMetadata>,
	options: RowLifecycleOptions = {},
): RowLifecycleBadge | null => {
	const eventKey = row.eventKey?.trim();
	const metadata = eventKey ? metadataByEventKey.get(eventKey) : undefined;
	if (!metadata) return null;

	if (isRecentlyAddedEvent(metadata)) {
		return {
			label: formatRecentlyAddedLabel(metadata),
			shortLabel: "New",
			title: "This row was added recently",
			tone: "added",
		};
	}

	if (options.suppressUpdated) return null;

	if (isRecentlyUpdatedEvent(metadata)) {
		return {
			label: formatRecentlyUpdatedLabel(metadata),
			shortLabel: "Updated",
			title: "This row was updated recently",
			tone: "updated",
		};
	}

	return null;
};

const sortRowIndexes = (
	indexes: number[],
	rows: EditableSheetRow[],
	sortMode: SheetSortMode,
	metadataByEventKey: Map<string, EventRowLifecycleMetadata> = new Map(),
	lifecycleOptions: RowLifecycleOptions = {},
): number[] => {
	if (sortMode === "sheet-order") {
		return indexes;
	}

	if (sortMode === "fresh-lifecycle") {
		return [...indexes].sort((leftIndex, rightIndex) => {
			const leftTime = getRowLifecycleTime(
				rows[leftIndex],
				metadataByEventKey,
				lifecycleOptions,
			);
			const rightTime = getRowLifecycleTime(
				rows[rightIndex],
				metadataByEventKey,
				lifecycleOptions,
			);
			return rightTime - leftTime || leftIndex - rightIndex;
		});
	}

	const referenceDate = new Date();
	const today = toUTCDateOnlyTime(referenceDate);
	const context = createDateNormalizationContext(
		rows.map((row) => ({ date: row.date ?? "", dateTo: row.dateTo ?? "" })),
		{ referenceDate },
	);
	const dateTimes = new Map<number, number | null>(
		indexes.map((index) => [index, getRowDateTime(rows[index], context)]),
	);

	return [...indexes].sort((leftIndex, rightIndex) => {
		const leftTime = dateTimes.get(leftIndex) ?? null;
		const rightTime = dateTimes.get(rightIndex) ?? null;
		if (leftTime === null && rightTime === null) {
			return leftIndex - rightIndex;
		}
		if (leftTime === null) return 1;
		if (rightTime === null) return -1;

		if (sortMode === "date-asc") {
			return leftTime - rightTime || leftIndex - rightIndex;
		}
		if (sortMode === "date-desc") {
			return rightTime - leftTime || leftIndex - rightIndex;
		}

		const leftIsPast = leftTime < today;
		const rightIsPast = rightTime < today;
		if (leftIsPast !== rightIsPast) {
			return leftIsPast ? 1 : -1;
		}

		const direction = sortMode === "latest-upcoming" || leftIsPast ? -1 : 1;
		const dateComparison = (leftTime - rightTime) * direction;
		return dateComparison || leftIndex - rightIndex;
	});
};

function initialEditorState(initialEditorData?: EditorPayload): {
	loading: boolean;
	columns: EditableSheetColumn[];
	rows: EditableSheetRow[];
	statusMessage: string;
	lastSavedAt: string | null;
} {
	const hasInitial =
		initialEditorData?.success &&
		initialEditorData.columns &&
		initialEditorData.rows;
	return {
		loading: !hasInitial,
		columns: hasInitial ? (initialEditorData.columns ?? []) : [],
		rows: hasInitial ? (initialEditorData.rows ?? []) : [],
		statusMessage: hasInitial
			? `Loaded ${initialEditorData.rows?.length ?? 0} rows and ${initialEditorData.columns?.length ?? 0} columns from Postgres store`
			: "Loading sheet...",
		lastSavedAt: hasInitial
			? (initialEditorData.status?.updatedAt ?? null)
			: null,
	};
}

export const EventSheetEditorCard = ({
	isAuthenticated,
	initialDeploymentId,
	initialEditorData,
	pendingEventReviews = [],
	onDataSaved,
}: EventSheetEditorCardProps) => {
	const initial = initialEditorState(initialEditorData);
	const [isLoading, setIsLoading] = useState(initial.loading);
	const [isSaving, setIsSaving] = useState(false);
	const [rows, setRows] = useState<EditableSheetRow[]>(initial.rows);
	const [columns, setColumns] = useState<EditableSheetColumn[]>(
		initial.columns,
	);
	const [query, setQuery] = useState("");
	const [statusMessage, setStatusMessage] = useState(initial.statusMessage);
	const [errorMessage, setErrorMessage] = useState("");
	const [lastSavedAt, setLastSavedAt] = useState<string | null>(
		initial.lastSavedAt,
	);
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
	const [saveScheduleVersion, setSaveScheduleVersion] = useState(0);
	const [activeDeploymentId] = useState(initialDeploymentId);
	const [latestDeploymentId, setLatestDeploymentId] =
		useState(initialDeploymentId);
	const [hasNewDeployment, setHasNewDeployment] = useState(false);
	const [recoverableDraft, setRecoverableDraft] =
		useState<StoredEditorDraft | null>(null);
	const [newColumnLabel, setNewColumnLabel] = useState("");
	const [displayLimit, setDisplayLimit] = useState(50);
	const [pinnedColumnsCount, setPinnedColumnsCount] = useState(0);
	const [showAdvancedColumns, setShowAdvancedColumns] = useState(false);
	const [sortMode, setSortMode] = useState<SheetSortMode>(DEFAULT_SORT_MODE);
	const [qualityFilter, setQualityFilter] = useState<RowQualityValue | null>(
		null,
	);
	const [canUndo, setCanUndo] = useState(false);
	const [canRedo, setCanRedo] = useState(false);
	const [genreTaxonomy, setGenreTaxonomy] = useState<
		GenreTaxonomySnapshot | undefined
	>(initialEditorData?.genreTaxonomy);
	const [rowMetadata, setRowMetadata] = useState<EventRowLifecycleMetadata[]>(
		initialEditorData?.rowMetadata ?? [],
	);
	const [locationResolutionIndex, setLocationResolutionIndex] =
		useState<SheetLocationResolutionIndex>(
			initialEditorData?.locationResolutionIndex ?? {},
		);
	const [sheetRevisions, setSheetRevisions] = useState<
		EventSheetRevisionRecord[]
	>(initialEditorData?.sheetRevisions ?? []);
	const [isSheetRevisionSupported, setIsSheetRevisionSupported] = useState(
		initialEditorData?.sheetRevisionSupported !== false,
	);
	const [isRevisionHistoryOpen, setIsRevisionHistoryOpen] = useState(false);
	const [isOcrDraftModalOpen, setIsOcrDraftModalOpen] = useState(false);
	const [revisionPreview, setRevisionPreview] =
		useState<RevisionSnapshotPayload | null>(null);
	const [isLoadingRevisionPreview, setIsLoadingRevisionPreview] =
		useState(false);
	const [restoreReviewRevision, setRestoreReviewRevision] =
		useState<EventSheetRevisionRecord | null>(null);
	const [isGenreManagerOpen, setIsGenreManagerOpen] = useState(false);
	const [newGenreLabel, setNewGenreLabel] = useState("");
	const [aliasInput, setAliasInput] = useState("");
	const [aliasGenreKey, setAliasGenreKey] = useState("");
	const [focusedCategoryRowIndex, setFocusedCategoryRowIndex] = useState<
		number | null
	>(null);
	const [focusedGenreCell, setFocusedGenreCell] = useState<FocusedCell | null>(
		null,
	);
	const [genreSearchQuery, setGenreSearchQuery] = useState("");
	const [highlightedGenreIndex, setHighlightedGenreIndex] = useState(0);
	const [focusedCountryCell, setFocusedCountryCell] =
		useState<FocusedCell | null>(null);
	const [countrySearchQuery, setCountrySearchQuery] = useState("");
	const [highlightedCountryIndex, setHighlightedCountryIndex] = useState(0);
	const [focusedDateCell, setFocusedDateCell] = useState<FocusedCell | null>(
		null,
	);
	const [focusedTimeCell, setFocusedTimeCell] = useState<FocusedCell | null>(
		null,
	);
	const [focusedLocationCell, setFocusedLocationCell] =
		useState<FocusedCell | null>(null);
	const [locationSearchQuery, setLocationSearchQuery] = useState("");
	const [highlightedLocationIndex, setHighlightedLocationIndex] = useState(0);
	const [focusedPrimaryUrlCell, setFocusedPrimaryUrlCell] =
		useState<FocusedCell | null>(null);
	const [focusedAreaCell, setFocusedAreaCell] = useState<FocusedCell | null>(
		null,
	);
	const [areaSearchQuery, setAreaSearchQuery] = useState("");
	const [highlightedAreaIndex, setHighlightedAreaIndex] = useState(0);
	const [focusedSettingCell, setFocusedSettingCell] =
		useState<FocusedCell | null>(null);
	const [highlightedSettingIndex, setHighlightedSettingIndex] = useState(0);
	const [focusedEventCategoryCell, setFocusedEventCategoryCell] =
		useState<FocusedCell | null>(null);
	const [highlightedEventCategoryIndex, setHighlightedEventCategoryIndex] =
		useState(0);
	const [focusedAgeCell, setFocusedAgeCell] = useState<FocusedCell | null>(
		null,
	);
	const [highlightedAgeIndex, setHighlightedAgeIndex] = useState(0);
	const [focusedSeriesKeyCell, setFocusedSeriesKeyCell] =
		useState<FocusedCell | null>(null);
	const [qualityPopover, setQualityPopover] =
		useState<QualityPopoverState | null>(null);
	const [eventCategoryPopover, setEventCategoryPopover] =
		useState<EventCategoryPopoverState | null>(null);
	const [rangePreviewRowIndex, setRangePreviewRowIndex] = useState<
		number | null
	>(null);
	const [detailRowIndex, setDetailRowIndex] = useState<number | null>(null);
	const [activeCellDraft, setActiveCellDraft] = useState<CellDraft | null>(
		null,
	);
	const hasBlankDraftRows = useMemo(
		() => pruneEmptyEditableSheetRows(rows).length !== rows.length,
		[rows],
	);
	const blockingRequiredIssues = useMemo(
		() => getRequiredSheetHealthIssues(rows),
		[rows],
	);
	const [autosaveBlockedAtEditVersion, setAutosaveBlockedAtEditVersion] =
		useState<number | null>(null);
	const [autosaveRetryBlockedUntil, setAutosaveRetryBlockedUntil] = useState<
		number | null
	>(null);
	const [lastAutosaveError, setLastAutosaveError] = useState<{
		message: string;
		at: string;
	} | null>(null);

	const rowsRef = useRef<EditableSheetRow[]>([]);
	const columnsRef = useRef<EditableSheetColumn[]>([]);
	const pastRef = useRef<EditorSnapshot[]>([]);
	const futureRef = useRef<EditorSnapshot[]>([]);
	const cellDraftRef = useRef<CellDraft | null>(null);
	const activeCellEditRef = useRef<string | null>(null);
	const editingLockedRef = useRef(false);
	const editVersionRef = useRef(0);
	const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const dirtyCellBatchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const dirtyRowIndexesRef = useRef<Set<number>>(new Set());
	const inputRefs = useRef<Record<string, HTMLElement | null>>({});
	const locationPartInputRefs = useRef<Record<string, HTMLInputElement | null>>(
		{},
	);
	const urlPartInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
	const primaryUrlBlurTimerRef = useRef<number | null>(null);
	const isAutosaveInBackoff =
		typeof autosaveRetryBlockedUntil === "number" &&
		autosaveRetryBlockedUntil > Date.now();
	const autosavePauseReason = !hasUnsavedChanges
		? null
		: hasBlankDraftRows
			? "blank-draft-row"
			: blockingRequiredIssues.length > 0
				? "missing-required-fields"
				: autosaveBlockedAtEditVersion === editVersionRef.current
					? "awaiting-edit-after-error"
					: isAutosaveInBackoff
						? "retry-backoff"
						: null;

	const updateRevisionHistory = useCallback(
		(revision: EventSheetRevisionRecord | null | undefined) => {
			if (!revision) return;
			setSheetRevisions((current) =>
				[revision, ...current.filter((item) => item.id !== revision.id)].slice(
					0,
					24,
				),
			);
		},
		[],
	);

	const clearInlineHelpers = useCallback(() => {
		cellDraftRef.current = null;
		setActiveCellDraft(null);
		setFocusedGenreCell(null);
		setGenreSearchQuery("");
		setFocusedCountryCell(null);
		setCountrySearchQuery("");
		setFocusedDateCell(null);
		setFocusedTimeCell(null);
		setFocusedLocationCell(null);
		setLocationSearchQuery("");
		setFocusedPrimaryUrlCell(null);
		setFocusedAreaCell(null);
		setAreaSearchQuery("");
		setFocusedSettingCell(null);
		setFocusedEventCategoryCell(null);
		setEventCategoryPopover(null);
		setFocusedAgeCell(null);
		setFocusedSeriesKeyCell(null);
	}, []);

	const openDetailDrawer = useCallback(
		(rowIndex: number) => {
			activeCellEditRef.current = null;
			clearInlineHelpers();
			setQualityPopover(null);
			setDetailRowIndex(rowIndex);
		},
		[clearInlineHelpers],
	);

	useEffect(() => {
		rowsRef.current = rows;
	}, [rows]);

	useEffect(() => {
		return () => {
			if (dirtyCellBatchTimerRef.current) {
				clearTimeout(dirtyCellBatchTimerRef.current);
			}
		};
	}, []);

	useEffect(() => {
		columnsRef.current = columns;
	}, [columns]);

	const visibleColumns = useMemo(
		() =>
			showAdvancedColumns
				? columns
				: columns.filter((column) => !ADVANCED_COLUMN_KEYS.has(column.key)),
		[columns, showAdvancedColumns],
	);

	useEffect(() => {
		editingLockedRef.current = hasNewDeployment;
	}, [hasNewDeployment]);

	const cloneSnapshot = useCallback(
		(
			sourceColumns: EditableSheetColumn[],
			sourceRows: EditableSheetRow[],
		): EditorSnapshot => ({
			columns: sourceColumns.map((column) => ({ ...column })),
			rows: sourceRows.map((row) => ({ ...row })),
		}),
		[],
	);

	const refreshHistoryFlags = useCallback(() => {
		setCanUndo(pastRef.current.length > 0);
		setCanRedo(futureRef.current.length > 0);
	}, []);

	const pushHistorySnapshot = useCallback(() => {
		pastRef.current.push(cloneSnapshot(columnsRef.current, rowsRef.current));
		if (pastRef.current.length > HISTORY_LIMIT) {
			pastRef.current.shift();
		}
		futureRef.current = [];
		refreshHistoryFlags();
	}, [cloneSnapshot, refreshHistoryFlags]);

	const applySnapshot = useCallback(
		(snapshot: EditorSnapshot, statusMessage: string) => {
			const nextColumns = snapshot.columns.map((column) => ({ ...column }));
			const nextRows = snapshot.rows.map((row) => ({ ...row }));
			activeCellEditRef.current = null;
			clearInlineHelpers();
			columnsRef.current = nextColumns;
			rowsRef.current = nextRows;
			setColumns(nextColumns);
			setRows(nextRows);
			setHasUnsavedChanges(true);
			setSaveScheduleVersion((current) => current + 1);
			editVersionRef.current += 1;
			setStatusMessage(statusMessage);
		},
		[clearInlineHelpers],
	);

	const loadEditorData = useCallback(async () => {
		if (!isAuthenticated) return;

		setIsLoading(true);
		setErrorMessage("");
		try {
			const result = await fetchEditorData();
			if (!result.success || !result.columns || !result.rows) {
				throw new Error(result.error || "Failed to load sheet data");
			}

			setColumns(result.columns);
			setRows(result.rows);
			setLocationResolutionIndex(result.locationResolutionIndex ?? {});
			setGenreTaxonomy(result.genreTaxonomy);
			setSheetRevisions(result.sheetRevisions ?? []);
			setIsSheetRevisionSupported(result.sheetRevisionSupported !== false);
			setRestoreReviewRevision(null);
			setLastSavedAt(result.status?.updatedAt ?? null);
			setHasUnsavedChanges(false);
			pastRef.current = [];
			futureRef.current = [];
			activeCellEditRef.current = null;
			clearInlineHelpers();
			clearStoredEditorDraft();
			setRecoverableDraft(null);
			refreshHistoryFlags();
			setStatusMessage(
				`Loaded ${result.rows.length} rows and ${result.columns.length} columns from Postgres store`,
			);
		} catch (error) {
			setErrorMessage(
				error instanceof Error ? error.message : "Unknown load error",
			);
			setStatusMessage("Failed to load sheet");
		} finally {
			setIsLoading(false);
		}
	}, [clearInlineHelpers, isAuthenticated, refreshHistoryFlags]);

	const handleRefreshRevisionHistory = async () => {
		if (!isAuthenticated) return;
		setErrorMessage("");
		try {
			const result = await fetchEditorData();
			if (!result.success) {
				throw new Error(result.error || "Failed to load revision history");
			}
			setSheetRevisions(result.sheetRevisions ?? []);
			setIsSheetRevisionSupported(result.sheetRevisionSupported !== false);
			setStatusMessage("Revision history refreshed");
		} catch (error) {
			setErrorMessage(
				error instanceof Error
					? error.message
					: "Failed to load revision history",
			);
		}
	};

	const handlePreviewRevision = async (revision: EventSheetRevisionRecord) => {
		if (!revision.canRestore) {
			setErrorMessage(
				"That revision was recorded before restorable snapshots were enabled.",
			);
			return;
		}

		setErrorMessage("");
		setIsLoadingRevisionPreview(true);
		try {
			const result = await fetchRevisionSnapshot(revision.id);
			if (
				!result.success ||
				!result.revision ||
				!result.columns ||
				!result.rows
			) {
				throw new Error(result.error || "Failed to load revision snapshot");
			}
			setRevisionPreview(result);
			setIsRevisionHistoryOpen(true);
		} catch (error) {
			setErrorMessage(
				error instanceof Error
					? error.message
					: "Failed to load revision snapshot",
			);
		} finally {
			setIsLoadingRevisionPreview(false);
		}
	};

	const handleRestoreRevisionPreview = () => {
		if (
			!revisionPreview?.revision ||
			!revisionPreview.columns ||
			!revisionPreview.rows
		) {
			return;
		}

		pushHistorySnapshot();
		activeCellEditRef.current = null;
		clearInlineHelpers();
		const nextColumns = revisionPreview.columns.map((column) => ({
			...column,
		}));
		const nextRows = revisionPreview.rows.map((row) => ({ ...row }));
		columnsRef.current = nextColumns;
		rowsRef.current = nextRows;
		setColumns(nextColumns);
		setRows(nextRows);
		setRestoreReviewRevision(revisionPreview.revision);
		setHasUnsavedChanges(true);
		editVersionRef.current += 1;
		setQuery("");
		setSortMode("sheet-order");
		clearStoredEditorDraft();
		setRecoverableDraft(null);
		setStatusMessage(
			`Restored revision loaded for review (${revisionPreview.rows.length} rows). Publish when ready.`,
		);
		setIsRevisionHistoryOpen(false);
	};

	const handleDiscardRestoredRevision = () => {
		setRestoreReviewRevision(null);
		setRevisionPreview(null);
		void loadEditorData();
	};

	const hasInitialEditorData = Boolean(
		initialEditorData?.success &&
			initialEditorData.columns &&
			initialEditorData.rows,
	);

	useEffect(() => {
		if (hasInitialEditorData) {
			return;
		}
		void loadEditorData();
	}, [hasInitialEditorData, loadEditorData]);

	useEffect(() => {
		if (!isAuthenticated) return;

		const handleEventSheetRefresh = async () => {
			if (hasUnsavedChanges) {
				setStatusMessage(
					"Submission accepted. Save or discard local sheet edits, then reload to see the new row.",
				);
				return;
			}
			await loadEditorData();
			setSortMode("fresh-lifecycle");
			setDisplayLimit(50);
			setStatusMessage(
				"Submission accepted. Showing recently added/updated rows first.",
			);
		};

		const refreshListener = () => void handleEventSheetRefresh();
		window.addEventListener(ADMIN_EVENT_SHEET_REFRESH_EVENT, refreshListener);
		return () => {
			window.removeEventListener(
				ADMIN_EVENT_SHEET_REFRESH_EVENT,
				refreshListener,
			);
		};
	}, [hasUnsavedChanges, isAuthenticated, loadEditorData]);

	useEffect(() => {
		const draft = readStoredEditorDraft();
		if (!draft) return;
		setRecoverableDraft(draft);
	}, []);

	useEffect(() => {
		if (!hasUnsavedChanges) return;
		writeStoredEditorDraft({
			columns: columns.map((column) => ({ ...column })),
			rows: rows.map((row) => ({ ...row })),
			savedAt: new Date().toISOString(),
			deploymentId: activeDeploymentId,
		});
	}, [activeDeploymentId, columns, hasUnsavedChanges, rows]);

	useEffect(() => {
		if (!hasUnsavedChanges) return;

		const handleBeforeUnload = (event: BeforeUnloadEvent) => {
			event.preventDefault();
			event.returnValue = "";
		};

		window.addEventListener("beforeunload", handleBeforeUnload);
		return () => {
			window.removeEventListener("beforeunload", handleBeforeUnload);
		};
	}, [hasUnsavedChanges]);

	useEffect(() => {
		if (!isAuthenticated) return;

		const checkDeployment = async () => {
			if (document.visibilityState !== "visible") return;
			try {
				const response = await fetch(buildApiPath(DEPLOYMENT_STATUS_ENDPOINT), {
					method: "GET",
					credentials: "same-origin",
					headers: {
						Accept: "application/json",
					},
					cache: "no-store",
				});
				if (!response.ok) return;
				const payload = (await response.json()) as {
					success?: boolean;
					deploymentId?: string;
				};
				if (!payload.success || !payload.deploymentId) return;
				setLatestDeploymentId(payload.deploymentId);
				if (payload.deploymentId !== activeDeploymentId) {
					setHasNewDeployment(true);
				}
			} catch {
				// Keep editing with the local draft if the status check is unreachable.
			}
		};

		void checkDeployment();
		const intervalId = window.setInterval(
			checkDeployment,
			DEPLOYMENT_POLL_INTERVAL_MS,
		);
		document.addEventListener("visibilitychange", checkDeployment);

		return () => {
			window.clearInterval(intervalId);
			document.removeEventListener("visibilitychange", checkDeployment);
		};
	}, [activeDeploymentId, isAuthenticated]);

	const performSave = useCallback(
		async (mode: "auto" | "manual"): Promise<boolean> => {
			const versionToSave = editVersionRef.current;
			setIsSaving(true);
			setErrorMessage("");

			try {
				const rowsToSave = pruneEmptyEditableSheetRows(rowsRef.current);
				const removedBlankRowCount = rowsRef.current.length - rowsToSave.length;
				const result = await saveEditorData(columnsRef.current, rowsToSave, {
					revalidateHomepage: mode === "manual",
					restoreRevisionId:
						mode === "manual"
							? (restoreReviewRevision?.id ?? undefined)
							: undefined,
				});
				if (!result.success) {
					throw new Error(result.error || result.message);
				}

				if (versionToSave === editVersionRef.current) {
					const savedColumns = result.columns ?? columnsRef.current;
					const savedRows = result.rows ?? rowsToSave;
					if (
						mode === "manual" &&
						(result.columns ||
							result.rows ||
							rowsToSave.length !== rowsRef.current.length)
					) {
						columnsRef.current = savedColumns;
						rowsRef.current = savedRows;
						setColumns(savedColumns);
						setRows(savedRows);
						setQuery("");
						setSortMode("sheet-order");
					}
					setAutosaveRetryBlockedUntil(null);
					setAutosaveBlockedAtEditVersion(null);
					setLastAutosaveError(null);
					setHasUnsavedChanges(false);
					clearStoredEditorDraft();
					setRecoverableDraft(null);
				}
				setLastSavedAt(result.updatedAt || new Date().toISOString());
				if (result.rowMetadata) {
					setRowMetadata(result.rowMetadata);
				}
				if (result.locationResolutionIndex) {
					setLocationResolutionIndex(result.locationResolutionIndex);
				}
				updateRevisionHistory(result.revision);
				const hasFreshPublishActivity =
					mode === "manual" &&
					((result.revision?.addedRows ?? 0) > 0 ||
						(result.revision?.changedRows ?? 0) > 0);
				if (hasFreshPublishActivity) {
					setSortMode("fresh-lifecycle");
					setDisplayLimit(50);
				}
				if (mode === "manual") {
					setRestoreReviewRevision(null);
				}
				setStatusMessage(
					hasFreshPublishActivity
						? "Saved to Postgres and homepage revalidated. Showing recently added/updated rows first."
						: mode === "auto"
							? removedBlankRowCount === 0
								? "Autosaved to Postgres (homepage revalidation pending)"
								: "Removed blank rows and autosaved to Postgres"
							: removedBlankRowCount === 0
								? "Saved to Postgres and homepage revalidated"
								: "Removed blank rows, saved to Postgres, and homepage revalidated",
				);

				if (onDataSaved && mode === "manual") {
					await onDataSaved();
				}
				return true;
			} catch (error) {
				const saveErrorMessage =
					error instanceof Error ? error.message : "Unknown save error";
				if (mode === "auto") {
					setAutosaveRetryBlockedUntil(Date.now() + AUTOSAVE_RETRY_BACKOFF_MS);
					setAutosaveBlockedAtEditVersion(editVersionRef.current);
					setLastAutosaveError({
						message: saveErrorMessage,
						at: new Date().toISOString(),
					});
					setStatusMessage("Autosave paused after save error. Edit to retry.");
					writeStoredEditorDraft({
						columns: columnsRef.current.map((column) => ({ ...column })),
						rows: rowsRef.current.map((row) => ({ ...row })),
						savedAt: new Date().toISOString(),
						deploymentId: activeDeploymentId,
					});
					return false;
				}
				setErrorMessage(saveErrorMessage);
				writeStoredEditorDraft({
					columns: columnsRef.current.map((column) => ({ ...column })),
					rows: rowsRef.current.map((row) => ({ ...row })),
					savedAt: new Date().toISOString(),
					deploymentId: activeDeploymentId,
				});
				return false;
			} finally {
				setIsSaving(false);
			}
		},
		[
			activeDeploymentId,
			onDataSaved,
			restoreReviewRevision,
			updateRevisionHistory,
		],
	);

	useEffect(() => {
		if (isAutosaveInBackoff && hasUnsavedChanges) {
			const remainingMs = Math.max(0, autosaveRetryBlockedUntil - Date.now());
			const retryTimer = window.setTimeout(() => {
				setSaveScheduleVersion((current) => current + 1);
			}, remainingMs);
			return () => window.clearTimeout(retryTimer);
		}

		if (
			!hasUnsavedChanges ||
			isSaving ||
			hasNewDeployment ||
			activeCellDraft ||
			hasBlankDraftRows ||
			blockingRequiredIssues.length > 0 ||
			autosaveBlockedAtEditVersion === editVersionRef.current ||
			isAutosaveInBackoff ||
			restoreReviewRevision ||
			saveScheduleVersion === 0
		) {
			return;
		}

		if (autosaveTimerRef.current) {
			clearTimeout(autosaveTimerRef.current);
		}

		autosaveTimerRef.current = setTimeout(() => {
			void performSave("auto");
		}, 850);

		return () => {
			if (autosaveTimerRef.current) {
				clearTimeout(autosaveTimerRef.current);
			}
		};
	}, [
		activeCellDraft,
		autosaveBlockedAtEditVersion,
		autosaveRetryBlockedUntil,
		blockingRequiredIssues.length,
		hasBlankDraftRows,
		hasNewDeployment,
		hasUnsavedChanges,
		isAutosaveInBackoff,
		isSaving,
		performSave,
		restoreReviewRevision,
		saveScheduleVersion,
	]);

	const markDirty = useCallback(() => {
		editVersionRef.current += 1;
		setHasUnsavedChanges(true);
		setSaveScheduleVersion((current) => current + 1);
		setAutosaveBlockedAtEditVersion(null);
		setAutosaveRetryBlockedUntil(null);
		setLastAutosaveError(null);
		setErrorMessage("");
	}, []);

	const markCellDirty = useCallback((rowIndex: number) => {
		editVersionRef.current += 1;
		setHasUnsavedChanges(true);
		setAutosaveBlockedAtEditVersion(null);
		setAutosaveRetryBlockedUntil(null);
		setLastAutosaveError(null);
		setErrorMessage("");
		dirtyRowIndexesRef.current.add(rowIndex);
		if (dirtyCellBatchTimerRef.current) {
			return;
		}
		dirtyCellBatchTimerRef.current = setTimeout(() => {
			dirtyCellBatchTimerRef.current = null;
			if (dirtyRowIndexesRef.current.size === 0) return;
			dirtyRowIndexesRef.current.clear();
			setSaveScheduleVersion((current) => current + 1);
		}, CELL_EDIT_BATCH_WINDOW_MS);
	}, []);

	const commitSheetMutation = useCallback(
		(
			nextColumns: EditableSheetColumn[],
			nextRows: EditableSheetRow[],
			status: string,
		) => {
			if (editingLockedRef.current) {
				setStatusMessage("Reload required before continuing edits");
				return;
			}
			pushHistorySnapshot();
			activeCellEditRef.current = null;
			clearInlineHelpers();
			columnsRef.current = nextColumns;
			rowsRef.current = nextRows;
			setColumns(nextColumns);
			setRows(nextRows);
			markDirty();
			setStatusMessage(status);
		},
		[clearInlineHelpers, markDirty, pushHistorySnapshot],
	);

	const handleCellChange = useCallback(
		(rowIndex: number, columnKey: string, value: string) => {
			if (editingLockedRef.current) {
				setStatusMessage("Reload required before continuing edits");
				return;
			}
			const currentRows = rowsRef.current;
			const targetRow = currentRows[rowIndex];
			if (!targetRow || targetRow[columnKey] === value) {
				return;
			}

			const editKey = cellRefKey(rowIndex, columnKey);
			if (activeCellEditRef.current !== editKey) {
				pushHistorySnapshot();
				activeCellEditRef.current = editKey;
			}

			const nextRows = currentRows.map((row, index) =>
				index === rowIndex ? { ...row, [columnKey]: value } : row,
			);
			rowsRef.current = nextRows;
			setRows(nextRows);
			markCellDirty(rowIndex);
		},
		[markCellDirty, pushHistorySnapshot],
	);

	const setCellDraft = useCallback((draft: CellDraft | null) => {
		cellDraftRef.current = draft;
		setActiveCellDraft(draft);
	}, []);

	const beginCellDraft = useCallback(
		(rowIndex: number, columnKey: string, value: string) => {
			setCellDraft({ rowIndex, columnKey, value });
		},
		[setCellDraft],
	);

	const updateCellDraft = useCallback(
		(rowIndex: number, columnKey: string, value: string) => {
			setCellDraft({ rowIndex, columnKey, value });
		},
		[setCellDraft],
	);

	const getDraftAwareCellValue = useCallback(
		(rowIndex: number, columnKey: string): string => {
			const draft = cellDraftRef.current;
			if (draft?.rowIndex === rowIndex && draft.columnKey === columnKey) {
				return draft.value;
			}
			return rowsRef.current[rowIndex]?.[columnKey] ?? "";
		},
		[],
	);

	const getCellDisplayValue = useCallback(
		(rowIndex: number, columnKey: string, storedValue: string): string => {
			if (
				activeCellDraft?.rowIndex === rowIndex &&
				activeCellDraft.columnKey === columnKey
			) {
				return activeCellDraft.value;
			}
			return storedValue;
		},
		[activeCellDraft],
	);

	const commitCellDraft = useCallback(
		(
			rowIndex: number,
			columnKey: string,
			normalizeValue?: (value: string) => string,
		) => {
			const rawValue = getDraftAwareCellValue(rowIndex, columnKey);
			const value = normalizeValue ? normalizeValue(rawValue) : rawValue;
			setCellDraft(null);
			handleCellChange(rowIndex, columnKey, value);
			if (activeCellEditRef.current === cellRefKey(rowIndex, columnKey)) {
				activeCellEditRef.current = null;
			}
			return value;
		},
		[getDraftAwareCellValue, handleCellChange, setCellDraft],
	);

	const normalizeDateCellValue = useCallback((value: string): string => {
		const trimmed = value.trim();
		if (!trimmed) return "";
		const context = createDateNormalizationContext(
			rowsRef.current.map((row) => ({
				date: row.date ?? "",
				dateTo: row.dateTo ?? "",
			})),
		);
		const normalized = normalizeCsvDate(trimmed, context);
		if (normalized.isoDate) {
			return formatIsoDateForEditableSheet(normalized.isoDate);
		}

		if (normalized.warning) {
			setStatusMessage(normalized.warning.message);
		}
		return trimmed;
	}, []);

	const normalizeValueForColumn = useCallback(
		(columnKey: string, value: string): string => {
			if (columnKey === DATE_COLUMN_KEY || columnKey === DATE_TO_COLUMN_KEY) {
				return normalizeDateCellValue(value);
			}
			if (TIME_COLUMN_KEYS.has(columnKey)) {
				return DateTransformers.convertToTime(value);
			}
			if (columnKey === PRIMARY_URL_COLUMN_KEY) {
				return normalizeUrlValue(value);
			}
			if (columnKey === PRICE_COLUMN_KEY) {
				return normalizePriceValue(value);
			}
			return value;
		},
		[normalizeDateCellValue],
	);

	const commitStandardCell = useCallback(
		(rowIndex: number, columnKey: string) => {
			const rawValue = rowsRef.current[rowIndex]?.[columnKey] ?? "";
			const normalizedValue = normalizeValueForColumn(columnKey, rawValue);
			handleCellChange(rowIndex, columnKey, normalizedValue);
			if (activeCellEditRef.current === cellRefKey(rowIndex, columnKey)) {
				activeCellEditRef.current = null;
			}
		},
		[handleCellChange, normalizeValueForColumn],
	);

	const handleNormalizeSheet = useCallback(() => {
		const currentRows = rowsRef.current;
		const context = createDateNormalizationContext(
			currentRows.map((row) => ({
				date: row.date ?? "",
				dateTo: row.dateTo ?? "",
			})),
		);
		const changesByKind = {
			dates: 0,
			times: 0,
			countries: 0,
			urls: 0,
		};
		let totalChanges = 0;

		const nextRows = currentRows.map((row) => {
			const normalizedRow = normalizeEditableSheetRowValues(row, context);
			const nextRow = { ...normalizedRow };

			if ((row[DATE_COLUMN_KEY] ?? "") !== (nextRow[DATE_COLUMN_KEY] ?? "")) {
				changesByKind.dates += 1;
			}
			for (const columnKey of TIME_COLUMN_KEYS) {
				if ((row[columnKey] ?? "") !== (nextRow[columnKey] ?? "")) {
					changesByKind.times += 1;
				}
			}
			for (const columnKey of COUNTRY_COLUMN_KEYS) {
				if ((row[columnKey] ?? "") !== (nextRow[columnKey] ?? "")) {
					changesByKind.countries += 1;
				}
			}

			const normalizedUrl = normalizeUrlValue(
				row[PRIMARY_URL_COLUMN_KEY] ?? "",
			);
			if ((row[PRIMARY_URL_COLUMN_KEY] ?? "") !== normalizedUrl) {
				nextRow[PRIMARY_URL_COLUMN_KEY] = normalizedUrl;
				changesByKind.urls += 1;
			}

			totalChanges += Object.keys(nextRow).filter(
				(key) => (row[key] ?? "") !== (nextRow[key] ?? ""),
			).length;
			return nextRow;
		});

		if (totalChanges === 0) {
			setStatusMessage("Sheet already normalized");
			return;
		}

		commitSheetMutation(
			columnsRef.current.map((column) => ({ ...column })),
			nextRows,
			`Normalized ${totalChanges} cell${totalChanges === 1 ? "" : "s"}: ${changesByKind.dates} date, ${changesByKind.times} time, ${changesByKind.countries} country, ${changesByKind.urls} URL`,
		);
	}, [commitSheetMutation]);

	const handleAddRow = () => {
		const nextRows = [
			createBlankEditableSheetRow(columnsRef.current),
			...rowsRef.current.map((row) => ({ ...row })),
		];
		commitSheetMutation(
			columnsRef.current.map((column) => ({ ...column })),
			nextRows,
			"New row added at the top",
		);
		setSortMode("sheet-order");
		setQuery("");
		window.setTimeout(() => {
			const firstEditableColumn =
				columnsRef.current.find(
					(column) => !SYSTEM_MANAGED_COLUMN_KEYS.has(column.key),
				) ?? columnsRef.current[0];
			if (!firstEditableColumn) return;

			inputRefs.current[cellRefKey(0, firstEditableColumn.key)]?.focus();
		}, 0);
	};

	const focusFirstEditableCell = (rowIndex: number) => {
		window.setTimeout(() => {
			const firstEditableColumn =
				columnsRef.current.find(
					(column) => !SYSTEM_MANAGED_COLUMN_KEYS.has(column.key),
				) ?? columnsRef.current[0];
			if (!firstEditableColumn) return;

			inputRefs.current[cellRefKey(rowIndex, firstEditableColumn.key)]?.focus();
		}, 0);
	};

	const handleInsertRowBelow = (rowIndex: number) => {
		const nextRows = rowsRef.current
			.map((row) => ({ ...row }))
			.toSpliced(
				rowIndex + 1,
				0,
				createBlankEditableSheetRow(columnsRef.current),
			);
		commitSheetMutation(
			columnsRef.current.map((column) => ({ ...column })),
			nextRows,
			"New row inserted",
		);
		setSortMode("sheet-order");
		setQuery("");
		focusFirstEditableCell(rowIndex + 1);
	};

	const handleDeleteRow = (rowIndex: number) => {
		if (!window.confirm(ROW_DELETE_CONFIRMATION)) {
			return;
		}
		const nextRows = rowsRef.current
			.map((row) => ({ ...row }))
			.filter((_, index) => index !== rowIndex);
		commitSheetMutation(
			columnsRef.current.map((column) => ({ ...column })),
			nextRows,
			"Row deleted",
		);
	};

	const handleDuplicateRow = (rowIndex: number) => {
		const sourceRow = rowsRef.current[rowIndex];
		if (!sourceRow) {
			return;
		}

		const nextRows = rowsRef.current
			.map((row) => ({ ...row }))
			.toSpliced(rowIndex + 1, 0, {
				...sourceRow,
				eventKey: "",
			});
		commitSheetMutation(
			columnsRef.current.map((column) => ({ ...column })),
			nextRows,
			"Row duplicated",
		);
		setSortMode("sheet-order");
		setQuery("");
		focusFirstEditableCell(rowIndex + 1);
	};

	const handleMoveRow = (rowIndex: number, direction: -1 | 1) => {
		const targetIndex = rowIndex + direction;
		if (targetIndex < 0 || targetIndex >= rowsRef.current.length) {
			return;
		}

		const nextRows = rowsRef.current.map((row) => ({ ...row }));
		const currentRow = nextRows[rowIndex];
		const targetRow = nextRows[targetIndex];
		if (!currentRow || !targetRow) {
			return;
		}

		nextRows[rowIndex] = targetRow;
		nextRows[targetIndex] = currentRow;
		commitSheetMutation(
			columnsRef.current.map((column) => ({ ...column })),
			nextRows,
			direction === -1 ? "Row moved up" : "Row moved down",
		);
		setSortMode("sheet-order");
		focusFirstEditableCell(targetIndex);
	};

	const handleAddColumn = () => {
		const label = newColumnLabel.trim();
		if (!label) {
			setErrorMessage("Column label is required");
			return;
		}

		setErrorMessage("");
		const currentColumns = columnsRef.current;
		const key = createCustomColumnKey(label, currentColumns);
		const nextColumns = [
			...currentColumns.map((column) => ({ ...column })),
			{
				key,
				label,
				isCore: false,
				isRequired: false,
			},
		];
		const nextRows = rowsRef.current.map((row) => ({
			...row,
			[key]: row[key] ?? "",
		}));

		commitSheetMutation(nextColumns, nextRows, `Column "${label}" added`);
		setNewColumnLabel("");
	};

	const handleDeleteColumn = (column: EditableSheetColumn) => {
		if (column.isCore) {
			setErrorMessage("Core columns are required and cannot be removed");
			return;
		}
		if (!window.confirm(COLUMN_DELETE_CONFIRMATION)) {
			return;
		}

		const nextColumns = columnsRef.current
			.filter((item) => item.key !== column.key)
			.map((item) => ({ ...item }));
		const nextRows = rowsRef.current.map((row) => {
			const nextRow = { ...row };
			delete nextRow[column.key];
			return nextRow;
		});

		commitSheetMutation(
			nextColumns,
			nextRows,
			`Column "${column.label}" deleted`,
		);
	};

	const handleRenameColumn = (columnKey: string, nextLabel: string) => {
		const label = nextLabel.trim();
		if (!label) return;

		const currentColumns = columnsRef.current;
		const currentColumn = currentColumns.find(
			(column) => column.key === columnKey,
		);
		if (
			!currentColumn ||
			currentColumn.isCore ||
			currentColumn.label === label
		) {
			return;
		}

		const nextColumns = currentColumns.map((column) =>
			column.key === columnKey ? { ...column, label } : { ...column },
		);
		commitSheetMutation(
			nextColumns,
			rowsRef.current.map((row) => ({ ...row })),
			`Column renamed to "${label}"`,
		);
	};

	const handleMoveColumn = (columnKey: string, direction: -1 | 1) => {
		const currentColumns = columnsRef.current;
		const currentIndex = currentColumns.findIndex(
			(column) => column.key === columnKey,
		);
		if (currentIndex < 0) return;

		const nextIndex = currentIndex + direction;
		if (nextIndex < 0 || nextIndex >= currentColumns.length) {
			return;
		}

		const reordered = currentColumns.map((column) => ({ ...column }));
		const [moved] = reordered.splice(currentIndex, 1);
		reordered.splice(nextIndex, 0, moved);

		commitSheetMutation(
			reordered,
			rowsRef.current.map((row) => ({ ...row })),
			`Column "${moved.label}" moved`,
		);
	};

	const handleUndo = () => {
		const previous = pastRef.current.pop();
		if (!previous) return;

		futureRef.current.push(cloneSnapshot(columnsRef.current, rowsRef.current));
		refreshHistoryFlags();
		applySnapshot(previous, "Undid last change");
	};

	const handleRedo = () => {
		const next = futureRef.current.pop();
		if (!next) return;

		pastRef.current.push(cloneSnapshot(columnsRef.current, rowsRef.current));
		refreshHistoryFlags();
		applySnapshot(next, "Redid last change");
	};

	const handleManualSave = useCallback(async () => {
		const blockingIssues = getRequiredSheetHealthIssues(rowsRef.current);
		if (blockingIssues.length > 0) {
			setErrorMessage(
				`Fix ${blockingIssues.length} required field ${blockingIssues.length === 1 ? "issue" : "issues"} before publishing. First issue: row ${blockingIssues[0]?.rowIndex} ${blockingIssues[0]?.column}.`,
			);
			setStatusMessage(
				"Publish blocked until required sheet fields are filled.",
			);
			return;
		}
		await performSave("manual");
	}, [performSave]);

	const handleAcceptOcrRows = useCallback(
		(acceptedRows: EditableSheetRow[], options: { saveAfterAdd: boolean }) => {
			if (acceptedRows.length === 0) return;
			const acceptedDraftCount = acceptedRows.filter(
				(row) => parseQualityOverride(row.detailsQualityOverride) === "draft",
			).length;
			const currentColumns = columnsRef.current.map((column) => ({
				...column,
			}));
			const nextAcceptedRows = acceptedRows.map((row) => ({
				...createBlankEditableSheetRow(currentColumns),
				...row,
				eventKey: "",
				sourceConfirmed: "",
			}));
			const nextRows = [
				...nextAcceptedRows,
				...rowsRef.current.map((row) => ({ ...row })),
			];
			commitSheetMutation(
				currentColumns,
				nextRows,
				acceptedDraftCount > 0
					? `Added ${acceptedDraftCount} admin-only OCR draft${acceptedDraftCount === 1 ? "" : "s"} to the sheet. Showing drafts now.`
					: `Added ${acceptedRows.length} OCR suggestion${acceptedRows.length === 1 ? "" : "s"} to the sheet`,
			);
			setSortMode("sheet-order");
			setQuery("");
			setQualityFilter(acceptedDraftCount > 0 ? "draft" : null);
			if (options.saveAfterAdd) {
				window.setTimeout(() => {
					void handleManualSave();
				}, 0);
			}
		},
		[commitSheetMutation, handleManualSave],
	);

	const handleSplitRangeRow = useCallback(
		(rowIndex: number, selectedDate?: string) => {
			const row = rowsRef.current[rowIndex];
			if (!row) return;
			const nextRows = splitEditableSheetRangeRow(
				rowsRef.current,
				rowIndex,
				selectedDate,
			);
			if (nextRows.length === rowsRef.current.length) {
				setStatusMessage("No multi-day range to split for this row.");
				return;
			}
			commitSheetMutation(
				columnsRef.current.map((column) => ({ ...column })),
				nextRows,
				selectedDate
					? `Split ${formatDateSuggestionLabel(selectedDate)} out of range`
					: "Split range into daily rows",
			);
			setRangePreviewRowIndex(null);
			setSortMode("sheet-order");
		},
		[commitSheetMutation],
	);

	const handleRestoreDraft = () => {
		if (!recoverableDraft) return;
		applySnapshot(recoverableDraft, "Restored local draft");
		setRecoverableDraft(null);
		setSortMode("sheet-order");
	};

	const handleDiscardDraft = () => {
		clearStoredEditorDraft();
		setRecoverableDraft(null);
	};

	const handleReloadForDeployment = async () => {
		if (hasUnsavedChanges) {
			const blockingIssues = getRequiredSheetHealthIssues(rowsRef.current);
			if (blockingIssues.length > 0) {
				setErrorMessage(
					`Fix ${blockingIssues.length} required field ${blockingIssues.length === 1 ? "issue" : "issues"} before publishing. First issue: row ${blockingIssues[0]?.rowIndex} ${blockingIssues[0]?.column}.`,
				);
				setStatusMessage(
					"Save and reload blocked until required sheet fields are filled.",
				);
				return;
			}
			const saved = await performSave("manual");
			if (!saved) {
				setStatusMessage(
					"Save failed. Local draft kept in this browser; reload paused.",
				);
				return;
			}
		}
		window.location.reload();
	};

	const addGenreToRow = useCallback(
		(
			rowIndex: number,
			genreKey: string,
			taxonomyOverride?: GenreTaxonomySnapshot,
		) => {
			const row = rowsRef.current[rowIndex];
			if (!row) return;
			const taxonomy = taxonomyOverride ?? genreTaxonomy;
			const label = getGenreLabel(genreKey, taxonomy?.genres ?? []);
			const parts = splitGenreCell(row[CATEGORY_COLUMN_KEY] ?? "", taxonomy);
			if (parts.some((part) => part.resolved === genreKey)) {
				return;
			}
			handleCellChange(
				rowIndex,
				CATEGORY_COLUMN_KEY,
				joinGenreLabels([...parts.map((part) => part.label), label]),
			);
			setFocusedCategoryRowIndex(rowIndex);
		},
		[genreTaxonomy, handleCellChange],
	);

	const toggleGenreForCell = useCallback(
		(rowIndex: number, columnKey: string, genre: GenreTaxonomyDefinition) => {
			const row = rowsRef.current[rowIndex];
			if (!row) return;
			const storedValue = row[columnKey] ?? "";
			const draftValue = getDraftAwareCellValue(rowIndex, columnKey);
			const taxonomy = genreTaxonomy;
			const storedParts = splitGenreCell(storedValue, taxonomy);
			const draftParts = splitGenreCell(draftValue, taxonomy);
			const isSelected = storedParts.some(
				(part) => part.resolved === genre.key,
			);
			const labels = isSelected
				? storedParts
						.filter((part) => part.resolved !== genre.key)
						.map((part) => part.label)
				: (() => {
						const nextLabels = draftParts.map((part) => part.label);
						const lastPart = draftParts.at(-1);
						const search = normalizeGenreInputText(genreSearchQuery);
						const alreadyTypedSelectedGenre = draftParts.some(
							(part) => part.resolved === genre.key,
						);
						if (alreadyTypedSelectedGenre) {
							return nextLabels;
						}
						const shouldReplaceTypedSegment =
							Boolean(search) &&
							lastPart !== undefined &&
							!lastPart.resolved &&
							normalizeGenreInputText(lastPart.value) === search;
						if (shouldReplaceTypedSegment && nextLabels.length > 0) {
							nextLabels[nextLabels.length - 1] = genre.label;
							return nextLabels;
						}
						return [...nextLabels, genre.label];
					})();

			handleCellChange(rowIndex, columnKey, joinGenreLabels(labels));
			setCellDraft(null);
			setGenreSearchQuery("");
			setFocusedCategoryRowIndex(rowIndex);
			setFocusedGenreCell({ rowIndex, columnKey });
			window.setTimeout(() => {
				inputRefs.current[cellRefKey(rowIndex, columnKey)]?.focus();
			}, 0);
		},
		[
			genreSearchQuery,
			genreTaxonomy,
			getDraftAwareCellValue,
			handleCellChange,
			setCellDraft,
		],
	);

	const handleCreateGenre = useCallback(
		async (labelInput: string, rowIndex?: number) => {
			const label = labelInput.trim();
			if (!label) {
				setErrorMessage("Genre label is required");
				return;
			}

			if (editingLockedRef.current) {
				setStatusMessage("Reload required before changing genres");
				return;
			}
			setErrorMessage("");
			const result = await postGenreTaxonomyAction({
				action: "create-genre",
				label,
			});
			if (!result.success || !result.genreTaxonomy || !result.genreKey) {
				setErrorMessage(result.error || "Failed to add genre");
				return;
			}

			setGenreTaxonomy(result.genreTaxonomy);
			setNewGenreLabel("");
			setStatusMessage(result.message || "Genre added");
			const targetRowIndex = rowIndex ?? focusedCategoryRowIndex;
			if (targetRowIndex !== null) {
				addGenreToRow(targetRowIndex, result.genreKey, result.genreTaxonomy);
			}
		},
		[addGenreToRow, focusedCategoryRowIndex],
	);

	const handleRemoveCustomGenre = useCallback(
		async (genre: GenreTaxonomyDefinition) => {
			if (genre.isDefault) {
				setErrorMessage("Default genres cannot be removed");
				return;
			}
			if (
				!window.confirm(
					`Remove "${genre.label}" from custom genres? Existing sheet cells using it will become unknown until remapped.`,
				)
			) {
				return;
			}

			if (editingLockedRef.current) {
				setStatusMessage("Reload required before changing genres");
				return;
			}
			setErrorMessage("");
			const result = await postGenreTaxonomyAction({
				action: "remove-genre",
				genreKey: genre.key,
			});
			if (!result.success || !result.genreTaxonomy) {
				setErrorMessage(result.error || "Failed to remove genre");
				return;
			}

			setGenreTaxonomy(result.genreTaxonomy);
			setStatusMessage(result.message || "Custom genre removed");
		},
		[],
	);

	const handleMapAlias = useCallback(
		async (aliasInput: string) => {
			const alias = aliasInput.trim();
			if (!alias || !aliasGenreKey) {
				setErrorMessage("Choose an unknown genre and a target genre");
				return;
			}

			if (editingLockedRef.current) {
				setStatusMessage("Reload required before changing genres");
				return;
			}
			setErrorMessage("");
			const result = await postGenreTaxonomyAction({
				action: "map-alias",
				alias,
				genreKey: aliasGenreKey,
			});
			if (!result.success || !result.genreTaxonomy) {
				setErrorMessage(result.error || "Failed to map genre alias");
				return;
			}

			setGenreTaxonomy(result.genreTaxonomy);
			setAliasInput("");
			setStatusMessage(result.message || "Genre alias saved");
		},
		[aliasGenreKey],
	);

	const handleRemoveAlias = useCallback(async (alias: string) => {
		if (editingLockedRef.current) {
			setStatusMessage("Reload required before changing genres");
			return;
		}
		setErrorMessage("");
		const result = await postGenreTaxonomyAction({
			action: "remove-alias",
			alias,
		});
		if (!result.success || !result.genreTaxonomy) {
			setErrorMessage(result.error || "Failed to remove alias");
			return;
		}

		setGenreTaxonomy(result.genreTaxonomy);
		setStatusMessage(result.message || "Genre alias removed");
	}, []);

	const selectGenreForCell = useCallback(
		(rowIndex: number, columnKey: string, genre: GenreTaxonomyDefinition) => {
			toggleGenreForCell(rowIndex, columnKey, genre);
		},
		[toggleGenreForCell],
	);

	const countryOptionsForFocusedCell = useMemo((): CountryOption[] => {
		if (!focusedCountryCell) return [];
		return filterCountryOptions(countrySearchQuery, 8);
	}, [countrySearchQuery, focusedCountryCell]);

	const areaOptionsForFocusedCell = useMemo((): AreaOption[] => {
		if (!focusedAreaCell) return [];
		const baseOptions = filterAreaOptions(areaSearchQuery);
		const locationValue =
			rows[focusedAreaCell.rowIndex]?.[LOCATION_COLUMN_KEY] ?? "";
		const normalizedLocation = normalizeLocationSearchText(locationValue);
		if (!normalizedLocation) return baseOptions;

		const knownAreas = new Map<string, number>();
		for (const [rowIndex, row] of rows.entries()) {
			if (rowIndex === focusedAreaCell.rowIndex) continue;
			if (
				normalizeLocationSearchText(row[LOCATION_COLUMN_KEY] ?? "") !==
				normalizedLocation
			) {
				continue;
			}
			const area = normalizeAreaValue(row[AREA_COLUMN_KEY] ?? "").trim();
			if (!area) continue;
			knownAreas.set(area, (knownAreas.get(area) ?? 0) + 1);
		}

		const suggested = Array.from(knownAreas.entries())
			.sort((left, right) => right[1] - left[1])
			.flatMap(([area]) => {
				const option = findAreaOption(area);
				return option ? [option] : [];
			});
		const seen = new Set<string>();
		return [...suggested, ...baseOptions].filter((option) => {
			if (seen.has(option.value)) return false;
			seen.add(option.value);
			return true;
		});
	}, [areaSearchQuery, focusedAreaCell, rows]);

	const locationSuggestionsForFocusedCell =
		useMemo((): LocationSuggestion[] => {
			if (!focusedLocationCell) return [];

			const query = normalizeLocationSearchText(locationSearchQuery);
			const currentRow = rows[focusedLocationCell.rowIndex];
			const currentArea = currentRow
				? normalizeAreaValue(getEffectiveAreaLabelFromRow(currentRow))
				: "";
			const suggestions = new Map<string, LocationSuggestion>();

			for (const [rowIndex, row] of rows.entries()) {
				if (rowIndex === focusedLocationCell.rowIndex) continue;
				const locationParts = splitLocationRawParts(
					row[LOCATION_COLUMN_KEY] ?? "",
				);
				for (const [partIndex, value] of locationParts.entries()) {
					const normalized = normalizeLocationSearchText(value);
					if (!normalized) continue;
					if (query && !normalized.includes(query)) continue;

					const area = getEffectiveAreaLabelFromRow(row, partIndex);
					const place = buildLocationPlaceContext(row, partIndex);
					const existing = suggestions.get(normalized);
					const isAreaMatch = Boolean(currentArea && area === currentArea);
					if (!existing) {
						suggestions.set(normalized, {
							value,
							area,
							address: place.address ?? "",
							postalCode: place.postalCode ?? "",
							city: place.city ?? "",
							countryCode: place.countryCode ?? "",
							count: 1,
							isAreaMatch,
						});
						continue;
					}
					existing.count += 1;
					existing.isAreaMatch = existing.isAreaMatch || isAreaMatch;
					if (!existing.area && area) existing.area = area;
					if (!existing.address && place.address) {
						existing.address = place.address;
					}
					if (!existing.postalCode && place.postalCode) {
						existing.postalCode = place.postalCode;
					}
					if (!existing.city && place.city) {
						existing.city = place.city;
					}
					if (!existing.countryCode && place.countryCode) {
						existing.countryCode = place.countryCode;
					}
				}
			}

			return Array.from(suggestions.values())
				.sort((left, right) => {
					if (left.isAreaMatch !== right.isAreaMatch) {
						return left.isAreaMatch ? -1 : 1;
					}
					if (left.count !== right.count) return right.count - left.count;
					return left.value.localeCompare(right.value);
				})
				.slice(0, 8);
		}, [focusedLocationCell, locationSearchQuery, rows]);

	const locationAliasCandidates = useMemo((): LocationAliasCandidate[] => {
		const candidates = new Map<string, LocationAliasCandidate>();
		for (const row of rows) {
			for (const pair of buildLocationAreaPairs(
				row[LOCATION_COLUMN_KEY] ?? "",
				row[AREA_COLUMN_KEY] ?? "",
			).map((pair, index) => ({
				...pair,
				area: pair.area || deriveAreaLabelFromRow(row, index),
				index,
			}))) {
				const name = pair.location.trim();
				const arrondissement = areaOptionToArrondissement(
					findAreaOption(pair.area),
				);
				if (!isCoordinateResolvableInput(name, arrondissement)) continue;
				const place = buildLocationPlaceContext(row, pair.index);
				const key = getSheetLocationResolutionKey(name, arrondissement, place);
				if (!candidates.has(key)) {
					candidates.set(key, { key, name, arrondissement, ...place });
				}
			}
		}
		for (const resolution of Object.values(locationResolutionIndex)) {
			if (
				!isCoordinateResolvableInput(resolution.name, resolution.arrondissement)
			) {
				continue;
			}
			if (!candidates.has(resolution.id)) {
				candidates.set(resolution.id, {
					key: resolution.id,
					name: resolution.name,
					arrondissement: resolution.arrondissement,
				});
			}
		}
		return Array.from(candidates.values());
	}, [locationResolutionIndex, rows]);

	const locationStatusByRowIndex = useMemo(() => {
		const statuses = new Map<number, LocationCellStatus>();
		rows.forEach((row, rowIndex) => {
			const parts = buildLocationAreaPairs(
				row[LOCATION_COLUMN_KEY] ?? "",
				row[AREA_COLUMN_KEY] ?? "",
			).map((pair, partIndex): LocationCellPartStatus => {
				const name = pair.location.trim();
				const area = pair.area || deriveAreaLabelFromRow(row, partIndex);
				const arrondissement = areaOptionToArrondissement(findAreaOption(area));
				const isResolvable = isCoordinateResolvableInput(name, arrondissement);
				const place = buildLocationPlaceContext(row, partIndex);
				const key = isResolvable
					? getSheetLocationResolutionKey(name, arrondissement, place)
					: `${name.toLowerCase()}_${String(arrondissement)}`;
				const resolution = isResolvable
					? (locationResolutionIndex[key] ?? null)
					: null;
				const trustState = getSheetLocationTrustState(resolution);
				const aliases = isResolvable
					? findLikelyLocationAliases(
							{ key, name, arrondissement, ...place },
							locationAliasCandidates,
						)
					: [];
				return {
					name,
					arrondissement,
					key,
					resolution,
					trustState,
					aliases,
				};
			});

			if (parts.length === 0) return;
			const trustState = parts.reduce<SheetLocationTrustState>(
				(current, part) =>
					getLocationTrustRank(part.trustState) < getLocationTrustRank(current)
						? part.trustState
						: current,
				"manual",
			);
			const hasAliasWarning = parts.some((part) => part.aliases.length > 0);
			const status: LocationCellStatus = {
				parts,
				trustState,
				hasAliasWarning,
				label: getLocationCellLabel(trustState, hasAliasWarning),
				title: "",
			};
			status.title = buildLocationCellTitle(status);
			statuses.set(rowIndex, status);
		});
		return statuses;
	}, [locationAliasCandidates, locationResolutionIndex, rows]);

	const settingOptionsForFocusedCell = useMemo((): SimpleOption[] => {
		if (!focusedSettingCell) return [];
		return SETTING_OPTIONS;
	}, [focusedSettingCell]);

	const eventCategoryOptionsForFocusedCell =
		useMemo((): readonly EventExperienceCategoryDefinition[] => {
			if (!focusedEventCategoryCell) return [];
			return EVENT_CATEGORY_OPTIONS;
		}, [focusedEventCategoryCell]);

	const ageOptionsForFocusedCell = useMemo((): SimpleOption[] => {
		if (!focusedAgeCell) return [];
		return AGE_OPTIONS;
	}, [focusedAgeCell]);

	const sheetDateContext = useMemo(
		() =>
			createDateNormalizationContext(
				rows.map((row) => ({ date: row.date ?? "", dateTo: row.dateTo ?? "" })),
			),
		[rows],
	);

	const seriesKeySuggestions = useMemo((): SeriesKeySuggestion[] => {
		if (!focusedSeriesKeyCell) return [];
		return buildSeriesKeySuggestions(focusedSeriesKeyCell.rowIndex, rows);
	}, [focusedSeriesKeyCell, rows]);

	const dateSuggestionState = useMemo((): DateSuggestionState => {
		if (!focusedDateCell) return { preview: null, groups: [] };

		const context = sheetDateContext;
		const seen = new Set<string>();
		const groups: DateSuggestionGroup[] = [];
		const addSuggestion = (option: DateSuggestionOption) => {
			if (seen.has(option.value)) return;
			seen.add(option.value);
			return option;
		};
		const addGroup = (label: string, options: DateSuggestionOption[]): void => {
			const deduped = options
				.map(addSuggestion)
				.filter((option): option is DateSuggestionOption => Boolean(option));
			if (deduped.length > 0) groups.push({ label, options: deduped });
		};

		const rawInput =
			rows[focusedDateCell.rowIndex]?.[focusedDateCell.columnKey] ?? "";
		const trimmedInput = rawInput.trim();
		const normalizedInput = trimmedInput
			? normalizeCsvDate(trimmedInput, context)
			: null;
		const preview: DateInputPreview | null = normalizedInput?.isoDate
			? {
					tone: "success",
					message:
						normalizedInput.isoDate === trimmedInput
							? `Valid date: ${formatDateSuggestionLabel(normalizedInput.isoDate)}`
							: `Will save as ${formatIsoDateForEditableSheet(normalizedInput.isoDate)}`,
				}
			: normalizedInput?.warning
				? {
						tone: "warning",
						message: normalizedInput.warning.message,
					}
				: null;

		const feteYear = pickUsefulFeteYear(
			focusedDateCell.rowIndex,
			rows,
			context,
		);
		addGroup(`Fete week ${feteYear}`, buildCommonFeteDates(feteYear));

		const dateStats = new Map<string, { count: number; lastIndex: number }>();
		rows.forEach((row, rowIndex) => {
			if (rowIndex === focusedDateCell.rowIndex) return;
			const normalized = getNormalizedSheetDate(
				row[DATE_COLUMN_KEY] ?? "",
				context,
			);
			if (!normalized) return;
			const existing = dateStats.get(normalized);
			dateStats.set(normalized, {
				count: (existing?.count ?? 0) + 1,
				lastIndex: Math.max(existing?.lastIndex ?? -1, rowIndex),
			});
		});

		addGroup(
			"Nearby rows",
			[
				{
					row: rows[focusedDateCell.rowIndex - 1],
					description: "Use row above",
				},
				{
					row: rows[focusedDateCell.rowIndex + 1],
					description: "Use row below",
				},
			].flatMap((adjacent) => {
				const adjacentDate = adjacent.row
					? getNormalizedSheetDate(adjacent.row[DATE_COLUMN_KEY] ?? "", context)
					: null;
				if (!adjacentDate) return [];
				return [
					{
						value: adjacentDate,
						label: formatDateSuggestionLabel(adjacentDate),
						description: adjacent.description,
					},
				];
			}),
		);

		addGroup(
			"Used in sheet",
			Array.from(dateStats.entries())
				.sort(
					([leftDate, left], [rightDate, right]) =>
						right.count - left.count ||
						right.lastIndex - left.lastIndex ||
						leftDate.localeCompare(rightDate),
				)
				.slice(0, 6)
				.map(([value, stats]) => ({
					value,
					label: formatDateSuggestionLabel(value),
					description: `${stats.count} row${stats.count === 1 ? "" : "s"} in sheet`,
				})),
		);

		return { preview, groups };
	}, [focusedDateCell, rows, sheetDateContext]);

	const timeInputPreview = useMemo((): TimeInputPreview | null => {
		if (!focusedTimeCell) return null;
		const value =
			rows[focusedTimeCell.rowIndex]?.[focusedTimeCell.columnKey] ?? "";
		return getTimeInputPreview(value);
	}, [focusedTimeCell, rows]);

	const toggleCuratedForCell = useCallback(
		(rowIndex: number, columnKey: string) => {
			const row = rowsRef.current[rowIndex];
			if (!row) return;
			const nextValue = isCuratedValue(row[columnKey] ?? "")
				? ""
				: CURATED_PICK_VALUE;
			handleCellChange(rowIndex, columnKey, nextValue);
		},
		[handleCellChange],
	);

	const generateSeriesKeyForCell = useCallback(
		(rowIndex: number, columnKey: string) => {
			const row = rowsRef.current[rowIndex];
			if (!row) return;
			const seriesKey = generateEditableSheetSeriesKey(row);
			handleCellChange(rowIndex, columnKey, seriesKey);
			setFocusedSeriesKeyCell({ rowIndex, columnKey });
			setStatusMessage(`Generated series key ${seriesKey}`);
			window.setTimeout(() => {
				inputRefs.current[cellRefKey(rowIndex, columnKey)]?.focus();
			}, 0);
		},
		[handleCellChange],
	);

	const clearSeriesKeyForCell = useCallback(
		(rowIndex: number, columnKey: string) => {
			handleCellChange(rowIndex, columnKey, "");
			setFocusedSeriesKeyCell({ rowIndex, columnKey });
			setStatusMessage("Series key cleared");
			window.setTimeout(() => {
				inputRefs.current[cellRefKey(rowIndex, columnKey)]?.focus();
			}, 0);
		},
		[handleCellChange],
	);

	const linkSeriesKeyForCell = useCallback(
		(rowIndex: number, columnKey: string, suggestion: SeriesKeySuggestion) => {
			const currentRows = rowsRef.current;
			const sourceRow = currentRows[rowIndex];
			const targetRow = currentRows[suggestion.rowIndex];
			if (!sourceRow || !targetRow) return;

			const nextRows = currentRows.map((row, index) => {
				if (index === rowIndex) {
					return { ...row, [columnKey]: suggestion.seriesKey };
				}
				if (
					index === suggestion.rowIndex &&
					!String(row[SERIES_KEY_COLUMN_KEY] ?? "").trim()
				) {
					return { ...row, [SERIES_KEY_COLUMN_KEY]: suggestion.seriesKey };
				}
				return { ...row };
			});

			commitSheetMutation(
				columnsRef.current.map((column) => ({ ...column })),
				nextRows,
				suggestion.willCreateSeriesKey
					? `Linked rows with new series key ${suggestion.seriesKey}`
					: `Linked row to series ${suggestion.seriesKey}`,
			);
		},
		[commitSheetMutation],
	);

	const selectDateForCell = useCallback(
		(rowIndex: number, columnKey: string, date: string) => {
			handleCellChange(
				rowIndex,
				columnKey,
				formatIsoDateForEditableSheet(date),
			);
			setFocusedDateCell(null);
			window.setTimeout(() => {
				inputRefs.current[cellRefKey(rowIndex, columnKey)]?.focus();
			}, 0);
		},
		[handleCellChange],
	);

	const fillDateFromRowAbove = useCallback(
		(rowIndex: number, columnKey: string): boolean => {
			const rowAbove = rowsRef.current[rowIndex - 1];
			if (!rowAbove) return false;
			const context = createDateNormalizationContext(
				rowsRef.current.map((row) => ({
					date: row.date ?? "",
					dateTo: row.dateTo ?? "",
				})),
			);
			const rowAboveDate = getNormalizedSheetDate(
				rowAbove[DATE_COLUMN_KEY] ?? "",
				context,
			);
			if (!rowAboveDate) return false;

			const sheetDate = formatIsoDateForEditableSheet(rowAboveDate);
			handleCellChange(rowIndex, columnKey, sheetDate);
			if (activeCellEditRef.current === cellRefKey(rowIndex, columnKey)) {
				activeCellEditRef.current = null;
			}
			setFocusedDateCell(null);
			setStatusMessage(`Copied ${sheetDate} from row above`);
			return true;
		},
		[handleCellChange],
	);

	const selectSettingForCell = useCallback(
		(rowIndex: number, columnKey: string, setting: SimpleOption) => {
			const row = rowsRef.current[rowIndex];
			if (!row) return;
			const currentValue = row[columnKey] ?? "";
			const selectedValues = splitSettingCell(currentValue);
			const nextValues = selectedValues.includes(setting.value)
				? selectedValues.filter((value) => value !== setting.value)
				: [...selectedValues, setting.value];

			handleCellChange(rowIndex, columnKey, nextValues.join(", "));
			setCellDraft(null);
			setFocusedSettingCell({ rowIndex, columnKey });
			window.setTimeout(() => {
				inputRefs.current[cellRefKey(rowIndex, columnKey)]?.focus();
			}, 0);
		},
		[handleCellChange, setCellDraft],
	);

	const selectEventCategoryForCell = useCallback(
		(
			rowIndex: number,
			columnKey: string,
			category: EventExperienceCategoryDefinition | null,
		) => {
			const row = rowsRef.current[rowIndex];
			if (!row) return;
			handleCellChange(rowIndex, columnKey, category?.label ?? "");
			setEventCategoryPopover(null);
			setCellDraft(null);
			setFocusedEventCategoryCell({ rowIndex, columnKey });
			window.setTimeout(() => {
				inputRefs.current[cellRefKey(rowIndex, columnKey)]?.focus();
			}, 0);
		},
		[handleCellChange, setCellDraft],
	);

	const selectAgeForCell = useCallback(
		(rowIndex: number, columnKey: string, age: SimpleOption | null) => {
			const row = rowsRef.current[rowIndex];
			if (!row) return;
			handleCellChange(rowIndex, columnKey, age?.value ?? "");
			setCellDraft(null);
			setFocusedAgeCell({ rowIndex, columnKey });
			window.setTimeout(() => {
				inputRefs.current[cellRefKey(rowIndex, columnKey)]?.focus();
			}, 0);
		},
		[handleCellChange, setCellDraft],
	);

	const selectCountryForCell = useCallback(
		(rowIndex: number, columnKey: string, country: CountryOption) => {
			const row = rowsRef.current[rowIndex];
			if (!row) return;
			const currentValue = row[columnKey] ?? "";
			const selectedCodes = splitCountryCell(currentValue);
			const nextCodes = selectedCodes.includes(country.code)
				? selectedCodes.filter((code) => code !== country.code)
				: [...selectedCodes, country.code];

			handleCellChange(rowIndex, columnKey, joinCountryCodes(nextCodes));
			setCellDraft(null);
			setCountrySearchQuery("");
			setFocusedCountryCell({ rowIndex, columnKey });
			window.setTimeout(() => {
				inputRefs.current[cellRefKey(rowIndex, columnKey)]?.focus();
			}, 0);
		},
		[handleCellChange, setCellDraft],
	);

	const selectAreaForCell = useCallback(
		(rowIndex: number, columnKey: string, area: AreaOption) => {
			handleCellChange(rowIndex, columnKey, area.value);
			setCellDraft(null);
			setAreaSearchQuery(area.value);
			setFocusedAreaCell({ rowIndex, columnKey });
			window.setTimeout(() => {
				inputRefs.current[cellRefKey(rowIndex, columnKey)]?.focus();
			}, 0);
		},
		[handleCellChange, setCellDraft],
	);

	const selectLocationForCell = useCallback(
		(rowIndex: number, columnKey: string, suggestion: LocationSuggestion) => {
			const currentRow = rowsRef.current[rowIndex] ?? {};
			const currentLocationValue = currentRow[columnKey] ?? "";
			const preserveMissingMetadata =
				normalizeLocationSearchText(currentLocationValue) ===
				normalizeLocationSearchText(suggestion.value);
			const nextAddress =
				suggestion.address ||
				(preserveMissingMetadata
					? (currentRow[LOCATION_ADDRESS_COLUMN_KEY] ?? "")
					: "");
			const nextPostalCode =
				suggestion.postalCode ||
				(preserveMissingMetadata
					? (currentRow[POSTAL_CODE_COLUMN_KEY] ?? "")
					: "");
			const nextCity =
				suggestion.city ||
				(preserveMissingMetadata ? (currentRow[CITY_COLUMN_KEY] ?? "") : "");
			const nextCountryCode =
				suggestion.countryCode ||
				(preserveMissingMetadata
					? (currentRow[COUNTRY_CODE_COLUMN_KEY] ?? "")
					: "");
			handleCellChange(rowIndex, columnKey, suggestion.value);
			handleCellChange(rowIndex, LOCATION_ADDRESS_COLUMN_KEY, nextAddress);
			handleCellChange(rowIndex, POSTAL_CODE_COLUMN_KEY, nextPostalCode);
			handleCellChange(rowIndex, CITY_COLUMN_KEY, nextCity);
			handleCellChange(rowIndex, COUNTRY_CODE_COLUMN_KEY, nextCountryCode);
			const currentArea = rowsRef.current[rowIndex]?.[AREA_COLUMN_KEY] ?? "";
			const derivedArea = deriveAreaFromPostalCodeCity(
				nextPostalCode,
				nextCity,
			);
			if (derivedArea) {
				handleCellChange(rowIndex, AREA_COLUMN_KEY, "");
			} else if (!currentArea.trim() && suggestion.area) {
				handleCellChange(rowIndex, AREA_COLUMN_KEY, suggestion.area);
			}
			setFocusedLocationCell({ rowIndex, columnKey });
			setLocationSearchQuery(suggestion.value);
			window.setTimeout(() => {
				inputRefs.current[cellRefKey(rowIndex, columnKey)]?.focus();
			}, 0);
		},
		[handleCellChange],
	);

	const addLocationSlot = useCallback(
		(rowIndex: number, columnKey: string) => {
			const currentValue = rowsRef.current[rowIndex]?.[columnKey] ?? "";
			const parts = splitLocationRawParts(currentValue);
			const nextParts = [...parts, "New location"];
			const nextPartIndex = nextParts.length - 1;
			handleCellChange(rowIndex, columnKey, joinLocationParts(nextParts));
			window.setTimeout(() => {
				const input =
					locationPartInputRefs.current[
						locationPartRefKey(rowIndex, columnKey, nextPartIndex)
					];
				input?.focus();
				input?.select();
			}, 0);
		},
		[handleCellChange],
	);

	const markMultipleLocationsForCell = useCallback(
		(rowIndex: number, columnKey: string) => {
			handleCellChange(rowIndex, columnKey, "Multiple locations");
			handleCellChange(rowIndex, AREA_COLUMN_KEY, "Multiple Locations");
			setFocusedLocationCell({ rowIndex, columnKey });
			window.setTimeout(() => {
				inputRefs.current[cellRefKey(rowIndex, columnKey)]?.focus();
			}, 0);
		},
		[handleCellChange],
	);

	const updateLocationPart = useCallback(
		(rowIndex: number, columnKey: string, partIndex: number, value: string) => {
			const currentValue = rowsRef.current[rowIndex]?.[columnKey] ?? "";
			const parts = splitLocationRawParts(currentValue);
			parts[partIndex] = value;
			handleCellChange(rowIndex, columnKey, joinLocationParts(parts));
		},
		[handleCellChange],
	);

	const updateLocationAreaPart = useCallback(
		(rowIndex: number, partIndex: number, areaValue: string) => {
			const locationParts = splitLocationRawParts(
				rowsRef.current[rowIndex]?.[LOCATION_COLUMN_KEY] ?? "",
			);
			const currentAreaParts = splitAreaRawParts(
				rowsRef.current[rowIndex]?.[AREA_COLUMN_KEY] ?? "",
			);
			const nextAreaParts = locationParts.map((_, index) => {
				if (index === partIndex) return normalizeAreaValue(areaValue);
				if (currentAreaParts.length === locationParts.length) {
					return currentAreaParts[index] ?? "";
				}
				if (
					currentAreaParts.length === 1 &&
					currentAreaParts[0] !== "Multiple Locations"
				) {
					return currentAreaParts[0];
				}
				return "";
			});
			handleCellChange(rowIndex, AREA_COLUMN_KEY, joinAreaParts(nextAreaParts));
		},
		[handleCellChange],
	);

	const updateLocationMetadataPart = useCallback(
		(
			rowIndex: number,
			columnKey: string,
			partIndex: number,
			value: string,
			normalizeValue: (input: string) => string = (input) => input,
		) => {
			const currentValue = rowsRef.current[rowIndex]?.[columnKey] ?? "";
			const parts = splitMetadataRawParts(currentValue);
			while (parts.length <= partIndex) {
				parts.push("");
			}
			parts[partIndex] = normalizeValue(value);
			const locationPartCount = splitLocationRawParts(
				rowsRef.current[rowIndex]?.[LOCATION_COLUMN_KEY] ?? "",
			).length;
			handleCellChange(
				rowIndex,
				columnKey,
				joinMetadataParts(parts, locationPartCount > 1 ? locationPartCount : 0),
			);
		},
		[handleCellChange],
	);

	const removeLocationPart = useCallback(
		(rowIndex: number, columnKey: string, partIndex: number) => {
			const currentValue = rowsRef.current[rowIndex]?.[columnKey] ?? "";
			const nextParts = splitLocationRawParts(currentValue).filter(
				(_, index) => index !== partIndex,
			);
			handleCellChange(rowIndex, columnKey, joinLocationParts(nextParts));
			for (const metadataColumnKey of [
				LOCATION_ADDRESS_COLUMN_KEY,
				POSTAL_CODE_COLUMN_KEY,
				CITY_COLUMN_KEY,
				COUNTRY_CODE_COLUMN_KEY,
				AREA_COLUMN_KEY,
			]) {
				const metadataParts = splitMetadataRawParts(
					rowsRef.current[rowIndex]?.[metadataColumnKey] ?? "",
				);
				if (metadataParts.length <= 1) continue;
				handleCellChange(
					rowIndex,
					metadataColumnKey,
					joinMetadataParts(
						metadataParts.filter((_, index) => index !== partIndex),
					),
				);
			}
			window.setTimeout(() => {
				inputRefs.current[cellRefKey(rowIndex, columnKey)]?.focus();
			}, 0);
		},
		[handleCellChange],
	);

	const addPrimaryUrlSlot = useCallback(
		(rowIndex: number, columnKey: string) => {
			const currentValue = rowsRef.current[rowIndex]?.[columnKey] ?? "";
			const parts = splitUrlRawParts(currentValue);
			const nextParts = [...parts, "https://"];
			const nextValue = nextParts.join(", ");
			const nextPartIndex = nextParts.length - 1;
			handleCellChange(rowIndex, columnKey, nextValue);
			window.setTimeout(() => {
				const input =
					urlPartInputRefs.current[
						urlPartRefKey(rowIndex, columnKey, nextPartIndex)
					];
				input?.focus();
				if (input) {
					input.setSelectionRange(input.value.length, input.value.length);
				}
			}, 0);
		},
		[handleCellChange],
	);

	const updatePrimaryUrlPart = useCallback(
		(rowIndex: number, columnKey: string, partIndex: number, value: string) => {
			const currentValue = rowsRef.current[rowIndex]?.[columnKey] ?? "";
			const parts = splitUrlRawParts(currentValue);
			parts[partIndex] = value;
			handleCellChange(rowIndex, columnKey, parts.join(", "));
		},
		[handleCellChange],
	);

	const removePrimaryUrlPart = useCallback(
		(rowIndex: number, columnKey: string, partIndex: number) => {
			const currentValue = rowsRef.current[rowIndex]?.[columnKey] ?? "";
			const nextValue = splitUrlRawParts(currentValue)
				.filter((_, index) => index !== partIndex)
				.join(", ");
			handleCellChange(rowIndex, columnKey, nextValue);
			window.setTimeout(() => {
				inputRefs.current[cellRefKey(rowIndex, columnKey)]?.focus();
			}, 0);
		},
		[handleCellChange],
	);

	const visibleSheetRevisions = sheetRevisions.slice(0, 3);
	const availableGenres = useMemo(
		() =>
			(genreTaxonomy?.genres ?? [])
				.filter((genre) => genre.isActive !== false)
				.sort(
					(left, right) =>
						(left.sortOrder ?? 1000) - (right.sortOrder ?? 1000) ||
						left.label.localeCompare(right.label),
				),
		[genreTaxonomy],
	);
	const defaultGenres = useMemo(
		() => availableGenres.filter((genre) => genre.isDefault),
		[availableGenres],
	);
	const customGenres = useMemo(
		() => availableGenres.filter((genre) => !genre.isDefault),
		[availableGenres],
	);
	const genreOptionsForFocusedCell = useMemo(() => {
		if (!focusedGenreCell) return [];
		const query = normalizeGenreInputText(genreSearchQuery);
		const scored = availableGenres
			.map((genre) => {
				const haystack = [genre.label, genre.key, ...(genre.aliases ?? [])].map(
					normalizeGenreInputText,
				);
				const exact = haystack.some((value) => value === query);
				const startsWith = haystack.some((value) => value.startsWith(query));
				const includes = haystack.some((value) => value.includes(query));
				return {
					genre,
					score: !query ? 1 : exact ? 4 : startsWith ? 3 : includes ? 2 : 0,
				};
			})
			.filter((item) => item.score > 0)
			.sort(
				(left, right) =>
					right.score - left.score ||
					(left.genre.sortOrder ?? 1000) - (right.genre.sortOrder ?? 1000) ||
					left.genre.label.localeCompare(right.genre.label),
			);
		return scored.slice(0, 10).map((item) => item.genre);
	}, [availableGenres, focusedGenreCell, genreSearchQuery]);
	const aliasMappings = useMemo<GenreAliasMapping[]>(() => {
		const genreByKey = new Map(
			availableGenres.map((genre) => [genre.key, genre.label]),
		);
		return (genreTaxonomy?.aliases ?? [])
			.filter(
				(alias) =>
					!isRedundantGenreAlias(alias.alias, alias.genreKey) &&
					genreByKey.has(alias.genreKey),
			)
			.map((alias) => ({
				...alias,
				genreLabel: genreByKey.get(alias.genreKey) ?? alias.genreKey,
				isDefault: DEFAULT_ALIAS_KEYS.has(`${alias.alias}:${alias.genreKey}`),
			}))
			.sort(
				(left, right) =>
					Number(left.isDefault) - Number(right.isDefault) ||
					left.genreLabel.localeCompare(right.genreLabel) ||
					left.alias.localeCompare(right.alias),
			);
	}, [availableGenres, genreTaxonomy]);
	const customAliasCount = aliasMappings.filter(
		(alias) => !alias.isDefault,
	).length;
	const unknownGenres = useMemo(() => {
		if (!genreTaxonomy) return [];
		const unknown = new Map<string, { label: string; count: number }>();
		for (const row of rows) {
			for (const part of splitGenreCell(
				row[CATEGORY_COLUMN_KEY] ?? "",
				genreTaxonomy,
			)) {
				if (part.resolved) continue;
				const existing = unknown.get(part.value);
				unknown.set(part.value, {
					label: part.label,
					count: (existing?.count ?? 0) + 1,
				});
			}
		}
		return Array.from(unknown.entries())
			.map(([value, meta]) => ({ value, ...meta }))
			.sort(
				(left, right) =>
					right.count - left.count || left.label.localeCompare(right.label),
			);
	}, [genreTaxonomy, rows]);

	const sheetHealthIssues = useMemo((): SheetHealthIssue[] => {
		const referenceDate = new Date();
		const context = createDateNormalizationContext(
			rows.map((row) => ({ date: row.date ?? "", dateTo: row.dateTo ?? "" })),
			{ referenceDate },
		);
		const issues: SheetHealthIssue[] = [];

		rows.forEach((row, index) => {
			const rowNumber = index + 1;
			if (isEditableSheetRowEmpty(row)) return;

			const dateValue = String(row[DATE_COLUMN_KEY] ?? "").trim();
			if (dateValue) {
				const normalized = normalizeCsvDate(dateValue, context);
				if (normalized.warning) {
					issues.push({
						rowIndex: rowNumber,
						column: "Date",
						message: normalized.warning.message,
						severity: "warning",
					});
				}
			}
			const dateToValue = String(row[DATE_TO_COLUMN_KEY] ?? "").trim();
			if (dateToValue) {
				const normalizedStart = normalizeCsvDate(dateValue, context);
				const normalizedEnd = normalizeCsvDate(dateToValue, context);
				if (normalizedEnd.warning) {
					issues.push({
						rowIndex: rowNumber,
						column: "Date To",
						message: normalizedEnd.warning.message,
						severity: "warning",
					});
				}
				if (
					normalizedStart.isoDate &&
					normalizedEnd.isoDate &&
					normalizedEnd.isoDate < normalizedStart.isoDate
				) {
					issues.push({
						rowIndex: rowNumber,
						column: "Date To",
						message: `Date To ${normalizedEnd.isoDate} is before Date ${normalizedStart.isoDate}.`,
						severity: "blocking",
					});
				}
			}

			for (const columnKey of TIME_COLUMN_KEYS) {
				const value = String(row[columnKey] ?? "").trim();
				if (!value || /^(?:tba|tbc)$/i.test(value)) continue;
				const normalized = DateTransformers.convertToTime(value);
				const isNormalizedTime = /^\d{2}:\d{2}$/.test(normalized);
				if (!isNormalizedTime && /\d/.test(value)) {
					issues.push({
						rowIndex: rowNumber,
						column:
							columnKey === START_TIME_COLUMN_KEY ? "Start Time" : "End Time",
						message: `Suspicious time value "${value}".`,
						severity: "warning",
					});
				}
			}

			const urlValue = String(row[PRIMARY_URL_COLUMN_KEY] ?? "").trim();
			if (urlValue) {
				const invalidUrl = urlValue
					.split(URL_SEPARATOR_REGEX)
					.map(normalizeUrlPart)
					.find((part) => part.length > 0 && !isValidHttpUrl(part));
				if (invalidUrl) {
					issues.push({
						rowIndex: rowNumber,
						column: "Primary URL",
						message: `Invalid URL "${invalidUrl}".`,
						severity: "warning",
					});
				}
			}

			for (const [columnKey, column] of [
				["hostCountry", "Host Country"],
				["audienceCountry", "Audience Country"],
			] as const) {
				const value = String(row[columnKey] ?? "").trim();
				if (!value) continue;
				const parsed = parseSupportedNationalities(value);
				if (parsed.unsupportedTokens.length > 0) {
					issues.push({
						rowIndex: rowNumber,
						column,
						message: `Unknown country token: ${parsed.unsupportedTokens.join(", ")}.`,
						severity: "warning",
					});
				}
			}

			const settingValue = String(row[SETTING_COLUMN_KEY] ?? "").trim();
			if (settingValue && splitSettingCell(settingValue).length === 0) {
				issues.push({
					rowIndex: rowNumber,
					column: "Setting",
					message: 'Use "Indoor", "Outdoor", or both.',
					severity: "warning",
				});
			}

			const locationParts = splitLocationRawParts(
				String(row[LOCATION_COLUMN_KEY] ?? ""),
			);
			const areaParts = String(row[AREA_COLUMN_KEY] ?? "")
				.split(/[\n\r|;]+/)
				.map((part) => part.trim())
				.filter(Boolean);
			const unknownAreas = areaParts.filter((part) => !findAreaOption(part));
			if (unknownAreas.length > 0) {
				issues.push({
					rowIndex: rowNumber,
					column: "Area",
					message: `Unknown area token: ${unknownAreas.join(", ")}.`,
					severity: "warning",
				});
			}
			if (locationParts.length > 1) {
				const normalizedAreas = areaParts.map(normalizeAreaValue);
				const hasSharedArea =
					normalizedAreas.length === 1 &&
					normalizedAreas[0] !== "Multiple Locations";
				const hasMultiplePlaceholder =
					normalizedAreas.length === 1 &&
					normalizedAreas[0] === "Multiple Locations";
				const hasPerLocationAreas =
					normalizedAreas.length === locationParts.length;
				if (
					normalizedAreas.length > 0 &&
					!hasSharedArea &&
					!hasMultiplePlaceholder &&
					!hasPerLocationAreas
				) {
					issues.push({
						rowIndex: rowNumber,
						column: "Area",
						message: `${locationParts.length} locations, ${normalizedAreas.length} areas. Areas link by list order, so use one shared area, ${locationParts.length} areas, or Multiple Locations.`,
						severity: "warning",
					});
				}
			}

			const eventCategoryValue = String(
				row[EVENT_CATEGORY_COLUMN_KEY] ?? "",
			).trim();
			if (
				eventCategoryValue &&
				!normalizeEventExperienceCategory(eventCategoryValue)
			) {
				issues.push({
					rowIndex: rowNumber,
					column: "Event Category",
					message:
						'Use "Party", "Activity", "Culture", "Culture (Fashion)", "Food", or "Wellness".',
					severity: "warning",
				});
			}
		});

		return [...getRequiredSheetHealthIssues(rows), ...issues];
	}, [rows]);
	const blockingSheetHealthIssues = sheetHealthIssues.filter(
		(issue) => issue.severity === "blocking",
	);
	const sheetHealthIssuesByRow = useMemo(() => {
		const byRow = new Map<number, SheetHealthIssue[]>();
		for (const issue of sheetHealthIssues) {
			byRow.set(issue.rowIndex, [...(byRow.get(issue.rowIndex) ?? []), issue]);
		}
		return byRow;
	}, [sheetHealthIssues]);
	const pendingEventReviewByEventKey = useMemo(
		() =>
			new Map(
				pendingEventReviews.flatMap((review) => {
					const eventKey = review.eventKey.trim();
					if (!eventKey) return [];
					return [
						[
							eventKey,
							{
								submissionId: review.submissionId,
								submissionType: review.submissionType,
							},
						] as const,
					];
				}),
			),
		[pendingEventReviews],
	);
	const getPendingEventReviewForRow = useCallback(
		(row: EditableSheetRow) =>
			pendingEventReviewByEventKey.get(String(row.eventKey ?? "").trim()) ??
			null,
		[pendingEventReviewByEventKey],
	);
	const rowQualityCounts = useMemo(() => {
		const counts = {
			complete: 0,
			review: 0,
			blocking: 0,
			draft: 0,
			manual: 0,
			sourceConfirmed: 0,
		};
		rows.forEach((row, index) => {
			const pendingEventReview = getPendingEventReviewForRow(row);
			const quality = getRowQualityAssessment(
				row,
				sheetHealthIssuesByRow.get(index + 1) ?? [],
				{ pendingSubmissionType: pendingEventReview?.submissionType },
			);
			counts[quality.value] += 1;
			if (quality.source === "manual") counts.manual += 1;
			if (quality.isConfirmed) counts.sourceConfirmed += 1;
		});
		return counts;
	}, [getPendingEventReviewForRow, rows, sheetHealthIssuesByRow]);
	const lifecycleMetadataByEventKey = useMemo(
		() => new Map(rowMetadata.map((metadata) => [metadata.eventKey, metadata])),
		[rowMetadata],
	);
	const suppressUpdatedLifecycleBadges = useMemo(
		() => hasLifecycleUpdateFlood(rowMetadata),
		[rowMetadata],
	);
	const filteredRowIndexes = useMemo(() => {
		const needle = query.trim().toLowerCase();
		return rows
			.map((row, index) => {
				if (needle) {
					const hasMatch = Object.values(row).some((value) =>
						value.toLowerCase().includes(needle),
					);
					if (!hasMatch) return -1;
				}

				if (qualityFilter) {
					const pendingEventReview = getPendingEventReviewForRow(row);
					const quality = getRowQualityAssessment(
						row,
						sheetHealthIssuesByRow.get(index + 1) ?? [],
						{ pendingSubmissionType: pendingEventReview?.submissionType },
					);
					if (quality.value !== qualityFilter) return -1;
				}

				return index;
			})
			.filter((index) => index >= 0);
	}, [
		getPendingEventReviewForRow,
		qualityFilter,
		query,
		rows,
		sheetHealthIssuesByRow,
	]);
	const sortedRowIndexes = useMemo(() => {
		return sortRowIndexes(
			filteredRowIndexes,
			rows,
			sortMode,
			lifecycleMetadataByEventKey,
			{ suppressUpdated: suppressUpdatedLifecycleBadges },
		);
	}, [
		filteredRowIndexes,
		lifecycleMetadataByEventKey,
		rows,
		sortMode,
		suppressUpdatedLifecycleBadges,
	]);
	const visibleRowIndexes = useMemo(() => {
		return sortedRowIndexes.slice(0, displayLimit);
	}, [sortedRowIndexes, displayLimit]);
	const canShowMoreRows = sortedRowIndexes.length > visibleRowIndexes.length;
	const canManuallyMoveRows = sortMode === "sheet-order" && !query.trim();
	const handleQualityFilterToggle = useCallback((value: RowQualityValue) => {
		setQualityFilter((current) => (current === value ? null : value));
		setDisplayLimit(50);
		setQualityPopover(null);
	}, []);
	const openQualityPopover = useCallback(
		(rowIndex: number, anchor: HTMLElement) => {
			const rect = anchor.getBoundingClientRect();
			const width = 288;
			const left = Math.min(
				Math.max(rect.left + 16, 8),
				Math.max(window.innerWidth - width - 8, 8),
			);
			const top =
				rect.bottom + 8 > window.innerHeight - 220
					? Math.max(rect.top - 8, 8)
					: rect.bottom + 8;
			setQualityPopover((current) =>
				current?.rowIndex === rowIndex ? null : { rowIndex, top, left },
			);
		},
		[],
	);
	const openEventCategoryPopover = useCallback(
		(rowIndex: number, columnKey: string, anchor: HTMLElement) => {
			const rect = anchor.getBoundingClientRect();
			const left = Math.min(
				Math.max(rect.left + 1, EVENT_CATEGORY_POPOVER_PADDING),
				Math.max(
					window.innerWidth -
						EVENT_CATEGORY_POPOVER_WIDTH -
						EVENT_CATEGORY_POPOVER_PADDING,
					EVENT_CATEGORY_POPOVER_PADDING,
				),
			);
			const hasRoomBelow =
				rect.bottom +
					EVENT_CATEGORY_POPOVER_HEIGHT +
					EVENT_CATEGORY_POPOVER_PADDING <
				window.innerHeight - EVENT_CATEGORY_POPOVER_PADDING;
			const top = hasRoomBelow
				? rect.bottom + 8
				: Math.max(
						rect.top - EVENT_CATEGORY_POPOVER_HEIGHT - 8,
						EVENT_CATEGORY_POPOVER_PADDING,
					);

			setEventCategoryPopover((current) =>
				current?.rowIndex === rowIndex && current.columnKey === columnKey
					? current
					: { rowIndex, columnKey, top, left },
			);
		},
		[],
	);
	useEffect(() => {
		if (!qualityPopover) return;
		const close = () => setQualityPopover(null);
		const closeOnOutsidePointerDown = (event: PointerEvent) => {
			const target = event.target;
			if (
				target instanceof Element &&
				target.closest("[data-quality-popover]")
			) {
				return;
			}
			setQualityPopover(null);
		};
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setQualityPopover(null);
			}
		};
		document.addEventListener("pointerdown", closeOnOutsidePointerDown);
		document.addEventListener("keydown", closeOnEscape);
		window.addEventListener("resize", close);
		window.addEventListener("scroll", close, true);
		return () => {
			document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
			document.removeEventListener("keydown", closeOnEscape);
			window.removeEventListener("resize", close);
			window.removeEventListener("scroll", close, true);
		};
	}, [qualityPopover]);
	useEffect(() => {
		if (!eventCategoryPopover) return;
		const close = () => {
			setEventCategoryPopover(null);
			setFocusedEventCategoryCell(null);
		};
		const closeOnOutsidePointerDown = (event: PointerEvent) => {
			const target = event.target;
			if (
				target instanceof Element &&
				(target.closest("[data-event-category-popover]") ||
					target.closest("[data-event-category-cell]"))
			) {
				return;
			}
			close();
		};
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				close();
			}
		};
		document.addEventListener("pointerdown", closeOnOutsidePointerDown);
		document.addEventListener("keydown", closeOnEscape);
		window.addEventListener("resize", close);
		window.addEventListener("scroll", close, true);
		return () => {
			document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
			document.removeEventListener("keydown", closeOnEscape);
			window.removeEventListener("resize", close);
			window.removeEventListener("scroll", close, true);
		};
	}, [eventCategoryPopover]);
	useEffect(() => {
		if (!focusedEventCategoryCell) {
			setEventCategoryPopover(null);
		}
	}, [focusedEventCategoryCell]);

	const focusCell = (
		rowIndex: number,
		columnKey: string,
		deltaRow: number,
		deltaColumn: number,
	) => {
		const columnIndex = visibleColumns.findIndex(
			(column) => column.key === columnKey,
		);
		if (columnIndex < 0) return;

		const nextRowIndex = rowIndex + deltaRow;
		const nextColumnIndex = columnIndex + deltaColumn;
		const nextColumn = visibleColumns[nextColumnIndex];
		if (!nextColumn) return;

		const targetKey = cellRefKey(nextRowIndex, nextColumn.key);
		const target = inputRefs.current[targetKey];
		if (target) {
			target.focus();
			if (target instanceof HTMLInputElement) {
				target.select();
			}
		}
	};

	const safePinnedCount = Math.max(
		0,
		Math.min(pinnedColumnsCount, visibleColumns.length, MAX_FROZEN_COLUMNS),
	);

	const getPinnedColumnStyle = (
		columnIndex: number,
		layer: "header" | "cell",
	): CSSProperties | undefined => {
		if (columnIndex >= safePinnedCount) {
			return undefined;
		}

		return {
			position: "sticky",
			left: `${ROW_NUMBER_COLUMN_WIDTH + columnIndex * DATA_COLUMN_WIDTH}px`,
			zIndex: layer === "header" ? 22 : 8,
			background: "color-mix(in oklab, var(--background) 94%, transparent)",
			boxShadow:
				columnIndex === safePinnedCount - 1
					? "1px 0 0 rgba(0,0,0,0.1), 8px 0 14px -14px rgba(0,0,0,0.4)"
					: undefined,
		};
	};

	const getCellPopoverStyle = (
		rowIndex: number,
		columnKey: string,
		width: number,
		estimatedHeight = 280,
	): CSSProperties => {
		if (typeof window === "undefined") {
			return {
				left: CELL_POPOVER_VIEWPORT_PADDING,
				top: CELL_POPOVER_VIEWPORT_PADDING,
			};
		}

		const anchor = inputRefs.current[cellRefKey(rowIndex, columnKey)];
		if (!anchor) {
			return {
				left: CELL_POPOVER_VIEWPORT_PADDING,
				top: CELL_POPOVER_VIEWPORT_PADDING,
			};
		}

		const rect = anchor.getBoundingClientRect();
		const left = Math.min(
			Math.max(rect.left + 4, CELL_POPOVER_VIEWPORT_PADDING),
			Math.max(
				window.innerWidth - width - CELL_POPOVER_VIEWPORT_PADDING,
				CELL_POPOVER_VIEWPORT_PADDING,
			),
		);
		const hasRoomBelow =
			rect.bottom + estimatedHeight + CELL_POPOVER_VIEWPORT_PADDING <=
			window.innerHeight;
		const top = hasRoomBelow
			? rect.bottom + 6
			: Math.max(rect.top - estimatedHeight - 6, CELL_POPOVER_VIEWPORT_PADDING);

		return { left, top };
	};

	const rangePreviewRow =
		rangePreviewRowIndex !== null ? rows[rangePreviewRowIndex] : undefined;
	const rangePreviewDates = rangePreviewRow
		? getEditableSheetDateRangeDates(rangePreviewRow, sheetDateContext)
		: [];
	const detailRow = detailRowIndex !== null ? rows[detailRowIndex] : undefined;
	const detailRowIssues =
		detailRowIndex !== null
			? (sheetHealthIssuesByRow.get(detailRowIndex + 1) ?? [])
			: [];
	const detailRowQuality =
		detailRow && detailRowIndex !== null
			? getRowQualityAssessment(detailRow, detailRowIssues, {
					pendingSubmissionType:
						getPendingEventReviewForRow(detailRow)?.submissionType,
				})
			: null;
	const detailLifecycleBadge = detailRow
		? getRowLifecycleBadge(detailRow, lifecycleMetadataByEventKey, {
				suppressUpdated: suppressUpdatedLifecycleBadges,
			})
		: null;
	const detailRangeDates = detailRow
		? getEditableSheetDateRangeDates(detailRow, sheetDateContext)
		: [];
	const detailVisiblePosition =
		detailRowIndex !== null ? visibleRowIndexes.indexOf(detailRowIndex) : -1;
	const detailPreviousRowIndex =
		detailVisiblePosition > 0
			? (visibleRowIndexes[detailVisiblePosition - 1] ?? null)
			: null;
	const detailNextRowIndex =
		detailVisiblePosition >= 0 &&
		detailVisiblePosition < visibleRowIndexes.length - 1
			? (visibleRowIndexes[detailVisiblePosition + 1] ?? null)
			: null;
	const detailCustomColumns = columns.filter(
		(column) => !column.isCore && !ADVANCED_COLUMN_KEYS.has(column.key),
	);
	const detailSeriesKeySuggestions = useMemo(
		() =>
			detailRowIndex === null
				? []
				: buildSeriesKeySuggestions(detailRowIndex, rows),
		[detailRowIndex, rows],
	);
	const generateDetailSeriesKey = (rowIndex: number, columnKey: string) => {
		const row = rowsRef.current[rowIndex];
		if (!row) return;
		const seriesKey = generateEditableSheetSeriesKey(row);
		handleCellChange(rowIndex, columnKey, seriesKey);
		setStatusMessage(`Generated series key ${seriesKey}`);
	};
	const clearDetailSeriesKey = (rowIndex: number, columnKey: string) => {
		handleCellChange(rowIndex, columnKey, "");
		setStatusMessage("Series key cleared");
	};
	const selectDetailDate = (
		rowIndex: number,
		columnKey: string,
		date: string,
	) => {
		handleCellChange(rowIndex, columnKey, formatIsoDateForEditableSheet(date));
	};
	const selectDetailEventCategory = (
		rowIndex: number,
		columnKey: string,
		category: EventExperienceCategoryDefinition | null,
	) => {
		handleCellChange(rowIndex, columnKey, category?.label ?? "");
	};
	const toggleDetailGenre = (
		rowIndex: number,
		columnKey: string,
		genre: GenreTaxonomyDefinition,
	) => {
		const row = rowsRef.current[rowIndex];
		if (!row) return;
		const storedParts = splitGenreCell(row[columnKey] ?? "", genreTaxonomy);
		const isSelected = storedParts.some((part) => part.resolved === genre.key);
		const nextLabels = isSelected
			? storedParts
					.filter((part) => part.resolved !== genre.key)
					.map((part) => part.label)
			: [...storedParts.map((part) => part.label), genre.label];
		handleCellChange(rowIndex, columnKey, joinGenreLabels(nextLabels));
	};
	const toggleDetailSetting = (
		rowIndex: number,
		columnKey: string,
		setting: SimpleOption,
	) => {
		const currentValue = rowsRef.current[rowIndex]?.[columnKey] ?? "";
		const selectedValues = splitSettingCell(currentValue);
		const nextValues = selectedValues.includes(setting.value)
			? selectedValues.filter((value) => value !== setting.value)
			: [...selectedValues, setting.value];
		handleCellChange(rowIndex, columnKey, nextValues.join(", "));
	};
	const selectDetailAge = (
		rowIndex: number,
		columnKey: string,
		age: SimpleOption | null,
	) => {
		handleCellChange(rowIndex, columnKey, age?.value ?? "");
	};
	const toggleDetailCountry = (
		rowIndex: number,
		columnKey: string,
		country: CountryOption,
	) => {
		const currentValue = rowsRef.current[rowIndex]?.[columnKey] ?? "";
		const selectedCodes = splitCountryCell(currentValue);
		const nextCodes = selectedCodes.includes(country.code)
			? selectedCodes.filter((code) => code !== country.code)
			: [...selectedCodes, country.code];
		handleCellChange(rowIndex, columnKey, joinCountryCodes(nextCodes));
	};
	const selectDetailArea = (
		rowIndex: number,
		columnKey: string,
		area: AreaOption,
	) => {
		handleCellChange(rowIndex, columnKey, area.value);
	};
	const addDetailPrimaryUrlSlot = (rowIndex: number, columnKey: string) => {
		const currentValue = rowsRef.current[rowIndex]?.[columnKey] ?? "";
		const nextValue = [...splitUrlRawParts(currentValue), "https://"].join(
			", ",
		);
		handleCellChange(rowIndex, columnKey, nextValue);
	};
	const updateDetailPrimaryUrlPart = (
		rowIndex: number,
		columnKey: string,
		partIndex: number,
		value: string,
	) => {
		const parts = splitUrlRawParts(
			rowsRef.current[rowIndex]?.[columnKey] ?? "",
		);
		parts[partIndex] = value;
		handleCellChange(rowIndex, columnKey, parts.join(", "));
	};
	const removeDetailPrimaryUrlPart = (
		rowIndex: number,
		columnKey: string,
		partIndex: number,
	) => {
		const nextValue = splitUrlRawParts(
			rowsRef.current[rowIndex]?.[columnKey] ?? "",
		)
			.filter((_, index) => index !== partIndex)
			.join(", ");
		handleCellChange(rowIndex, columnKey, nextValue);
	};
	const renderDetailField = (
		label: string,
		columnKey: string,
		options: { multiline?: boolean; readOnly?: boolean } = {},
	): ReactNode => {
		if (detailRowIndex === null || !detailRow) return null;
		const value = detailRow[columnKey] ?? "";
		const inputClassName =
			"mt-1 w-full rounded-md border border-border/70 bg-background px-2 py-1.5 text-xs outline-none focus:border-ring";
		const fieldLabel = (
			<span className="block text-xs font-medium text-foreground">{label}</span>
		);

		if (columnKey === CURATED_COLUMN_KEY) {
			const isCurated = isCuratedValue(value);
			return (
				<div className="block text-xs font-medium text-foreground">
					{fieldLabel}
					<div className="mt-1 flex flex-wrap gap-2">
						<Button
							type="button"
							size="sm"
							variant={isCurated ? "default" : "outline"}
							className="h-8"
							onClick={() => toggleCuratedForCell(detailRowIndex, columnKey)}
						>
							{isCurated ? "OOOC pick" : "Mark OOOC pick"}
						</Button>
					</div>
				</div>
			);
		}

		if (columnKey === SERIES_KEY_COLUMN_KEY) {
			return (
				<div className="block text-xs font-medium text-foreground">
					{fieldLabel}
					<input
						value={value}
						onChange={(event) =>
							handleCellChange(detailRowIndex, columnKey, event.target.value)
						}
						onBlur={() => commitStandardCell(detailRowIndex, columnKey)}
						className={`${inputClassName} font-mono text-[11px]`}
						placeholder="ser_..."
					/>
					<div className="mt-2 flex flex-wrap gap-1.5">
						<Button
							type="button"
							size="sm"
							variant="outline"
							className="h-8"
							onClick={() => generateDetailSeriesKey(detailRowIndex, columnKey)}
						>
							<RefreshCw className="mr-1 h-3.5 w-3.5" />
							Generate
						</Button>
						<Button
							type="button"
							size="sm"
							variant="ghost"
							className="h-8 px-2 text-xs"
							disabled={!value.trim()}
							onClick={() => clearDetailSeriesKey(detailRowIndex, columnKey)}
						>
							Clear
						</Button>
					</div>
					{detailSeriesKeySuggestions.length > 0 && (
						<div className="mt-2 overflow-hidden rounded-md border border-border/70 bg-background/60">
							<div className="border-b px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
								Link related rows
							</div>
							<div className="max-h-44 overflow-y-auto p-1">
								{detailSeriesKeySuggestions.map((suggestion) => (
									<button
										key={`${suggestion.seriesKey}-${suggestion.rowIndex}`}
										type="button"
										className="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-xs transition hover:bg-accent/70"
										onClick={() =>
											linkSeriesKeyForCell(
												detailRowIndex,
												columnKey,
												suggestion,
											)
										}
									>
										<Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
										<span className="min-w-0 flex-1">
											<span className="block truncate font-medium">
												{suggestion.title}
											</span>
											<span className="block truncate text-[11px] text-muted-foreground">
												{[suggestion.date, suggestion.location]
													.filter(Boolean)
													.join(" · ") || `Row ${suggestion.rowIndex + 1}`}
											</span>
											<span className="block truncate font-mono text-[10px] text-muted-foreground">
												{suggestion.seriesKey}
											</span>
										</span>
										<Badge
											variant={
												suggestion.willCreateSeriesKey ? "secondary" : "outline"
											}
											className="shrink-0 text-[10px]"
										>
											{suggestion.willCreateSeriesKey
												? "New"
												: `${suggestion.rowCount} rows`}
										</Badge>
									</button>
								))}
							</div>
						</div>
					)}
				</div>
			);
		}

		if (columnKey === EVENT_CATEGORY_COLUMN_KEY) {
			const selectedCategory = normalizeEventExperienceCategory(value);
			return (
				<div className="block text-xs font-medium text-foreground">
					{fieldLabel}
					<div className="mt-2 flex flex-wrap gap-1.5">
						{EVENT_CATEGORY_OPTIONS.map((category) => {
							const selected = selectedCategory === category.key;
							return (
								<button
									key={category.key}
									type="button"
									className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs transition ${
										selected
											? `${EVENT_CATEGORY_ADMIN_OPTION_CLASSES[category.key].selected}`
											: "border-border/70 bg-background hover:bg-muted/70"
									}`}
									onClick={() =>
										selectDetailEventCategory(
											detailRowIndex,
											columnKey,
											category,
										)
									}
								>
									<span
										className={`h-2 w-2 rounded-full ${EVENT_CATEGORY_ADMIN_OPTION_CLASSES[category.key].dot}`}
									/>
									<span>{category.label}</span>
								</button>
							);
						})}
						<Button
							type="button"
							size="sm"
							variant="ghost"
							className="h-8 px-2 text-xs"
							onClick={() =>
								selectDetailEventCategory(detailRowIndex, columnKey, null)
							}
						>
							Clear
						</Button>
					</div>
				</div>
			);
		}

		if (columnKey === CATEGORY_COLUMN_KEY) {
			const selectedGenreKeys = getSelectedGenreKeys(value, genreTaxonomy);
			const selectedGenres = splitGenreCell(value, genreTaxonomy).filter(
				(part) => part.label.trim(),
			);
			return (
				<div className="block text-xs font-medium text-foreground">
					{fieldLabel}
					<input
						value={value}
						onChange={(event) =>
							handleCellChange(detailRowIndex, columnKey, event.target.value)
						}
						onBlur={() => commitStandardCell(detailRowIndex, columnKey)}
						className={inputClassName}
					/>
					{selectedGenres.length > 0 && (
						<div className="mt-2 flex flex-wrap gap-1.5">
							{selectedGenres.map((genre) => (
								<Badge
									key={`${genre.label}-${genre.resolved ?? genre.value}`}
									variant="secondary"
									className="text-[10px]"
								>
									{genre.label}
								</Badge>
							))}
						</div>
					)}
					<details className="mt-2 rounded-md border border-border/70 bg-background/60">
						<summary className="cursor-pointer list-none px-2.5 py-2 text-[11px] font-medium text-muted-foreground hover:text-foreground">
							Genre quick picks
						</summary>
						<div className="max-h-32 overflow-y-auto border-t border-border/70 p-2">
							<div className="flex flex-wrap gap-1.5">
								{availableGenres.map((genre) => (
									<button
										key={genre.key}
										type="button"
										className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2 text-xs transition ${
											selectedGenreKeys.has(genre.key)
												? `${genre.color} border-transparent`
												: "border-border/70 bg-background hover:bg-muted/70"
										}`}
										onClick={() =>
											toggleDetailGenre(detailRowIndex, columnKey, genre)
										}
									>
										<span
											className={`h-2 w-2 rounded-full ${genre.color || "bg-stone-500"}`}
										/>
										{genre.label}
									</button>
								))}
								{availableGenres.length === 0 && (
									<span className="text-xs text-muted-foreground">
										Genre taxonomy unavailable.
									</span>
								)}
							</div>
						</div>
					</details>
				</div>
			);
		}

		if (columnKey === SETTING_COLUMN_KEY) {
			const selectedValues = splitSettingCell(value);
			return (
				<div className="block text-xs font-medium text-foreground">
					{fieldLabel}
					<div className="mt-1 flex flex-wrap gap-1.5">
						{SETTING_OPTIONS.map((setting) => (
							<Button
								key={setting.value}
								type="button"
								size="sm"
								variant={
									selectedValues.includes(setting.value) ? "default" : "outline"
								}
								className="h-8"
								title={setting.description}
								onClick={() =>
									toggleDetailSetting(detailRowIndex, columnKey, setting)
								}
							>
								{setting.label}
							</Button>
						))}
					</div>
				</div>
			);
		}

		if (columnKey === AGE_COLUMN_KEY) {
			return (
				<div className="block text-xs font-medium text-foreground">
					{fieldLabel}
					<div className="mt-1 flex flex-wrap gap-1.5">
						{AGE_OPTIONS.map((age) => (
							<Button
								key={age.value}
								type="button"
								size="sm"
								variant={value === age.value ? "default" : "outline"}
								className="h-8"
								title={age.description}
								onClick={() => selectDetailAge(detailRowIndex, columnKey, age)}
							>
								{age.label}
							</Button>
						))}
						<Button
							type="button"
							size="sm"
							variant="ghost"
							className="h-8"
							onClick={() => selectDetailAge(detailRowIndex, columnKey, null)}
						>
							Clear
						</Button>
					</div>
				</div>
			);
		}

		if (COUNTRY_COLUMN_KEYS.has(columnKey)) {
			const selectedCodes = getSelectedCountryCodes(value);
			return (
				<div className="block text-xs font-medium text-foreground">
					{fieldLabel}
					<input
						value={value}
						onChange={(event) =>
							handleCellChange(
								detailRowIndex,
								columnKey,
								normalizeCountryValue(event.target.value),
							)
						}
						onBlur={() =>
							commitCellDraft(detailRowIndex, columnKey, normalizeCountryValue)
						}
						className={inputClassName}
					/>
					{selectedCodes.size > 0 && (
						<div className="mt-1 flex flex-wrap gap-1">
							{[...selectedCodes].map((code) => {
								const country = getCountryOption(code);
								return (
									<Badge key={code} variant="outline" className="text-[10px]">
										{country ? `${country.flag} ${country.code}` : code}
									</Badge>
								);
							})}
						</div>
					)}
				</div>
			);
		}

		if (columnKey === AREA_COLUMN_KEY) {
			const normalizedArea = normalizeAreaValue(value);
			const derivedArea = deriveAreaLabelFromRow(detailRow);
			return (
				<div className="block text-xs font-medium text-foreground">
					{fieldLabel}
					<input
						value={value}
						onChange={(event) =>
							handleCellChange(detailRowIndex, columnKey, event.target.value)
						}
						onBlur={() =>
							commitCellDraft(detailRowIndex, columnKey, normalizeAreaValue)
						}
						className={inputClassName}
						placeholder={derivedArea ? `Auto: ${derivedArea}` : "Auto"}
					/>
					{derivedArea && (
						<div className="mt-1 text-[11px] text-muted-foreground">
							{`Auto area: ${normalizeAreaValue(derivedArea)}`}
						</div>
					)}
					<details className="mt-2 rounded-md border border-border/70 bg-background/60">
						<summary className="cursor-pointer list-none px-2.5 py-2 text-[11px] font-medium text-muted-foreground hover:text-foreground">
							Override quick picks
						</summary>
						<div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto border-t border-border/70 p-2">
							{AREA_OPTIONS.map((area) => (
								<button
									key={area.value}
									type="button"
									className={`h-7 rounded-full border px-2 text-xs transition ${
										normalizedArea === area.value
											? "border-foreground bg-foreground text-background"
											: "border-border/70 bg-background hover:bg-muted/70"
									}`}
									title={area.description}
									onClick={() =>
										selectDetailArea(detailRowIndex, columnKey, area)
									}
								>
									{area.label}
								</button>
							))}
						</div>
					</details>
				</div>
			);
		}

		if (columnKey === DATE_COLUMN_KEY || columnKey === DATE_TO_COLUMN_KEY) {
			const hint = formatDateCellHint(value, sheetDateContext);
			const suggestions = buildCommonFeteDates(
				pickUsefulFeteYear(detailRowIndex, rows, sheetDateContext),
			);
			return (
				<label className="block text-xs font-medium text-foreground">
					{label}
					<input
						value={value}
						readOnly={options.readOnly}
						onChange={(event) =>
							handleCellChange(detailRowIndex, columnKey, event.target.value)
						}
						onBlur={() => commitStandardCell(detailRowIndex, columnKey)}
						className={`${inputClassName} ${
							options.readOnly
								? "cursor-not-allowed bg-muted/35 text-muted-foreground"
								: ""
						}`}
					/>
					{hint && (
						<span className="mt-1 block text-[11px] text-muted-foreground">
							{hint}
						</span>
					)}
					<div className="mt-2 flex flex-wrap gap-1.5">
						{suggestions.map((suggestion) => (
							<Button
								key={suggestion.value}
								type="button"
								size="sm"
								variant="outline"
								className="h-7 px-2 text-[11px]"
								title={suggestion.description}
								onClick={() =>
									selectDetailDate(detailRowIndex, columnKey, suggestion.value)
								}
							>
								{suggestion.label}
							</Button>
						))}
					</div>
				</label>
			);
		}

		if (TIME_COLUMN_KEYS.has(columnKey)) {
			const preview = getTimeInputPreview(value);
			return (
				<label className="block text-xs font-medium text-foreground">
					{label}
					<input
						value={value}
						readOnly={options.readOnly}
						onChange={(event) =>
							handleCellChange(detailRowIndex, columnKey, event.target.value)
						}
						onBlur={() => commitStandardCell(detailRowIndex, columnKey)}
						className={`${inputClassName} ${
							options.readOnly
								? "cursor-not-allowed bg-muted/35 text-muted-foreground"
								: ""
						}`}
					/>
					{preview && (
						<span className="mt-1 block text-[11px] text-muted-foreground">
							{preview.message}
						</span>
					)}
				</label>
			);
		}

		if (columnKey === PRIMARY_URL_COLUMN_KEY) {
			const parts = parseUrlParts(value);
			return (
				<div className="block text-xs font-medium text-foreground">
					{fieldLabel}
					<div className="mt-1 space-y-2">
						{parts.length > 0 ? (
							parts.map((part, index) => (
								<div key={`${part.raw}-${index}`} className="space-y-1">
									<div className="flex gap-1.5">
										<input
											value={part.raw}
											onChange={(event) =>
												updateDetailPrimaryUrlPart(
													detailRowIndex,
													columnKey,
													index,
													event.target.value,
												)
											}
											onBlur={() =>
												commitStandardCell(detailRowIndex, columnKey)
											}
											className={`${inputClassName} mt-0`}
										/>
										<Button
											type="button"
											size="sm"
											variant="ghost"
											className="h-8 px-2"
											onClick={() =>
												removeDetailPrimaryUrlPart(
													detailRowIndex,
													columnKey,
													index,
												)
											}
										>
											Remove
										</Button>
									</div>
									<span
										className={`block text-[11px] ${
											part.isValid
												? "text-muted-foreground"
												: "text-amber-700 dark:text-amber-300"
										}`}
									>
										{part.isValid
											? (part.host ?? "Valid URL")
											: "Check this URL before publishing"}
									</span>
								</div>
							))
						) : (
							<input
								value={value}
								onChange={(event) =>
									handleCellChange(
										detailRowIndex,
										columnKey,
										event.target.value,
									)
								}
								onBlur={() => commitStandardCell(detailRowIndex, columnKey)}
								className={inputClassName}
							/>
						)}
						<Button
							type="button"
							size="sm"
							variant="outline"
							className="h-8"
							onClick={() => addDetailPrimaryUrlSlot(detailRowIndex, columnKey)}
						>
							Add another link
						</Button>
					</div>
				</div>
			);
		}

		return (
			<label className="block text-xs font-medium text-foreground">
				{label}
				{options.multiline ? (
					<textarea
						value={value}
						readOnly={options.readOnly}
						onChange={(event) =>
							handleCellChange(detailRowIndex, columnKey, event.target.value)
						}
						onBlur={() => commitStandardCell(detailRowIndex, columnKey)}
						rows={4}
						className={`${inputClassName} min-h-24 resize-y`}
					/>
				) : (
					<input
						value={value}
						readOnly={options.readOnly}
						onChange={(event) =>
							handleCellChange(detailRowIndex, columnKey, event.target.value)
						}
						onBlur={() => commitStandardCell(detailRowIndex, columnKey)}
						className={`${inputClassName} ${
							options.readOnly
								? "cursor-not-allowed bg-muted/35 text-muted-foreground"
								: ""
						}`}
					/>
				)}
			</label>
		);
	};

	const renderDetailCountryPair = (): ReactNode => {
		if (detailRowIndex === null || !detailRow) return null;
		const commonCountries = DETAIL_COMMON_COUNTRY_CODES.map((code) =>
			getCountryOption(code),
		).filter((country): country is CountryOption => Boolean(country));
		const hostCodes = getSelectedCountryCodes(detailRow.hostCountry ?? "");
		const audienceCodes = getSelectedCountryCodes(
			detailRow.audienceCountry ?? "",
		);

		return (
			<div className="space-y-2">
				<div className="grid gap-3 md:grid-cols-2">
					{renderDetailField("Host Country", "hostCountry")}
					{renderDetailField("Audience Country", "audienceCountry")}
				</div>
				<details className="rounded-md border border-border/70 bg-background/60">
					<summary className="cursor-pointer list-none px-2.5 py-2 text-[11px] font-medium text-muted-foreground hover:text-foreground">
						Quick countries
					</summary>
					<div className="flex flex-wrap gap-1.5 border-t border-border/70 p-2">
						{commonCountries.map((country) => (
							<div
								key={country.code}
								className="inline-flex h-8 overflow-hidden rounded-md border border-border/70 bg-background text-xs"
							>
								<span className="inline-flex items-center border-r border-border/70 px-2">
									{country.flag} {country.code}
								</span>
								<button
									type="button"
									className={`w-8 border-r border-border/70 transition ${
										hostCodes.has(country.code)
											? "bg-foreground text-background"
											: "hover:bg-muted/70"
									}`}
									title={`Toggle ${country.label} as host country`}
									onClick={() =>
										toggleDetailCountry(detailRowIndex, "hostCountry", country)
									}
								>
									H
								</button>
								<button
									type="button"
									className={`w-8 transition ${
										audienceCodes.has(country.code)
											? "bg-foreground text-background"
											: "hover:bg-muted/70"
									}`}
									title={`Toggle ${country.label} as audience country`}
									onClick={() =>
										toggleDetailCountry(
											detailRowIndex,
											"audienceCountry",
											country,
										)
									}
								>
									A
								</button>
							</div>
						))}
					</div>
				</details>
			</div>
		);
	};

	if (!isAuthenticated) {
		return null;
	}

	const qualityPopoverPortal =
		qualityPopover && typeof document !== "undefined"
			? (() => {
					const row = rows[qualityPopover.rowIndex];
					if (!row) return null;
					const rowIssues =
						sheetHealthIssuesByRow.get(qualityPopover.rowIndex + 1) ?? [];
					const pendingEventReview = getPendingEventReviewForRow(row);
					const rowQuality = getRowQualityAssessment(row, rowIssues, {
						pendingSubmissionType: pendingEventReview?.submissionType,
					});

					return createPortal(
						<div
							data-quality-popover
							className="fixed z-[120] w-72 rounded-md border border-border/80 bg-popover p-3 text-left text-xs text-popover-foreground shadow-xl"
							style={{
								top: qualityPopover.top,
								left: qualityPopover.left,
							}}
						>
							<div className="mb-2">
								<div className="font-medium text-foreground">
									{rowQuality.label}
								</div>
								<div className="text-muted-foreground">
									{rowQuality.description} Status is {rowQuality.sourceLabel}.
								</div>
							</div>
							{pendingEventReview && (
								<a
									href={`#submission-${pendingEventReview.submissionId}`}
									className="mb-2 block rounded-md border border-red-200 bg-red-50 px-2 py-1.5 font-medium text-red-700 underline-offset-2 hover:underline dark:border-red-400/30 dark:bg-red-950/30 dark:text-red-200"
									onClick={() => setQualityPopover(null)}
								>
									Jump to matching submission
								</a>
							)}
							<div className="mb-2 grid grid-cols-1 gap-1">
								{rowQuality.checks.map((check) => (
									<div
										key={check.label}
										className="flex items-center justify-between gap-2"
									>
										<span>{check.label}</span>
										<span
											className={
												check.passed
													? "text-green-700"
													: "text-muted-foreground"
											}
										>
											{check.passed ? "Yes" : "No"}
										</span>
									</div>
								))}
							</div>
							{rowQuality.issues.length > 0 && (
								<div className="mb-2 space-y-1 border-t border-border/70 pt-2">
									{rowQuality.issues.slice(0, 3).map((issue) => (
										<div
											key={`${issue.column}-${issue.message}`}
											className={
												issue.severity === "blocking"
													? "text-red-700"
													: "text-amber-700"
											}
										>
											{issue.column}: {issue.message}
										</div>
									))}
								</div>
							)}
							<Button
								type="button"
								size="sm"
								variant={
									qualityFilter === rowQuality.value ? "default" : "outline"
								}
								className="mb-2 h-7 w-full px-2 text-[11px]"
								onClick={() => handleQualityFilterToggle(rowQuality.value)}
							>
								{qualityFilter === rowQuality.value
									? "Clear this quality filter"
									: `Show only ${getQualityFilterDescription(rowQuality.value)}`}
							</Button>
							<label className="mb-2 flex items-center gap-2 border-t border-border/70 pt-2">
								<input
									type="checkbox"
									checked={rowQuality.isConfirmed}
									onChange={(event) =>
										handleCellChange(
											qualityPopover.rowIndex,
											SOURCE_CONFIRMED_COLUMN_KEY,
											event.target.checked ? "true" : "",
										)
									}
								/>
								<span>Location/source confirmed</span>
							</label>
							<div className="grid grid-cols-2 gap-1 border-t border-border/70 pt-2">
								{[
									{ label: "Auto", value: "" },
									{ label: "Draft", value: "draft" },
									{ label: "Complete", value: "complete" },
									{ label: "Review", value: "review" },
									{ label: "Needs fix", value: "blocking" },
								].map((option) => (
									<Button
										key={option.label}
										type="button"
										size="sm"
										variant={
											(row[DETAILS_QUALITY_OVERRIDE_COLUMN_KEY] ?? "") ===
											option.value
												? "default"
												: "outline"
										}
										className="h-7 px-2 text-[11px]"
										onClick={() =>
											handleCellChange(
												qualityPopover.rowIndex,
												DETAILS_QUALITY_OVERRIDE_COLUMN_KEY,
												option.value,
											)
										}
									>
										{option.label}
									</Button>
								))}
							</div>
						</div>,
						document.body,
					);
				})()
			: null;
	const eventCategoryPopoverPortal =
		eventCategoryPopover && typeof document !== "undefined"
			? createPortal(
					<div
						data-event-category-popover
						className="fixed z-[130] w-72 overflow-hidden rounded-md border border-border/80 bg-popover shadow-xl"
						style={{
							top: eventCategoryPopover.top,
							left: eventCategoryPopover.left,
						}}
					>
						<div className="border-b px-2 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
							Event Category
						</div>
						<div className="border-b px-2 py-1.5 text-[11px] text-muted-foreground">
							Use this to separate parties from activities without changing the
							card layout.
						</div>
						<div className="max-h-60 overflow-y-auto p-1">
							<button
								type="button"
								onMouseDown={(event) => {
									event.preventDefault();
									selectEventCategoryForCell(
										eventCategoryPopover.rowIndex,
										eventCategoryPopover.columnKey,
										null,
									);
								}}
								className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-muted-foreground transition hover:bg-accent/70"
							>
								Clear
							</button>
							{eventCategoryOptionsForFocusedCell.map(
								(category, optionIndex) => {
									const normalizedCurrent = normalizeEventExperienceCategory(
										rows[eventCategoryPopover.rowIndex]?.[
											eventCategoryPopover.columnKey
										] ?? "",
									);
									const isSelected = normalizedCurrent === category.key;

									return (
										<button
											key={category.key}
											type="button"
											onMouseDown={(event) => {
												event.preventDefault();
												selectEventCategoryForCell(
													eventCategoryPopover.rowIndex,
													eventCategoryPopover.columnKey,
													category,
												);
											}}
											className={getEventCategoryAdminOptionClassName(
												category.key,
												isSelected,
												optionIndex === highlightedEventCategoryIndex,
											)}
										>
											<span
												className={`h-2 w-2 shrink-0 rounded-full ${EVENT_CATEGORY_ADMIN_OPTION_CLASSES[category.key].dot}`}
												aria-hidden="true"
											/>
											<span className="min-w-0 flex-1 truncate font-medium">
												{category.label}
											</span>
											<span className="max-w-40 truncate text-[10px] text-muted-foreground">
												{category.description}
											</span>
										</button>
									);
								},
							)}
						</div>
					</div>,
					document.body,
				)
			: null;

	return (
		<>
			{eventCategoryPopoverPortal}
			{qualityPopoverPortal}
			<Card className="ooo-admin-card-soft min-w-0 overflow-hidden">
				<CardHeader>
					<CardTitle className="text-2xl tracking-tight">
						Event Sheet Editor
					</CardTitle>
					<CardDescription>
						Spreadsheet editing with autosave. Use Save and Revalidate Homepage
						to publish visible site changes.
					</CardDescription>
					{recoverableDraft && (
						<div className="flex flex-wrap gap-2 pt-2">
							<Button type="button" size="sm" onClick={handleRestoreDraft}>
								Restore Local Draft
							</Button>
							<Button
								type="button"
								size="sm"
								variant="outline"
								onClick={handleDiscardDraft}
							>
								Discard Draft
							</Button>
						</div>
					)}
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="flex flex-wrap items-center gap-2" role="status">
						{isSaving ? (
							<Badge variant="secondary">Saving...</Badge>
						) : hasUnsavedChanges ? (
							<Badge variant="outline">Unsaved changes</Badge>
						) : (
							<Badge variant="default">All changes saved</Badge>
						)}
						{autosavePauseReason === "blank-draft-row" && (
							<Badge variant="secondary">
								Autosave paused for blank draft row
							</Badge>
						)}
						{autosavePauseReason === "missing-required-fields" && (
							<Badge variant="secondary">
								Autosave paused: required fields missing
							</Badge>
						)}
						{autosavePauseReason === "awaiting-edit-after-error" && (
							<Badge variant="secondary">
								Autosave paused after save error; edit to retry
							</Badge>
						)}
						{autosavePauseReason === "retry-backoff" && (
							<Badge variant="secondary">
								Autosave retrying in a few seconds
							</Badge>
						)}
						{lastAutosaveError && (
							<Badge
								variant="outline"
								className="gap-1 border-amber-300/70 bg-amber-50/60 text-amber-900"
								title={`${lastAutosaveError.message} (${formatAdminDateTime(lastAutosaveError.at)})`}
							>
								<AlertCircle className="h-3.5 w-3.5" />
								Last autosave issue
							</Badge>
						)}
						<Badge variant="outline">Source of truth: Postgres</Badge>
						{restoreReviewRevision && (
							<Badge variant="secondary">Revision loaded for review</Badge>
						)}
						<span className="text-xs text-muted-foreground">
							{statusMessage}
						</span>
						{lastSavedAt && (
							<span className="text-xs text-muted-foreground">
								Last saved: {formatAdminDateTime(lastSavedAt)}
							</span>
						)}
					</div>

					{hasNewDeployment && (
						<div className="rounded-md border border-amber-300/70 bg-amber-50/80 p-3 text-sm text-amber-950">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<div>
									<p className="font-medium">A new deployment is live.</p>
									<p className="mt-1 text-xs text-amber-900/85">
										Editing is paused on this old admin tab. Your current sheet
										is stored locally in this browser. Deployment checks run
										every {DEPLOYMENT_POLL_INTERVAL_MS / 1000}s while this tab
										is visible.
									</p>
								</div>
								<div className="flex flex-wrap gap-2">
									<Button
										type="button"
										size="sm"
										onClick={() => void handleReloadForDeployment()}
										disabled={isSaving}
									>
										{hasUnsavedChanges ? "Save and Reload" : "Reload"}
									</Button>
									<Badge
										variant="outline"
										className="bg-background/70 text-[10px]"
									>
										{latestDeploymentId.slice(0, 12)}
									</Badge>
								</div>
							</div>
						</div>
					)}

					{recoverableDraft && (
						<div className="rounded-md border border-emerald-300/70 bg-emerald-50/80 p-3 text-sm text-emerald-950">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<div>
									<p className="font-medium">Local sheet draft available.</p>
									<p className="mt-1 text-xs text-emerald-900/85">
										Saved in this browser{" "}
										{formatAdminDateTime(recoverableDraft.savedAt)}.
									</p>
								</div>
								<div className="flex flex-wrap gap-2">
									<Button type="button" size="sm" onClick={handleRestoreDraft}>
										Restore Draft
									</Button>
									<Button
										type="button"
										size="sm"
										variant="outline"
										onClick={handleDiscardDraft}
									>
										Discard
									</Button>
								</div>
							</div>
						</div>
					)}

					{restoreReviewRevision && (
						<div className="rounded-md border border-sky-300/70 bg-sky-50/80 p-3 text-sm text-sky-950">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<div>
									<p className="font-medium">Revision loaded for review.</p>
									<p className="mt-1 text-xs text-sky-900/85">
										{restoreReviewRevision.summary}. Publish to make it live, or
										discard to reload the current saved sheet.
									</p>
								</div>
								<div className="flex flex-wrap gap-2">
									<Button
										type="button"
										size="sm"
										onClick={() => void handleManualSave()}
										disabled={isSaving}
									>
										Publish Revision
									</Button>
									<Button
										type="button"
										size="sm"
										variant="outline"
										onClick={handleDiscardRestoredRevision}
										disabled={isSaving}
									>
										Discard
									</Button>
								</div>
							</div>
						</div>
					)}

					{sheetHealthIssues.length > 0 && (
						<details className="rounded-md border border-amber-300/70 bg-amber-50/75 px-3 py-2 text-xs text-amber-950">
							<summary className="cursor-pointer font-medium">
								Sheet health:{" "}
								{blockingSheetHealthIssues.length > 0
									? `${blockingSheetHealthIssues.length} required fix${blockingSheetHealthIssues.length === 1 ? "" : "es"} before publishing`
									: `${sheetHealthIssues.length} value${sheetHealthIssues.length === 1 ? "" : "s"} worth reviewing`}
							</summary>
							<div className="mt-2 space-y-1">
								{sheetHealthIssues.slice(0, 5).map((issue) => (
									<div
										key={`${issue.rowIndex}-${issue.column}-${issue.message}`}
										className="leading-snug"
									>
										{issue.severity === "blocking" ? "Required" : "Review"} ·
										Row {issue.rowIndex} · {issue.column}: {issue.message}
									</div>
								))}
								{sheetHealthIssues.length > 5 && (
									<div className="text-amber-900/80">
										+{sheetHealthIssues.length - 5} more. Use search or sort to
										review affected rows.
									</div>
								)}
							</div>
						</details>
					)}

					<div className="rounded-md border bg-background/55 p-3">
						<div className="flex flex-wrap items-start justify-between gap-3">
							<div className="min-w-0">
								<div className="flex items-center gap-2">
									<History className="h-4 w-4 text-muted-foreground" />
									<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
										Sheet revision history
									</p>
									<Badge variant="outline" className="text-[10px]">
										{sheetRevisions.length} loaded
									</Badge>
								</div>
								<p className="mt-1 text-xs text-muted-foreground">
									Autosaves are grouped into editing sessions. Published saves
									are listed separately. Restore loads a revision for review
									before publishing.
								</p>
							</div>
							<div className="flex flex-wrap gap-2">
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="h-8"
									onClick={() => setIsRevisionHistoryOpen(true)}
									disabled={sheetRevisions.length === 0}
								>
									View all
								</Button>
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="h-8 gap-1.5"
									onClick={() => void handleRefreshRevisionHistory()}
									disabled={isSaving}
								>
									<RefreshCw className="h-3.5 w-3.5" />
									Refresh
								</Button>
							</div>
						</div>

						{!isSheetRevisionSupported ? (
							<div className="mt-3 rounded-md border border-amber-300/70 bg-amber-50/75 px-3 py-2 text-xs text-amber-950">
								Sheet revision history requires Postgres.
							</div>
						) : visibleSheetRevisions.length > 0 ? (
							<div className="mt-3 divide-y rounded-md border bg-background/70">
								{visibleSheetRevisions.map((revision) => (
									<div
										key={revision.id}
										className="grid gap-2 px-3 py-2 md:grid-cols-[minmax(0,1fr)_auto]"
									>
										<div className="min-w-0">
											<div className="flex min-w-0 flex-wrap items-center gap-2">
												<Badge
													variant={
														revision.trigger === "publish"
															? "default"
															: "secondary"
													}
													className="text-[10px]"
												>
													{revision.trigger === "publish"
														? "Published"
														: "Autosave"}
												</Badge>
												<span className="min-w-0 truncate text-sm font-medium">
													{revision.summary}
												</span>
											</div>
											<div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
												<span>{revision.actorLabel}</span>
												<span>{formatRevisionTime(revision.updatedAt)}</span>
												<span>{revision.rowCount} rows</span>
												{revision.autosaveCount > 1 && (
													<span>{revision.autosaveCount} autosaves</span>
												)}
												{!revision.canRestore && <span>Summary only</span>}
											</div>
											{(revision.changedColumns.length > 0 ||
												revision.sampleAdded.length > 0 ||
												revision.sampleDeleted.length > 0) && (
												<details className="mt-1 text-xs text-muted-foreground">
													<summary className="cursor-pointer">
														Columns and samples
													</summary>
													<div className="mt-1 space-y-1">
														{revision.changedColumns.length > 0 && (
															<p>
																Columns: {revision.changedColumns.join(", ")}
															</p>
														)}
														{revision.sampleAdded.length > 0 && (
															<p>Added: {revision.sampleAdded.join(", ")}</p>
														)}
														{revision.sampleDeleted.length > 0 && (
															<p>
																Deleted: {revision.sampleDeleted.join(", ")}
															</p>
														)}
													</div>
												</details>
											)}
										</div>
										<div className="flex items-start justify-start md:justify-end">
											<div className="flex flex-wrap justify-start gap-2 md:justify-end">
												<Badge variant="outline" className="text-[10px]">
													{formatRevisionStats(revision)}
												</Badge>
												<Button
													type="button"
													variant="outline"
													size="sm"
													className="h-7"
													onClick={() => void handlePreviewRevision(revision)}
													disabled={
														!revision.canRestore || isLoadingRevisionPreview
													}
												>
													Preview
												</Button>
											</div>
										</div>
									</div>
								))}
							</div>
						) : (
							<div className="mt-3 rounded-md border bg-background/70 px-3 py-2 text-xs text-muted-foreground">
								No sheet revisions recorded yet.
							</div>
						)}
					</div>

					<Dialog
						open={isRevisionHistoryOpen}
						onOpenChange={setIsRevisionHistoryOpen}
					>
						<DialogContent className="max-h-[88vh] w-[min(980px,calc(100vw-2rem))] max-w-none overflow-hidden p-5 sm:max-w-none sm:p-6">
							<DialogHeader className="pr-10">
								<DialogTitle className="text-xl">
									Sheet revision history
								</DialogTitle>
								<DialogDescription className="max-w-2xl text-base leading-relaxed">
									Preview a revision before restoring it into the editor. The
									restore stays unpublished until you save and revalidate.
								</DialogDescription>
							</DialogHeader>

							<div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
								<div className="max-h-[58vh] min-h-0 overflow-y-auto rounded-md border bg-background/70">
									{sheetRevisions.length > 0 ? (
										<div className="divide-y">
											{sheetRevisions.map((revision) => (
												<button
													key={revision.id}
													type="button"
													className="block w-full px-3 py-2 text-left transition hover:bg-muted/45 disabled:cursor-not-allowed disabled:opacity-60"
													onClick={() => void handlePreviewRevision(revision)}
													disabled={
														!revision.canRestore || isLoadingRevisionPreview
													}
												>
													<div className="flex flex-wrap items-center gap-2">
														<Badge
															variant={
																revision.trigger === "publish"
																	? "default"
																	: "secondary"
															}
															className="text-[10px]"
														>
															{revision.trigger === "publish"
																? "Published"
																: "Autosave"}
														</Badge>
														<span className="min-w-0 truncate text-sm font-medium">
															{revision.summary}
														</span>
													</div>
													<div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
														<span>{revision.actorLabel}</span>
														<span>
															{formatRevisionTime(revision.updatedAt)}
														</span>
														<span>{revision.rowCount} rows</span>
														<span>{formatRevisionStats(revision)}</span>
														{revision.autosaveCount > 1 && (
															<span>{revision.autosaveCount} autosaves</span>
														)}
														{!revision.canRestore && <span>Summary only</span>}
													</div>
												</button>
											))}
										</div>
									) : (
										<div className="p-3 text-sm text-muted-foreground">
											No sheet revisions recorded yet.
										</div>
									)}
								</div>

								<div className="min-h-0 rounded-md border bg-background/70 p-3">
									{revisionPreview?.revision ? (
										<div className="space-y-3">
											<div>
												<div className="flex flex-wrap items-center gap-2">
													<Badge
														variant={
															revisionPreview.revision.trigger === "publish"
																? "default"
																: "secondary"
														}
														className="text-[10px]"
													>
														{revisionPreview.revision.trigger === "publish"
															? "Published"
															: "Autosave"}
													</Badge>
													<span className="text-sm font-medium">
														{formatRevisionTime(
															revisionPreview.revision.updatedAt,
														)}
													</span>
												</div>
												<p className="mt-2 text-sm">
													{revisionPreview.revision.summary}
												</p>
												<p className="mt-1 text-xs text-muted-foreground">
													{revisionPreview.rows?.length ?? 0} rows,{" "}
													{revisionPreview.columns?.length ?? 0} columns
												</p>
											</div>

											<div className="space-y-1 text-xs text-muted-foreground">
												{revisionPreview.revision.changedColumns.length > 0 && (
													<p>
														Columns:{" "}
														{revisionPreview.revision.changedColumns.join(", ")}
													</p>
												)}
												{revisionPreview.revision.sampleAdded.length > 0 && (
													<p>
														Added:{" "}
														{revisionPreview.revision.sampleAdded.join(", ")}
													</p>
												)}
												{revisionPreview.revision.sampleDeleted.length > 0 && (
													<p>
														Deleted:{" "}
														{revisionPreview.revision.sampleDeleted.join(", ")}
													</p>
												)}
											</div>

											<div className="max-h-56 overflow-y-auto rounded-md border bg-background">
												<table className="w-full text-xs">
													<thead className="sticky top-0 bg-background">
														<tr>
															<th className="border-b px-2 py-1 text-left">
																Title
															</th>
															<th className="border-b px-2 py-1 text-left">
																Date
															</th>
														</tr>
													</thead>
													<tbody>
														{(revisionPreview.rows ?? [])
															.slice(0, 8)
															.map((row, index) => (
																<tr
																	key={`${row.eventKey || row.title}-${index}`}
																	className="border-b last:border-0"
																>
																	<td className="px-2 py-1">
																		{row.title || "Untitled event"}
																	</td>
																	<td className="px-2 py-1">
																		{row.date || "TBC"}
																	</td>
																</tr>
															))}
													</tbody>
												</table>
											</div>

											<div className="flex flex-wrap justify-end gap-2 border-t pt-3">
												<Button
													type="button"
													variant="outline"
													onClick={() => setRevisionPreview(null)}
												>
													Clear preview
												</Button>
												<Button
													type="button"
													onClick={handleRestoreRevisionPreview}
													disabled={isSaving}
												>
													Restore as draft
												</Button>
											</div>
										</div>
									) : (
										<div className="flex min-h-48 items-center rounded-md border border-dashed px-3 py-6 text-sm text-muted-foreground">
											{isLoadingRevisionPreview
												? "Loading revision preview..."
												: "Choose a restorable revision to preview."}
										</div>
									)}
								</div>
							</div>
						</DialogContent>
					</Dialog>

					<Dialog
						open={rangePreviewRowIndex !== null}
						onOpenChange={(open) => {
							if (!open) setRangePreviewRowIndex(null);
						}}
					>
						<DialogContent className="max-h-[88vh] w-[min(720px,calc(100vw-2rem))] max-w-none overflow-y-auto p-5 sm:max-w-none sm:p-6">
							<DialogHeader className="pr-10">
								<DialogTitle className="text-xl">
									Generated occurrences
								</DialogTitle>
								<DialogDescription className="max-w-2xl text-base leading-relaxed">
									This source row will render as one public event per date.
									Split the row when a date needs a different time, link,
									location, or price.
								</DialogDescription>
							</DialogHeader>

							{rangePreviewRow && rangePreviewRowIndex !== null ? (
								<div className="space-y-4">
									<div className="rounded-md border bg-background/70 p-3">
										<div className="font-medium">
											{rangePreviewRow[TITLE_COLUMN_KEY] || "Untitled event"}
										</div>
										<div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
											<span>
												{rangePreviewRow[DATE_COLUMN_KEY] || "TBC"} to{" "}
												{rangePreviewRow[DATE_TO_COLUMN_KEY] || "TBC"}
											</span>
											{rangePreviewRow[SERIES_KEY_COLUMN_KEY] && (
												<span className="font-mono">
													{rangePreviewRow[SERIES_KEY_COLUMN_KEY]}
												</span>
											)}
										</div>
									</div>

									<div className="overflow-hidden rounded-md border">
										<table className="w-full text-sm">
											<thead className="bg-muted/50 text-xs text-muted-foreground">
												<tr>
													<th className="px-3 py-2 text-left">Date</th>
													<th className="px-3 py-2 text-left">Occurrence</th>
													<th className="px-3 py-2 text-right">Action</th>
												</tr>
											</thead>
											<tbody className="divide-y">
												{rangePreviewDates.map((date, index) => (
													<tr key={date}>
														<td className="px-3 py-2 font-medium">
															{formatDateSuggestionLabel(date)}
														</td>
														<td className="px-3 py-2 text-xs text-muted-foreground">
															Day {index + 1} of {rangePreviewDates.length}
														</td>
														<td className="px-3 py-2 text-right">
															<Button
																type="button"
																size="sm"
																variant="outline"
																className="h-8"
																onClick={() =>
																	handleSplitRangeRow(
																		rangePreviewRowIndex,
																		date,
																	)
																}
															>
																Split this date
															</Button>
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>

									<div className="flex flex-wrap justify-end gap-2">
										<Button
											type="button"
											variant="outline"
											onClick={() => setRangePreviewRowIndex(null)}
										>
											Close
										</Button>
										<Button
											type="button"
											onClick={() => handleSplitRangeRow(rangePreviewRowIndex)}
										>
											Split all dates into rows
										</Button>
									</div>
								</div>
							) : (
								<div className="rounded-md border border-dashed px-3 py-6 text-sm text-muted-foreground">
									No range row selected.
								</div>
							)}
						</DialogContent>
					</Dialog>

					<Dialog
						open={detailRowIndex !== null}
						onOpenChange={(open) => {
							if (!open) {
								clearInlineHelpers();
								setDetailRowIndex(null);
							}
						}}
					>
						<DialogContent
							className="top-0 right-0 left-auto flex h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col overflow-hidden rounded-none border-y-0 border-r-0 bg-background p-0 opacity-100 shadow-[-24px_0_70px_-38px_rgba(0,0,0,0.72)] sm:w-[min(760px,100vw)] sm:max-w-none xl:w-[min(860px,calc(100vw-2rem))]"
							style={{ maxHeight: "100dvh" }}
						>
							<DialogHeader className="shrink-0 px-5 pt-5 pr-14 sm:px-6 sm:pt-6">
								<div className="flex flex-wrap items-start justify-between gap-3">
									<div>
										<DialogTitle className="text-xl">
											Row {detailRowIndex !== null ? detailRowIndex + 1 : ""}{" "}
											details
										</DialogTitle>
										<DialogDescription className="max-w-lg text-sm leading-relaxed">
											Edits update this row in the sheet. Use Save and
											Revalidate Homepage in the sheet toolbar to publish
											visible site changes.
										</DialogDescription>
									</div>
									<div className="flex shrink-0 gap-1.5 pr-8">
										<Button
											type="button"
											size="sm"
											variant="outline"
											className="h-8"
											disabled={detailPreviousRowIndex === null}
											onClick={() => {
												if (detailPreviousRowIndex !== null) {
													clearInlineHelpers();
													setDetailRowIndex(detailPreviousRowIndex);
												}
											}}
										>
											Prev
										</Button>
										<Button
											type="button"
											size="sm"
											variant="outline"
											className="h-8"
											disabled={detailNextRowIndex === null}
											onClick={() => {
												if (detailNextRowIndex !== null) {
													clearInlineHelpers();
													setDetailRowIndex(detailNextRowIndex);
												}
											}}
										>
											Next
										</Button>
									</div>
								</div>
							</DialogHeader>

							{detailRow && detailRowIndex !== null ? (
								<>
									<div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
										{detailRowQuality && (
											<section className="rounded-md border border-border/70 bg-background/75 p-3">
												<div className="flex flex-wrap items-center gap-2">
													<span
														className={`h-2.5 w-2.5 rounded-full border ${getQualityDotClassName(
															detailRowQuality.value,
														)}`}
													/>
													<span className="font-medium">
														{detailRowQuality.label}
													</span>
													<Badge variant="outline" className="text-[10px]">
														{detailRowQuality.sourceLabel}
													</Badge>
													{detailRowQuality.isConfirmed && (
														<Badge variant="secondary" className="text-[10px]">
															Source confirmed
														</Badge>
													)}
													{detailLifecycleBadge && (
														<Badge variant="outline" className="text-[10px]">
															{detailLifecycleBadge.label}
														</Badge>
													)}
												</div>
												<p className="mt-2 text-xs text-muted-foreground">
													{detailRowQuality.description}
												</p>
												{detailRowIssues.length > 0 && (
													<div className="mt-2 space-y-1 text-xs text-red-700 dark:text-red-300">
														{detailRowIssues.slice(0, 3).map((issue) => (
															<p
																key={`${issue.column}-${issue.message}`}
															>{`${issue.column}: ${issue.message}`}</p>
														))}
													</div>
												)}
											</section>
										)}

										<section className="space-y-3">
											<div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
												Identity
											</div>
											<div className="grid gap-3 sm:grid-cols-2">
												<div className="sm:col-span-2">
													{renderDetailField("Title", TITLE_COLUMN_KEY)}
												</div>
												{renderDetailField("Series Key", SERIES_KEY_COLUMN_KEY)}
												{renderDetailField("Event Key", "eventKey", {
													readOnly: true,
												})}
											</div>
											<div className="flex flex-wrap gap-2">
												<Button
													type="button"
													size="sm"
													variant="ghost"
													className="h-8 px-2 text-xs"
													onClick={() => {
														setShowAdvancedColumns(true);
														setDetailRowIndex(null);
													}}
												>
													<Eye className="mr-1 h-3.5 w-3.5" />
													Reveal advanced columns in sheet
												</Button>
											</div>
										</section>

										<section className="space-y-3">
											<div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
												Schedule
											</div>
											<div className="grid gap-3 sm:grid-cols-2">
												{renderDetailField("Date", DATE_COLUMN_KEY)}
												{renderDetailField("Date To", DATE_TO_COLUMN_KEY)}
												{renderDetailField("Start Time", START_TIME_COLUMN_KEY)}
												{renderDetailField("End Time", END_TIME_COLUMN_KEY)}
											</div>
											{getEditableSheetDateRangeDates(
												detailRow,
												sheetDateContext,
											).length > 1 && (
												<Button
													type="button"
													size="sm"
													variant="outline"
													onClick={() => {
														setRangePreviewRowIndex(detailRowIndex);
														setDetailRowIndex(null);
													}}
												>
													<CalendarDays className="mr-1 h-3.5 w-3.5" />
													Preview generated dates
												</Button>
											)}
										</section>

										<section className="space-y-3">
											<div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
												Location and links
											</div>
											<div className="grid gap-3">
												{renderDetailField("Location", LOCATION_COLUMN_KEY)}
												<div className="grid gap-3 sm:grid-cols-2">
													{renderDetailField(
														"Postal Code",
														POSTAL_CODE_COLUMN_KEY,
													)}
													{renderDetailField("City", CITY_COLUMN_KEY)}
												</div>
												<div className="grid gap-3 sm:grid-cols-2">
													{renderDetailField("Area override", AREA_COLUMN_KEY)}
												</div>
												<div className="grid gap-3 sm:grid-cols-2">
													{renderDetailField(
														"Address",
														LOCATION_ADDRESS_COLUMN_KEY,
													)}
												</div>
												<details className="rounded-md border border-border/70 bg-background/60">
													<summary className="cursor-pointer list-none px-2.5 py-2 text-[11px] font-medium text-muted-foreground hover:text-foreground">
														Advanced location metadata
													</summary>
													<div className="border-t border-border/70 p-2">
														{renderDetailField(
															"Country Code",
															COUNTRY_CODE_COLUMN_KEY,
														)}
													</div>
												</details>
												{renderDetailField(
													"Primary URL",
													PRIMARY_URL_COLUMN_KEY,
													{
														multiline: true,
													},
												)}
											</div>
										</section>

										<section className="space-y-3">
											<div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
												Classification
											</div>
											<div className="grid gap-3 sm:grid-cols-2">
												{renderDetailField("Curated", CURATED_COLUMN_KEY)}
												{renderDetailField(
													"Event Category",
													EVENT_CATEGORY_COLUMN_KEY,
												)}
												{renderDetailField("Categories", CATEGORY_COLUMN_KEY)}
												{renderDetailField("Tags", TAGS_COLUMN_KEY)}
												<div className="sm:col-span-2">
													{renderDetailCountryPair()}
												</div>
												{renderDetailField("Setting", SETTING_COLUMN_KEY)}
												{renderDetailField("Age Guidance", AGE_COLUMN_KEY)}
												{renderDetailField("Price", PRICE_COLUMN_KEY)}
											</div>
										</section>

										<section className="space-y-3">
											<div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
												Notes and custom fields
											</div>
											{renderDetailField("Notes", "notes", { multiline: true })}
											{detailCustomColumns.length > 0 && (
												<div className="grid gap-3 sm:grid-cols-2">
													{detailCustomColumns.map((column) => (
														<div key={column.key}>
															{renderDetailField(column.label, column.key)}
														</div>
													))}
												</div>
											)}
										</section>
									</div>
									<div className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-t bg-background/95 px-5 py-3 backdrop-blur sm:px-6">
										<div className="flex min-w-0 flex-wrap items-center gap-2">
											<Button
												type="button"
												size="sm"
												variant="outline"
												onClick={() => handleDuplicateRow(detailRowIndex)}
											>
												<Copy className="mr-1 h-3.5 w-3.5" />
												Duplicate
											</Button>
											{detailRangeDates.length > 1 && (
												<Button
													type="button"
													size="sm"
													variant="outline"
													onClick={() => {
														setRangePreviewRowIndex(detailRowIndex);
														setDetailRowIndex(null);
													}}
												>
													<CalendarDays className="mr-1 h-3.5 w-3.5" />
													Split range
												</Button>
											)}
											<span className="text-xs text-muted-foreground">
												{isSaving
													? "Saving..."
													: hasUnsavedChanges
														? "Unsaved sheet changes"
														: "Editor changes saved"}
											</span>
										</div>
										<div className="flex flex-wrap gap-2">
											<Button
												type="button"
												size="sm"
												variant="outline"
												onClick={() => setDetailRowIndex(null)}
											>
												Close
											</Button>
											<Button
												type="button"
												size="sm"
												variant="outline"
												className="border-destructive/40 text-destructive hover:bg-destructive/10"
												onClick={() => {
													handleDeleteRow(detailRowIndex);
													setDetailRowIndex(null);
												}}
											>
												<Trash2 className="mr-1 h-3.5 w-3.5" />
												Delete
											</Button>
										</div>
									</div>
								</>
							) : (
								<div className="m-5 rounded-md border border-dashed px-3 py-6 text-sm text-muted-foreground sm:m-6">
									No row selected.
								</div>
							)}
						</DialogContent>
					</Dialog>

					<EventSheetOcrDraftModal
						open={isOcrDraftModalOpen}
						onOpenChange={setIsOcrDraftModalOpen}
						onAcceptRows={handleAcceptOcrRows}
					/>

					<div className="space-y-3 rounded-md border bg-background/55 p-3">
						<div className="grid items-end gap-3 xl:grid-cols-[minmax(280px,1fr)_220px_auto]">
							<div className="space-y-2">
								<Label htmlFor="sheet-search">Search rows</Label>
								<Input
									id="sheet-search"
									value={query}
									onChange={(event) => setQuery(event.target.value)}
									placeholder="Search events, dates, genres..."
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="sheet-sort">Sort rows</Label>
								<select
									id="sheet-sort"
									value={sortMode}
									onChange={(event) =>
										setSortMode(event.target.value as SheetSortMode)
									}
									className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
								>
									<option value="soonest-upcoming">Soonest upcoming</option>
									<option value="latest-upcoming">Latest upcoming</option>
									<option value="date-asc">Date/time ascending</option>
									<option value="date-desc">Date/time descending</option>
									<option value="fresh-lifecycle">
										Recently added/updated
									</option>
									<option value="sheet-order">Sheet order</option>
								</select>
							</div>
							<div className="flex flex-wrap items-center justify-start gap-2 xl:justify-end">
								{qualityFilter && (
									<Button
										type="button"
										variant="outline"
										onClick={() => setQualityFilter(null)}
										className="h-10 border-foreground/30 bg-background px-3 text-xs"
										title="Clear quality filter"
									>
										Quality: {getQualityLabel(qualityFilter)} x
									</Button>
								)}
								<Button
									onClick={handleManualSave}
									disabled={isSaving || !hasUnsavedChanges}
									className="h-10"
								>
									Save and Revalidate Homepage
								</Button>
								<Button
									type="button"
									variant="outline"
									onClick={handleUndo}
									disabled={!canUndo || isSaving}
									className="h-10"
								>
									Undo
								</Button>
								<Button
									type="button"
									variant="outline"
									onClick={handleRedo}
									disabled={!canRedo || isSaving}
									className="h-10"
								>
									Redo
								</Button>
							</div>
						</div>

						<div className="flex flex-wrap items-end gap-x-6 gap-y-4 border-t pt-3">
							<div className="min-w-fit space-y-2">
								<Label>Sheet actions</Label>
								<div className="flex flex-wrap gap-2">
									<Button
										onClick={handleAddRow}
										variant="outline"
										size="sm"
										className="h-9"
									>
										Add row at top
									</Button>
									<Button
										onClick={() => setIsOcrDraftModalOpen(true)}
										variant="outline"
										size="sm"
										className="h-9 gap-2"
									>
										<Sparkles className="h-4 w-4" />
										OCR screenshots
									</Button>
									<Button
										onClick={() => void loadEditorData()}
										disabled={isSaving}
										variant="outline"
										size="sm"
										className="h-9"
									>
										Reload
									</Button>
									<Button
										onClick={handleNormalizeSheet}
										disabled={isSaving || isLoading}
										variant="outline"
										size="sm"
										className="h-9"
									>
										Normalize sheet
									</Button>
									<Button
										onClick={() => setDisplayLimit((current) => current + 50)}
										disabled={!canShowMoreRows}
										variant="outline"
										size="sm"
										className="h-9"
									>
										Show 50 more rows
									</Button>
									<Label htmlFor="new-column-label" className="sr-only">
										New column
									</Label>
									<Input
										id="new-column-label"
										value={newColumnLabel}
										onChange={(event) => setNewColumnLabel(event.target.value)}
										placeholder="New column"
										className="h-9 w-44"
									/>
									<Button
										onClick={handleAddColumn}
										variant="outline"
										size="sm"
										disabled={isSaving || isLoading}
										className="h-9"
									>
										Add column
									</Button>
								</div>
							</div>

							<div className="min-w-fit space-y-2">
								<Label>Genre tools</Label>
								<div className="flex flex-wrap items-center gap-2">
									<Badge variant="outline" className="h-8 text-[10px]">
										{defaultGenres.length} default
									</Badge>
									<Badge variant="secondary" className="h-8 text-[10px]">
										{customGenres.length} custom
									</Badge>
									{unknownGenres.length > 0 && (
										<Badge
											variant="outline"
											className="h-8 border-amber-300 bg-amber-50 text-[10px] text-amber-900"
										>
											{unknownGenres.length} unknown
										</Badge>
									)}
									<Button
										type="button"
										size="sm"
										variant="outline"
										className="h-9"
										onClick={() => setIsGenreManagerOpen(true)}
									>
										Manage genres
									</Button>
								</div>
							</div>

							<div className="ml-0 min-w-fit space-y-2 xl:ml-auto">
								<Label>View options</Label>
								<div className="flex h-9 items-center overflow-hidden rounded-md border bg-background text-sm whitespace-nowrap">
									<span className="border-r px-3 text-muted-foreground whitespace-nowrap">
										Frozen columns
									</span>
									<Button
										type="button"
										size="sm"
										variant="ghost"
										className="h-9 rounded-none px-3"
										onClick={() =>
											setPinnedColumnsCount((current) =>
												Math.max(0, current - 1),
											)
										}
										disabled={safePinnedCount <= 0}
										aria-label="Decrease frozen columns"
									>
										-
									</Button>
									<span className="min-w-8 px-2 text-center font-medium">
										{safePinnedCount}
									</span>
									<Button
										type="button"
										size="sm"
										variant="ghost"
										className="h-9 rounded-none px-3"
										onClick={() =>
											setPinnedColumnsCount((current) =>
												Math.min(
													visibleColumns.length,
													MAX_FROZEN_COLUMNS,
													current + 1,
												),
											)
										}
										disabled={
											safePinnedCount >= visibleColumns.length ||
											safePinnedCount >= MAX_FROZEN_COLUMNS
										}
										aria-label="Increase frozen columns"
									>
										+
									</Button>
									<Button
										type="button"
										size="sm"
										variant="ghost"
										className="h-9 rounded-none border-l px-3"
										onClick={() => setPinnedColumnsCount(0)}
										disabled={safePinnedCount === 0}
									>
										Unfreeze
									</Button>
									<Button
										type="button"
										size="sm"
										variant="ghost"
										className="h-9 rounded-none border-l px-3"
										onClick={() =>
											setShowAdvancedColumns((current) => !current)
										}
									>
										{showAdvancedColumns ? (
											<EyeOff className="mr-1 h-3.5 w-3.5" />
										) : (
											<Eye className="mr-1 h-3.5 w-3.5" />
										)}
										{showAdvancedColumns ? "Hide advanced" : "Show advanced"}
									</Button>
								</div>
							</div>
						</div>

						{unknownGenres.length > 0 && (
							<div className="border-t pt-3">
								<div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
									<div className="flex flex-wrap items-center gap-2">
										<span className="font-medium">Unknown genre tags</span>
										<span className="text-amber-900">
											Highlighted in the sheet. Add or map before publishing so
											filters and genre chips stay consistent.
										</span>
										<Button
											type="button"
											size="sm"
											variant="outline"
											className="ml-auto h-8 border-amber-300 bg-amber-50"
											onClick={() => setIsGenreManagerOpen(true)}
										>
											Review all
										</Button>
									</div>
									<div className="mt-2 flex flex-wrap gap-2">
										{unknownGenres.slice(0, 6).map((genre) => (
											<div
												key={genre.value}
												className="flex items-center gap-1 rounded-full border border-amber-300 bg-background/80 px-2 py-1 text-xs text-amber-900"
											>
												<span>
													{genre.label} ({genre.count})
												</span>
												<Button
													type="button"
													size="sm"
													variant="ghost"
													className="h-5 px-1.5 text-[10px]"
													title="Add this as a custom genre everywhere it appears"
													onClick={() => void handleCreateGenre(genre.label)}
												>
													Add globally
												</Button>
												<Button
													type="button"
													size="sm"
													variant="ghost"
													className="h-5 px-1.5 text-[10px]"
													onClick={() => {
														setAliasInput(genre.label);
														setIsGenreManagerOpen(true);
													}}
												>
													Map
												</Button>
											</div>
										))}
										{unknownGenres.length > 6 && (
											<Button
												type="button"
												size="sm"
												variant="ghost"
												className="h-7 text-xs text-amber-950"
												onClick={() => setIsGenreManagerOpen(true)}
											>
												+{unknownGenres.length - 6} more
											</Button>
										)}
									</div>
								</div>
							</div>
						)}
					</div>

					<Dialog
						open={isGenreManagerOpen}
						onOpenChange={setIsGenreManagerOpen}
					>
						<DialogContent className="max-h-[88vh] w-[min(1040px,calc(100vw-2rem))] max-w-none overflow-y-auto p-5 sm:max-w-none sm:p-6">
							<DialogHeader className="pr-10">
								<DialogTitle className="text-xl">Manage genres</DialogTitle>
								<DialogDescription className="max-w-2xl text-base leading-relaxed">
									Default genres are protected. Custom genres and aliases apply
									across the whole sheet.
								</DialogDescription>
							</DialogHeader>

							<div className="space-y-4">
								<div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
									<div className="min-w-0 space-y-1.5">
										<Label htmlFor="new-genre-label">Add custom genre</Label>
										<Input
											id="new-genre-label"
											value={newGenreLabel}
											onChange={(event) => setNewGenreLabel(event.target.value)}
											placeholder="French Pop"
											className="h-9"
											onKeyDown={(event) => {
												if (event.key === "Enter") {
													event.preventDefault();
													void handleCreateGenre(newGenreLabel);
												}
											}}
										/>
									</div>
									<Button
										type="button"
										size="sm"
										variant="outline"
										className="h-9"
										onClick={() => void handleCreateGenre(newGenreLabel)}
										disabled={isSaving || isLoading}
									>
										Add custom
									</Button>
								</div>

								<div className="grid gap-3 xl:grid-cols-2">
									<div className="min-w-0 space-y-1.5">
										<div className="flex items-center gap-2">
											<Label className="text-xs text-muted-foreground whitespace-nowrap">
												Default genres
											</Label>
											<Badge variant="outline" className="text-[10px]">
												{defaultGenres.length}
											</Badge>
										</div>
										<div className="flex max-h-56 min-h-24 flex-wrap content-start gap-1.5 overflow-y-auto rounded-md border border-border/70 bg-background/70 p-3">
											{defaultGenres.map((genre) => (
												<span
													key={genre.key}
													className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border/70 bg-background px-2.5 text-xs"
												>
													<span
														className={`h-2 w-2 rounded-full ${genre.color || "bg-stone-500"}`}
													/>
													{genre.label}
												</span>
											))}
											{availableGenres.length === 0 && (
												<span className="text-xs text-muted-foreground">
													Genre list unavailable. Check the Postgres connection.
												</span>
											)}
										</div>
									</div>

									<div className="min-w-0 space-y-1.5">
										<div className="flex items-center gap-2">
											<Label className="text-xs text-muted-foreground whitespace-nowrap">
												Custom genres
											</Label>
											<Badge variant="secondary" className="text-[10px]">
												{customGenres.length}
											</Badge>
										</div>
										<div className="flex max-h-56 min-h-24 flex-wrap content-start gap-1.5 overflow-y-auto rounded-md border border-border/70 bg-background/70 p-3">
											{customGenres.map((genre) => (
												<div
													key={genre.key}
													className="inline-flex h-7 items-center overflow-hidden rounded-full border border-border/70 bg-background text-xs"
												>
													<span className="inline-flex h-7 items-center gap-1.5 px-2.5">
														<span
															className={`h-2 w-2 rounded-full ${genre.color || "bg-stone-500"}`}
														/>
														{genre.label}
													</span>
													<button
														type="button"
														className="h-7 border-l px-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
														onClick={() => void handleRemoveCustomGenre(genre)}
														aria-label={`Remove ${genre.label}`}
														title={`Remove ${genre.label}`}
													>
														x
													</button>
												</div>
											))}
											{customGenres.length === 0 && (
												<span className="text-xs text-muted-foreground">
													No custom genres yet.
												</span>
											)}
										</div>
									</div>
								</div>

								{unknownGenres.length > 0 && (
									<div className="space-y-2 border-t pt-3">
										<Label>Unknown genres in the sheet</Label>
										<div className="flex flex-wrap gap-2">
											{unknownGenres.map((genre) => (
												<div
													key={genre.value}
													className="flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-900"
												>
													<span>
														{genre.label} ({genre.count})
													</span>
													<Button
														type="button"
														size="sm"
														variant="ghost"
														className="h-5 px-1.5 text-[10px]"
														title="Add this as a custom genre everywhere it appears"
														onClick={() => void handleCreateGenre(genre.label)}
													>
														Add globally
													</Button>
													<Button
														type="button"
														size="sm"
														variant="ghost"
														className="h-5 px-1.5 text-[10px]"
														onClick={() => setAliasInput(genre.label)}
													>
														Map
													</Button>
												</div>
											))}
										</div>
									</div>
								)}

								<div className="space-y-2 border-t pt-3">
									<Label>Alias mapping</Label>
									<div className="grid gap-2 md:grid-cols-[minmax(12rem,16rem)_minmax(12rem,1fr)_auto] md:items-end">
										<div className="min-w-0 space-y-1">
											<Label htmlFor="genre-alias-target">
												Treat typed genre as
											</Label>
											<select
												id="genre-alias-target"
												value={aliasGenreKey}
												onChange={(event) =>
													setAliasGenreKey(event.target.value)
												}
												className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
											>
												<option value="">Choose genre</option>
												{availableGenres.map((genre) => (
													<option key={genre.key} value={genre.key}>
														{genre.label}
													</option>
												))}
											</select>
										</div>
										<div className="min-w-0 space-y-1">
											<Label htmlFor="genre-alias-input">Typed genre</Label>
											<Input
												id="genre-alias-input"
												value={aliasInput}
												onChange={(event) => setAliasInput(event.target.value)}
												placeholder="Afro Trap"
												className="h-9 w-full"
											/>
										</div>
										<Button
											type="button"
											size="sm"
											variant="outline"
											className="h-9"
											onClick={() => void handleMapAlias(aliasInput)}
											disabled={!aliasInput.trim() || !aliasGenreKey}
										>
											Save mapping
										</Button>
									</div>
								</div>

								<div className="border-t pt-3">
									<Accordion>
										<AccordionItem value="genre-aliases" className="border-0">
											<AccordionTrigger className="rounded-md border border-border/70 bg-background/70 px-3 py-2 text-sm no-underline hover:bg-muted/40 hover:no-underline">
												<span className="flex min-w-0 flex-wrap items-center gap-2">
													<span>Current alias mappings</span>
													<Badge variant="outline" className="text-[10px]">
														{aliasMappings.length}
													</Badge>
													{customAliasCount > 0 && (
														<Badge variant="secondary" className="text-[10px]">
															{customAliasCount} custom
														</Badge>
													)}
												</span>
											</AccordionTrigger>
											<AccordionContent className="pt-2 pb-0">
												{aliasMappings.length > 0 ? (
													<div className="grid max-h-64 gap-2 overflow-y-auto rounded-md border border-border/70 bg-background/70 p-2 sm:grid-cols-2">
														{aliasMappings.map((alias) => (
															<div
																key={`${alias.alias}:${alias.genreKey}`}
																className="flex min-w-0 items-center justify-between gap-2 rounded-md border border-border/60 bg-background px-2.5 py-2 text-xs"
															>
																<span className="min-w-0 truncate">
																	{toGenreLabel(alias.alias)} -&gt;{" "}
																	{alias.genreLabel}
																</span>
																{alias.isDefault ? (
																	<Badge
																		variant="outline"
																		className="text-[10px]"
																	>
																		Built-in
																	</Badge>
																) : (
																	<button
																		type="button"
																		className="shrink-0 rounded-sm px-2 py-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
																		onClick={() =>
																			void handleRemoveAlias(alias.alias)
																		}
																		aria-label={`Remove ${alias.alias} alias`}
																		title={`Remove ${alias.alias} alias`}
																	>
																		x
																	</button>
																)}
															</div>
														))}
													</div>
												) : (
													<p className="rounded-md border border-border/70 bg-background/70 p-3 text-xs text-muted-foreground">
														No alias mappings are available yet.
													</p>
												)}
											</AccordionContent>
										</AccordionItem>
									</Accordion>
								</div>
							</div>
						</DialogContent>
					</Dialog>

					{errorMessage && (
						<div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
							{errorMessage}
						</div>
					)}

					<div className="text-xs text-muted-foreground">
						`Event Key` is system-managed for stable share links and is
						read-only.
					</div>
					<div className="text-xs text-muted-foreground">
						When missing, Event Key is generated from canonical identity fields:
						`Title`, `Date`, `Start Time`, `Location`, `Area`.
					</div>
					<div className="text-xs text-muted-foreground">
						{DATE_RANGE_HELPER_MESSAGE}
					</div>

					<div className="text-xs text-muted-foreground">
						Showing {visibleRowIndexes.length} of {filteredRowIndexes.length}{" "}
						filtered rows ({rows.length} total).
						{qualityFilter
							? ` Quality filter: ${getQualityFilterDescription(qualityFilter)}.`
							: ""}
					</div>
					<div className="flex flex-wrap items-center gap-2 rounded-md border border-border/70 bg-background/65 px-3 py-2 text-xs text-muted-foreground">
						<span className="font-medium text-foreground">Row quality</span>
						<button
							type="button"
							onClick={() => handleQualityFilterToggle("blocking")}
							className={`inline-flex items-center gap-1 rounded-full px-2 py-1 transition-colors hover:bg-muted ${
								qualityFilter === "blocking" ? "bg-muted text-foreground" : ""
							}`}
							aria-pressed={qualityFilter === "blocking"}
						>
							<span className="h-2.5 w-2.5 rounded-full bg-red-600" />
							{rowQualityCounts.blocking} need fix
						</button>
						<button
							type="button"
							onClick={() => handleQualityFilterToggle("review")}
							className={`inline-flex items-center gap-1 rounded-full px-2 py-1 transition-colors hover:bg-muted ${
								qualityFilter === "review" ? "bg-muted text-foreground" : ""
							}`}
							aria-pressed={qualityFilter === "review"}
						>
							<span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
							{rowQualityCounts.review} review
						</button>
						<button
							type="button"
							onClick={() => handleQualityFilterToggle("complete")}
							className={`inline-flex items-center gap-1 rounded-full px-2 py-1 transition-colors hover:bg-muted ${
								qualityFilter === "complete" ? "bg-muted text-foreground" : ""
							}`}
							aria-pressed={qualityFilter === "complete"}
						>
							<span className="h-2.5 w-2.5 rounded-full bg-green-600" />
							{rowQualityCounts.complete} complete
						</button>
						<button
							type="button"
							onClick={() => handleQualityFilterToggle("draft")}
							className={`inline-flex items-center gap-1 rounded-full px-2 py-1 transition-colors hover:bg-muted ${
								qualityFilter === "draft" ? "bg-muted text-foreground" : ""
							}`}
							aria-pressed={qualityFilter === "draft"}
						>
							<span className="h-2.5 w-2.5 rounded-full border border-muted-foreground/45" />
							{rowQualityCounts.draft} admin drafts
						</button>
						<span className="border-l border-border/70 pl-2">
							{rowQualityCounts.sourceConfirmed} location/source confirmed
						</span>
						{rowQualityCounts.manual > 0 && (
							<span>{rowQualityCounts.manual} quality manual override</span>
						)}
					</div>
					<div className="max-w-full overflow-auto rounded-md border max-h-[70vh]">
						<table className="w-max min-w-full table-fixed border-separate border-spacing-0 text-xs">
							<colgroup>
								<col style={{ width: `${ROW_NUMBER_COLUMN_WIDTH}px` }} />
								{visibleColumns.map((column) => (
									<col
										key={`col-${column.key}`}
										style={{ width: `${DATA_COLUMN_WIDTH}px` }}
									/>
								))}
							</colgroup>
							<thead className="sticky top-0 z-20 bg-background/95 backdrop-blur-[2px]">
								<tr>
									<th
										className="sticky z-30 border-b border-r bg-background px-2 py-2 text-left"
										style={{ left: 0, width: `${ROW_NUMBER_COLUMN_WIDTH}px` }}
									>
										Row
									</th>
									{visibleColumns.map((column, columnIndex) => (
										<th
											key={column.key}
											className="w-[170px] border-b border-r bg-background px-2 py-2 text-left align-top"
											style={getPinnedColumnStyle(columnIndex, "header")}
										>
											<div className="space-y-1">
												{column.isCore ? (
													<div className="font-medium">{column.label}</div>
												) : (
													<Input
														key={`${column.key}-${column.label}`}
														defaultValue={column.label}
														onBlur={(event) =>
															handleRenameColumn(column.key, event.target.value)
														}
														onKeyDown={(event) => {
															if (event.key === "Enter") {
																event.currentTarget.blur();
															}
														}}
														className="h-7 text-xs"
														aria-label={`Rename column ${column.label}`}
													/>
												)}
												<div className="flex items-center gap-1">
													{column.isCore ? (
														<Badge variant="outline" className="text-[10px]">
															Core
														</Badge>
													) : (
														<Button
															type="button"
															size="sm"
															variant="ghost"
															className="h-6 px-2 text-[10px]"
															onClick={() => handleDeleteColumn(column)}
														>
															Remove
														</Button>
													)}
													{column.isRequired && (
														<Badge variant="secondary" className="text-[10px]">
															Required
														</Badge>
													)}
													{SYSTEM_MANAGED_COLUMN_KEYS.has(column.key) && (
														<Badge variant="outline" className="text-[10px]">
															System
														</Badge>
													)}
												</div>
												<div className="flex items-center gap-1">
													<Button
														type="button"
														size="sm"
														variant="ghost"
														className="h-6 px-2 text-[10px]"
														onClick={() => handleMoveColumn(column.key, -1)}
														disabled={columnIndex === 0}
													>
														←
													</Button>
													<Button
														type="button"
														size="sm"
														variant="ghost"
														className="h-6 px-2 text-[10px]"
														onClick={() => handleMoveColumn(column.key, 1)}
														disabled={columnIndex === visibleColumns.length - 1}
													>
														→
													</Button>
												</div>
											</div>
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{isLoading ? (
									<tr>
										<td
											colSpan={visibleColumns.length + 1}
											className="px-3 py-8 text-center text-muted-foreground"
										>
											Loading editor data...
										</td>
									</tr>
								) : visibleRowIndexes.length === 0 ? (
									<tr>
										<td
											colSpan={visibleColumns.length + 1}
											className="px-3 py-8 text-center text-muted-foreground"
										>
											No rows match your search.
										</td>
									</tr>
								) : (
									visibleRowIndexes.map((rowIndex) => {
										const row = rows[rowIndex];
										const pendingEventReview = getPendingEventReviewForRow(row);
										const hasPendingSubmissionReview =
											Boolean(pendingEventReview);
										const categoryValue = getCellDisplayValue(
											rowIndex,
											CATEGORY_COLUMN_KEY,
											row[CATEGORY_COLUMN_KEY] ?? "",
										);
										const selectedGenreKeys = getSelectedGenreKeys(
											row[CATEGORY_COLUMN_KEY] ?? "",
											genreTaxonomy,
										);
										const dateCellHint = formatDateCellHint(
											row[DATE_COLUMN_KEY] ?? "",
											sheetDateContext,
										);
										const dateToCellHint = formatDateCellHint(
											row[DATE_TO_COLUMN_KEY] ?? "",
											sheetDateContext,
										);
										const rowRangeDates = getEditableSheetDateRangeDates(
											row,
											sheetDateContext,
										);
										const startTimeHint = formatTwelveHourTime(
											row[START_TIME_COLUMN_KEY] ?? "",
										);
										const endTimeHint = formatTwelveHourTime(
											row[END_TIME_COLUMN_KEY] ?? "",
										);
										const primaryUrlParts = parseUrlParts(
											row[PRIMARY_URL_COLUMN_KEY] ?? "",
										);
										const locationParts = splitLocationRawParts(
											getCellDisplayValue(
												rowIndex,
												LOCATION_COLUMN_KEY,
												row[LOCATION_COLUMN_KEY] ?? "",
											),
										);
										const locationAreaPairs = buildLocationAreaPairs(
											row[LOCATION_COLUMN_KEY] ?? "",
											row[AREA_COLUMN_KEY] ?? "",
										);
										const locationCellStatus =
											locationStatusByRowIndex.get(rowIndex);
										const rowIssues =
											sheetHealthIssuesByRow.get(rowIndex + 1) ?? [];
										const rowQuality = getRowQualityAssessment(row, rowIssues, {
											pendingSubmissionType: pendingEventReview?.submissionType,
										});
										const lifecycleBadge = getRowLifecycleBadge(
											row,
											lifecycleMetadataByEventKey,
											{
												suppressUpdated: suppressUpdatedLifecycleBadges,
											},
										);
										return (
											<tr
												key={`row-${rowIndex}`}
												className={`group/row align-top ${
													hasPendingSubmissionReview
														? "bg-red-50/35 dark:bg-red-950/10"
														: ""
												}`}
											>
												<td
													className={`sticky z-10 border-r border-b px-1.5 py-1 text-[11px] text-muted-foreground ${
														hasPendingSubmissionReview
															? "bg-red-50/80 dark:bg-red-950/30"
															: "bg-background"
													}`}
													style={{
														left: 0,
														width: `${ROW_NUMBER_COLUMN_WIDTH}px`,
													}}
												>
													<div className="flex min-h-10 flex-col justify-center gap-1">
														<div className="flex min-w-0 items-center gap-1">
															<div className="flex min-w-7 items-center justify-center px-1">
																<span className="font-mono">
																	{rowIndex + 1}
																</span>
															</div>
															<button
																type="button"
																data-quality-popover
																onClick={(event) =>
																	openQualityPopover(
																		rowIndex,
																		event.currentTarget,
																	)
																}
																className={`h-2.5 w-2.5 shrink-0 rounded-full border ${getQualityDotClassName(
																	rowQuality.value,
																)} cursor-pointer transition-transform hover:scale-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${
																	qualityFilter === rowQuality.value
																		? "outline outline-2 outline-offset-2 outline-ring"
																		: ""
																}`}
																aria-label={`Open quality details for row ${rowIndex + 1}`}
																title={`${rowQuality.label}. Click to review or filter.`}
															/>
															{rowQuality.isConfirmed && (
																<span
																	className="h-1.5 w-1.5 rounded-full bg-green-700"
																	title="Source confirmed"
																/>
															)}
															{rowRangeDates.length > 1 && (
																<button
																	type="button"
																	onClick={() =>
																		setRangePreviewRowIndex(rowIndex)
																	}
																	className="inline-flex h-6 items-center gap-1 rounded border border-border/70 bg-background px-1.5 text-[10px] font-medium text-foreground transition hover:bg-muted"
																	title="Preview generated range occurrences"
																	aria-label={`Preview ${rowRangeDates.length} generated dates for row ${rowIndex + 1}`}
																>
																	<CalendarDays className="h-3 w-3" />
																	{rowRangeDates.length}
																</button>
															)}
															<div className="flex items-center gap-0.5 opacity-100 transition sm:opacity-0 sm:group-hover/row:opacity-100 sm:focus-within:opacity-100">
																<Button
																	type="button"
																	size="sm"
																	variant="ghost"
																	onClick={() => openDetailDrawer(rowIndex)}
																	className="h-6 w-6 p-0"
																	aria-label={`Open row ${rowIndex + 1} details`}
																	title="Open row details"
																>
																	<PanelRightOpen className="h-3.5 w-3.5" />
																</Button>
																<Button
																	type="button"
																	size="sm"
																	variant="ghost"
																	onClick={() => handleInsertRowBelow(rowIndex)}
																	className="hidden h-6 w-6 p-0 sm:inline-flex"
																	aria-label={`Insert row below ${rowIndex + 1}`}
																	title="Insert row below"
																>
																	<Plus className="h-3.5 w-3.5" />
																</Button>
																<Button
																	type="button"
																	size="sm"
																	variant="ghost"
																	onClick={() => handleDuplicateRow(rowIndex)}
																	className="hidden h-6 w-6 p-0 sm:inline-flex"
																	aria-label={`Duplicate row ${rowIndex + 1}`}
																	title="Duplicate row"
																>
																	<Copy className="h-3.5 w-3.5" />
																</Button>
																{canManuallyMoveRows && (
																	<>
																		<Button
																			type="button"
																			size="sm"
																			variant="ghost"
																			onClick={() =>
																				handleMoveRow(rowIndex, -1)
																			}
																			disabled={rowIndex === 0}
																			className="hidden h-6 w-6 p-0 sm:inline-flex"
																			aria-label={`Move row ${rowIndex + 1} up`}
																			title="Move row up"
																		>
																			<ArrowUp className="h-3.5 w-3.5" />
																		</Button>
																		<Button
																			type="button"
																			size="sm"
																			variant="ghost"
																			onClick={() => handleMoveRow(rowIndex, 1)}
																			disabled={rowIndex >= rows.length - 1}
																			className="hidden h-6 w-6 p-0 sm:inline-flex"
																			aria-label={`Move row ${rowIndex + 1} down`}
																			title="Move row down"
																		>
																			<ArrowDown className="h-3.5 w-3.5" />
																		</Button>
																	</>
																)}
																<Button
																	type="button"
																	size="sm"
																	variant="ghost"
																	onClick={() => handleDeleteRow(rowIndex)}
																	className="hidden h-6 w-6 p-0 text-muted-foreground hover:text-destructive sm:inline-flex"
																	aria-label={`Delete row ${rowIndex + 1}`}
																	title="Delete row"
																>
																	<Trash2 className="h-3.5 w-3.5" />
																</Button>
															</div>
														</div>
														<div className="min-h-[0.65rem] pl-1">
															{lifecycleBadge && (
																<span
																	className={`block max-w-[5rem] truncate text-[9px] font-medium leading-none ${
																		lifecycleBadge.tone === "added"
																			? "text-emerald-700/80 dark:text-emerald-300/85"
																			: "text-sky-700/80 dark:text-sky-300/85"
																	}`}
																	title={`${lifecycleBadge.title}: ${lifecycleBadge.label}`}
																>
																	{lifecycleBadge.shortLabel}
																</span>
															)}
														</div>
													</div>
												</td>
												{visibleColumns.map((column, columnIndex) => (
													<td
														key={`row-${rowIndex}-${column.key}`}
														className={`w-[170px] border-b border-r p-0 ${
															hasPendingSubmissionReview
																? "bg-red-50/25 dark:bg-red-950/10"
																: ""
														}`}
														style={getPinnedColumnStyle(columnIndex, "cell")}
													>
														{column.key === CURATED_COLUMN_KEY ? (
															<button
																ref={(node) => {
																	inputRefs.current[
																		cellRefKey(rowIndex, column.key)
																	] = node;
																}}
																type="button"
																aria-pressed={isCuratedValue(
																	row[column.key] ?? "",
																)}
																onClick={() =>
																	toggleCuratedForCell(rowIndex, column.key)
																}
																onKeyDown={(event) => {
																	if (event.key === "ArrowDown") {
																		event.preventDefault();
																		focusCell(rowIndex, column.key, 1, 0);
																	}
																	if (event.key === "ArrowUp") {
																		event.preventDefault();
																		focusCell(rowIndex, column.key, -1, 0);
																	}
																	if (
																		event.key === "ArrowRight" &&
																		event.altKey
																	) {
																		event.preventDefault();
																		focusCell(rowIndex, column.key, 0, 1);
																	}
																	if (
																		event.key === "ArrowLeft" &&
																		event.altKey
																	) {
																		event.preventDefault();
																		focusCell(rowIndex, column.key, 0, -1);
																	}
																}}
																className={`flex h-9 w-full items-center gap-2 px-2 text-left text-xs outline-none transition hover:bg-accent/60 focus:bg-muted/30 ${
																	isCuratedValue(row[column.key] ?? "")
																		? "text-amber-700"
																		: "text-muted-foreground"
																}`}
															>
																<span className="text-base leading-none">
																	{isCuratedValue(row[column.key] ?? "")
																		? CURATED_PICK_VALUE
																		: "☆"}
																</span>
																<span className="truncate">
																	{isCuratedValue(row[column.key] ?? "")
																		? "OOOC Pick"
																		: "Not curated"}
																</span>
															</button>
														) : column.key === DATE_COLUMN_KEY ||
															column.key === DATE_TO_COLUMN_KEY ? (
															<div className="relative min-h-9 bg-transparent px-2 py-1">
																<input
																	ref={(node) => {
																		inputRefs.current[
																			cellRefKey(rowIndex, column.key)
																		] = node;
																	}}
																	value={row[column.key] ?? ""}
																	onFocus={() => {
																		setFocusedDateCell({
																			rowIndex,
																			columnKey: column.key,
																		});
																	}}
																	onChange={(event) =>
																		handleCellChange(
																			rowIndex,
																			column.key,
																			event.target.value,
																		)
																	}
																	onBlur={() => {
																		commitStandardCell(rowIndex, column.key);
																		window.setTimeout(() => {
																			setFocusedDateCell((current) =>
																				current?.rowIndex === rowIndex &&
																				current.columnKey === column.key
																					? null
																					: current,
																			);
																		}, 120);
																	}}
																	onKeyDown={(event) => {
																		if (
																			event.key.toLowerCase() === "d" &&
																			(event.metaKey || event.ctrlKey)
																		) {
																			event.preventDefault();
																			const didFill = fillDateFromRowAbove(
																				rowIndex,
																				column.key,
																			);
																			if (!didFill) {
																				setStatusMessage(
																					"No date available in the row above",
																				);
																			}
																			return;
																		}
																		if (event.key === "Escape") {
																			setFocusedDateCell(null);
																			return;
																		}
																		if (event.key === "Enter") {
																			event.preventDefault();
																			commitStandardCell(rowIndex, column.key);
																			focusCell(rowIndex, column.key, 1, 0);
																		}
																		if (event.key === "ArrowDown") {
																			event.preventDefault();
																			commitStandardCell(rowIndex, column.key);
																			focusCell(rowIndex, column.key, 1, 0);
																		}
																		if (event.key === "ArrowUp") {
																			event.preventDefault();
																			commitStandardCell(rowIndex, column.key);
																			focusCell(rowIndex, column.key, -1, 0);
																		}
																		if (
																			event.key === "ArrowRight" &&
																			event.altKey
																		) {
																			event.preventDefault();
																			commitStandardCell(rowIndex, column.key);
																			focusCell(rowIndex, column.key, 0, 1);
																		}
																		if (
																			event.key === "ArrowLeft" &&
																			event.altKey
																		) {
																			event.preventDefault();
																			commitStandardCell(rowIndex, column.key);
																			focusCell(rowIndex, column.key, 0, -1);
																		}
																	}}
																	className="h-5 w-full border-0 bg-transparent p-0 text-xs outline-none placeholder:text-muted-foreground/45 focus:bg-muted/30"
																	placeholder="DD-MM-YYYY"
																	aria-autocomplete="list"
																	aria-expanded={
																		focusedDateCell?.rowIndex === rowIndex &&
																		focusedDateCell.columnKey === column.key
																	}
																/>
																{(column.key === DATE_COLUMN_KEY
																	? dateCellHint
																	: dateToCellHint) && (
																	<div className="mt-0.5 truncate text-[10px] leading-3 text-muted-foreground/70">
																		{column.key === DATE_COLUMN_KEY
																			? dateCellHint
																			: dateToCellHint}
																	</div>
																)}
																{focusedDateCell?.rowIndex === rowIndex &&
																	focusedDateCell.columnKey === column.key && (
																		<CellPopover
																			className="fixed z-[140] w-72 overflow-hidden rounded-md border border-border/80 bg-popover shadow-xl"
																			style={getCellPopoverStyle(
																				rowIndex,
																				column.key,
																				288,
																			)}
																		>
																			<div className="border-b px-2 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
																				{column.key === DATE_TO_COLUMN_KEY
																					? "Date To"
																					: "Date"}
																			</div>
																			{dateSuggestionState.preview && (
																				<div
																					className={`border-b px-2 py-1.5 text-[11px] ${
																						dateSuggestionState.preview.tone ===
																						"success"
																							? "text-foreground/75"
																							: "text-amber-700"
																					}`}
																				>
																					{dateSuggestionState.preview.message}
																				</div>
																			)}
																			<div className="max-h-60 overflow-y-auto p-1">
																				{dateSuggestionState.groups.map(
																					(group) => (
																						<div key={group.label}>
																							<div className="px-2 pb-1 pt-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
																								{group.label}
																							</div>
																							{group.options.map((option) => {
																								const isSelected =
																									(row[column.key] ?? "") ===
																									option.value;
																								return (
																									<button
																										key={`${group.label}-${option.description}-${option.value}`}
																										type="button"
																										onMouseDown={(event) => {
																											event.preventDefault();
																											selectDateForCell(
																												rowIndex,
																												column.key,
																												option.value,
																											);
																										}}
																										className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition ${
																											isSelected
																												? "bg-muted text-foreground"
																												: "hover:bg-accent/70"
																										}`}
																									>
																										<span className="min-w-0 flex-1 truncate font-medium">
																											{option.label}
																										</span>
																										<span className="font-mono text-[10px] text-muted-foreground">
																											{option.value}
																										</span>
																										<span className="max-w-24 truncate text-[10px] text-muted-foreground">
																											{option.description}
																										</span>
																									</button>
																								);
																							})}
																						</div>
																					),
																				)}
																				{dateSuggestionState.groups.length ===
																					0 && (
																					<div className="px-2 py-2 text-xs text-muted-foreground">
																						No reusable dates yet.
																					</div>
																				)}
																			</div>
																		</CellPopover>
																	)}
															</div>
														) : TIME_COLUMN_KEYS.has(column.key) ? (
															<div className="relative min-h-9 bg-transparent px-2 py-1">
																<input
																	ref={(node) => {
																		inputRefs.current[
																			cellRefKey(rowIndex, column.key)
																		] = node;
																	}}
																	value={row[column.key] ?? ""}
																	onFocus={() => {
																		setFocusedTimeCell({
																			rowIndex,
																			columnKey: column.key,
																		});
																	}}
																	onChange={(event) =>
																		handleCellChange(
																			rowIndex,
																			column.key,
																			event.target.value,
																		)
																	}
																	onBlur={() => {
																		commitStandardCell(rowIndex, column.key);
																		window.setTimeout(() => {
																			setFocusedTimeCell((current) =>
																				current?.rowIndex === rowIndex &&
																				current.columnKey === column.key
																					? null
																					: current,
																			);
																		}, 120);
																	}}
																	onKeyDown={(event) => {
																		if (event.key === "Escape") {
																			setFocusedTimeCell(null);
																			return;
																		}
																		if (event.key === "Enter") {
																			event.preventDefault();
																			commitStandardCell(rowIndex, column.key);
																			focusCell(rowIndex, column.key, 1, 0);
																		}
																		if (event.key === "ArrowDown") {
																			event.preventDefault();
																			commitStandardCell(rowIndex, column.key);
																			focusCell(rowIndex, column.key, 1, 0);
																		}
																		if (event.key === "ArrowUp") {
																			event.preventDefault();
																			commitStandardCell(rowIndex, column.key);
																			focusCell(rowIndex, column.key, -1, 0);
																		}
																		if (
																			event.key === "ArrowRight" &&
																			event.altKey
																		) {
																			event.preventDefault();
																			commitStandardCell(rowIndex, column.key);
																			focusCell(rowIndex, column.key, 0, 1);
																		}
																		if (
																			event.key === "ArrowLeft" &&
																			event.altKey
																		) {
																			event.preventDefault();
																			commitStandardCell(rowIndex, column.key);
																			focusCell(rowIndex, column.key, 0, -1);
																		}
																	}}
																	className="h-5 w-full border-0 bg-transparent p-0 font-mono text-xs outline-none focus:bg-muted/30"
																	placeholder="14:00 or 2 pm"
																/>
																{(column.key === START_TIME_COLUMN_KEY
																	? startTimeHint
																	: endTimeHint) && (
																	<div className="mt-0.5 truncate text-[10px] leading-3 text-muted-foreground/70">
																		{column.key === START_TIME_COLUMN_KEY
																			? startTimeHint
																			: endTimeHint}
																	</div>
																)}
																{focusedTimeCell?.rowIndex === rowIndex &&
																	focusedTimeCell.columnKey === column.key &&
																	timeInputPreview && (
																		<CellPopover
																			className="fixed z-[140] w-56 overflow-hidden rounded-md border border-border/80 bg-popover shadow-xl"
																			style={getCellPopoverStyle(
																				rowIndex,
																				column.key,
																				224,
																				112,
																			)}
																		>
																			<div className="border-b px-2 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
																				{column.key === START_TIME_COLUMN_KEY
																					? "Start time"
																					: "End time"}
																			</div>
																			<div
																				className={`border-b px-2 py-1.5 text-[11px] ${
																					timeInputPreview.tone === "success"
																						? "text-foreground/75"
																						: "text-muted-foreground"
																				}`}
																			>
																				{timeInputPreview.message}
																			</div>
																			<div className="px-2 py-1.5 text-[10px] text-muted-foreground">
																				Try 2 pm, 14:00, 11.30pm, or 14h00
																			</div>
																		</CellPopover>
																	)}
															</div>
														) : column.key === LOCATION_COLUMN_KEY ? (
															<div className="relative min-h-9 bg-transparent">
																{locationCellStatus && (
																	<span
																		className={`absolute left-2 top-1/2 z-10 h-2.5 w-2.5 -translate-y-1/2 rounded-full border ${getLocationDotClassName(
																			locationCellStatus.trustState,
																			locationCellStatus.hasAliasWarning,
																		)}`}
																		title={locationCellStatus.title}
																		aria-label={locationCellStatus.label}
																	/>
																)}
																<input
																	ref={(node) => {
																		inputRefs.current[
																			cellRefKey(rowIndex, column.key)
																		] = node;
																	}}
																	value={row[column.key] ?? ""}
																	onFocus={() => {
																		setFocusedLocationCell({
																			rowIndex,
																			columnKey: column.key,
																		});
																		setLocationSearchQuery(
																			row[column.key] ?? "",
																		);
																		setHighlightedLocationIndex(0);
																	}}
																	onChange={(event) => {
																		setFocusedLocationCell((current) =>
																			current?.rowIndex === rowIndex &&
																			current.columnKey === column.key
																				? current
																				: { rowIndex, columnKey: column.key },
																		);
																		setLocationSearchQuery(event.target.value);
																		setHighlightedLocationIndex(0);
																		handleCellChange(
																			rowIndex,
																			column.key,
																			event.target.value,
																		);
																	}}
																	onBlur={() => {
																		commitStandardCell(rowIndex, column.key);
																		window.setTimeout(() => {
																			setFocusedLocationCell((current) =>
																				current?.rowIndex === rowIndex &&
																				current.columnKey === column.key
																					? null
																					: current,
																			);
																		}, 120);
																	}}
																	onKeyDown={(event) => {
																		if (
																			event.key === "ArrowDown" &&
																			locationSuggestionsForFocusedCell.length >
																				0
																		) {
																			event.preventDefault();
																			setHighlightedLocationIndex((current) =>
																				Math.min(
																					current + 1,
																					locationSuggestionsForFocusedCell.length -
																						1,
																				),
																			);
																			return;
																		}
																		if (
																			event.key === "ArrowUp" &&
																			locationSuggestionsForFocusedCell.length >
																				0
																		) {
																			event.preventDefault();
																			setHighlightedLocationIndex((current) =>
																				Math.max(current - 1, 0),
																			);
																			return;
																		}
																		if (
																			event.key === "Enter" &&
																			locationSuggestionsForFocusedCell.length >
																				0
																		) {
																			event.preventDefault();
																			selectLocationForCell(
																				rowIndex,
																				column.key,
																				locationSuggestionsForFocusedCell[
																					highlightedLocationIndex
																				] ??
																					locationSuggestionsForFocusedCell[0],
																			);
																			return;
																		}
																		if (event.key === "Escape") {
																			setFocusedLocationCell(null);
																			return;
																		}
																		if (event.key === "Enter") {
																			event.preventDefault();
																			commitStandardCell(rowIndex, column.key);
																			focusCell(rowIndex, column.key, 1, 0);
																		}
																		if (event.key === "ArrowDown") {
																			event.preventDefault();
																			commitStandardCell(rowIndex, column.key);
																			focusCell(rowIndex, column.key, 1, 0);
																		}
																		if (event.key === "ArrowUp") {
																			event.preventDefault();
																			commitStandardCell(rowIndex, column.key);
																			focusCell(rowIndex, column.key, -1, 0);
																		}
																		if (
																			event.key === "ArrowRight" &&
																			event.altKey
																		) {
																			event.preventDefault();
																			commitStandardCell(rowIndex, column.key);
																			focusCell(rowIndex, column.key, 0, 1);
																		}
																		if (
																			event.key === "ArrowLeft" &&
																			event.altKey
																		) {
																			event.preventDefault();
																			commitStandardCell(rowIndex, column.key);
																			focusCell(rowIndex, column.key, 0, -1);
																		}
																	}}
																	className={`h-9 w-full border-0 bg-transparent py-0 pr-2 text-xs outline-none placeholder:text-muted-foreground/45 focus:bg-muted/30 ${
																		locationCellStatus ? "pl-6" : "pl-2"
																	}`}
																	placeholder="Venue or address"
																	aria-autocomplete="list"
																	aria-expanded={
																		focusedLocationCell?.rowIndex ===
																			rowIndex &&
																		focusedLocationCell.columnKey === column.key
																	}
																/>
																{focusedLocationCell?.rowIndex === rowIndex &&
																	focusedLocationCell.columnKey ===
																		column.key && (
																		<CellPopover
																			className="fixed z-[140] max-h-[calc(100vh-1rem)] w-[min(28rem,calc(100vw-1rem))] overflow-y-auto rounded-md border border-border/80 bg-popover shadow-xl"
																			style={getCellPopoverStyle(
																				rowIndex,
																				column.key,
																				448,
																				520,
																			)}
																		>
																			<div className="border-b px-2 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
																				Location
																			</div>
																			{locationCellStatus && (
																				<div className="border-b px-2 py-1.5">
																					<div className="flex items-center gap-2 text-[11px] text-muted-foreground">
																						<span
																							className={`h-2 w-2 rounded-full border ${getLocationDotClassName(
																								locationCellStatus.trustState,
																								locationCellStatus.hasAliasWarning,
																							)}`}
																						/>
																						<span className="font-medium text-foreground/75">
																							{locationCellStatus.label}
																						</span>
																						{locationCellStatus.parts.length >
																							1 && (
																							<span>
																								{
																									locationCellStatus.parts
																										.length
																								}{" "}
																								locations
																							</span>
																						)}
																					</div>
																					{locationCellStatus.parts.some(
																						(part) =>
																							part.resolution
																								?.formattedAddress ||
																							part.aliases.length > 0,
																					) && (
																						<div className="mt-1 space-y-0.5 text-[10px] leading-4 text-muted-foreground">
																							{locationCellStatus.parts.map(
																								(part) => (
																									<div
																										key={part.key}
																										className="truncate"
																										title={
																											part.resolution
																												?.formattedAddress ??
																											undefined
																										}
																									>
																										<span className="font-medium text-foreground/65">
																											{part.name ||
																												"Location TBC"}
																										</span>
																										{part.resolution
																											?.formattedAddress
																											? ` -> ${part.resolution.formattedAddress}`
																											: ""}
																										{part.aliases.length > 0
																											? `; similar: ${part.aliases
																													.map(
																														(alias) =>
																															alias.name,
																													)
																													.join(", ")}`
																											: ""}
																									</div>
																								),
																							)}
																						</div>
																					)}
																				</div>
																			)}
																			<div className="border-b p-1">
																				<div className="grid grid-cols-2 gap-1">
																					<Button
																						type="button"
																						size="sm"
																						variant="ghost"
																						className="h-7 justify-start px-2 text-xs"
																						onMouseDown={(event) => {
																							event.preventDefault();
																						}}
																						onClick={() =>
																							addLocationSlot(
																								rowIndex,
																								column.key,
																							)
																						}
																					>
																						<Plus className="mr-1 h-3.5 w-3.5" />
																						Add location
																					</Button>
																					<Button
																						type="button"
																						size="sm"
																						variant="ghost"
																						className="h-7 justify-start px-2 text-xs"
																						onMouseDown={(event) => {
																							event.preventDefault();
																						}}
																						onClick={() =>
																							markMultipleLocationsForCell(
																								rowIndex,
																								column.key,
																							)
																						}
																					>
																						Multiple locations
																					</Button>
																				</div>
																			</div>
																			{locationParts.length > 0 && (
																				<div className="border-b p-1">
																					{locationParts.map(
																						(part, partIndex) => {
																							const place =
																								buildLocationPlaceContext(
																									row,
																									partIndex,
																								);
																							const explicitArea =
																								locationAreaPairs[partIndex]
																									?.area ?? "";
																							const derivedArea =
																								deriveAreaLabelFromRow(
																									row,
																									partIndex,
																								);
																							return (
																								<div
																									key={locationPartRefKey(
																										rowIndex,
																										column.key,
																										partIndex,
																									)}
																									className="rounded px-1 py-1.5"
																								>
																									<div className="grid gap-1">
																										<div className="flex items-center gap-1">
																											<input
																												ref={(node) => {
																													locationPartInputRefs.current[
																														locationPartRefKey(
																															rowIndex,
																															column.key,
																															partIndex,
																														)
																													] = node;
																												}}
																												value={part}
																												onChange={(event) =>
																													updateLocationPart(
																														rowIndex,
																														column.key,
																														partIndex,
																														event.target.value,
																													)
																												}
																												className="h-7 min-w-0 flex-1 rounded border border-border/70 bg-background px-2 text-xs outline-none focus:border-ring"
																												placeholder={`Location ${partIndex + 1}`}
																											/>
																											<button
																												type="button"
																												className="rounded p-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
																												aria-label={`Remove location ${partIndex + 1}`}
																												title={`Remove location ${partIndex + 1}`}
																												onMouseDown={(
																													event,
																												) => {
																													event.preventDefault();
																													removeLocationPart(
																														rowIndex,
																														column.key,
																														partIndex,
																													);
																												}}
																											>
																												<Trash2 className="h-3 w-3" />
																											</button>
																										</div>
																										<input
																											value={
																												place.address ?? ""
																											}
																											onChange={(event) =>
																												updateLocationMetadataPart(
																													rowIndex,
																													LOCATION_ADDRESS_COLUMN_KEY,
																													partIndex,
																													event.target.value,
																												)
																											}
																											className="h-7 rounded border border-border/70 bg-background px-2 text-xs outline-none focus:border-ring"
																											placeholder="Address"
																										/>
																										<div className="grid grid-cols-[6.5rem_1fr_4.25rem] gap-1">
																											<input
																												value={
																													place.postalCode ?? ""
																												}
																												onChange={(event) =>
																													updateLocationMetadataPart(
																														rowIndex,
																														POSTAL_CODE_COLUMN_KEY,
																														partIndex,
																														event.target.value,
																														normalizePostalCode,
																													)
																												}
																												className="h-7 rounded border border-border/70 bg-background px-2 text-xs outline-none focus:border-ring"
																												placeholder="Postal"
																											/>
																											<input
																												value={place.city ?? ""}
																												onChange={(event) =>
																													updateLocationMetadataPart(
																														rowIndex,
																														CITY_COLUMN_KEY,
																														partIndex,
																														event.target.value,
																														normalizeCity,
																													)
																												}
																												className="h-7 rounded border border-border/70 bg-background px-2 text-xs outline-none focus:border-ring"
																												placeholder="City"
																											/>
																											<input
																												value={
																													place.countryCode ??
																													""
																												}
																												onChange={(event) =>
																													updateLocationMetadataPart(
																														rowIndex,
																														COUNTRY_CODE_COLUMN_KEY,
																														partIndex,
																														event.target.value,
																														normalizePlaceCountryCodeInput,
																													)
																												}
																												className="h-7 rounded border border-border/70 bg-background px-2 text-xs uppercase outline-none focus:border-ring"
																												placeholder="FR"
																												maxLength={2}
																											/>
																										</div>
																										<div className="grid grid-cols-[1fr_7.5rem] items-center gap-1">
																											<div className="truncate text-[10px] text-muted-foreground">
																												{derivedArea
																													? `Auto area ${normalizeAreaValue(derivedArea)}`
																													: "Auto area pending"}
																											</div>
																											<select
																												value={explicitArea}
																												onChange={(event) =>
																													updateLocationAreaPart(
																														rowIndex,
																														partIndex,
																														event.target.value,
																													)
																												}
																												onMouseDown={(
																													event,
																												) => {
																													event.stopPropagation();
																												}}
																												className="h-7 rounded border border-border/70 bg-background px-1.5 text-[11px] outline-none focus:border-ring"
																												aria-label={`Area override for location ${partIndex + 1}`}
																											>
																												<option value="">
																													Auto area
																												</option>
																												{AREA_OPTIONS.map(
																													(area) => (
																														<option
																															key={`${partIndex}-${area.value}`}
																															value={area.value}
																														>
																															{area.label}
																														</option>
																													),
																												)}
																											</select>
																										</div>
																									</div>
																								</div>
																							);
																						},
																					)}
																				</div>
																			)}
																			<div className="max-h-52 overflow-y-auto p-1">
																				<div className="px-2 pb-1 pt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
																					Reused locations
																				</div>
																				{locationSuggestionsForFocusedCell.map(
																					(suggestion, optionIndex) => (
																						<button
																							key={`${suggestion.value}-${suggestion.area}`}
																							type="button"
																							onMouseDown={(event) => {
																								event.preventDefault();
																								selectLocationForCell(
																									rowIndex,
																									column.key,
																									suggestion,
																								);
																							}}
																							className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition ${
																								optionIndex ===
																								highlightedLocationIndex
																									? "bg-accent text-accent-foreground"
																									: suggestion.isAreaMatch
																										? "bg-muted text-foreground"
																										: "hover:bg-accent/70"
																							}`}
																						>
																							<span className="min-w-0 flex-1 truncate font-medium">
																								{suggestion.value}
																							</span>
																							{suggestion.area && (
																								<span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
																									{suggestion.area}
																								</span>
																							)}
																							<span className="text-[10px] text-muted-foreground">
																								{suggestion.count}x
																							</span>
																						</button>
																					),
																				)}
																				{locationSuggestionsForFocusedCell.length ===
																					0 && (
																					<div className="px-2 py-2 text-xs text-muted-foreground">
																						No matching sheet locations yet.
																					</div>
																				)}
																			</div>
																		</CellPopover>
																	)}
															</div>
														) : column.key === CATEGORY_COLUMN_KEY ? (
															<div className="relative min-h-9 bg-transparent">
																<input
																	ref={(node) => {
																		inputRefs.current[
																			cellRefKey(rowIndex, column.key)
																		] = node;
																	}}
																	value={categoryValue}
																	onFocus={() => {
																		beginCellDraft(
																			rowIndex,
																			column.key,
																			row[column.key] ?? "",
																		);
																		setFocusedCategoryRowIndex(rowIndex);
																		setFocusedGenreCell({
																			rowIndex,
																			columnKey: column.key,
																		});
																		setGenreSearchQuery("");
																		setHighlightedGenreIndex(0);
																	}}
																	onChange={(event) => {
																		setFocusedCategoryRowIndex(rowIndex);
																		setFocusedGenreCell((current) =>
																			current?.rowIndex === rowIndex &&
																			current.columnKey === column.key
																				? current
																				: { rowIndex, columnKey: column.key },
																		);
																		setGenreSearchQuery(
																			getGenreSearchSegment(event.target.value),
																		);
																		setHighlightedGenreIndex(0);
																		updateCellDraft(
																			rowIndex,
																			column.key,
																			event.target.value,
																		);
																	}}
																	onBlur={() => {
																		commitCellDraft(rowIndex, column.key);
																		window.setTimeout(() => {
																			setFocusedGenreCell((current) =>
																				current?.rowIndex === rowIndex &&
																				current.columnKey === column.key
																					? null
																					: current,
																			);
																		}, 120);
																	}}
																	onKeyDown={(event) => {
																		if (
																			event.key === "ArrowDown" &&
																			genreOptionsForFocusedCell.length > 0
																		) {
																			event.preventDefault();
																			setHighlightedGenreIndex((current) =>
																				Math.min(
																					current + 1,
																					genreOptionsForFocusedCell.length - 1,
																				),
																			);
																			return;
																		}
																		if (
																			event.key === "ArrowUp" &&
																			genreOptionsForFocusedCell.length > 0
																		) {
																			event.preventDefault();
																			setHighlightedGenreIndex((current) =>
																				Math.max(current - 1, 0),
																			);
																			return;
																		}
																		if (
																			event.key === "Enter" &&
																			genreOptionsForFocusedCell.length > 0
																		) {
																			event.preventDefault();
																			selectGenreForCell(
																				rowIndex,
																				column.key,
																				genreOptionsForFocusedCell[
																					highlightedGenreIndex
																				] ?? genreOptionsForFocusedCell[0],
																			);
																			return;
																		}
																		if (event.key === "Escape") {
																			event.preventDefault();
																			setCellDraft(null);
																			setFocusedGenreCell(null);
																			return;
																		}
																		if (event.key === "Enter") {
																			event.preventDefault();
																			commitCellDraft(rowIndex, column.key);
																			focusCell(rowIndex, column.key, 1, 0);
																		}
																		if (event.key === "ArrowDown") {
																			event.preventDefault();
																			commitCellDraft(rowIndex, column.key);
																			focusCell(rowIndex, column.key, 1, 0);
																		}
																		if (event.key === "ArrowUp") {
																			event.preventDefault();
																			commitCellDraft(rowIndex, column.key);
																			focusCell(rowIndex, column.key, -1, 0);
																		}
																		if (
																			event.key === "ArrowRight" &&
																			event.altKey
																		) {
																			event.preventDefault();
																			commitCellDraft(rowIndex, column.key);
																			focusCell(rowIndex, column.key, 0, 1);
																		}
																		if (
																			event.key === "ArrowLeft" &&
																			event.altKey
																		) {
																			event.preventDefault();
																			commitCellDraft(rowIndex, column.key);
																			focusCell(rowIndex, column.key, 0, -1);
																		}
																	}}
																	className="h-8 w-full border-0 bg-transparent px-2 text-xs outline-none focus:bg-muted/30"
																	aria-autocomplete="list"
																	aria-expanded={
																		focusedGenreCell?.rowIndex === rowIndex &&
																		focusedGenreCell.columnKey === column.key
																	}
																/>
																{focusedGenreCell?.rowIndex === rowIndex &&
																	focusedGenreCell.columnKey === column.key && (
																		<CellPopover
																			className="fixed z-[140] w-72 overflow-hidden rounded-md border border-border/80 bg-popover shadow-xl"
																			style={getCellPopoverStyle(
																				rowIndex,
																				column.key,
																				288,
																			)}
																		>
																			<div className="border-b px-2 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
																				Genres
																			</div>
																			<div className="max-h-60 overflow-y-auto p-1">
																				{genreOptionsForFocusedCell.map(
																					(genre, optionIndex) => {
																						const isSelected =
																							selectedGenreKeys.has(genre.key);
																						return (
																							<button
																								key={genre.key}
																								type="button"
																								onMouseDown={(event) => {
																									event.preventDefault();
																									selectGenreForCell(
																										rowIndex,
																										column.key,
																										genre,
																									);
																								}}
																								className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition ${
																									optionIndex ===
																									highlightedGenreIndex
																										? "bg-accent text-accent-foreground"
																										: isSelected
																											? "bg-muted text-foreground"
																											: "hover:bg-accent/70"
																								}`}
																							>
																								<span
																									className={`h-3 w-3 rounded-sm border ${
																										isSelected
																											? "border-foreground bg-foreground"
																											: "border-muted-foreground/40"
																									}`}
																									aria-hidden="true"
																								/>
																								<span
																									className={`h-2 w-2 rounded-full ${genre.color || "bg-stone-500"}`}
																								/>
																								<span className="min-w-0 flex-1 truncate">
																									{genre.label}
																								</span>
																								<span className="text-[10px] text-muted-foreground">
																									{genre.isDefault
																										? "Default"
																										: "Custom"}
																								</span>
																							</button>
																						);
																					},
																				)}
																				{genreOptionsForFocusedCell.length ===
																					0 && (
																					<div className="px-2 py-2 text-xs text-muted-foreground">
																						No matching genre. Keep typing or
																						add it from Unknown genres.
																					</div>
																				)}
																			</div>
																		</CellPopover>
																	)}
																<div className="flex min-h-7 flex-wrap gap-1 px-1.5 pb-1.5">
																	{splitGenreCell(
																		categoryValue,
																		genreTaxonomy,
																	).map((part, partIndex) => (
																		<span
																			key={`${rowIndex}-${part.value}-${partIndex}`}
																			className={`inline-flex h-5 max-w-full items-center rounded-full border px-1.5 text-[10px] ${
																				part.resolved
																					? "border-border/70 bg-muted/45 text-foreground/80"
																					: "border-amber-300 bg-amber-50 text-amber-900"
																			}`}
																			title={
																				part.resolved
																					? `Maps to ${part.resolved}`
																					: "Unknown genre"
																			}
																		>
																			<span className="truncate">
																				{part.label}
																			</span>
																		</span>
																	))}
																</div>
															</div>
														) : column.key === AREA_COLUMN_KEY ? (
															<div className="relative min-h-9 bg-transparent">
																<input
																	ref={(node) => {
																		inputRefs.current[
																			cellRefKey(rowIndex, column.key)
																		] = node;
																	}}
																	value={getCellDisplayValue(
																		rowIndex,
																		column.key,
																		row[column.key] ?? "",
																	)}
																	onFocus={() => {
																		beginCellDraft(
																			rowIndex,
																			column.key,
																			row[column.key] ?? "",
																		);
																		setFocusedAreaCell({
																			rowIndex,
																			columnKey: column.key,
																		});
																		setAreaSearchQuery(row[column.key] ?? "");
																		setHighlightedAreaIndex(0);
																	}}
																	onChange={(event) => {
																		setFocusedAreaCell((current) =>
																			current?.rowIndex === rowIndex &&
																			current.columnKey === column.key
																				? current
																				: { rowIndex, columnKey: column.key },
																		);
																		setAreaSearchQuery(event.target.value);
																		setHighlightedAreaIndex(0);
																		updateCellDraft(
																			rowIndex,
																			column.key,
																			event.target.value,
																		);
																	}}
																	onBlur={() => {
																		commitCellDraft(
																			rowIndex,
																			column.key,
																			normalizeAreaValue,
																		);
																		window.setTimeout(() => {
																			setFocusedAreaCell((current) =>
																				current?.rowIndex === rowIndex &&
																				current.columnKey === column.key
																					? null
																					: current,
																			);
																		}, 120);
																	}}
																	onKeyDown={(event) => {
																		if (
																			event.key === "ArrowDown" &&
																			areaOptionsForFocusedCell.length > 0
																		) {
																			event.preventDefault();
																			setHighlightedAreaIndex((current) =>
																				Math.min(
																					current + 1,
																					areaOptionsForFocusedCell.length - 1,
																				),
																			);
																			return;
																		}
																		if (
																			event.key === "ArrowUp" &&
																			areaOptionsForFocusedCell.length > 0
																		) {
																			event.preventDefault();
																			setHighlightedAreaIndex((current) =>
																				Math.max(current - 1, 0),
																			);
																			return;
																		}
																		if (
																			event.key === "Enter" &&
																			areaOptionsForFocusedCell.length > 0
																		) {
																			event.preventDefault();
																			selectAreaForCell(
																				rowIndex,
																				column.key,
																				areaOptionsForFocusedCell[
																					highlightedAreaIndex
																				] ?? areaOptionsForFocusedCell[0],
																			);
																			return;
																		}
																		if (event.key === "Escape") {
																			event.preventDefault();
																			setCellDraft(null);
																			setFocusedAreaCell(null);
																			return;
																		}
																		if (event.key === "Enter") {
																			event.preventDefault();
																			commitCellDraft(
																				rowIndex,
																				column.key,
																				normalizeAreaValue,
																			);
																			focusCell(rowIndex, column.key, 1, 0);
																		}
																		if (
																			event.key === "ArrowRight" &&
																			event.altKey
																		) {
																			event.preventDefault();
																			commitCellDraft(
																				rowIndex,
																				column.key,
																				normalizeAreaValue,
																			);
																			focusCell(rowIndex, column.key, 0, 1);
																		}
																		if (
																			event.key === "ArrowLeft" &&
																			event.altKey
																		) {
																			event.preventDefault();
																			commitCellDraft(
																				rowIndex,
																				column.key,
																				normalizeAreaValue,
																			);
																			focusCell(rowIndex, column.key, 0, -1);
																		}
																	}}
																	className="h-9 w-full border-0 bg-transparent px-2 text-xs outline-none focus:bg-muted/30"
																	placeholder="Choose area"
																	aria-autocomplete="list"
																	aria-expanded={
																		focusedAreaCell?.rowIndex === rowIndex &&
																		focusedAreaCell.columnKey === column.key
																	}
																/>
																{focusedAreaCell?.rowIndex === rowIndex &&
																	focusedAreaCell.columnKey === column.key && (
																		<CellPopover
																			className="fixed z-[140] w-72 overflow-hidden rounded-md border border-border/80 bg-popover shadow-xl"
																			style={getCellPopoverStyle(
																				rowIndex,
																				column.key,
																				288,
																			)}
																		>
																			<div className="border-b px-2 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
																				Area
																			</div>
																			<div className="border-b px-2 py-1.5 text-[11px] text-muted-foreground">
																				Choose one area, or pair areas to
																				locations with | in list order.
																			</div>
																			{locationAreaPairs.length > 1 && (
																				<div className="border-b p-2">
																					<div className="mb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
																						Location area links
																					</div>
																					<div className="space-y-1">
																						{locationAreaPairs.map(
																							(pair, pairIndex) => (
																								<div
																									key={`${pair.location}-${pairIndex}`}
																									className="grid grid-cols-[1fr_6rem] items-center gap-1"
																								>
																									<span className="truncate text-xs">
																										{pair.location}
																									</span>
																									<select
																										value={pair.area}
																										onChange={(event) =>
																											updateLocationAreaPart(
																												rowIndex,
																												pairIndex,
																												event.target.value,
																											)
																										}
																										className="h-7 rounded border border-border/70 bg-background px-1.5 text-[11px] outline-none focus:border-ring"
																										aria-label={`Area for ${pair.location}`}
																									>
																										<option value="">
																											Area
																										</option>
																										{AREA_OPTIONS.map(
																											(area) => (
																												<option
																													key={`${pairIndex}-${area.value}`}
																													value={area.value}
																												>
																													{area.label}
																												</option>
																											),
																										)}
																									</select>
																								</div>
																							),
																						)}
																					</div>
																					<p className="mt-1.5 text-[10px] text-muted-foreground">
																						Stored as `Location A | Location B`
																						and `10e | 11e`.
																					</p>
																				</div>
																			)}
																			<div className="max-h-60 overflow-y-auto p-1">
																				{areaOptionsForFocusedCell.map(
																					(area, optionIndex) => {
																						const previousArea =
																							areaOptionsForFocusedCell[
																								optionIndex - 1
																							];
																						const isSelected =
																							normalizeAreaValue(
																								row[column.key] ?? "",
																							) === area.value;
																						const showGroup =
																							!previousArea ||
																							previousArea.group !== area.group;
																						return (
																							<div key={area.value}>
																								{showGroup && (
																									<div className="px-2 pb-1 pt-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
																										{area.group}
																									</div>
																								)}
																								<button
																									type="button"
																									onMouseDown={(event) => {
																										event.preventDefault();
																										selectAreaForCell(
																											rowIndex,
																											column.key,
																											area,
																										);
																									}}
																									className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition ${
																										optionIndex ===
																										highlightedAreaIndex
																											? "bg-accent text-accent-foreground"
																											: isSelected
																												? "bg-muted text-foreground"
																												: "hover:bg-accent/70"
																									}`}
																								>
																									<span className="min-w-0 flex-1 truncate font-medium">
																										{area.label}
																									</span>
																									<span className="max-w-36 truncate text-[10px] text-muted-foreground">
																										{area.description}
																									</span>
																								</button>
																							</div>
																						);
																					},
																				)}
																				{areaOptionsForFocusedCell.length ===
																					0 && (
																					<div className="px-2 py-2 text-xs text-muted-foreground">
																						No matching area. Use `Greater
																						Paris`, `Outside Paris`, or
																						`Location TBC`.
																					</div>
																				)}
																			</div>
																		</CellPopover>
																	)}
															</div>
														) : column.key === EVENT_CATEGORY_COLUMN_KEY ? (
															<div className="relative min-h-9 bg-transparent">
																<input
																	ref={(node) => {
																		inputRefs.current[
																			cellRefKey(rowIndex, column.key)
																		] = node;
																	}}
																	value={getCellDisplayValue(
																		rowIndex,
																		column.key,
																		row[column.key] ?? "",
																	)}
																	onFocus={(event) => {
																		beginCellDraft(
																			rowIndex,
																			column.key,
																			row[column.key] ?? "",
																		);
																		openEventCategoryPopover(
																			rowIndex,
																			column.key,
																			event.currentTarget,
																		);
																		setFocusedEventCategoryCell({
																			rowIndex,
																			columnKey: column.key,
																		});
																		setHighlightedEventCategoryIndex(0);
																	}}
																	onChange={(event) => {
																		setFocusedEventCategoryCell((current) =>
																			current?.rowIndex === rowIndex &&
																			current.columnKey === column.key
																				? current
																				: { rowIndex, columnKey: column.key },
																		);
																		setHighlightedEventCategoryIndex(0);
																		updateCellDraft(
																			rowIndex,
																			column.key,
																			event.target.value,
																		);
																	}}
																	onBlur={() => {
																		commitCellDraft(
																			rowIndex,
																			column.key,
																			normalizeEventCategoryValue,
																		);
																		window.setTimeout(() => {
																			setFocusedEventCategoryCell((current) =>
																				current?.rowIndex === rowIndex &&
																				current.columnKey === column.key
																					? null
																					: current,
																			);
																		}, 120);
																	}}
																	onKeyDown={(event) => {
																		if (
																			event.key === "ArrowDown" &&
																			eventCategoryOptionsForFocusedCell.length >
																				0
																		) {
																			event.preventDefault();
																			setHighlightedEventCategoryIndex(
																				(current) =>
																					Math.min(
																						current + 1,
																						eventCategoryOptionsForFocusedCell.length -
																							1,
																					),
																			);
																			return;
																		}
																		if (
																			event.key === "ArrowUp" &&
																			eventCategoryOptionsForFocusedCell.length >
																				0
																		) {
																			event.preventDefault();
																			setHighlightedEventCategoryIndex(
																				(current) => Math.max(current - 1, 0),
																			);
																			return;
																		}
																		if (
																			event.key === "Enter" &&
																			eventCategoryOptionsForFocusedCell.length >
																				0
																		) {
																			event.preventDefault();
																			selectEventCategoryForCell(
																				rowIndex,
																				column.key,
																				eventCategoryOptionsForFocusedCell[
																					highlightedEventCategoryIndex
																				] ??
																					eventCategoryOptionsForFocusedCell[0],
																			);
																			return;
																		}
																		if (event.key === "Escape") {
																			event.preventDefault();
																			setCellDraft(null);
																			setFocusedEventCategoryCell(null);
																			return;
																		}
																		if (event.key === "Enter") {
																			event.preventDefault();
																			commitCellDraft(
																				rowIndex,
																				column.key,
																				normalizeEventCategoryValue,
																			);
																			focusCell(rowIndex, column.key, 1, 0);
																		}
																		if (
																			event.key === "ArrowRight" &&
																			event.altKey
																		) {
																			event.preventDefault();
																			commitCellDraft(
																				rowIndex,
																				column.key,
																				normalizeEventCategoryValue,
																			);
																			focusCell(rowIndex, column.key, 0, 1);
																		}
																		if (
																			event.key === "ArrowLeft" &&
																			event.altKey
																		) {
																			event.preventDefault();
																			commitCellDraft(
																				rowIndex,
																				column.key,
																				normalizeEventCategoryValue,
																			);
																			focusCell(rowIndex, column.key, 0, -1);
																		}
																	}}
																	className="h-9 w-full border-0 bg-transparent px-2 text-xs outline-none focus:bg-muted/30"
																	placeholder="Party / Activity"
																	aria-autocomplete="list"
																	aria-expanded={
																		focusedEventCategoryCell?.rowIndex ===
																			rowIndex &&
																		focusedEventCategoryCell.columnKey ===
																			column.key
																	}
																	data-event-category-cell
																/>
															</div>
														) : column.key === SETTING_COLUMN_KEY ? (
															<div className="relative min-h-9 bg-transparent">
																<input
																	ref={(node) => {
																		inputRefs.current[
																			cellRefKey(rowIndex, column.key)
																		] = node;
																	}}
																	value={getCellDisplayValue(
																		rowIndex,
																		column.key,
																		row[column.key] ?? "",
																	)}
																	onFocus={() => {
																		beginCellDraft(
																			rowIndex,
																			column.key,
																			row[column.key] ?? "",
																		);
																		setFocusedSettingCell({
																			rowIndex,
																			columnKey: column.key,
																		});
																		setHighlightedSettingIndex(0);
																	}}
																	onChange={(event) => {
																		setFocusedSettingCell((current) =>
																			current?.rowIndex === rowIndex &&
																			current.columnKey === column.key
																				? current
																				: { rowIndex, columnKey: column.key },
																		);
																		setHighlightedSettingIndex(0);
																		updateCellDraft(
																			rowIndex,
																			column.key,
																			event.target.value,
																		);
																	}}
																	onBlur={() => {
																		commitCellDraft(
																			rowIndex,
																			column.key,
																			normalizeSettingValue,
																		);
																		window.setTimeout(() => {
																			setFocusedSettingCell((current) =>
																				current?.rowIndex === rowIndex &&
																				current.columnKey === column.key
																					? null
																					: current,
																			);
																		}, 120);
																	}}
																	onKeyDown={(event) => {
																		if (
																			event.key === "ArrowDown" &&
																			settingOptionsForFocusedCell.length > 0
																		) {
																			event.preventDefault();
																			setHighlightedSettingIndex((current) =>
																				Math.min(
																					current + 1,
																					settingOptionsForFocusedCell.length -
																						1,
																				),
																			);
																			return;
																		}
																		if (
																			event.key === "ArrowUp" &&
																			settingOptionsForFocusedCell.length > 0
																		) {
																			event.preventDefault();
																			setHighlightedSettingIndex((current) =>
																				Math.max(current - 1, 0),
																			);
																			return;
																		}
																		if (
																			event.key === "Enter" &&
																			settingOptionsForFocusedCell.length > 0
																		) {
																			event.preventDefault();
																			selectSettingForCell(
																				rowIndex,
																				column.key,
																				settingOptionsForFocusedCell[
																					highlightedSettingIndex
																				] ?? settingOptionsForFocusedCell[0],
																			);
																			return;
																		}
																		if (event.key === "Escape") {
																			event.preventDefault();
																			setCellDraft(null);
																			setFocusedSettingCell(null);
																			return;
																		}
																		if (event.key === "Enter") {
																			event.preventDefault();
																			commitCellDraft(
																				rowIndex,
																				column.key,
																				normalizeSettingValue,
																			);
																			focusCell(rowIndex, column.key, 1, 0);
																		}
																		if (
																			event.key === "ArrowRight" &&
																			event.altKey
																		) {
																			event.preventDefault();
																			commitCellDraft(
																				rowIndex,
																				column.key,
																				normalizeSettingValue,
																			);
																			focusCell(rowIndex, column.key, 0, 1);
																		}
																		if (
																			event.key === "ArrowLeft" &&
																			event.altKey
																		) {
																			event.preventDefault();
																			commitCellDraft(
																				rowIndex,
																				column.key,
																				normalizeSettingValue,
																			);
																			focusCell(rowIndex, column.key, 0, -1);
																		}
																	}}
																	className="h-9 w-full border-0 bg-transparent px-2 text-xs outline-none focus:bg-muted/30"
																	placeholder="Indoor / Outdoor"
																	aria-autocomplete="list"
																	aria-expanded={
																		focusedSettingCell?.rowIndex === rowIndex &&
																		focusedSettingCell.columnKey === column.key
																	}
																/>
																{focusedSettingCell?.rowIndex === rowIndex &&
																	focusedSettingCell.columnKey ===
																		column.key && (
																		<CellPopover
																			className="fixed z-[140] w-72 overflow-hidden rounded-md border border-border/80 bg-popover shadow-xl"
																			style={getCellPopoverStyle(
																				rowIndex,
																				column.key,
																				288,
																				172,
																			)}
																		>
																			<div className="border-b px-2 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
																				Setting
																			</div>
																			<div className="border-b px-2 py-1.5 text-[11px] text-muted-foreground">
																				Select one or both.
																			</div>
																			<div className="p-1">
																				{settingOptionsForFocusedCell.map(
																					(setting, optionIndex) => {
																						const selectedValues =
																							splitSettingCell(
																								row[column.key] ?? "",
																							);
																						const isSelected =
																							selectedValues.includes(
																								setting.value,
																							);
																						return (
																							<button
																								key={setting.value}
																								type="button"
																								onMouseDown={(event) => {
																									event.preventDefault();
																									selectSettingForCell(
																										rowIndex,
																										column.key,
																										setting,
																									);
																								}}
																								className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition ${
																									optionIndex ===
																									highlightedSettingIndex
																										? "bg-accent text-accent-foreground"
																										: isSelected
																											? "bg-muted text-foreground"
																											: "hover:bg-accent/70"
																								}`}
																							>
																								<span
																									className={`h-3 w-3 rounded-sm border ${
																										isSelected
																											? "border-foreground bg-foreground"
																											: "border-muted-foreground/40"
																									}`}
																									aria-hidden="true"
																								/>
																								<span className="min-w-0 flex-1 truncate font-medium">
																									{setting.label}
																								</span>
																								<span className="max-w-40 truncate text-[10px] text-muted-foreground">
																									{setting.description}
																								</span>
																							</button>
																						);
																					},
																				)}
																			</div>
																		</CellPopover>
																	)}
															</div>
														) : column.key === AGE_COLUMN_KEY ? (
															<div className="relative min-h-9 bg-transparent">
																<input
																	ref={(node) => {
																		inputRefs.current[
																			cellRefKey(rowIndex, column.key)
																		] = node;
																	}}
																	value={getCellDisplayValue(
																		rowIndex,
																		column.key,
																		row[column.key] ?? "",
																	)}
																	onFocus={() => {
																		beginCellDraft(
																			rowIndex,
																			column.key,
																			row[column.key] ?? "",
																		);
																		setFocusedAgeCell({
																			rowIndex,
																			columnKey: column.key,
																		});
																		setHighlightedAgeIndex(0);
																	}}
																	onChange={(event) => {
																		setFocusedAgeCell((current) =>
																			current?.rowIndex === rowIndex &&
																			current.columnKey === column.key
																				? current
																				: { rowIndex, columnKey: column.key },
																		);
																		setHighlightedAgeIndex(0);
																		updateCellDraft(
																			rowIndex,
																			column.key,
																			event.target.value,
																		);
																	}}
																	onBlur={() => {
																		commitCellDraft(
																			rowIndex,
																			column.key,
																			(value) => value.trim(),
																		);
																		window.setTimeout(() => {
																			setFocusedAgeCell((current) =>
																				current?.rowIndex === rowIndex &&
																				current.columnKey === column.key
																					? null
																					: current,
																			);
																		}, 120);
																	}}
																	onKeyDown={(event) => {
																		if (
																			event.key === "ArrowDown" &&
																			ageOptionsForFocusedCell.length > 0
																		) {
																			event.preventDefault();
																			setHighlightedAgeIndex((current) =>
																				Math.min(
																					current + 1,
																					ageOptionsForFocusedCell.length - 1,
																				),
																			);
																			return;
																		}
																		if (
																			event.key === "ArrowUp" &&
																			ageOptionsForFocusedCell.length > 0
																		) {
																			event.preventDefault();
																			setHighlightedAgeIndex((current) =>
																				Math.max(current - 1, 0),
																			);
																			return;
																		}
																		if (
																			event.key === "Enter" &&
																			ageOptionsForFocusedCell.length > 0
																		) {
																			event.preventDefault();
																			selectAgeForCell(
																				rowIndex,
																				column.key,
																				ageOptionsForFocusedCell[
																					highlightedAgeIndex
																				] ?? ageOptionsForFocusedCell[0],
																			);
																			return;
																		}
																		if (event.key === "Escape") {
																			event.preventDefault();
																			setCellDraft(null);
																			setFocusedAgeCell(null);
																			return;
																		}
																		if (event.key === "Enter") {
																			event.preventDefault();
																			commitCellDraft(
																				rowIndex,
																				column.key,
																				(value) => value.trim(),
																			);
																			focusCell(rowIndex, column.key, 1, 0);
																		}
																		if (
																			event.key === "ArrowRight" &&
																			event.altKey
																		) {
																			event.preventDefault();
																			commitCellDraft(
																				rowIndex,
																				column.key,
																				(value) => value.trim(),
																			);
																			focusCell(rowIndex, column.key, 0, 1);
																		}
																		if (
																			event.key === "ArrowLeft" &&
																			event.altKey
																		) {
																			event.preventDefault();
																			commitCellDraft(
																				rowIndex,
																				column.key,
																				(value) => value.trim(),
																			);
																			focusCell(rowIndex, column.key, 0, -1);
																		}
																	}}
																	className="h-9 w-full border-0 bg-transparent px-2 text-xs outline-none focus:bg-muted/30"
																	placeholder="18+, 21+, TBC"
																	aria-autocomplete="list"
																	aria-expanded={
																		focusedAgeCell?.rowIndex === rowIndex &&
																		focusedAgeCell.columnKey === column.key
																	}
																/>
																{focusedAgeCell?.rowIndex === rowIndex &&
																	focusedAgeCell.columnKey === column.key && (
																		<CellPopover
																			className="fixed z-[140] w-64 overflow-hidden rounded-md border border-border/80 bg-popover shadow-xl"
																			style={getCellPopoverStyle(
																				rowIndex,
																				column.key,
																				256,
																				248,
																			)}
																		>
																			<div className="border-b px-2 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
																				Age Guidance
																			</div>
																			<div className="max-h-56 overflow-y-auto p-1">
																				<button
																					type="button"
																					onMouseDown={(event) => {
																						event.preventDefault();
																						selectAgeForCell(
																							rowIndex,
																							column.key,
																							null,
																						);
																					}}
																					className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-muted-foreground transition hover:bg-accent/70"
																				>
																					Clear
																				</button>
																				{ageOptionsForFocusedCell.map(
																					(age, optionIndex) => {
																						const isSelected =
																							(row[column.key] ?? "")
																								.trim()
																								.toLowerCase() ===
																							age.value.toLowerCase();
																						return (
																							<button
																								key={age.value}
																								type="button"
																								onMouseDown={(event) => {
																									event.preventDefault();
																									selectAgeForCell(
																										rowIndex,
																										column.key,
																										age,
																									);
																								}}
																								className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition ${
																									optionIndex ===
																									highlightedAgeIndex
																										? "bg-accent text-accent-foreground"
																										: isSelected
																											? "bg-muted text-foreground"
																											: "hover:bg-accent/70"
																								}`}
																							>
																								<span className="min-w-0 flex-1 truncate font-medium">
																									{age.label}
																								</span>
																								<span className="max-w-36 truncate text-[10px] text-muted-foreground">
																									{age.description}
																								</span>
																							</button>
																						);
																					},
																				)}
																			</div>
																		</CellPopover>
																	)}
															</div>
														) : column.key === PRIMARY_URL_COLUMN_KEY ? (
															<div
																className="relative min-h-9 bg-transparent px-2 py-1"
																onBlurCapture={(event) => {
																	const nextTarget = event.relatedTarget;
																	if (
																		nextTarget instanceof Node &&
																		event.currentTarget.contains(nextTarget)
																	) {
																		return;
																	}
																	commitStandardCell(rowIndex, column.key);
																	if (primaryUrlBlurTimerRef.current) {
																		window.clearTimeout(
																			primaryUrlBlurTimerRef.current,
																		);
																	}
																	primaryUrlBlurTimerRef.current =
																		window.setTimeout(() => {
																			setFocusedPrimaryUrlCell((current) =>
																				current?.rowIndex === rowIndex &&
																				current.columnKey === column.key
																					? null
																					: current,
																			);
																			primaryUrlBlurTimerRef.current = null;
																		}, 120);
																}}
															>
																<input
																	ref={(node) => {
																		inputRefs.current[
																			cellRefKey(rowIndex, column.key)
																		] = node;
																	}}
																	value={row[column.key] ?? ""}
																	onFocus={() => {
																		if (primaryUrlBlurTimerRef.current) {
																			window.clearTimeout(
																				primaryUrlBlurTimerRef.current,
																			);
																			primaryUrlBlurTimerRef.current = null;
																		}
																		setFocusedPrimaryUrlCell({
																			rowIndex,
																			columnKey: column.key,
																		});
																	}}
																	onClick={() => {
																		if (primaryUrlBlurTimerRef.current) {
																			window.clearTimeout(
																				primaryUrlBlurTimerRef.current,
																			);
																			primaryUrlBlurTimerRef.current = null;
																		}
																		setFocusedPrimaryUrlCell({
																			rowIndex,
																			columnKey: column.key,
																		});
																	}}
																	onChange={(event) =>
																		handleCellChange(
																			rowIndex,
																			column.key,
																			event.target.value,
																		)
																	}
																	onBlur={() => {
																		commitStandardCell(rowIndex, column.key);
																	}}
																	onKeyDown={(event) => {
																		if (event.key === "Escape") {
																			setFocusedPrimaryUrlCell(null);
																			return;
																		}
																		if (event.key === "Enter") {
																			event.preventDefault();
																			commitStandardCell(rowIndex, column.key);
																			focusCell(rowIndex, column.key, 1, 0);
																		}
																		if (event.key === "ArrowDown") {
																			event.preventDefault();
																			commitStandardCell(rowIndex, column.key);
																			focusCell(rowIndex, column.key, 1, 0);
																		}
																		if (event.key === "ArrowUp") {
																			event.preventDefault();
																			commitStandardCell(rowIndex, column.key);
																			focusCell(rowIndex, column.key, -1, 0);
																		}
																		if (
																			event.key === "ArrowRight" &&
																			event.altKey
																		) {
																			event.preventDefault();
																			commitStandardCell(rowIndex, column.key);
																			focusCell(rowIndex, column.key, 0, 1);
																		}
																		if (
																			event.key === "ArrowLeft" &&
																			event.altKey
																		) {
																			event.preventDefault();
																			commitStandardCell(rowIndex, column.key);
																			focusCell(rowIndex, column.key, 0, -1);
																		}
																	}}
																	className="h-5 w-full border-0 bg-transparent p-0 text-xs outline-none placeholder:text-muted-foreground/45 focus:bg-muted/30"
																	placeholder="URL, or comma-separated URLs"
																/>
																{primaryUrlParts.length > 0 && (
																	<div className="mt-0.5 truncate text-[10px] leading-3 text-muted-foreground/70">
																		{primaryUrlParts
																			.map((part) =>
																				part.isValid
																					? part.host
																					: `Invalid: ${part.raw}`,
																			)
																			.join(" / ")}
																	</div>
																)}
																{focusedPrimaryUrlCell?.rowIndex === rowIndex &&
																	focusedPrimaryUrlCell.columnKey ===
																		column.key && (
																		<CellPopover
																			className="fixed z-[140] w-80 overflow-hidden rounded-md border border-border/80 bg-popover shadow-xl"
																			style={getCellPopoverStyle(
																				rowIndex,
																				column.key,
																				320,
																			)}
																		>
																			<div className="border-b px-2 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
																				Primary URL
																			</div>
																			<div className="border-b px-2 py-1.5 text-[11px] text-muted-foreground">
																				Separate multiple links with commas or
																				new lines. Domains are saved with
																				https://.
																			</div>
																			<div className="border-b p-1">
																				<Button
																					type="button"
																					size="sm"
																					variant="ghost"
																					className="h-7 w-full justify-start px-2 text-xs"
																					onMouseDown={(event) => {
																						event.preventDefault();
																					}}
																					onClick={() => {
																						addPrimaryUrlSlot(
																							rowIndex,
																							column.key,
																						);
																					}}
																				>
																					<Plus className="mr-1 h-3.5 w-3.5" />
																					Add URL
																				</Button>
																			</div>
																			<div className="max-h-60 overflow-y-auto p-1">
																				{primaryUrlParts.map(
																					(part, partIndex) => (
																						<div
																							key={urlPartRefKey(
																								rowIndex,
																								column.key,
																								partIndex,
																							)}
																							className="rounded px-2 py-1.5 text-xs hover:bg-accent/40"
																						>
																							<div className="flex items-center gap-2">
																								<span
																									className={`h-2 w-2 rounded-full ${
																										part.isValid
																											? "bg-emerald-500"
																											: "bg-amber-500"
																									}`}
																									aria-hidden="true"
																								/>
																								<span className="min-w-0 flex-1 truncate font-medium">
																									{part.isValid
																										? part.host
																										: "Needs review"}
																								</span>
																								<span className="font-mono text-[10px] text-muted-foreground">
																									#{partIndex + 1}
																								</span>
																								<button
																									type="button"
																									className="rounded p-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
																									aria-label={`Remove URL ${partIndex + 1}`}
																									title={`Remove URL ${partIndex + 1}`}
																									onMouseDown={(event) => {
																										event.preventDefault();
																										removePrimaryUrlPart(
																											rowIndex,
																											column.key,
																											partIndex,
																										);
																									}}
																								>
																									<Trash2 className="h-3 w-3" />
																								</button>
																							</div>
																							<input
																								ref={(node) => {
																									urlPartInputRefs.current[
																										urlPartRefKey(
																											rowIndex,
																											column.key,
																											partIndex,
																										)
																									] = node;
																								}}
																								value={part.raw}
																								onChange={(event) =>
																									updatePrimaryUrlPart(
																										rowIndex,
																										column.key,
																										partIndex,
																										event.target.value,
																									)
																								}
																								onBlur={() => {
																									const normalized =
																										normalizeUrlValue(
																											rowsRef.current[
																												rowIndex
																											]?.[column.key] ?? "",
																										);
																									handleCellChange(
																										rowIndex,
																										column.key,
																										normalized,
																									);
																								}}
																								className="mt-1 h-7 w-full rounded border border-border/70 bg-background px-2 font-mono text-[11px] outline-none focus:border-ring"
																								placeholder="https://example.com/event"
																							/>
																							{part.normalized !== part.raw && (
																								<div className="mt-0.5 truncate text-[10px] text-muted-foreground">
																									Will save as {part.normalized}
																								</div>
																							)}
																						</div>
																					),
																				)}
																				{primaryUrlParts.length === 0 && (
																					<div className="px-2 py-2 text-xs text-muted-foreground">
																						Add a ticket, RSVP, or official
																						event URL.
																					</div>
																				)}
																			</div>
																		</CellPopover>
																	)}
															</div>
														) : COUNTRY_COLUMN_KEYS.has(column.key) ? (
															<div className="relative min-h-9 bg-transparent">
																<input
																	ref={(node) => {
																		inputRefs.current[
																			cellRefKey(rowIndex, column.key)
																		] = node;
																	}}
																	value={getCellDisplayValue(
																		rowIndex,
																		column.key,
																		row[column.key] ?? "",
																	)}
																	onFocus={() => {
																		beginCellDraft(
																			rowIndex,
																			column.key,
																			row[column.key] ?? "",
																		);
																		setFocusedCountryCell({
																			rowIndex,
																			columnKey: column.key,
																		});
																		setCountrySearchQuery(
																			getCountrySearchSegment(
																				row[column.key] ?? "",
																			),
																		);
																		setHighlightedCountryIndex(0);
																	}}
																	onChange={(event) => {
																		setFocusedCountryCell((current) =>
																			current?.rowIndex === rowIndex &&
																			current.columnKey === column.key
																				? current
																				: { rowIndex, columnKey: column.key },
																		);
																		setCountrySearchQuery(
																			getCountrySearchSegment(
																				event.target.value,
																			),
																		);
																		setHighlightedCountryIndex(0);
																		updateCellDraft(
																			rowIndex,
																			column.key,
																			event.target.value,
																		);
																	}}
																	onBlur={() => {
																		commitCellDraft(
																			rowIndex,
																			column.key,
																			normalizeCountryValue,
																		);
																		window.setTimeout(() => {
																			setFocusedCountryCell((current) =>
																				current?.rowIndex === rowIndex &&
																				current.columnKey === column.key
																					? null
																					: current,
																			);
																		}, 120);
																	}}
																	onKeyDown={(event) => {
																		if (
																			event.key === "ArrowDown" &&
																			countryOptionsForFocusedCell.length > 0
																		) {
																			event.preventDefault();
																			setHighlightedCountryIndex((current) =>
																				Math.min(
																					current + 1,
																					countryOptionsForFocusedCell.length -
																						1,
																				),
																			);
																			return;
																		}
																		if (
																			event.key === "ArrowUp" &&
																			countryOptionsForFocusedCell.length > 0
																		) {
																			event.preventDefault();
																			setHighlightedCountryIndex((current) =>
																				Math.max(current - 1, 0),
																			);
																			return;
																		}
																		if (
																			event.key === "Enter" &&
																			countryOptionsForFocusedCell.length > 0
																		) {
																			event.preventDefault();
																			selectCountryForCell(
																				rowIndex,
																				column.key,
																				countryOptionsForFocusedCell[
																					highlightedCountryIndex
																				] ?? countryOptionsForFocusedCell[0],
																			);
																			return;
																		}
																		if (event.key === "Escape") {
																			event.preventDefault();
																			setCellDraft(null);
																			setFocusedCountryCell(null);
																			return;
																		}
																		if (event.key === "Enter") {
																			event.preventDefault();
																			commitCellDraft(
																				rowIndex,
																				column.key,
																				normalizeCountryValue,
																			);
																			focusCell(rowIndex, column.key, 1, 0);
																		}
																		if (
																			event.key === "ArrowRight" &&
																			event.altKey
																		) {
																			event.preventDefault();
																			commitCellDraft(
																				rowIndex,
																				column.key,
																				normalizeCountryValue,
																			);
																			focusCell(rowIndex, column.key, 0, 1);
																		}
																		if (
																			event.key === "ArrowLeft" &&
																			event.altKey
																		) {
																			event.preventDefault();
																			commitCellDraft(
																				rowIndex,
																				column.key,
																				normalizeCountryValue,
																			);
																			focusCell(rowIndex, column.key, 0, -1);
																		}
																	}}
																	className="h-9 w-full border-0 bg-transparent px-2 text-xs outline-none focus:bg-muted/30"
																	aria-autocomplete="list"
																	aria-expanded={
																		focusedCountryCell?.rowIndex === rowIndex &&
																		focusedCountryCell.columnKey === column.key
																	}
																/>
																{focusedCountryCell?.rowIndex === rowIndex &&
																	focusedCountryCell.columnKey ===
																		column.key && (
																		<CellPopover
																			className="fixed z-[140] w-64 overflow-hidden rounded-md border border-border/80 bg-popover shadow-xl"
																			style={getCellPopoverStyle(
																				rowIndex,
																				column.key,
																				256,
																			)}
																		>
																			<div className="border-b px-2 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
																				Country
																			</div>
																			<div className="border-b px-2 py-1.5 text-[11px] text-muted-foreground">
																				Use comma, slash, +, or & for multiple
																				countries.
																			</div>
																			<div className="max-h-56 overflow-y-auto p-1">
																				{countryOptionsForFocusedCell.map(
																					(country, optionIndex) => {
																						const isSelected =
																							getSelectedCountryCodes(
																								row[column.key] ?? "",
																							).has(country.code);
																						return (
																							<button
																								key={country.code}
																								type="button"
																								onMouseDown={(event) => {
																									event.preventDefault();
																									selectCountryForCell(
																										rowIndex,
																										column.key,
																										country,
																									);
																								}}
																								className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition ${
																									optionIndex ===
																									highlightedCountryIndex
																										? "bg-accent text-accent-foreground"
																										: isSelected
																											? "bg-muted text-foreground"
																											: "hover:bg-accent/70"
																								}`}
																							>
																								<span
																									className={`h-3 w-3 rounded-sm border ${
																										isSelected
																											? "border-foreground bg-foreground"
																											: "border-muted-foreground/40"
																									}`}
																									aria-hidden="true"
																								/>
																								<span className="text-sm">
																									{country.flag}
																								</span>
																								<span className="min-w-0 flex-1 truncate">
																									{country.label}
																								</span>
																								<span className="font-mono text-[10px] text-muted-foreground">
																									{country.code}
																								</span>
																							</button>
																						);
																					},
																				)}
																				{countryOptionsForFocusedCell.length ===
																					0 && (
																					<div className="px-2 py-2 text-xs text-muted-foreground">
																						No matching country. Keep typing a
																						code or name.
																					</div>
																				)}
																			</div>
																		</CellPopover>
																	)}
															</div>
														) : column.key === SERIES_KEY_COLUMN_KEY ? (
															<div className="relative min-h-9 bg-transparent">
																<input
																	ref={(node) => {
																		inputRefs.current[
																			cellRefKey(rowIndex, column.key)
																		] = node;
																	}}
																	value={row[column.key] ?? ""}
																	onFocus={() => {
																		setFocusedSeriesKeyCell({
																			rowIndex,
																			columnKey: column.key,
																		});
																	}}
																	onChange={(event) => {
																		setFocusedSeriesKeyCell({
																			rowIndex,
																			columnKey: column.key,
																		});
																		handleCellChange(
																			rowIndex,
																			column.key,
																			event.target.value,
																		);
																	}}
																	onBlur={() => {
																		commitStandardCell(rowIndex, column.key);
																		window.setTimeout(() => {
																			setFocusedSeriesKeyCell((current) =>
																				current?.rowIndex === rowIndex &&
																				current.columnKey === column.key
																					? null
																					: current,
																			);
																		}, 120);
																	}}
																	onKeyDown={(event) => {
																		if (event.key === "Escape") {
																			event.preventDefault();
																			setFocusedSeriesKeyCell(null);
																			return;
																		}
																		if (event.key === "Enter") {
																			event.preventDefault();
																			commitStandardCell(rowIndex, column.key);
																			focusCell(rowIndex, column.key, 1, 0);
																		}
																		if (event.key === "ArrowDown") {
																			event.preventDefault();
																			commitStandardCell(rowIndex, column.key);
																			focusCell(rowIndex, column.key, 1, 0);
																		}
																		if (event.key === "ArrowUp") {
																			event.preventDefault();
																			commitStandardCell(rowIndex, column.key);
																			focusCell(rowIndex, column.key, -1, 0);
																		}
																		if (
																			event.key === "ArrowRight" &&
																			event.altKey
																		) {
																			event.preventDefault();
																			commitStandardCell(rowIndex, column.key);
																			focusCell(rowIndex, column.key, 0, 1);
																		}
																		if (
																			event.key === "ArrowLeft" &&
																			event.altKey
																		) {
																			event.preventDefault();
																			commitStandardCell(rowIndex, column.key);
																			focusCell(rowIndex, column.key, 0, -1);
																		}
																	}}
																	className="h-9 w-full border-0 bg-transparent px-2 font-mono text-[11px] outline-none focus:bg-muted/30"
																	placeholder="ser_..."
																/>
																{focusedSeriesKeyCell?.rowIndex === rowIndex &&
																	focusedSeriesKeyCell.columnKey ===
																		column.key && (
																		<CellPopover
																			className="fixed z-[140] w-[360px] overflow-hidden rounded-md border border-border/80 bg-popover shadow-xl"
																			style={getCellPopoverStyle(
																				rowIndex,
																				column.key,
																				SERIES_KEY_POPOVER_WIDTH,
																				340,
																			)}
																		>
																			<div className="border-b px-2 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
																				Series Key
																			</div>
																			<div className="border-b px-2 py-1.5 text-[11px] text-muted-foreground">
																				Group related rows without merging their
																				dates, times, locations, or links.
																			</div>
																			<div className="border-b p-1">
																				<Button
																					type="button"
																					size="sm"
																					variant="ghost"
																					className="h-7 w-full justify-start px-2 text-xs"
																					onMouseDown={(event) => {
																						event.preventDefault();
																					}}
																					onClick={() =>
																						generateSeriesKeyForCell(
																							rowIndex,
																							column.key,
																						)
																					}
																				>
																					<RefreshCw className="mr-1 h-3.5 w-3.5" />
																					Generate from this row
																				</Button>
																				<Button
																					type="button"
																					size="sm"
																					variant="ghost"
																					className="h-7 w-full justify-start px-2 text-xs"
																					onMouseDown={(event) => {
																						event.preventDefault();
																					}}
																					onClick={() =>
																						clearSeriesKeyForCell(
																							rowIndex,
																							column.key,
																						)
																					}
																					disabled={
																						!String(
																							row[column.key] ?? "",
																						).trim()
																					}
																				>
																					<Trash2 className="mr-1 h-3.5 w-3.5" />
																					Clear series key
																				</Button>
																			</div>
																			<div className="max-h-60 overflow-y-auto p-1">
																				<div className="px-2 pb-1 pt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
																					Link to another row
																				</div>
																				{seriesKeySuggestions.map(
																					(suggestion) => (
																						<button
																							key={`${suggestion.seriesKey}-${suggestion.rowIndex}`}
																							type="button"
																							onMouseDown={(event) => {
																								event.preventDefault();
																								linkSeriesKeyForCell(
																									rowIndex,
																									column.key,
																									suggestion,
																								);
																							}}
																							className="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-xs transition hover:bg-accent/70"
																						>
																							<Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
																							<span className="min-w-0 flex-1">
																								<span className="block truncate font-medium">
																									{suggestion.title}
																								</span>
																								<span className="block truncate text-[11px] text-muted-foreground">
																									{[
																										suggestion.date,
																										suggestion.location,
																									]
																										.filter(Boolean)
																										.join(" · ") ||
																										`Row ${suggestion.rowIndex + 1}`}
																								</span>
																								<span className="block truncate font-mono text-[10px] text-muted-foreground">
																									{suggestion.seriesKey}
																								</span>
																							</span>
																							<Badge
																								variant={
																									suggestion.willCreateSeriesKey
																										? "secondary"
																										: "outline"
																								}
																								className="shrink-0 text-[10px]"
																							>
																								{suggestion.willCreateSeriesKey
																									? "New"
																									: `${suggestion.rowCount} rows`}
																							</Badge>
																						</button>
																					),
																				)}
																				{seriesKeySuggestions.length === 0 && (
																					<div className="px-2 py-2 text-xs text-muted-foreground">
																						No matching rows yet. Type or paste
																						a key manually, or generate one from
																						this row.
																					</div>
																				)}
																			</div>
																		</CellPopover>
																	)}
															</div>
														) : (
															<input
																ref={(node) => {
																	inputRefs.current[
																		cellRefKey(rowIndex, column.key)
																	] = node;
																}}
																value={row[column.key] ?? ""}
																readOnly={SYSTEM_MANAGED_COLUMN_KEYS.has(
																	column.key,
																)}
																onChange={(event) =>
																	handleCellChange(
																		rowIndex,
																		column.key,
																		event.target.value,
																	)
																}
																onBlur={() => {
																	commitStandardCell(rowIndex, column.key);
																}}
																onKeyDown={(event) => {
																	if (event.key === "Enter") {
																		event.preventDefault();
																		commitStandardCell(rowIndex, column.key);
																		focusCell(rowIndex, column.key, 1, 0);
																	}
																	if (event.key === "ArrowDown") {
																		event.preventDefault();
																		commitStandardCell(rowIndex, column.key);
																		focusCell(rowIndex, column.key, 1, 0);
																	}
																	if (event.key === "ArrowUp") {
																		event.preventDefault();
																		commitStandardCell(rowIndex, column.key);
																		focusCell(rowIndex, column.key, -1, 0);
																	}
																	if (
																		event.key === "ArrowRight" &&
																		event.altKey
																	) {
																		event.preventDefault();
																		commitStandardCell(rowIndex, column.key);
																		focusCell(rowIndex, column.key, 0, 1);
																	}
																	if (
																		event.key === "ArrowLeft" &&
																		event.altKey
																	) {
																		event.preventDefault();
																		commitStandardCell(rowIndex, column.key);
																		focusCell(rowIndex, column.key, 0, -1);
																	}
																}}
																className={`h-9 w-full border-0 bg-transparent px-2 text-xs outline-none focus:bg-muted/30 ${
																	SYSTEM_MANAGED_COLUMN_KEYS.has(column.key)
																		? "cursor-not-allowed bg-muted/25 text-muted-foreground"
																		: ""
																}`}
															/>
														)}
													</td>
												))}
											</tr>
										);
									})
								)}
							</tbody>
						</table>
					</div>
				</CardContent>
			</Card>
		</>
	);
};
