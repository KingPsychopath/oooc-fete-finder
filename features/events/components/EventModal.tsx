"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	addToCalendar,
	isCalendarDateValid,
} from "@/features/events/calendar-utils";
import {
	getSeriesKeyboardNavigationTarget,
	isEventModalTextEntryKeyTarget,
} from "@/features/events/components/event-modal-series-navigation";
import { getCountryOption } from "@/features/events/countries";
import {
	trackEventEngagement,
	trackMapOpen,
	trackMapPreferenceChange,
} from "@/features/events/engagement/client-tracking";
import { shouldDisplayFeaturedEvent } from "@/features/events/featured/utils/timestamp-utils";
import {
	getCustomGenreColor,
	normalizeSearchText,
	toGenreLabel,
} from "@/features/events/genre-normalization";
import {
	formatRecentlyAddedLabel,
	isRecentlyAddedEvent,
} from "@/features/events/recently-added";
import {
	formatRecentlyUpdatedLabel,
	isRecentlyUpdatedEvent,
} from "@/features/events/recently-updated";
import {
	type SocialProofDisplayMode,
	shouldShowSocialProofBadge,
} from "@/features/events/social-proof";
import {
	normalizeProofLink,
	normalizeProofLinks,
} from "@/features/events/submissions/proof-link";
import {
	EVENT_EXPERIENCE_CATEGORIES,
	type Event,
	type EventExperienceCategory,
	MUSIC_GENRES,
	type ParisArrondissement,
	VENUE_TYPES,
	formatDayWithDate,
	formatEventDateRangeLabel,
	formatEventOccurrenceLabel,
	formatLocationAreaShort,
	formatPrice,
	getEventLocationDisplay,
	getPartyEventTypeLabel,
	getPriceMeta,
	getResolvedEventExperienceCategoryDefinition,
	isPartyEventType,
} from "@/features/events/types";
import type {
	LocationQuery,
	LocationResolution,
} from "@/features/locations/types";
import { MapPreferenceSettings } from "@/features/maps/components/map-preference-settings";
import { MapSelectionModal } from "@/features/maps/components/map-selection-modal";
import { useMapPreference } from "@/features/maps/hooks/use-map-preference";
import type { MapProvider } from "@/features/maps/types";
import { openLocationInMaps } from "@/features/maps/utils/map-launcher";
import { useAppHaptics } from "@/hooks/useAppHaptics";
import { LAYERS } from "@/lib/ui/layers";
import {
	OVERLAY_BODY_ATTRIBUTE,
	setBodyOverlayAttribute,
} from "@/lib/ui/overlay-state";
import {
	AlertCircle,
	Bookmark,
	BookmarkCheck,
	Building2,
	Calendar,
	CalendarPlus,
	Check,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	CircleHelp,
	Clock,
	Copy,
	Crown,
	Euro,
	ExternalLink,
	Flag,
	Flame,
	Link2,
	MapPin,
	Megaphone,
	Music,
	Plus,
	Route,
	Settings,
	Star,
	Tag,
	Trash2,
	User,
	Users,
	X,
} from "lucide-react";
import type React from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface EventModalProps {
	event: Event | null;
	isOpen: boolean;
	onClose: () => void;
	isAuthenticated?: boolean;
	submissionsEnabled?: boolean;
	isRequestUpdateOpen?: boolean;
	onRequestUpdateOpenChange?: (open: boolean) => void;
	socialProofMode?: SocialProofDisplayMode;
	isSaved?: boolean;
	isInPlan?: boolean;
	onToggleSaved?: (event: Event) => boolean;
	onAddToPlan?: (event: Event) => EventAddToPlanResult | null;
	seriesEvents?: Event[];
	onNavigateSeriesEvent?: (event: Event) => void;
}

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const CONTACT_EMAIL = "hello@outofofficecollective.co.uk";
const MODAL_GENRE_PREVIEW_LIMIT = 8;
const MODAL_MIN_COLLAPSED_GENRES = 3;
const COUNTRY_PREVIEW_LIMIT = 3;
const EVENT_CATEGORY_MODAL_ACCENTS: Record<
	EventExperienceCategory,
	{ header: string; badge: string }
> = {
	party: {
		header:
			"bg-[radial-gradient(ellipse_at_18%_42%,rgba(217,119,6,0.07)_0%,rgba(217,119,6,0.026)_38%,rgba(217,119,6,0)_72%)] dark:bg-[radial-gradient(ellipse_at_18%_42%,rgba(251,191,36,0.11)_0%,rgba(251,191,36,0.04)_38%,rgba(251,191,36,0)_72%)]",
		badge:
			"border-amber-500/35 bg-amber-500/10 text-amber-900 hover:bg-amber-500/14 dark:border-amber-300/28 dark:bg-amber-300/12 dark:text-amber-100",
	},
	activity: {
		header:
			"bg-[radial-gradient(ellipse_at_18%_42%,rgba(14,165,233,0.06)_0%,rgba(14,165,233,0.022)_38%,rgba(14,165,233,0)_72%)] dark:bg-[radial-gradient(ellipse_at_18%_42%,rgba(125,211,252,0.1)_0%,rgba(125,211,252,0.036)_38%,rgba(125,211,252,0)_72%)]",
		badge:
			"border-sky-500/35 bg-sky-500/10 text-sky-900 hover:bg-sky-500/14 dark:border-sky-300/28 dark:bg-sky-300/12 dark:text-sky-100",
	},
	culture: {
		header:
			"bg-[radial-gradient(ellipse_at_18%_42%,rgba(124,58,237,0.055)_0%,rgba(124,58,237,0.02)_38%,rgba(124,58,237,0)_72%)] dark:bg-[radial-gradient(ellipse_at_18%_42%,rgba(196,181,253,0.095)_0%,rgba(196,181,253,0.034)_38%,rgba(196,181,253,0)_72%)]",
		badge:
			"border-violet-500/35 bg-violet-500/10 text-violet-900 hover:bg-violet-500/14 dark:border-violet-300/28 dark:bg-violet-300/12 dark:text-violet-100",
	},
	food: {
		header:
			"bg-[radial-gradient(ellipse_at_18%_42%,rgba(16,185,129,0.055)_0%,rgba(16,185,129,0.02)_38%,rgba(16,185,129,0)_72%)] dark:bg-[radial-gradient(ellipse_at_18%_42%,rgba(110,231,183,0.095)_0%,rgba(110,231,183,0.034)_38%,rgba(110,231,183,0)_72%)]",
		badge:
			"border-emerald-500/35 bg-emerald-500/10 text-emerald-900 hover:bg-emerald-500/14 dark:border-emerald-300/28 dark:bg-emerald-300/12 dark:text-emerald-100",
	},
	wellness: {
		header:
			"bg-[radial-gradient(ellipse_at_18%_42%,rgba(20,184,166,0.055)_0%,rgba(20,184,166,0.02)_38%,rgba(20,184,166,0)_72%)] dark:bg-[radial-gradient(ellipse_at_18%_42%,rgba(94,234,212,0.095)_0%,rgba(94,234,212,0.034)_38%,rgba(94,234,212,0)_72%)]",
		badge:
			"border-teal-500/35 bg-teal-500/10 text-teal-900 hover:bg-teal-500/14 dark:border-teal-300/28 dark:bg-teal-300/12 dark:text-teal-100",
	},
};
const FOCUSABLE_MODAL_SELECTOR = [
	"a[href]",
	"button:not([disabled])",
	"input:not([disabled])",
	"select:not([disabled])",
	"textarea:not([disabled])",
	'[tabindex]:not([tabindex="-1"])',
].join(",");

interface CountryDisplay {
	code: string;
	flag?: string;
	label: string;
}

interface EventUpdateRequestForm {
	eventName: string;
	eventCategory: string;
	date: string;
	startTime: string;
	endTime: string;
	location: string;
	genre: string;
	price: string;
	age: string;
	indoorOutdoor: string;
	arrondissement: string;
	proofLink: string;
	ticketLink: string;
	hostEmail: string;
	notes: string;
}

interface PriceFlagStatus {
	message: string;
	tone: "success" | "error";
}

export interface EventAddToPlanResult {
	stopCount: number;
	routeTitle?: string;
	alreadyInRoute?: boolean;
	message?: string;
}

const parseGenreLabels = (value: string): string[] =>
	value
		.split(",")
		.map((genre) => genre.trim())
		.filter(Boolean);

const dedupeGenreLabels = (genres: string[]): string[] => {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const genre of genres) {
		const normalized = normalizeSearchText(genre);
		if (!normalized || seen.has(normalized)) continue;
		seen.add(normalized);
		result.push(genre.trim());
	}
	return result;
};

const formatGenreValue = (genres: string[]): string => genres.join(", ");

const parseTicketLinkRows = (value: string): string[] => {
	if (!value) return [""];
	const rows = value.split(/[,\n\r|]/).map((link) => link.trim());
	return rows.length > 0 ? rows : [""];
};

const formatTicketLinkRows = (links: string[]): string =>
	links.map((link) => link.trim()).join("\n");

const hasGenreLabel = (genres: string[], label: string): boolean => {
	const normalized = normalizeSearchText(label);
	return genres.some((genre) => normalizeSearchText(genre) === normalized);
};

const splitTitleForTrailingAdornment = (
	title: string,
): { leading: string; trailing: string } => {
	const normalizedTitle = title.trim();
	const match = normalizedTitle.match(/^(.*\S)(\s+)(\S+)$/);
	if (!match) {
		return { leading: "", trailing: normalizedTitle };
	}
	return {
		leading: `${match[1]}${match[2]}`,
		trailing: match[3],
	};
};

const EVENT_UPDATE_DIFF_FIELDS = [
	"eventName",
	"eventCategory",
	"date",
	"startTime",
	"endTime",
	"location",
	"genre",
	"price",
	"age",
	"indoorOutdoor",
	"arrondissement",
	"ticketLink",
	"notes",
] as const;
type EventUpdatePatchField = (typeof EVENT_UPDATE_DIFF_FIELDS)[number];

const REQUIRED_EVENT_UPDATE_MERGE_FIELDS = [
	"eventName",
	"date",
	"startTime",
	"location",
	"endTime",
] as const;

const normalizeEventUpdateText = (value: string): string =>
	value.replace(/\s+/g, " ").trim();

const getDisplayGenreLabel = (genre: string) =>
	MUSIC_GENRES.find((item) => item.key === genre)?.label || toGenreLabel(genre);

const getEventCategoryLabelForSheet = (event: Event): string => {
	const eventCategoryDefinition =
		getResolvedEventExperienceCategoryDefinition(event);
	return eventCategoryDefinition?.label ?? "";
};

const buildEventUpdateRequestForm = (event: Event): EventUpdateRequestForm => {
	const eventLinks =
		event.links && event.links.length > 0 ? event.links : [event.link];
	const normalizedTicketLinks =
		normalizeProofLinks(eventLinks.filter(Boolean).join("\n")) ?? [];
	const venueTypeLabel =
		event.venueTypes && event.venueTypes.length > 0
			? event.venueTypes
					.map((vt) => VENUE_TYPES.find((venue) => venue.key === vt)?.label)
					.filter(Boolean)
					.join(" & ")
			: event.indoor
				? "Indoor"
				: "Outdoor";
	const priceLabel = formatPrice(event.price);
	const ageLabel = event.age || "All ages";

	return {
		eventName: event.name,
		eventCategory: getEventCategoryLabelForSheet(event),
		date: event.date || "",
		startTime: event.time && event.time !== "TBC" ? event.time : "",
		endTime: event.endTime && event.endTime !== "TBC" ? event.endTime : "",
		location: event.location && event.location !== "TBA" ? event.location : "",
		genre: formatGenreValue(event.genre.map(getDisplayGenreLabel)),
		price: priceLabel === "TBC" ? "" : priceLabel,
		age: ageLabel,
		indoorOutdoor: venueTypeLabel,
		arrondissement: String(event.arrondissement),
		proofLink: "",
		ticketLink: normalizedTicketLinks.join("\n"),
		hostEmail: "",
		notes: event.description || "",
	};
};

function getCountryDisplayList(
	countries: string[] | undefined,
): CountryDisplay[] {
	if (!countries || countries.length === 0) return [];

	return countries.map((countryCode) => {
		const country = getCountryOption(countryCode);
		return {
			code: country?.code ?? countryCode,
			flag: country?.flag,
			label: country ? `${country.flag} ${country.code}` : countryCode,
		};
	});
}

function formatCountryDisplayList(countries: CountryDisplay[]) {
	if (countries.length === 0) return "TBC";
	return countries.map((country) => country.label).join(", ");
}

function CountryChipList({
	countries,
	mobilePreviewLimit = COUNTRY_PREVIEW_LIMIT,
	desktopPreviewLimit = mobilePreviewLimit,
	onShowAll,
}: {
	countries: CountryDisplay[];
	mobilePreviewLimit?: number;
	desktopPreviewLimit?: number;
	onShowAll?: () => void;
}) {
	const mobileCountries = countries.slice(0, mobilePreviewLimit);
	const desktopCountries = countries.slice(0, desktopPreviewLimit);
	const mobileHiddenCount = countries.length - mobileCountries.length;
	const desktopHiddenCount = countries.length - desktopCountries.length;
	const fullLabel = formatCountryDisplayList(countries);

	return (
		<div className="mt-1 flex flex-wrap gap-1" aria-label={fullLabel}>
			{mobileCountries.map((country) => (
				<span
					key={country.code}
					className="inline-flex min-h-6 items-center rounded-full border border-border/70 bg-background/70 px-2 text-[12px] font-medium leading-none text-foreground sm:hidden"
					title={country.label}
				>
					{country.flag && <span className="mr-1">{country.flag}</span>}
					{country.code}
				</span>
			))}
			{desktopCountries.map((country) => (
				<span
					key={country.code}
					className="hidden min-h-6 items-center rounded-full border border-border/70 bg-background/70 px-2 text-[12px] font-medium leading-none text-foreground sm:inline-flex"
					title={country.label}
				>
					{country.flag && <span className="mr-1">{country.flag}</span>}
					{country.code}
				</span>
			))}
			{mobileHiddenCount > 0 && onShowAll && (
				<button
					type="button"
					className="inline-flex min-h-6 items-center rounded-full border border-border/70 bg-muted/45 px-2 text-[12px] font-medium leading-none text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 sm:hidden"
					title={fullLabel}
					aria-label={`Show all countries: ${fullLabel}`}
					onClick={onShowAll}
				>
					+{mobileHiddenCount}
				</button>
			)}
			{desktopHiddenCount > 0 && onShowAll && (
				<button
					type="button"
					className="hidden min-h-6 items-center rounded-full border border-border/70 bg-muted/45 px-2 text-[12px] font-medium leading-none text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 sm:inline-flex"
					title={fullLabel}
					aria-label={`Show all countries: ${fullLabel}`}
					onClick={onShowAll}
				>
					+{desktopHiddenCount}
				</button>
			)}
			{mobileHiddenCount > 0 && !onShowAll && (
				<span
					className="inline-flex min-h-6 items-center rounded-full border border-border/70 bg-muted/45 px-2 text-[12px] font-medium leading-none text-muted-foreground sm:hidden"
					title={fullLabel}
				>
					+{mobileHiddenCount}
				</span>
			)}
			{desktopHiddenCount > 0 && !onShowAll && (
				<span
					className="hidden min-h-6 items-center rounded-full border border-border/70 bg-muted/45 px-2 text-[12px] font-medium leading-none text-muted-foreground sm:inline-flex"
					title={fullLabel}
				>
					+{desktopHiddenCount}
				</span>
			)}
		</div>
	);
}

function CountryDetailsGroup({
	label,
	countries,
}: {
	label: string;
	countries: CountryDisplay[];
}) {
	if (countries.length === 0) return null;

	return (
		<div>
			<p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
				{label}
			</p>
			<div className="mt-2 flex flex-wrap gap-1.5">
				{countries.map((country) => (
					<span
						key={country.code}
						className="inline-flex min-h-7 items-center rounded-full border border-border/70 bg-background/75 px-2.5 text-[13px] font-medium leading-none text-foreground"
						title={country.label}
					>
						{country.flag && <span className="mr-1.5">{country.flag}</span>}
						{country.code}
					</span>
				))}
			</div>
		</div>
	);
}

const EventModal: React.FC<EventModalProps> = ({
	event,
	isOpen,
	onClose,
	isAuthenticated = false,
	submissionsEnabled = true,
	isRequestUpdateOpen: controlledRequestUpdateOpen,
	onRequestUpdateOpenChange,
	socialProofMode,
	isSaved = false,
	isInPlan = false,
	onToggleSaved,
	onAddToPlan,
	seriesEvents = [],
	onNavigateSeriesEvent,
}) => {
	const modalTitleId = useId();
	const { mapPreference, setMapPreference, isLoaded } = useMapPreference();
	const haptics = useAppHaptics();
	const [showMapSelection, setShowMapSelection] = useState(false);
	const [showMapSettings, setShowMapSettings] = useState(false);
	const [linkShareStatus, setLinkShareStatus] = useState<{
		message: string;
		tone: "success" | "error";
	} | null>(null);
	const [planAddStatus, setPlanAddStatus] = useState<{
		message: string;
		tone: "success" | "error";
	} | null>(null);
	const [isContactEmailCopied, setIsContactEmailCopied] = useState(false);
	const shareStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const planStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const modalCardRef = useRef<HTMLDivElement>(null);
	const closeButtonRef = useRef<HTMLButtonElement>(null);
	const contactCopyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const [pendingLocationData, setPendingLocationData] = useState<{
		location: string;
		arrondissement?: ParisArrondissement;
		resolution?: LocationResolution | null;
		place?: Partial<
			Pick<LocationQuery, "address" | "postalCode" | "city" | "countryCode">
		>;
	} | null>(null);
	const [showAllGenres, setShowAllGenres] = useState(false);
	const [showCountryDetails, setShowCountryDetails] = useState(false);
	const [internalRequestUpdateOpen, setInternalRequestUpdateOpen] =
		useState(false);
	const [isGenrePickerOpen, setIsGenrePickerOpen] = useState(false);
	const [genreSearchQuery, setGenreSearchQuery] = useState("");
	const [updateRequestForm, setUpdateRequestForm] =
		useState<EventUpdateRequestForm | null>(null);
	const [isSubmittingUpdateRequest, setIsSubmittingUpdateRequest] =
		useState(false);
	const [updateRequestStatus, setUpdateRequestStatus] = useState<{
		message: string;
		tone: "success" | "error";
	} | null>(null);
	const [priceFlagNote, setPriceFlagNote] = useState("");
	const [priceFlagStatus, setPriceFlagStatus] =
		useState<PriceFlagStatus | null>(null);
	const [isSubmittingPriceFlag, setIsSubmittingPriceFlag] = useState(false);
	const [hasMounted, setHasMounted] = useState(false);
	const isUpdateRequestOpen =
		controlledRequestUpdateOpen ?? internalRequestUpdateOpen;

	useEffect(() => {
		setHasMounted(true);
	}, []);

	useEffect(() => {
		if (!isOpen) {
			setShowMapSelection(false);
			setShowMapSettings(false);
			setLinkShareStatus(null);
			setPlanAddStatus(null);
			setPendingLocationData(null);
			setShowAllGenres(false);
			setShowCountryDetails(false);
			setIsContactEmailCopied(false);
			setInternalRequestUpdateOpen(false);
			setIsGenrePickerOpen(false);
			setGenreSearchQuery("");
			setUpdateRequestStatus(null);
			setPriceFlagNote("");
			setPriceFlagStatus(null);
			setIsSubmittingPriceFlag(false);
		}
	}, [isOpen]);

	useEffect(() => {
		return () => {
			if (shareStatusTimeoutRef.current) {
				clearTimeout(shareStatusTimeoutRef.current);
			}
			if (planStatusTimeoutRef.current) {
				clearTimeout(planStatusTimeoutRef.current);
			}
			if (contactCopyTimeoutRef.current) {
				clearTimeout(contactCopyTimeoutRef.current);
			}
		};
	}, []);

	useEffect(() => {
		setBodyOverlayAttribute(OVERLAY_BODY_ATTRIBUTE.EVENT_MODAL, isOpen);

		return () => {
			setBodyOverlayAttribute(OVERLAY_BODY_ATTRIBUTE.EVENT_MODAL, false);
		};
	}, [isOpen]);

	useEffect(() => {
		if (!isOpen) return;
		const frameId = window.requestAnimationFrame(() => {
			closeButtonRef.current?.focus();
		});
		return () => {
			window.cancelAnimationFrame(frameId);
		};
	}, [isOpen]);

	const handleModalKeyDown = (keyboardEvent: React.KeyboardEvent) => {
		if (keyboardEvent.key === "Escape") {
			if (showMapSelection || isUpdateRequestOpen) return;
			keyboardEvent.preventDefault();
			onClose();
			return;
		}

		if (
			keyboardEvent.key === "ArrowLeft" ||
			keyboardEvent.key === "ArrowRight"
		) {
			if (showMapSelection || isUpdateRequestOpen) return;
			if (isEventModalTextEntryKeyTarget(keyboardEvent.target)) return;

			const targetSeriesEvent = getSeriesKeyboardNavigationTarget({
				currentEvent: event,
				seriesEvents,
				key: keyboardEvent.key,
			});
			if (!targetSeriesEvent || !onNavigateSeriesEvent) return;

			keyboardEvent.preventDefault();
			onNavigateSeriesEvent(targetSeriesEvent);
			return;
		}

		if (keyboardEvent.key !== "Tab") return;
		if (showMapSelection || isUpdateRequestOpen) return;

		const modalCard = modalCardRef.current;
		if (!modalCard) return;

		const focusableElements = Array.from(
			modalCard.querySelectorAll<HTMLElement>(FOCUSABLE_MODAL_SELECTOR),
		).filter(
			(element) =>
				!element.hasAttribute("disabled") &&
				element.getAttribute("aria-hidden") !== "true" &&
				element.offsetParent !== null,
		);
		if (focusableElements.length === 0) return;

		const firstElement = focusableElements[0];
		const lastElement = focusableElements[focusableElements.length - 1];
		const activeElement = document.activeElement;

		if (keyboardEvent.shiftKey && activeElement === firstElement) {
			keyboardEvent.preventDefault();
			lastElement.focus();
			return;
		}

		if (!keyboardEvent.shiftKey && activeElement === lastElement) {
			keyboardEvent.preventDefault();
			firstElement.focus();
		}
	};

	useEffect(() => {
		setUpdateRequestForm(null);
		setUpdateRequestStatus(null);
		setIsGenrePickerOpen(false);
		setGenreSearchQuery("");
		if (!isOpen || !event || !isUpdateRequestOpen || !submissionsEnabled)
			return;
		setUpdateRequestForm(buildEventUpdateRequestForm(event));
	}, [event, isOpen, isUpdateRequestOpen, submissionsEnabled]);

	const selectedUpdateGenres = dedupeGenreLabels(
		parseGenreLabels(updateRequestForm?.genre ?? ""),
	);
	const filteredGenreOptions = useMemo(() => {
		const query = normalizeSearchText(genreSearchQuery);
		if (!query) return MUSIC_GENRES;
		return MUSIC_GENRES.filter((genre) =>
			[genre.label, genre.key].some((candidate) =>
				normalizeSearchText(candidate).includes(query),
			),
		);
	}, [genreSearchQuery]);

	if (!hasMounted || !isOpen || !event) return null;
	const isCurrentlyFeatured = shouldDisplayFeaturedEvent(event);
	const isCurrentlyPromoted = event.isPromoted === true;
	const isNewlyAdded = isRecentlyAddedEvent(event);
	const isRecentlyUpdated = !isNewlyAdded && isRecentlyUpdatedEvent(event);
	const recentlyAddedLabel = formatRecentlyAddedLabel(event);
	const recentlyUpdatedLabel = formatRecentlyUpdatedLabel(event);
	const canAddToCalendar = isCalendarDateValid(event.date);
	const socialProofSaveCount = event.socialProofSaveCount ?? 0;
	const socialProofHistoricalSaveCount =
		event.socialProofHistoricalSaveCount ?? 0;
	const savedLabel = socialProofSaveCount === 1 ? "person" : "people";
	const socialProofLabel =
		socialProofMode === "numeric"
			? `${socialProofSaveCount} ${savedLabel} saved this`
			: "People are saving this";
	const titleParts = splitTitleForTrailingAdornment(event.name);
	const hasTitleAdornment = Boolean(
		isCurrentlyFeatured ||
			(!isCurrentlyFeatured && isCurrentlyPromoted) ||
			event.isOOOCPick,
	);
	const hasSocialProofBadge = shouldShowSocialProofBadge(
		socialProofMode,
		socialProofSaveCount,
		socialProofHistoricalSaveCount,
	);
	const isPartyTypeEvent = isPartyEventType(event.type);
	const eventPartyTypeLabel = getPartyEventTypeLabel(event.type);
	const eventCategoryDefinition =
		getResolvedEventExperienceCategoryDefinition(event);
	const eventCategoryModalAccent = eventCategoryDefinition
		? EVENT_CATEGORY_MODAL_ACCENTS[eventCategoryDefinition.key]
		: null;
	const dateRangeLabel = formatEventDateRangeLabel(event);
	const occurrenceLabel = formatEventOccurrenceLabel(event);
	const orderedSeriesEvents = seriesEvents
		.filter((seriesEvent) => seriesEvent.seriesKey === event.seriesKey)
		.sort((left, right) => left.date.localeCompare(right.date));
	const activeSeriesIndex = orderedSeriesEvents.findIndex(
		(seriesEvent) => seriesEvent.eventKey === event.eventKey,
	);
	const hasSeriesNavigation =
		orderedSeriesEvents.length > 1 &&
		activeSeriesIndex >= 0 &&
		typeof onNavigateSeriesEvent === "function";
	const previousSeriesEvent = hasSeriesNavigation
		? orderedSeriesEvents.at(activeSeriesIndex - 1)
		: undefined;
	const nextSeriesEvent = hasSeriesNavigation
		? orderedSeriesEvents.at(activeSeriesIndex + 1)
		: undefined;
	const planButtonTone =
		planAddStatus?.tone === "success" || isInPlan
			? "success"
			: planAddStatus?.tone === "error"
				? "error"
				: "idle";
	const planButtonLabel = isInPlan ? "Event is in a route" : "Add to route";
	const planTooltipLabel =
		planAddStatus?.message ?? (isInPlan ? "In a route" : "Add to route");

	const handleOpenLocation = async (
		location: string,
		arrondissement?: ParisArrondissement,
		resolution?: LocationResolution | null,
		place?: Partial<
			Pick<LocationQuery, "address" | "postalCode" | "city" | "countryCode">
		>,
	) => {
		if (!isLoaded) return;

		if (mapPreference === "ask") {
			setPendingLocationData({ location, arrondissement, resolution, place });
			haptics.nudge();
			setShowMapSelection(true);
		} else {
			haptics.selection();
			trackMapOpen({
				eventKey: event.eventKey,
				provider: mapPreference,
				isAuthenticated,
			});
			await openLocationInMaps(
				location,
				arrondissement,
				mapPreference,
				undefined,
				resolution,
				place,
			);
		}
	};

	const handleMapSelection = async (selectedProvider: MapProvider) => {
		if (pendingLocationData) {
			trackMapOpen({
				eventKey: event.eventKey,
				provider: selectedProvider,
				isAuthenticated,
			});
			await openLocationInMaps(
				pendingLocationData.location,
				pendingLocationData.arrondissement,
				selectedProvider,
				undefined,
				pendingLocationData.resolution,
				pendingLocationData.place,
			);
			setPendingLocationData(null);
		}
		setShowMapSelection(false);
	};

	const handleSetMapPreference = (provider: MapProvider) => {
		trackMapPreferenceChange({
			eventKey: event.eventKey,
			from: mapPreference,
			to: provider,
			source: "selection_default",
			isAuthenticated,
		});
		setMapPreference(provider);
	};

	const handleMapSettingsPreferenceChange = (
		from: MapProvider,
		to: MapProvider,
	) => {
		haptics.selection();
		trackMapPreferenceChange({
			eventKey: event.eventKey,
			from,
			to,
			source: "modal_settings",
			isAuthenticated,
		});
	};

	const getLinkButtonText = (url: string) => {
		if (!url || url === "#") {
			return "Link Coming Soon";
		}
		try {
			const parsed = new URL(url);
			return `View on ${parsed.hostname.replace("www.", "")}`;
		} catch {
			return "View Event Details";
		}
	};

	const allLinks =
		event.links && event.links.length > 0 ? event.links : [event.link];
	const primaryLink = allLinks[0];
	const secondaryLinks = allLinks.slice(1);
	const detailsQuality = event.detailsQuality ?? "review";
	const sourceConfirmed = event.sourceConfirmed ?? false;
	const detailsStatus = sourceConfirmed
		? {
				label: "Details confirmed",
				dotClassName: "bg-green-500",
			}
		: detailsQuality === "complete"
			? {
					label: "Details complete",
					dotClassName: "bg-green-500",
				}
			: detailsQuality === "blocking"
				? {
						label: "Some details TBA",
						dotClassName: "bg-red-500",
					}
				: {
						label: "Details may change",
						dotClassName: "bg-yellow-500",
					};
	const allGenres = event.genre || [];
	const shouldCollapseGenres =
		allGenres.length >= MODAL_GENRE_PREVIEW_LIMIT + MODAL_MIN_COLLAPSED_GENRES;
	const visibleGenres =
		showAllGenres || !shouldCollapseGenres
			? allGenres
			: allGenres.slice(0, MODAL_GENRE_PREVIEW_LIMIT);
	const extraGenreCount = Math.max(0, allGenres.length - visibleGenres.length);
	const hasHeaderBadges = Boolean(
		isCurrentlyFeatured ||
			(!isCurrentlyFeatured && isCurrentlyPromoted) ||
			event.isOOOCPick ||
			hasSocialProofBadge ||
			eventCategoryDefinition ||
			event.category ||
			visibleGenres.length > 0 ||
			extraGenreCount > 0,
	);

	const getGenreColor = (genre: string) => {
		const genreInfo = MUSIC_GENRES.find((g) => g.key === genre);
		return genreInfo?.color || getCustomGenreColor(genre);
	};

	const getGenreLabel = getDisplayGenreLabel;

	const setTimedShareStatus = (
		message: string,
		tone: "success" | "error" = "success",
	) => {
		setLinkShareStatus({ message, tone });
		if (shareStatusTimeoutRef.current) {
			clearTimeout(shareStatusTimeoutRef.current);
		}
		shareStatusTimeoutRef.current = setTimeout(() => {
			setLinkShareStatus(null);
		}, 1800);
	};

	const setTimedPlanStatus = (
		message: string,
		tone: "success" | "error" = "success",
	) => {
		setPlanAddStatus({ message, tone });
		if (planStatusTimeoutRef.current) {
			clearTimeout(planStatusTimeoutRef.current);
		}
		planStatusTimeoutRef.current = setTimeout(() => {
			setPlanAddStatus(null);
		}, 2200);
	};

	const buildCanonicalEventUrl = (): string => {
		if (typeof window === "undefined") return "";
		const normalizedBasePath =
			basePath && basePath !== "/" && basePath.endsWith("/")
				? basePath.slice(0, -1)
				: basePath;
		const encodedEventKey = encodeURIComponent(event.eventKey);
		const encodedSlug = event.slug ? `/${encodeURIComponent(event.slug)}` : "";
		const eventPath = `${normalizedBasePath}/event/${encodedEventKey}${encodedSlug}/`;
		return new URL(eventPath, window.location.origin).toString();
	};

	const buildRequestUpdateUrl = (): string => {
		const eventUrl = buildCanonicalEventUrl();
		if (!eventUrl) return "";
		const url = new URL(eventUrl);
		url.searchParams.set("requestUpdate", "1");
		return url.toString();
	};

	const setRequestUpdateOpen = (open: boolean) => {
		if (onRequestUpdateOpenChange) {
			onRequestUpdateOpenChange(open);
			return;
		}
		setInternalRequestUpdateOpen(open);
	};

	const copyToClipboard = async (value: string): Promise<boolean> => {
		if (typeof navigator === "undefined") return false;

		if (
			typeof window !== "undefined" &&
			window.isSecureContext &&
			navigator.clipboard?.writeText
		) {
			try {
				await navigator.clipboard.writeText(value);
				return true;
			} catch {
				// Fall back for browsers/contexts that reject Clipboard API writes.
			}
		}

		if (typeof document === "undefined") {
			return false;
		}

		const textarea = document.createElement("textarea");
		textarea.value = value;
		textarea.setAttribute("readonly", "");
		textarea.style.position = "fixed";
		textarea.style.opacity = "0";
		textarea.style.left = "-9999px";
		document.body.appendChild(textarea);
		textarea.focus();
		textarea.select();

		let copied = false;
		try {
			copied = document.execCommand("copy");
		} finally {
			document.body.removeChild(textarea);
		}

		return copied;
	};

	const handleCopyContactEmail = async () => {
		const copied = await copyToClipboard(CONTACT_EMAIL);
		if (!copied) {
			haptics.error();
			return;
		}
		haptics.success();
		setIsContactEmailCopied(true);
		if (contactCopyTimeoutRef.current) {
			clearTimeout(contactCopyTimeoutRef.current);
		}
		contactCopyTimeoutRef.current = setTimeout(() => {
			setIsContactEmailCopied(false);
		}, 1800);
	};

	const handleCopyRequestUpdateUrl = async () => {
		const requestUpdateUrl = buildRequestUpdateUrl();
		if (!requestUpdateUrl) return;
		const copied = await copyToClipboard(requestUpdateUrl);
		if (copied) {
			haptics.success();
		} else {
			haptics.error();
		}
		setTimedShareStatus(
			copied ? "Update link copied" : "Unable to copy update link",
			copied ? "success" : "error",
		);
	};

	const handleShareEventLink = async () => {
		const shareUrl = buildCanonicalEventUrl();
		if (!shareUrl) return;

		const canUseNativeShare =
			typeof navigator !== "undefined" &&
			typeof navigator.share === "function" &&
			typeof window !== "undefined" &&
			window.matchMedia("(pointer: coarse)").matches;

		try {
			if (canUseNativeShare) {
				await navigator.share({
					title: event.name,
					text: `Check out ${event.name}`,
					url: shareUrl,
				});
				haptics.success();
				setTimedShareStatus("Link shared");
				return;
			}

			const copied = await copyToClipboard(shareUrl);
			if (copied) {
				haptics.success();
				setTimedShareStatus("Link copied");
			} else {
				haptics.error();
				setTimedShareStatus("Unable to copy link", "error");
			}
		} catch {
			const copied = await copyToClipboard(shareUrl);
			if (copied) {
				haptics.success();
			} else {
				haptics.error();
			}
			setTimedShareStatus(
				copied ? "Link copied" : "Unable to share link",
				copied ? "success" : "error",
			);
		}
	};

	const buildUpdateRequestForm = (): EventUpdateRequestForm => {
		return buildEventUpdateRequestForm(event);
	};

	const openUpdateRequest = () => {
		if (!submissionsEnabled) return;
		haptics.nudge();
		setUpdateRequestForm(buildUpdateRequestForm());
		setUpdateRequestStatus(null);
		setGenreSearchQuery("");
		setRequestUpdateOpen(true);
	};

	const updateRequestField = (
		field: keyof EventUpdateRequestForm,
		value: string,
	) => {
		setUpdateRequestForm((current) =>
			current ? { ...current, [field]: value } : current,
		);
	};

	const toggleUpdateGenre = (label: string) => {
		setUpdateRequestForm((current) => {
			if (!current) return current;
			const selectedGenres = dedupeGenreLabels(parseGenreLabels(current.genre));
			const nextGenres = hasGenreLabel(selectedGenres, label)
				? selectedGenres.filter(
						(genre) =>
							normalizeSearchText(genre) !== normalizeSearchText(label),
					)
				: [...selectedGenres, label];
			return {
				...current,
				genre: formatGenreValue(nextGenres),
			};
		});
	};

	const addUpdateGenreSuggestion = () => {
		const label = genreSearchQuery.trim();
		if (!label) return;
		toggleUpdateGenre(label);
		setGenreSearchQuery("");
	};

	const ticketLinkRows = parseTicketLinkRows(
		updateRequestForm?.ticketLink ?? "",
	);

	const updateTicketLinkRow = (index: number, value: string) => {
		setUpdateRequestForm((current) => {
			if (!current) return current;
			const rows = parseTicketLinkRows(current.ticketLink);
			rows[index] = value;
			return {
				...current,
				ticketLink: formatTicketLinkRows(rows),
			};
		});
	};

	const addTicketLinkRow = () => {
		setUpdateRequestForm((current) => {
			if (!current) return current;
			return {
				...current,
				ticketLink: [...parseTicketLinkRows(current.ticketLink), ""].join("\n"),
			};
		});
	};

	const removeTicketLinkRow = (index: number) => {
		setUpdateRequestForm((current) => {
			if (!current) return current;
			const rows = parseTicketLinkRows(current.ticketLink).filter(
				(_, rowIndex) => rowIndex !== index,
			);
			return {
				...current,
				ticketLink: formatTicketLinkRows(rows.length > 0 ? rows : [""]),
			};
		});
	};

	const normalizeTicketLinkRows = () => {
		setUpdateRequestForm((current) => {
			if (!current?.ticketLink.trim()) return current;
			const normalized = normalizeProofLinks(current.ticketLink);
			if (!normalized) return current;
			return {
				...current,
				ticketLink: normalized.join("\n"),
			};
		});
	};

	const submitUpdateRequest = async (formEvent: React.FormEvent) => {
		formEvent.preventDefault();
		if (!updateRequestForm) return;
		if (updateRequestStatus?.tone === "success") return;
		setUpdateRequestStatus(null);
		if (!updateRequestForm.hostEmail.includes("@")) {
			haptics.error();
			setUpdateRequestStatus({
				message: "Add a contact email so admins can verify the update.",
				tone: "error",
			});
			return;
		}
		const normalizedProofLink = normalizeProofLink(updateRequestForm.proofLink);
		if (!normalizedProofLink) {
			haptics.error();
			setUpdateRequestStatus({
				message:
					"Add a valid proof URL showing the change, like an organiser post or ticket page update.",
				tone: "error",
			});
			return;
		}
		const normalizedTicketLinks = updateRequestForm.ticketLink.trim()
			? normalizeProofLinks(updateRequestForm.ticketLink)
			: [];
		if (updateRequestForm.ticketLink.trim() && !normalizedTicketLinks) {
			haptics.error();
			setUpdateRequestStatus({
				message: "Ticket links must be valid URLs.",
				tone: "error",
			});
			return;
		}
		const normalizedTicketLink = normalizedTicketLinks
			? normalizedTicketLinks.join("\n")
			: "";
		const originalSnapshot = buildUpdateRequestForm();
		const changedFields = EVENT_UPDATE_DIFF_FIELDS.reduce(
			(acc, field) => {
				const updatedValue =
					field === "ticketLink"
						? normalizedTicketLink
						: normalizeEventUpdateText(updateRequestForm[field]);
				const originalValue = normalizeEventUpdateText(originalSnapshot[field]);
				if (updatedValue !== originalValue) {
					acc[field] = updatedValue;
				}
				return acc;
			},
			{} as Partial<Record<EventUpdatePatchField, string>>,
		);

		if (Object.keys(changedFields).length === 0) {
			haptics.error();
			setUpdateRequestStatus({
				message:
					"Nothing changed. Please update at least one field before submitting.",
				tone: "error",
			});
			return;
		}

		const originalEventSnapshot = Object.fromEntries(
			Array.from(
				new Set([
					...REQUIRED_EVENT_UPDATE_MERGE_FIELDS,
					...(Object.keys(changedFields) as EventUpdatePatchField[]),
				]),
			)
				.map((field) => [
					field,
					normalizeEventUpdateText(originalSnapshot[field]),
				])
				.filter(([, value]) => value.length > 0),
		) as Record<string, string>;

		setIsSubmittingUpdateRequest(true);
		try {
			const response = await fetch(`${basePath}/api/event-submissions`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					...changedFields,
					proofLink: normalizedProofLink,
					ticketLink:
						changedFields.ticketLink !== undefined
							? normalizedTicketLink
							: undefined,
					submissionType: "event_update",
					originalEventKey: event.eventKey,
					originalEventName: event.name,
					originalEventUrl: buildCanonicalEventUrl(),
					originalEventSnapshot,
					formStartedAt: new Date(Date.now() - 5000).toISOString(),
				}),
				signal: AbortSignal.timeout(12000),
			});
			const payload = (await response.json()) as {
				success?: boolean;
				message?: string;
				error?: string;
				issues?: string[];
			};
			if (!response.ok || !payload.success) {
				haptics.error();
				setUpdateRequestStatus({
					message:
						payload.issues?.[0] ||
						payload.error ||
						"Could not send this update request.",
					tone: "error",
				});
				return;
			}
			setUpdateRequestStatus({
				message: "Update request sent for admin review.",
				tone: "success",
			});
			haptics.success();
		} catch (error) {
			haptics.error();
			setUpdateRequestStatus({
				message:
					error instanceof Error &&
					(error.name === "TimeoutError" || error.name === "AbortError")
						? "Request timed out. Please try again."
						: "Could not send this update request.",
				tone: "error",
			});
		} finally {
			setIsSubmittingUpdateRequest(false);
		}
	};

	const submitPriceFlag = async () => {
		if (!submissionsEnabled || priceFlagStatus?.tone === "success") return;
		setPriceFlagStatus(null);
		setIsSubmittingPriceFlag(true);

		const eventLinks =
			event.links && event.links.length > 0 ? event.links : [event.link];
		const normalizedTicketLinks =
			normalizeProofLinks(eventLinks.filter(Boolean).join("\n")) ?? [];
		const displayedPriceLabel = formatPrice(event.price);
		const proofLink =
			normalizedTicketLinks[0] ||
			normalizeProofLink(buildCanonicalEventUrl()) ||
			"";
		const originalEventSnapshot = Object.fromEntries(
			(
				[
					["eventName", event.name],
					["date", event.date || ""],
					["startTime", event.time && event.time !== "TBC" ? event.time : ""],
					[
						"endTime",
						event.endTime && event.endTime !== "TBC" ? event.endTime : "",
					],
					[
						"location",
						event.location && event.location !== "TBA" ? event.location : "",
					],
					["price", displayedPriceLabel],
					["ticketLink", normalizedTicketLinks.join("\n")],
					["notes", event.description || ""],
				] satisfies Array<[string, string]>
			)
				.map(([key, value]) => [key, normalizeEventUpdateText(value)])
				.filter(([, value]) => value.length > 0),
		);

		try {
			const response = await fetch(`${basePath}/api/event-submissions`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					submissionType: "price_flag",
					originalEventKey: event.eventKey,
					originalEventName: event.name,
					originalEventUrl: buildCanonicalEventUrl(),
					originalEventSnapshot,
					eventName: event.name,
					date: event.date || "",
					startTime: event.time && event.time !== "TBC" ? event.time : "",
					location:
						event.location && event.location !== "TBA" ? event.location : "",
					price: displayedPriceLabel,
					proofLink,
					ticketLink: normalizedTicketLinks.join("\n"),
					reporterNote: priceFlagNote,
					notes: "Visitor flagged this free price as possibly wrong.",
					formStartedAt: new Date(Date.now() - 5000).toISOString(),
				}),
				signal: AbortSignal.timeout(12000),
			});
			const payload = (await response.json()) as {
				success?: boolean;
				message?: string;
				error?: string;
				issues?: string[];
			};
			if (!response.ok || !payload.success) {
				haptics.error();
				setPriceFlagStatus({
					message:
						payload.issues?.[0] ||
						payload.error ||
						"Could not flag this price right now.",
					tone: "error",
				});
				return;
			}
			haptics.success();
			setPriceFlagStatus({
				message: "Thanks, we will check the ticket page.",
				tone: "success",
			});
		} catch (error) {
			haptics.error();
			setPriceFlagStatus({
				message:
					error instanceof Error &&
					(error.name === "TimeoutError" || error.name === "AbortError")
						? "Request timed out. Please try again."
						: "Could not flag this price right now.",
				tone: "error",
			});
		} finally {
			setIsSubmittingPriceFlag(false);
		}
	};

	const hasTime = Boolean(event.time && event.time !== "TBC");
	const hasEndTime = Boolean(event.endTime && event.endTime !== "TBC");
	const timeRange = hasTime
		? hasEndTime
			? `${event.time} - ${event.endTime}`
			: (event.time ?? "TBC")
		: "TBC";
	const venueTypeLabel =
		event.venueTypes && event.venueTypes.length > 0
			? event.venueTypes
					.map((vt) => VENUE_TYPES.find((v) => v.key === vt)?.label)
					.filter(Boolean)
					.join(" & ")
			: event.indoor
				? "Indoor"
				: "Outdoor";
	const hostCountries = getCountryDisplayList(event.hostCountries);
	const audienceCountries = getCountryDisplayList(event.audienceCountries);
	const hasHostCountries = hostCountries.length > 0;
	const hasAudienceCountries = audienceCountries.length > 0;
	const hasCountryDetails = hasHostCountries || hasAudienceCountries;
	const hasCountrySplit = hasHostCountries && hasAudienceCountries;
	const mobileCountryPreviewLimit = hasCountrySplit ? 1 : COUNTRY_PREVIEW_LIMIT;
	const desktopCountryPreviewLimit = hasCountrySplit
		? 2
		: COUNTRY_PREVIEW_LIMIT;
	const hasHiddenCountries =
		hostCountries.length > mobileCountryPreviewLimit ||
		audienceCountries.length > mobileCountryPreviewLimit;
	const locationDisplay = getEventLocationDisplay(event);
	const locationLabel = locationDisplay.sectionLabel;
	const eventLocationEntries = locationDisplay.listedLocationEntries;
	const canOpenSingleLocation = locationDisplay.canOpenSingleLocation;
	const canOpenAnyLocation = locationDisplay.canOpenAnyLocation;
	const priceLabel = formatPrice(event.price);
	const priceMeta = getPriceMeta(event.price);
	const ageLabel = event.age || "All ages";

	const openExternalLink = (url: string, source: string) => {
		haptics.selection();
		trackEventEngagement({
			eventKey: event.eventKey,
			actionType: "outbound_click",
			source,
			isAuthenticated,
		});
		window.open(url, "_blank", "noopener,noreferrer");
	};

	const handleCalendarSync = () => {
		haptics.success();
		trackEventEngagement({
			eventKey: event.eventKey,
			actionType: "calendar_sync",
			source: "modal_calendar_sync",
			isAuthenticated,
		});
		addToCalendar(event);
	};

	const handleToggleSaved = () => {
		if (isSaved) {
			haptics.light();
		} else {
			haptics.success();
		}
		onToggleSaved?.(event);
		trackEventEngagement({
			eventKey: event.eventKey,
			actionType: "saved_toggle",
			source: isSaved ? "modal_unsave" : "modal_save",
			isAuthenticated,
		});
	};

	const handleAddToPlan = () => {
		if (!onAddToPlan) return;
		if (!event.date) {
			haptics.error();
			setTimedPlanStatus("Needs a confirmed date first", "error");
			return;
		}
		const result = onAddToPlan(event);
		if (!result) return;
		haptics.success();
		setTimedPlanStatus(
			result.message ??
				(result.alreadyInRoute
					? result.routeTitle
						? `Already in ${result.routeTitle}`
						: `Already in route (${result.stopCount} stops)`
					: result.stopCount <= 1
						? result.routeTitle
							? `Started ${result.routeTitle}`
							: "Started a route"
						: result.routeTitle
							? `Added to ${result.routeTitle}`
							: `Added to route (${result.stopCount} stops)`),
		);
	};

	return createPortal(
		<div
			className="fixed inset-0 flex items-center justify-center bg-black/70 backdrop-blur-[4px]"
			style={{
				zIndex: LAYERS.OVERLAY,
				paddingTop: "max(env(safe-area-inset-top), 0.5rem)",
				paddingRight: "max(env(safe-area-inset-right), 0.5rem)",
				paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)",
				paddingLeft: "max(env(safe-area-inset-left), 0.5rem)",
			}}
			role="dialog"
			aria-modal="true"
			aria-labelledby={modalTitleId}
			onKeyDown={handleModalKeyDown}
			onPointerDown={(pointerEvent) => {
				if (pointerEvent.target !== pointerEvent.currentTarget) return;
				if (showMapSelection) return;
				pointerEvent.preventDefault();
				pointerEvent.stopPropagation();
			}}
			onClick={(mouseEvent) => {
				if (mouseEvent.target !== mouseEvent.currentTarget) return;
				if (showMapSelection) return;
				mouseEvent.preventDefault();
				mouseEvent.stopPropagation();
				onClose();
			}}
		>
			<Card
				ref={modalCardRef}
				data-event-modal-card
				className={`relative max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1rem)] w-full max-w-[38rem] overflow-y-auto rounded-[22px] border bg-card/95 shadow-[0_36px_90px_-52px_rgba(0,0,0,0.9)] sm:max-h-[90vh] sm:rounded-[26px] dark:bg-[color-mix(in_oklab,var(--card)_90%,rgba(6,7,9,0.95))] ${
					isCurrentlyFeatured
						? "border-amber-300/70 shadow-[0_38px_94px_-52px_rgba(0,0,0,0.9),0_0_0_1px_rgba(212,164,96,0.35)] dark:border-amber-500/45"
						: "border-border/80"
				}`}
			>
				{isCurrentlyFeatured && (
					<div
						className="pointer-events-none absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,rgba(212,164,96,0)_0%,rgba(212,164,96,0.9)_50%,rgba(212,164,96,0)_100%)]"
						aria-hidden="true"
					/>
				)}
				<CardHeader
					className={`pb-2 sm:pb-3 ${
						!isCurrentlyFeatured ? (eventCategoryModalAccent?.header ?? "") : ""
					}`}
				>
					<div className="flex items-start justify-between gap-3">
						<div className="min-w-0 flex-1">
							<p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
								Out Of Office Collective
							</p>
							<div className="mt-1">
								<CardTitle className="break-words text-[clamp(1.25rem,3.5vw,1.9rem)] [font-family:var(--ooo-font-display)] font-light leading-tight">
									<span id={modalTitleId}>
										{titleParts.leading}
										<span
											className={
												hasTitleAdornment
													? "inline-block whitespace-nowrap"
													: undefined
											}
										>
											{titleParts.trailing}
											{isCurrentlyFeatured && (
												<Crown className="ml-2 inline h-4 w-4 translate-y-[-0.08em] text-amber-600 dark:text-amber-300" />
											)}
											{!isCurrentlyFeatured && isCurrentlyPromoted && (
												<Megaphone className="ml-2 inline h-4 w-4 translate-y-[-0.08em] text-[#315b5f] dark:text-cyan-200" />
											)}
											{event.isOOOCPick && (
												<Star className="ml-2 inline h-4 w-4 translate-y-[-0.08em] fill-current text-yellow-500" />
											)}
										</span>
									</span>
								</CardTitle>
							</div>
						</div>
						<div className="relative mt-0.5 flex shrink-0 items-center gap-2 self-start">
							{(linkShareStatus || planAddStatus) && (
								<span
									className={`pointer-events-none absolute -bottom-5 right-0 whitespace-nowrap text-[10px] ${
										(linkShareStatus ?? planAddStatus)?.tone === "error"
											? "text-amber-700 dark:text-amber-300"
											: "text-emerald-700 dark:text-emerald-300"
									}`}
									role="status"
									aria-live="polite"
								>
									{(linkShareStatus ?? planAddStatus)?.message}
								</span>
							)}
							<TooltipProvider>
								{onToggleSaved && (
									<Tooltip>
										<TooltipTrigger
											render={
												<Button
													variant="outline"
													size="icon"
													onClick={handleToggleSaved}
													className={`h-10 w-10 rounded-xl border-border/70 bg-background/70 transition-all duration-200 hover:bg-accent dark:bg-white/5 dark:hover:bg-white/10 ${
														isSaved
															? "border-emerald-300/80 text-emerald-700 dark:border-emerald-400/45 dark:text-emerald-300"
															: ""
													}`}
													aria-label={isSaved ? "Unsave event" : "Save event"}
													aria-pressed={isSaved}
												/>
											}
										>
											{isSaved ? (
												<BookmarkCheck className="h-4 w-4" />
											) : (
												<Bookmark className="h-4 w-4" />
											)}
										</TooltipTrigger>
										<TooltipContent>
											<p>{isSaved ? "Saved event" : "Save event"}</p>
										</TooltipContent>
									</Tooltip>
								)}
								{onAddToPlan && (
									<Tooltip>
										<TooltipTrigger
											render={
												<Button
													variant="outline"
													size="icon"
													onClick={handleAddToPlan}
													className={`h-10 w-10 rounded-xl border-border/70 bg-background/70 transition-all duration-200 hover:bg-accent dark:bg-white/5 dark:hover:bg-white/10 ${
														planButtonTone === "success"
															? "border-emerald-300/80 text-emerald-700 dark:border-emerald-400/45 dark:text-emerald-300"
															: planButtonTone === "error"
																? "border-amber-300/80 text-amber-700 dark:border-amber-400/45 dark:text-amber-300"
																: ""
													}`}
													aria-label={planButtonLabel}
													aria-pressed={isInPlan}
												/>
											}
										>
											{planButtonTone === "success" ? (
												<Check className="h-4 w-4" />
											) : (
												<Route className="h-4 w-4" />
											)}
										</TooltipTrigger>
										<TooltipContent>
											<p>{planTooltipLabel}</p>
										</TooltipContent>
									</Tooltip>
								)}
								<Tooltip>
									<TooltipTrigger
										render={
											<Button
												variant="outline"
												size="icon"
												onClick={() => void handleShareEventLink()}
												className={`h-10 w-10 rounded-xl border-border/70 bg-background/70 transition-all duration-200 hover:bg-accent dark:bg-white/5 dark:hover:bg-white/10 ${
													linkShareStatus?.tone === "success"
														? "border-emerald-300/80 text-emerald-700 dark:border-emerald-400/45 dark:text-emerald-300"
														: linkShareStatus?.tone === "error"
															? "border-amber-300/80 text-amber-700 dark:border-amber-400/45 dark:text-amber-300"
															: ""
												}`}
												aria-label="Share event link"
											/>
										}
									>
										{linkShareStatus?.tone === "success" ? (
											<Check className="h-4 w-4" />
										) : linkShareStatus?.tone === "error" ? (
											<AlertCircle className="h-4 w-4" />
										) : (
											<Link2 className="h-4 w-4" />
										)}
									</TooltipTrigger>
									<TooltipContent>
										<p>
											{linkShareStatus?.message
												? linkShareStatus.message
												: "Share event link"}
										</p>
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
							<Button
								ref={closeButtonRef}
								variant="outline"
								size="icon"
								onClick={onClose}
								className="h-10 w-10 rounded-xl border-border/70 bg-background/70 hover:bg-accent dark:bg-white/5 dark:hover:bg-white/10"
								aria-label="Close event details"
							>
								<X className="h-5 w-5" />
							</Button>
						</div>
					</div>
					{hasHeaderBadges && (
						<div className="mt-2 flex flex-wrap items-center gap-1.5">
							{isCurrentlyFeatured && (
								<Badge className="border-0 bg-[linear-gradient(145deg,rgba(204,159,93,0.96),rgba(167,122,67,0.96))] text-amber-50 hover:bg-[linear-gradient(145deg,rgba(204,159,93,0.96),rgba(167,122,67,0.96))]">
									<Crown className="mr-1 h-3.5 w-3.5" />
									Featured
								</Badge>
							)}
							{!isCurrentlyFeatured && isCurrentlyPromoted && (
								<Badge className="border border-[#213f43]/18 bg-[#213f43]/10 text-[#213f43] hover:bg-[#213f43]/10 dark:border-cyan-100/14 dark:bg-cyan-100/8 dark:text-cyan-100">
									<Megaphone className="mr-1 h-3.5 w-3.5" />
									Promoted
								</Badge>
							)}
							{event.isOOOCPick && (
								<Badge className="border-yellow-300 bg-yellow-400 text-black hover:bg-yellow-500">
									<Star className="mr-1 h-3.5 w-3.5 fill-current" />
									OOOC Pick
								</Badge>
							)}
							{hasSocialProofBadge && (
								<Badge className="border-amber-300/70 bg-amber-500/15 text-amber-900 hover:bg-amber-500/20 dark:border-amber-400/45 dark:text-amber-200">
									<Flame className="mr-1 h-3.5 w-3.5" />
									{socialProofLabel}
								</Badge>
							)}
							{isPartyTypeEvent ? (
								eventPartyTypeLabel ? (
									<Badge
										variant="outline"
										className="border-border/70 bg-background/50 text-foreground hover:bg-background/55"
									>
										<Clock className="mr-1 h-3 w-3" />
										{eventPartyTypeLabel}
									</Badge>
								) : null
							) : (
								eventCategoryDefinition && (
									<Badge
										variant="outline"
										className={
											eventCategoryModalAccent?.badge ??
											`${eventCategoryDefinition.color} hover:bg-background/70`
										}
									>
										<Tag className="mr-1 h-3 w-3" />
										{eventCategoryDefinition.label}
									</Badge>
								)
							)}
							{!isPartyTypeEvent && event.category && (
								<Badge className="bg-gray-100 text-gray-800">
									<Tag className="mr-1 h-3 w-3" />
									{event.category}
								</Badge>
							)}
							{visibleGenres.map((genre) => (
								<Badge
									key={genre}
									className={`${getGenreColor(genre)} border border-white/20 dark:bg-opacity-25`}
								>
									<Music className="mr-1 h-3 w-3" />
									{getGenreLabel(genre)}
								</Badge>
							))}
							{extraGenreCount > 0 && (
								<Badge
									render={
										<button
											type="button"
											onClick={() => setShowAllGenres(true)}
											className="cursor-pointer hover:bg-accent hover:text-foreground"
											aria-label={`Show ${extraGenreCount} more genres`}
										/>
									}
									variant="outline"
									className="border-border/70"
								>
									+{extraGenreCount} more
								</Badge>
							)}
						</div>
					)}
				</CardHeader>

				<CardContent className="space-y-3 pt-0">
					<div className="grid grid-cols-2 gap-1.5 rounded-xl border border-border/70 bg-background/55 p-2.5 dark:bg-white/[0.025] sm:p-3">
						<div className="rounded-lg border border-border/70 bg-background/80 px-2.5 py-2 dark:bg-white/[0.04]">
							<p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.11em] text-muted-foreground">
								<Calendar className="h-3.5 w-3.5" />
								<span>Date</span>
							</p>
							<p className="mt-0.5 break-words text-[13px] font-medium leading-snug sm:text-sm">
								{formatDayWithDate(event.day, event.date)}
							</p>
							{dateRangeLabel && (
								<p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
									{dateRangeLabel}
									{occurrenceLabel ? ` · ${occurrenceLabel}` : ""}
								</p>
							)}
						</div>
						<div className="rounded-lg border border-border/70 bg-background/80 px-2.5 py-2 dark:bg-white/[0.04]">
							<p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.11em] text-muted-foreground">
								<Clock className="h-3.5 w-3.5" />
								<span>Time</span>
							</p>
							<p className="mt-0.5 text-[13px] font-medium sm:text-sm">
								{timeRange}
							</p>
						</div>
						{(dateRangeLabel || orderedSeriesEvents.length > 1) && (
							<div className="col-span-2 rounded-lg border border-border/70 bg-background/80 px-2.5 py-2 dark:bg-white/[0.04]">
								<div className="flex items-center justify-between gap-2">
									<p className="flex min-w-0 items-center gap-1.5 text-[10px] uppercase tracking-[0.11em] text-muted-foreground">
										<Calendar className="h-3.5 w-3.5" />
										<span className="truncate">Event series</span>
									</p>
									{occurrenceLabel && (
										<span className="shrink-0 text-[11px] font-medium text-muted-foreground">
											{occurrenceLabel}
										</span>
									)}
								</div>
								{orderedSeriesEvents.length > 1 ? (
									<div className="mt-2 flex items-center gap-1.5">
										<Button
											type="button"
											size="sm"
											variant="outline"
											className="h-7 w-7 shrink-0 p-0"
											disabled={!previousSeriesEvent}
											onClick={() =>
												previousSeriesEvent &&
												onNavigateSeriesEvent?.(previousSeriesEvent)
											}
											aria-label="Open previous series date"
										>
											<ChevronLeft className="h-3.5 w-3.5" />
										</Button>
										<div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
											{orderedSeriesEvents.map((seriesEvent) => {
												const isActive =
													seriesEvent.eventKey === event.eventKey;
												return (
													<button
														key={seriesEvent.eventKey}
														type="button"
														onClick={() =>
															!isActive && onNavigateSeriesEvent?.(seriesEvent)
														}
														className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
															isActive
																? "border-foreground bg-foreground text-background"
																: "border-border/80 bg-background hover:bg-muted"
														}`}
														aria-current={isActive ? "date" : undefined}
													>
														{formatDayWithDate(
															seriesEvent.day,
															seriesEvent.date,
														)}
													</button>
												);
											})}
										</div>
										<Button
											type="button"
											size="sm"
											variant="outline"
											className="h-7 w-7 shrink-0 p-0"
											disabled={!nextSeriesEvent}
											onClick={() =>
												nextSeriesEvent &&
												onNavigateSeriesEvent?.(nextSeriesEvent)
											}
											aria-label="Open next series date"
										>
											<ChevronRight className="h-3.5 w-3.5" />
										</Button>
									</div>
								) : (
									<p className="mt-1 text-xs font-medium text-foreground">
										{dateRangeLabel}
									</p>
								)}
							</div>
						)}
						<div className="rounded-lg border border-border/70 bg-background/80 px-2.5 py-2 dark:bg-white/[0.04]">
							<p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.11em] text-muted-foreground">
								<Euro className="h-3.5 w-3.5" />
								<span>Price</span>
							</p>
							<p
								className={`mt-0.5 flex items-center gap-1.5 text-[13px] font-medium sm:text-sm ${
									priceMeta.kind === "free"
										? "text-green-600 dark:text-green-400"
										: priceMeta.kind === "free_option"
											? "text-amber-700 dark:text-amber-300"
											: "text-foreground"
								}`}
							>
								<span>{priceLabel}</span>
								{priceMeta.hasFreeOption && submissionsEnabled && (
									<Popover>
										<PopoverTrigger
											render={
												<button
													type="button"
													className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
													aria-label="Flag wrong free price"
												/>
											}
										>
											<CircleHelp className="size-3.5" aria-hidden="true" />
										</PopoverTrigger>
										<PopoverContent
											align="start"
											className="w-72 gap-3 text-sm"
										>
											<div className="space-y-1">
												<p className="font-medium text-foreground">
													Think this price is wrong?
												</p>
												<p className="text-xs leading-relaxed text-muted-foreground">
													Ticket pages can change. If this now requires payment,
													flag it for admin review.
												</p>
											</div>
											<Textarea
												value={priceFlagNote}
												onChange={(inputEvent) =>
													setPriceFlagNote(inputEvent.target.value)
												}
												rows={3}
												maxLength={1000}
												placeholder="Optional note, like the price you saw"
												disabled={
													isSubmittingPriceFlag ||
													priceFlagStatus?.tone === "success"
												}
												className="text-xs"
											/>
											{priceFlagStatus && (
												<p
													className={`rounded-md border px-2.5 py-2 text-xs ${
														priceFlagStatus.tone === "success"
															? "border-emerald-200 bg-emerald-50 text-emerald-900"
															: "border-rose-200 bg-rose-50 text-rose-800"
													}`}
													role="status"
												>
													{priceFlagStatus.message}
												</p>
											)}
											<Button
												type="button"
												size="sm"
												onClick={() => void submitPriceFlag()}
												disabled={
													isSubmittingPriceFlag ||
													priceFlagStatus?.tone === "success"
												}
												className="w-full"
											>
												<Flag className="size-3.5" aria-hidden="true" />
												{isSubmittingPriceFlag
													? "Flagging..."
													: priceFlagStatus?.tone === "success"
														? "Flagged"
														: "Flag price issue"}
											</Button>
										</PopoverContent>
									</Popover>
								)}
							</p>
						</div>
						<div className="rounded-lg border border-border/70 bg-background/80 px-2.5 py-2 dark:bg-white/[0.04]">
							<p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.11em] text-muted-foreground">
								<User className="h-3.5 w-3.5" />
								<span>Age</span>
							</p>
							<p className="mt-0.5 text-[13px] font-medium sm:text-sm">
								{ageLabel}
							</p>
						</div>
						<div
							className={`col-span-2 grid gap-1.5 ${
								hasCountryDetails ? "grid-cols-2" : "grid-cols-1"
							}`}
						>
							<div className="rounded-lg border border-border/70 bg-background/80 px-2.5 py-2 dark:bg-white/[0.04]">
								<p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.11em] text-muted-foreground">
									<Building2 className="h-3.5 w-3.5" />
									<span>Venue Type</span>
								</p>
								<p className="mt-0.5 text-[13px] font-medium sm:text-sm">
									{venueTypeLabel}
								</p>
							</div>
							{hasCountryDetails && (
								<div
									className={`relative overflow-hidden rounded-lg border border-border/70 bg-background/80 dark:bg-white/[0.04] ${
										hasCountrySplit ? "grid grid-cols-2" : ""
									}`}
								>
									{hasCountrySplit && (
										<div
											className="pointer-events-none absolute top-[-18%] bottom-[-18%] left-1/2 z-10 w-px rotate-[14deg] bg-border/80 dark:bg-border/65"
											aria-hidden="true"
										/>
									)}
									{hasHostCountries && (
										<div
											className={`min-w-0 px-2.5 py-2 ${hasCountrySplit ? "pr-4" : ""}`}
										>
											<p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.11em] text-muted-foreground">
												<Flag className="h-4 w-4 shrink-0" />
												<span>Host</span>
											</p>
											<CountryChipList
												countries={hostCountries}
												mobilePreviewLimit={mobileCountryPreviewLimit}
												desktopPreviewLimit={desktopCountryPreviewLimit}
												onShowAll={() => setShowCountryDetails(true)}
											/>
										</div>
									)}
									{hasAudienceCountries && (
										<div
											className={`min-w-0 px-2.5 py-2 ${hasCountrySplit ? "pl-4" : ""}`}
										>
											<p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.11em] text-muted-foreground">
												<Users className="h-4 w-4 shrink-0" />
												<span>Crowd</span>
											</p>
											<CountryChipList
												countries={audienceCountries}
												mobilePreviewLimit={mobileCountryPreviewLimit}
												desktopPreviewLimit={desktopCountryPreviewLimit}
												onShowAll={() => setShowCountryDetails(true)}
											/>
										</div>
									)}
								</div>
							)}
						</div>
						<div className="col-span-2 rounded-lg border border-border/70 bg-background/80 px-2.5 py-2 dark:bg-white/[0.04]">
							<div className="flex items-start justify-between gap-2">
								<p className="flex min-w-0 items-center gap-1.5 text-[10px] uppercase tracking-[0.11em] text-muted-foreground">
									<MapPin className="h-3.5 w-3.5" />
									<span>{locationLabel}</span>
									{locationDisplay.state === "tbc" && (
										<span className="truncate text-[13px] font-medium normal-case tracking-normal text-foreground sm:text-sm">
											Location TBC
										</span>
									)}
								</p>
								{canOpenAnyLocation && (
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger
												render={
													<Button
														variant="outline"
														size="sm"
														onClick={() => setShowMapSettings(!showMapSettings)}
														className="h-6.5 px-2 text-[10px]"
													/>
												}
											>
												<Settings className="mr-1 h-3 w-3" />
												Map
											</TooltipTrigger>
											<TooltipContent>
												<p>Map preferences</p>
											</TooltipContent>
										</Tooltip>
									</TooltipProvider>
								)}
							</div>
							{locationDisplay.state === "multiple-listed" ? (
								<div className="mt-1.5 space-y-1.5">
									{eventLocationEntries.map((locationEntry, locationIndex) => (
										<button
											key={`${locationEntry.name}-${locationIndex}`}
											onClick={() =>
												handleOpenLocation(
													locationEntry.name,
													locationEntry.arrondissement,
													null,
													{
														address: locationEntry.address,
														postalCode: locationEntry.postalCode,
														city: locationEntry.city,
														countryCode: locationEntry.countryCode,
													},
												)
											}
											className="inline-flex min-h-[32px] w-full items-center justify-between rounded-md border border-border/70 bg-background/80 px-2.5 text-left text-sm text-primary underline-offset-4 transition-colors hover:bg-accent hover:underline dark:bg-white/[0.03] dark:hover:bg-white/[0.08]"
											title={`Open "${locationEntry.name}" in maps`}
										>
											<span className="truncate">{locationEntry.name}</span>
											<span className="ml-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.1em] text-primary">
												{locationEntry.arrondissement
													? formatLocationAreaShort(
															locationEntry.arrondissement,
														)
													: null}
												Open map
												<ExternalLink className="h-3 w-3" />
											</span>
										</button>
									))}
								</div>
							) : canOpenSingleLocation && locationDisplay.singleLocation ? (
								<button
									onClick={() =>
										handleOpenLocation(
											locationDisplay.singleLocation!,
											event.arrondissement,
											event.locationResolution,
											{
												address: event.locationAddress,
												postalCode: event.postalCode,
												city: event.city,
												countryCode: event.countryCode,
											},
										)
									}
									className="mt-1.5 inline-flex min-h-[32px] w-full items-center justify-between rounded-md border border-border/70 bg-background/80 px-2.5 text-left text-sm text-primary underline-offset-4 transition-colors hover:bg-accent hover:underline dark:bg-white/[0.03] dark:hover:bg-white/[0.08]"
									title={`Open "${locationDisplay.singleLocation}" in maps`}
								>
									<span className="truncate">
										{locationDisplay.singleLocation}
									</span>
									<span className="ml-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.1em] text-primary">
										Open map
										<ExternalLink className="h-3 w-3" />
									</span>
								</button>
							) : (
								<div className="mt-1.5 space-y-1">
									<p className="text-xs text-muted-foreground">
										{locationDisplay.modalLabel}
									</p>
								</div>
							)}
						</div>

						{showMapSettings && canOpenAnyLocation && (
							<div className="col-span-2 mt-1 border-t border-border/60 pt-2.5">
								<MapPreferenceSettings
									compact={true}
									showTitle={false}
									className="w-full"
									onPreferenceChange={handleMapSettingsPreferenceChange}
								/>
							</div>
						)}
					</div>

					{event.description && (
						<div className="rounded-xl border border-border/70 bg-background/55 p-2.5 dark:bg-white/[0.025] sm:p-3">
							<h4 className="mb-1 text-xs uppercase tracking-[0.12em] text-muted-foreground">
								Notes
							</h4>
							<p className="text-sm leading-relaxed text-muted-foreground">
								{event.description}
							</p>
						</div>
					)}

					<div className="flex items-center gap-2 text-[11px] text-muted-foreground">
						<div
							className={`h-2 w-2 rounded-full ${detailsStatus.dotClassName}`}
						/>
						<span>{detailsStatus.label}</span>
						{isNewlyAdded && (
							<>
								<span aria-hidden="true">•</span>
								<span>{recentlyAddedLabel}</span>
							</>
						)}
						{isRecentlyUpdated && (
							<>
								<span aria-hidden="true">•</span>
								<span>{recentlyUpdatedLabel}</span>
							</>
						)}
					</div>

					<div className="space-y-1.5 border-t border-border/70 pt-3">
						<div className="grid grid-cols-2 gap-2">
							{primaryLink && primaryLink !== "#" ? (
								<Button
									onClick={() =>
										openExternalLink(primaryLink, "modal_primary_link")
									}
									className="group h-10 w-full min-w-0 transition-all duration-200 hover:shadow-[0_10px_24px_-18px_rgba(16,12,9,0.65)]"
									title={primaryLink}
								>
									<ExternalLink className="mr-2 h-4 w-4" />
									<span className="truncate">
										{getLinkButtonText(primaryLink)}
									</span>
								</Button>
							) : (
								<Button disabled className="h-10 w-full min-w-0">
									<Clock className="mr-2 h-4 w-4" />
									<span className="truncate">Link Coming Soon</span>
								</Button>
							)}

							{canAddToCalendar ? (
								<Button
									variant="outline"
									onClick={handleCalendarSync}
									className="group h-10 w-full border-blue-200 bg-blue-50 text-blue-700 transition-all duration-200 hover:border-blue-300 hover:bg-blue-100 hover:shadow-[0_10px_24px_-18px_rgba(20,73,163,0.6)] dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
									title="Add event to your calendar"
								>
									<CalendarPlus className="mr-2 h-4 w-4" />
									Add to Calendar
								</Button>
							) : (
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger
											render={<span className="inline-flex w-full" />}
										>
											<Button
												variant="outline"
												disabled
												className="h-10 w-full border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
											>
												<CalendarPlus className="mr-2 h-4 w-4" />
												Add to Calendar
											</Button>
										</TooltipTrigger>
										<TooltipContent>
											<p>Add an unambiguous date to enable calendar export.</p>
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
							)}
						</div>

						{secondaryLinks.length > 0 && (
							<div className="space-y-1">
								{secondaryLinks.map((link) => (
									<Button
										key={link}
										variant="outline"
										size="sm"
										onClick={() =>
											openExternalLink(link, "modal_secondary_link")
										}
										className="w-full"
										title={link}
									>
										<ExternalLink className="mr-1 h-3 w-3" />
										{getLinkButtonText(link)}
									</Button>
								))}
							</div>
						)}
					</div>

					<div className="rounded-xl border border-border/70 bg-muted/35 p-2.5 text-[11px] text-muted-foreground dark:bg-white/[0.03] sm:p-3 sm:text-xs">
						<p className="mb-1 font-medium">Event Information</p>
						<p>
							This information is preliminary. Please check the official event
							page for the most up-to-date details including exact location,
							timing, and any entry requirements.
							{submissionsEnabled && (
								<>
									{" "}
									<button
										type="button"
										onClick={openUpdateRequest}
										className="font-medium text-foreground underline underline-offset-4 transition-colors hover:text-primary"
									>
										Own this event? Request an update.
									</button>
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger
												onClick={() => void handleCopyRequestUpdateUrl()}
												render={
													<button
														type="button"
														className="relative ml-0 inline-flex h-[1em] w-[1em] items-center justify-center align-[-0.14em] text-muted-foreground/65 transition-colors before:absolute before:-inset-1.5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
														aria-label="Copy request update link"
													/>
												}
											>
												<Copy className="h-[0.72em] w-[0.72em]" />
											</TooltipTrigger>
											<TooltipContent>
												<p>Copy request update link</p>
											</TooltipContent>
										</Tooltip>
									</TooltipProvider>
								</>
							)}
						</p>
					</div>
				</CardContent>
			</Card>

			<Dialog
				open={isUpdateRequestOpen}
				onOpenChange={(open) => {
					if (open && !updateRequestForm && submissionsEnabled) {
						setUpdateRequestForm(buildUpdateRequestForm());
					}
					setRequestUpdateOpen(open);
					if (!open) {
						setIsGenrePickerOpen(false);
						setGenreSearchQuery("");
					}
				}}
			>
				<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
					<DialogHeader>
						<DialogTitle>Request an event update</DialogTitle>
						<DialogDescription className="space-y-1.5">
							<span className="block">
								Edit the details that changed and add a source URL for the admin
								team to review.
							</span>
							<span className="block text-xs">
								Need to contact us directly?{" "}
								<a
									href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
										`Fete Finder event update: ${event.name}`,
									)}`}
								>
									Email us
								</a>
								<button
									type="button"
									onClick={() => void handleCopyContactEmail()}
									className="relative ml-1 inline-flex h-[1em] w-[1em] items-center justify-center align-[-0.14em] text-muted-foreground/70 transition-colors before:absolute before:-inset-1.5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
									aria-label={
										isContactEmailCopied
											? "Contact email copied"
											: "Copy contact email"
									}
									title={
										isContactEmailCopied
											? "Contact email copied"
											: "Copy contact email"
									}
								>
									{isContactEmailCopied ? (
										<Check
											className="h-[0.72em] w-[0.72em]"
											aria-hidden="true"
										/>
									) : (
										<Copy
											className="h-[0.72em] w-[0.72em]"
											aria-hidden="true"
										/>
									)}
								</button>
								<span className="sr-only" role="status" aria-live="polite">
									{isContactEmailCopied ? "Contact email copied" : ""}
								</span>
							</span>
						</DialogDescription>
					</DialogHeader>
					{updateRequestForm && (
						<form onSubmit={submitUpdateRequest} className="space-y-4">
							<div className="grid gap-3 sm:grid-cols-2">
								<div className="space-y-1.5 sm:col-span-2">
									<Label htmlFor="update-event-name">Event name</Label>
									<Input
										id="update-event-name"
										value={updateRequestForm.eventName}
										onChange={(inputEvent) =>
											updateRequestField("eventName", inputEvent.target.value)
										}
										required
									/>
								</div>
								<div className="space-y-1.5 sm:col-span-2">
									<Label htmlFor="update-event-category">Event category</Label>
									<select
										id="update-event-category"
										value={updateRequestForm.eventCategory}
										onChange={(inputEvent) =>
											updateRequestField(
												"eventCategory",
												inputEvent.target.value,
											)
										}
										className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
									>
										<option value="">Not set</option>
										{EVENT_EXPERIENCE_CATEGORIES.map((category) => (
											<option key={category.key} value={category.label}>
												{category.label}
											</option>
										))}
									</select>
								</div>
								<div className="space-y-1.5">
									<Label htmlFor="update-date">Date</Label>
									<Input
										id="update-date"
										type="date"
										value={updateRequestForm.date}
										onChange={(inputEvent) =>
											updateRequestField("date", inputEvent.target.value)
										}
										required
									/>
								</div>
								<div className="grid grid-cols-2 gap-2">
									<div className="space-y-1.5">
										<Label htmlFor="update-start">Start</Label>
										<Input
											id="update-start"
											type="time"
											value={updateRequestForm.startTime}
											onChange={(inputEvent) =>
												updateRequestField("startTime", inputEvent.target.value)
											}
											required
										/>
									</div>
									<div className="space-y-1.5">
										<Label htmlFor="update-end">End</Label>
										<Input
											id="update-end"
											type="time"
											value={updateRequestForm.endTime}
											onChange={(inputEvent) =>
												updateRequestField("endTime", inputEvent.target.value)
											}
											required
										/>
									</div>
								</div>
								<div className="space-y-1.5 sm:col-span-2">
									<Label htmlFor="update-location">Location</Label>
									<Input
										id="update-location"
										value={updateRequestForm.location}
										onChange={(inputEvent) =>
											updateRequestField("location", inputEvent.target.value)
										}
										required
									/>
								</div>
								<div className="space-y-1.5">
									<Label htmlFor="update-genre">Music genres</Label>
									<Button
										id="update-genre"
										type="button"
										variant="outline"
										className="h-10 w-full justify-between px-3 font-normal"
										onClick={() => setIsGenrePickerOpen((current) => !current)}
									>
										<span className="truncate">
											{selectedUpdateGenres.length > 0
												? formatGenreValue(selectedUpdateGenres)
												: "Choose genres"}
										</span>
										<ChevronDown aria-hidden="true" />
									</Button>
									{isGenrePickerOpen && (
										<div className="space-y-3 rounded-lg border border-border bg-background p-3">
											<div className="flex gap-2">
												<div className="relative min-w-0 flex-1">
													<Input
														value={genreSearchQuery}
														onChange={(inputEvent) =>
															setGenreSearchQuery(inputEvent.target.value)
														}
														placeholder="Afrobeats, Kompa, Jersey club..."
														autoComplete="off"
														className={genreSearchQuery ? "pr-9" : undefined}
													/>
													{genreSearchQuery && (
														<button
															type="button"
															onClick={() => setGenreSearchQuery("")}
															className="absolute right-1.5 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
															aria-label="Clear genre search"
														>
															<X className="size-3.5" aria-hidden="true" />
														</button>
													)}
												</div>
												<Button
													type="button"
													variant="outline"
													onClick={addUpdateGenreSuggestion}
													disabled={!genreSearchQuery.trim()}
												>
													Add
												</Button>
											</div>
											<div className="grid max-h-52 gap-1 overflow-y-auto rounded-md border border-border bg-background p-2">
												{filteredGenreOptions.map((genre) => {
													const isSelected = hasGenreLabel(
														selectedUpdateGenres,
														genre.label,
													);
													return (
														<button
															key={genre.key}
															type="button"
															onClick={() => toggleUpdateGenre(genre.label)}
															className="flex min-h-9 items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
															aria-pressed={isSelected}
														>
															<span
																className={`h-2.5 w-2.5 shrink-0 rounded-full ${genre.color || "bg-stone-500"}`}
																aria-hidden="true"
															/>
															<span className="min-w-0 flex-1 truncate">
																{genre.label}
															</span>
															{isSelected && (
																<Check
																	className="size-4 shrink-0"
																	aria-hidden="true"
																/>
															)}
														</button>
													);
												})}
											</div>
											{selectedUpdateGenres.length > 0 && (
												<div className="flex flex-wrap gap-1.5">
													{selectedUpdateGenres.map((genre) => (
														<button
															key={genre}
															type="button"
															onClick={() => toggleUpdateGenre(genre)}
															className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-xs hover:bg-muted"
															aria-label={`Remove ${genre}`}
														>
															{genre}
															<X className="size-3" aria-hidden="true" />
														</button>
													))}
												</div>
											)}
										</div>
									)}
								</div>
								<div className="space-y-1.5">
									<Label htmlFor="update-price">Price</Label>
									<Input
										id="update-price"
										value={updateRequestForm.price}
										onChange={(inputEvent) =>
											updateRequestField("price", inputEvent.target.value)
										}
										required
									/>
								</div>
								<div className="space-y-1.5">
									<Label htmlFor="update-age">Age</Label>
									<Input
										id="update-age"
										value={updateRequestForm.age}
										onChange={(inputEvent) =>
											updateRequestField("age", inputEvent.target.value)
										}
									/>
								</div>
								<div className="space-y-1.5">
									<Label htmlFor="update-setting">Indoor/Outdoor</Label>
									<Input
										id="update-setting"
										value={updateRequestForm.indoorOutdoor}
										onChange={(inputEvent) =>
											updateRequestField(
												"indoorOutdoor",
												inputEvent.target.value,
											)
										}
									/>
								</div>
								<div className="space-y-1.5">
									<Label htmlFor="update-area">Arrondissement</Label>
									<Input
										id="update-area"
										value={updateRequestForm.arrondissement}
										onChange={(inputEvent) =>
											updateRequestField(
												"arrondissement",
												inputEvent.target.value,
											)
										}
									/>
								</div>
								<div className="space-y-1.5">
									<Label htmlFor="update-email">Contact email</Label>
									<Input
										id="update-email"
										type="email"
										value={updateRequestForm.hostEmail}
										onChange={(inputEvent) =>
											updateRequestField("hostEmail", inputEvent.target.value)
										}
										placeholder="you@example.com"
										autoCapitalize="off"
										autoCorrect="off"
										spellCheck={false}
										required
									/>
								</div>
								<div className="space-y-1.5 sm:col-span-2">
									<Label htmlFor="update-ticket-link">Ticket link(s)</Label>
									<div className="space-y-2">
										{ticketLinkRows.map((link, index) => {
											const inputId = `update-ticket-link-${index}`;
											return (
												<div
													key={`${inputId}-${index}`}
													className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"
												>
													<div className="space-y-1">
														<div className="flex items-center justify-between gap-2">
															<Label
																htmlFor={inputId}
																className="text-xs text-muted-foreground"
															>
																{index === 0
																	? "Primary link"
																	: `Additional link ${index}`}
															</Label>
														</div>
														<Input
															id={inputId}
															type="url"
															value={link}
															onChange={(inputEvent) =>
																updateTicketLinkRow(
																	index,
																	inputEvent.target.value,
																)
															}
															onBlur={normalizeTicketLinkRows}
															placeholder={
																index === 0
																	? "Ticket, RSVP, or official event URL"
																	: "Additional ticket or official event URL"
															}
															autoCapitalize="off"
															autoCorrect="off"
															spellCheck={false}
														/>
													</div>
													{ticketLinkRows.length > 1 && (
														<Button
															type="button"
															variant="outline"
															size="icon-sm"
															className="self-end"
															onClick={() => removeTicketLinkRow(index)}
															aria-label={`Remove ${
																index === 0
																	? "primary link"
																	: `additional link ${index}`
															}`}
															title="Remove link"
														>
															<Trash2 className="size-3.5" aria-hidden="true" />
														</Button>
													)}
												</div>
											);
										})}
										<div className="flex flex-wrap items-center gap-2">
											<Button
												type="button"
												variant="outline"
												size="sm"
												onClick={addTicketLinkRow}
											>
												<Plus className="size-3.5" aria-hidden="true" />
												Add another link
											</Button>
											<p className="text-xs text-muted-foreground">
												The first link is used as the main event button.
											</p>
										</div>
									</div>
								</div>
								<div className="space-y-1.5 sm:col-span-2">
									<Label htmlFor="update-proof">Proof of change URL</Label>
									<Input
										id="update-proof"
										type="url"
										value={updateRequestForm.proofLink}
										onChange={(inputEvent) =>
											updateRequestField("proofLink", inputEvent.target.value)
										}
										onBlur={() => {
											const normalized = normalizeProofLink(
												updateRequestForm.proofLink,
											);
											if (normalized) {
												updateRequestField("proofLink", normalized);
											}
										}}
										placeholder="Post, organiser update, or ticket page proving the changed detail"
										autoCapitalize="off"
										autoCorrect="off"
										spellCheck={false}
										required
									/>
								</div>
								<div className="space-y-1.5 sm:col-span-2">
									<Label htmlFor="update-notes">Notes</Label>
									<Textarea
										id="update-notes"
										value={updateRequestForm.notes}
										onChange={(inputEvent) =>
											updateRequestField("notes", inputEvent.target.value)
										}
										rows={4}
									/>
								</div>
							</div>

							{updateRequestStatus && (
								<div
									className={`rounded-md border px-3 py-2 text-sm ${
										updateRequestStatus.tone === "success"
											? "border-emerald-200 bg-emerald-50 text-emerald-900"
											: "border-rose-200 bg-rose-50 text-rose-800"
									}`}
									role="status"
								>
									{updateRequestStatus.message}
								</div>
							)}

							<DialogFooter>
								<Button
									type="submit"
									disabled={
										isSubmittingUpdateRequest ||
										updateRequestStatus?.tone === "success"
									}
								>
									{isSubmittingUpdateRequest
										? "Sending..."
										: updateRequestStatus?.tone === "success"
											? "Sent"
											: "Send update request"}
								</Button>
							</DialogFooter>
						</form>
					)}
				</DialogContent>
			</Dialog>

			{showCountryDetails && hasHiddenCountries && (
				<div
					className="fixed inset-0 flex items-end justify-center bg-black/35 backdrop-blur-[2px] sm:items-center"
					style={{
						zIndex: LAYERS.SYSTEM_TOAST,
						paddingTop: "max(env(safe-area-inset-top), 0.75rem)",
						paddingRight: "max(env(safe-area-inset-right), 0.75rem)",
						paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)",
						paddingLeft: "max(env(safe-area-inset-left), 0.75rem)",
					}}
					onClick={() => setShowCountryDetails(false)}
				>
					<div
						className="w-full max-w-sm rounded-2xl border border-border/80 bg-card p-4 shadow-[0_24px_70px_-38px_rgba(0,0,0,0.95)] sm:rounded-[22px]"
						role="dialog"
						aria-modal="true"
						aria-labelledby="country-details-title"
						onClick={(event) => event.stopPropagation()}
					>
						<div className="flex items-start justify-between gap-3">
							<div>
								<p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
									Country split
								</p>
								<h2
									id="country-details-title"
									className="mt-1 text-lg font-medium leading-tight"
								>
									Host and crowd
								</h2>
							</div>
							<Button
								variant="outline"
								size="icon"
								onClick={() => setShowCountryDetails(false)}
								className="h-9 w-9 rounded-xl border-border/70 bg-background/70"
							>
								<X className="h-4 w-4" />
								<span className="sr-only">Close country split</span>
							</Button>
						</div>
						<div className="mt-4 space-y-4">
							<CountryDetailsGroup label="Host" countries={hostCountries} />
							<CountryDetailsGroup
								label="Crowd"
								countries={audienceCountries}
							/>
						</div>
					</div>
				</div>
			)}

			<MapSelectionModal
				isOpen={showMapSelection}
				onClose={() => {
					setShowMapSelection(false);
					setPendingLocationData(null);
				}}
				onSelect={handleMapSelection}
				onRememberPreference={handleSetMapPreference}
				title="Choose Map App"
				description="How would you like to open this location?"
			/>
		</div>,
		document.body,
	);
};

export default EventModal;
