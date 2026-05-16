"use client";

import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoPopover } from "@/components/ui/info-popover";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Toggle } from "@/components/ui/toggle";
import { ClearFiltersButton } from "@/features/events/components/ClearFiltersButton";
import { DateRangePickerControl } from "@/features/events/components/DateRangePickerControl";
import { FilterButton } from "@/features/events/components/FilterButton";
import {
	type DateRangeFilter,
	areDateRangesEqual,
	getActiveFiltersCount,
	hasActiveFilters as hasActiveEventFilters,
} from "@/features/events/filtering";
import {
	AGE_RANGE_CONFIG,
	type AgeRange,
	DAY_NIGHT_PERIODS,
	type DayNightPeriod,
	type EventExperienceCategory,
	MUSIC_GENRES,
	type MusicGenre,
	type MusicGenreDefinition,
	type Nationality,
	PRICE_RANGE_CONFIG,
	type ParisArrondissement,
	VENUE_TYPES,
	type VenueType,
	formatAgeRange,
	formatLocationAreaShort,
	formatPriceRange,
	getEventExperienceCategoryDefinition,
} from "@/features/events/types";
import { useAppHaptics } from "@/hooks/useAppHaptics";
import { useLocalAppSettings } from "@/hooks/useLocalAppSettings";
import { LAYERS } from "@/lib/ui/layers";
import {
	OVERLAY_BODY_ATTRIBUTE,
	setBodyOverlayAttribute,
} from "@/lib/ui/overlay-state";
import {
	Building2,
	CalendarDays,
	Check,
	ChevronDown,
	Clock,
	Euro,
	Filter,
	Minus,
	Moon,
	Plus,
	Search,
	Star,
	Sun,
	Tag,
	Trees,
	Users,
	X,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type FilterPanelProps = {
	selectedDateRange: DateRangeFilter;
	defaultDateRange: DateRangeFilter;
	selectedDayNightPeriods: DayNightPeriod[];
	selectedArrondissements: ParisArrondissement[];
	selectedGenres: MusicGenre[];
	excludedGenres: MusicGenre[];
	selectedEventCategories: EventExperienceCategory[];
	selectedNationalities: Nationality[];
	selectedVenueTypes: VenueType[];
	selectedIndoorPreference: boolean | null;
	selectedPriceRange: [number, number];
	includeFreeOptions: boolean;
	selectedAgeRange: AgeRange | null;
	selectedOOOCPicks: boolean;
	onDateRangeChange: (dateRange: DateRangeFilter) => void;
	onDayNightPeriodToggle: (period: DayNightPeriod) => void;
	onArrondissementToggle: (arrondissement: ParisArrondissement) => void;
	onGenreToggle: (genre: MusicGenre) => void;
	onGenreExcludeToggle: (genre: MusicGenre) => void;
	onEventCategoryToggle: (category: EventExperienceCategory) => void;
	onNationalityToggle: (nationality: Nationality) => void;
	onVenueTypeToggle: (venueType: VenueType) => void;
	onIndoorPreferenceChange: (preference: boolean | null) => void;
	onPriceRangeChange: (range: [number, number]) => void;
	onIncludeFreeOptionsChange: (include: boolean) => void;
	onAgeRangeChange: (range: AgeRange | null) => void;
	onOOOCPicksToggle: (selected: boolean) => void;
	onClearFilters: () => void;
	availableArrondissements: ParisArrondissement[];
	availableEventCategories: EventExperienceCategory[];
	availableGenres?: MusicGenreDefinition[];
	availableNationalities?: Array<{
		key: Nationality;
		label: string;
		flag: string;
		shortCode: string;
	}>;
	availableEventDates: string[];
	quickSelectEventDates: string[];
	filteredEventsCount: number;
	isOpen: boolean;
	onClose: () => void;
	onOpen?: () => void;
	isExpanded?: boolean;
	onToggleExpanded?: () => void;
	hideFloatingButton?: boolean;
	forceDrawer?: boolean;
};

const FilterPanel: React.FC<FilterPanelProps> = ({
	selectedDateRange,
	defaultDateRange,
	selectedDayNightPeriods,
	selectedArrondissements,
	selectedGenres,
	excludedGenres,
	selectedEventCategories,
	selectedNationalities,
	selectedVenueTypes,
	selectedIndoorPreference,
	selectedPriceRange,
	includeFreeOptions,
	selectedAgeRange,
	selectedOOOCPicks,
	onDateRangeChange,
	onDayNightPeriodToggle,
	onArrondissementToggle,
	onGenreToggle,
	onGenreExcludeToggle,
	onEventCategoryToggle,
	onNationalityToggle,
	onVenueTypeToggle,
	onIndoorPreferenceChange,
	onPriceRangeChange,
	onIncludeFreeOptionsChange,
	onAgeRangeChange,
	onOOOCPicksToggle,
	onClearFilters,
	availableArrondissements,
	availableEventCategories,
	availableGenres,
	availableNationalities = [],
	availableEventDates,
	quickSelectEventDates,
	filteredEventsCount,
	isOpen,
	onClose,
	onOpen,
	isExpanded,
	onToggleExpanded,
	hideFloatingButton = false,
	forceDrawer = false,
}) => {
	const { settings: localAppSettings } = useLocalAppSettings();
	const haptics = useAppHaptics();
	const sectionClassName =
		"space-y-3 rounded-xl border border-border/70 bg-background/58 p-3";
	const prioritySectionClassName =
		"space-y-3 rounded-xl border-2 border-border bg-background/75 p-3 shadow-sm";
	const priorityEventCategorySectionClassName = `${prioritySectionClassName} border-amber-300/20 bg-amber-100/20 dark:border-amber-600/20 dark:bg-orange-950/15`;
	const sectionTitleClassName =
		"text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground lg:text-[10px]";
	const hiddenScrollbarClassName =
		"[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";
	const denseToggleClassName =
		"h-7 w-full min-w-0 overflow-hidden justify-start border border-border/75 bg-background/68 text-xs text-foreground/90 hover:bg-accent data-[state=on]:bg-accent data-[state=on]:text-accent-foreground lg:text-[11px]";
	const regularToggleClassName =
		"h-8 w-full min-w-0 overflow-hidden justify-start border border-border/75 bg-background/68 text-xs text-foreground/90 hover:bg-accent data-[state=on]:bg-accent data-[state=on]:text-accent-foreground lg:text-[11px]";
	const eventCategoryToggleBaseClassName =
		"h-8 w-full min-w-0 overflow-hidden justify-start border bg-background/68 text-xs text-foreground/90 hover:bg-accent lg:text-[11px]";
	const getEventCategoryToggleClassName = (
		category: EventExperienceCategory,
		selected: boolean,
	): string => {
		if (!selected) return `${eventCategoryToggleBaseClassName} border-border/75`;

		switch (category) {
			case "party":
				return `${eventCategoryToggleBaseClassName} border-amber-500/35 bg-amber-500/10 text-amber-900 dark:border-amber-300/28 dark:bg-amber-300/12 dark:text-amber-100`;
			case "activity":
				return `${eventCategoryToggleBaseClassName} border-sky-500/35 bg-sky-500/10 text-sky-900 dark:border-sky-300/28 dark:bg-sky-300/12 dark:text-sky-100`;
			case "culture":
				return `${eventCategoryToggleBaseClassName} border-violet-500/35 bg-violet-500/10 text-violet-900 dark:border-violet-300/28 dark:bg-violet-300/12 dark:text-violet-100`;
			case "food":
				return `${eventCategoryToggleBaseClassName} border-emerald-500/35 bg-emerald-500/10 text-emerald-900 dark:border-emerald-300/28 dark:bg-emerald-300/12 dark:text-emerald-100`;
			case "wellness":
				return `${eventCategoryToggleBaseClassName} border-teal-500/35 bg-teal-500/10 text-teal-900 dark:border-teal-300/28 dark:bg-teal-300/12 dark:text-teal-100`;
			default:
				return `${eventCategoryToggleBaseClassName} border-border/75 bg-accent text-accent-foreground`;
		}
	};
	const compactRailSectionClassName =
		"space-y-2.5 rounded-lg border border-border/70 bg-background/58 p-2.5";
	const genreOptions = availableGenres ?? MUSIC_GENRES;
	const eventCategoryOptions = useMemo(
		() =>
			availableEventCategories.flatMap((category) => {
				const definition = getEventExperienceCategoryDefinition(category);
				return definition ? [definition] : [];
			}),
		[availableEventCategories],
	);
	const [genreSearchQuery, setGenreSearchQuery] = useState("");
	const activeFilterBadgeClassName =
		"h-7 gap-1 rounded-full border border-border/70 bg-background/72 px-2.5 text-xs font-normal shadow-none lg:text-[11px]";
	const compactActiveFilterBadgeClassName =
		"h-7 max-w-full gap-1 rounded-full border border-border/70 bg-background/80 px-2 text-xs font-normal shadow-none lg:text-[11px]";
	const activeFilterRemoveButtonClassName =
		"h-auto p-0 ml-1 text-muted-foreground hover:bg-transparent hover:text-foreground";
	const getGenreActiveFilterBadgeClassName = (
		mode: "include" | "exclude",
		compact: boolean,
	): string =>
		`${compact ? compactActiveFilterBadgeClassName : activeFilterBadgeClassName} ${
			mode === "include"
				? "border-emerald-500/35 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
				: "border-red-500/35 bg-red-500/10 text-red-800 dark:text-red-200"
		}`;
	const ooocPickHelp =
		"OOOC Picks are events highlighted by Out Of Office Collective as especially worth considering.";
	const eventCategoryHelp =
		"Event category classifies the listing type (party/activity/culture/food/wellness), while music genres describe what kind of music is playing. Only categories already present in the event data are shown here.";
	const hostNationalityHelp =
		"The country or cultural background associated with the event host or promoter. Selecting more than one means events must include all selected host nationalities.";
	const arrondissementHelp =
		"Arr. is short for arrondissement: Paris's numbered neighbourhood districts. Use it to narrow events by area.";
	const venueTypeHelp =
		"Venue type filters events by setting, such as indoor club spaces or outdoor/open-air locations.";
	const ageRangeHelp =
		"Age range primarily reflects the minimum allowed age for an event. It can also hint at the typical attendee age when organisers provide that context.";
	const genreModeLegend = (
		<div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground lg:text-[10px]">
			<span className="inline-flex items-center gap-1">
				<Check className="h-3 w-3 text-emerald-600 dark:text-emerald-300" />
				Include
			</span>
			<span className="inline-flex items-center gap-1">
				<X className="h-3 w-3 text-red-600 dark:text-red-300" />
				Exclude
			</span>
		</div>
	);

	// Stable accordion state for desktop compact mode
	const [openAccordionSections, setOpenAccordionSections] = useState<string[]>([
		"days",
		"types",
		"price",
	]);
	const desktopRailScrollRef = useRef<HTMLDivElement>(null);

	// Stable price range reset handler
	const resetPriceRange = useCallback(() => {
		haptics.warning();
		onPriceRangeChange(PRICE_RANGE_CONFIG.defaultRange);
	}, [haptics, onPriceRangeChange]);

	const toggleIncludeFreeOptions = useCallback(() => {
		haptics.selection();
		onIncludeFreeOptionsChange(!includeFreeOptions);
	}, [haptics, includeFreeOptions, onIncludeFreeOptionsChange]);

	// Stable age range reset handler
	const resetAgeRange = useCallback(() => {
		haptics.warning();
		onAgeRangeChange(null);
	}, [haptics, onAgeRangeChange]);

	const handleClearFilters = useCallback(() => {
		haptics.warning();
		onClearFilters();
	}, [haptics, onClearFilters]);

	const handleFilterSelection = useCallback(
		(action: () => void) => {
			haptics.selection();
			action();
		},
		[haptics],
	);
	const isFreeOnlyPriceRange =
		selectedPriceRange[0] === PRICE_RANGE_CONFIG.min &&
		selectedPriceRange[1] === PRICE_RANGE_CONFIG.min;
	const activeIncludeFreeOptions = isFreeOnlyPriceRange && includeFreeOptions;

	// Memoize the hasActiveFilters calculation
	const hasActiveFilters = useMemo(
		() =>
			hasActiveEventFilters(
				{
					selectedDateRange,
					selectedDayNightPeriods,
					selectedArrondissements,
					selectedGenres,
					excludedGenres,
					selectedEventCategories,
					selectedNationalities,
					selectedVenueTypes,
					selectedIndoorPreference,
					selectedPriceRange,
					includeFreeOptions: activeIncludeFreeOptions,
					selectedAgeRange,
					selectedOOOCPicks,
					searchQuery: "",
				},
				{
					defaultDateRange,
				},
			),
		[
			defaultDateRange,
			selectedDateRange,
			selectedDayNightPeriods,
			selectedArrondissements,
			selectedGenres,
			excludedGenres,
			selectedEventCategories,
			selectedNationalities,
			selectedVenueTypes,
			selectedIndoorPreference,
			selectedPriceRange,
			activeIncludeFreeOptions,
			selectedAgeRange,
			selectedOOOCPicks,
		],
	);

	// Memoize the active filter count
	const activeFilterCount = useMemo(
		() =>
			getActiveFiltersCount(
				{
					selectedDateRange,
					selectedDayNightPeriods,
					selectedArrondissements,
					selectedGenres,
					excludedGenres,
					selectedEventCategories,
					selectedNationalities,
					selectedVenueTypes,
					selectedIndoorPreference,
					selectedPriceRange,
					includeFreeOptions: activeIncludeFreeOptions,
					selectedAgeRange,
					selectedOOOCPicks,
					searchQuery: "",
				},
				{
					defaultDateRange,
				},
			),
		[
			defaultDateRange,
			selectedDateRange,
			selectedDayNightPeriods,
			selectedArrondissements,
			selectedGenres,
			excludedGenres,
			selectedEventCategories,
			selectedNationalities,
			selectedVenueTypes,
			selectedIndoorPreference,
			selectedPriceRange,
			activeIncludeFreeOptions,
			selectedAgeRange,
			selectedOOOCPicks,
		],
	);
	const filteredGenreOptions = useMemo(() => {
		const normalizedQuery = genreSearchQuery.trim().toLowerCase();
		if (!normalizedQuery) return genreOptions;

		return genreOptions.filter(({ key, label }) => {
			if (selectedGenres.includes(key) || excludedGenres.includes(key))
				return true;
			return (
				label.toLowerCase().includes(normalizedQuery) ||
				key.toLowerCase().includes(normalizedQuery)
			);
		});
	}, [excludedGenres, genreOptions, genreSearchQuery, selectedGenres]);
	const activeGenreFilters = useMemo(
		() => [
			...selectedGenres.map((genre) => ({
				genre,
				mode: "include" as const,
				genreLabel: genreOptions.find((g) => g.key === genre)?.label ?? genre,
			})),
			...excludedGenres.map((genre) => ({
				genre,
				mode: "exclude" as const,
				genreLabel: genreOptions.find((g) => g.key === genre)?.label ?? genre,
			})),
		],
		[excludedGenres, genreOptions, selectedGenres],
	);

	// Decision logic for UI variations
	const uiDecisions = useMemo(() => {
		return {
			// Keep a single consistent layout for easier scanning/reasoning.
			useAccordion: false,
			// Show active filters at top on mobile, bottom on desktop (unless many active)
			activeFiltersAtTop: activeFilterCount <= 5,
		};
	}, [activeFilterCount]);
	const isDesktopContentExpanded = isExpanded === undefined || isExpanded;

	useEffect(() => {
		setBodyOverlayAttribute(OVERLAY_BODY_ATTRIBUTE.FILTER_PANEL, isOpen);

		return () => {
			setBodyOverlayAttribute(OVERLAY_BODY_ATTRIBUTE.FILTER_PANEL, false);
		};
	}, [isOpen]);

	useEffect(() => {
		if (!isOpen || typeof window === "undefined") return;
		const isDesktopViewport = window.matchMedia("(min-width: 1024px)").matches;
		if (!forceDrawer && isDesktopViewport) return;

		const scrollY = window.scrollY;
		const { style } = document.body;
		const previousStyles = {
			overflow: style.overflow,
			position: style.position,
			top: style.top,
			width: style.width,
		};

		style.overflow = "hidden";
		style.position = "fixed";
		style.top = `-${scrollY}px`;
		style.width = "100%";

		return () => {
			style.overflow = previousStyles.overflow;
			style.position = previousStyles.position;
			style.top = previousStyles.top;
			style.width = previousStyles.width;
			window.scrollTo(0, scrollY);
		};
	}, [forceDrawer, isOpen]);

	useEffect(() => {
		if (!isDesktopContentExpanded) return;
		desktopRailScrollRef.current?.scrollTo({ top: 0 });
	}, [isDesktopContentExpanded]);

	const formatDateLabel = useCallback((isoDate: string) => {
		const parsed = new Date(`${isoDate}T12:00:00`);
		if (Number.isNaN(parsed.getTime())) return isoDate;
		return parsed.toLocaleDateString("en-GB", {
			weekday: "short",
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	}, []);

	const formatDateRangeLabel = useCallback(
		(dateRange: DateRangeFilter) => {
			if (dateRange.from && dateRange.to) {
				if (dateRange.from === dateRange.to)
					return formatDateLabel(dateRange.from);
				return `${formatDateLabel(dateRange.from)} - ${formatDateLabel(dateRange.to)}`;
			}
			if (dateRange.from) return `From ${formatDateLabel(dateRange.from)}`;
			if (dateRange.to) return `Until ${formatDateLabel(dateRange.to)}`;
			return "Any date";
		},
		[formatDateLabel],
	);

	const hasSelectedDateRange = !areDateRangesEqual(
		selectedDateRange,
		defaultDateRange,
	);
	const isUsingDefaultDateRange =
		!hasSelectedDateRange &&
		(defaultDateRange.from !== null || defaultDateRange.to !== null);
	const resetDateRangeToDefault = useCallback(() => {
		haptics.warning();
		onDateRangeChange(defaultDateRange);
	}, [defaultDateRange, haptics, onDateRangeChange]);

	const getDayNightLabel = useCallback((period: DayNightPeriod) => {
		return (
			DAY_NIGHT_PERIODS.find((item) => item.key === period)?.label ?? period
		);
	}, []);

	const getVenueTypeLabel = useCallback((venueType: VenueType) => {
		return (
			VENUE_TYPES.find((item) => item.key === venueType)?.label ?? venueType
		);
	}, []);

	const renderDayNightIcon = useCallback((period: DayNightPeriod) => {
		return period === "day" ? (
			<Sun className="h-3.5 w-3.5" />
		) : (
			<Moon className="h-3.5 w-3.5" />
		);
	}, []);

	const renderVenueTypeIcon = useCallback((venueType: VenueType) => {
		return venueType === "indoor" ? (
			<Building2 className="h-3.5 w-3.5" />
		) : (
			<Trees className="h-3.5 w-3.5" />
		);
	}, []);

	const renderDefaultDateRangeHint = () => {
		if (!isUsingDefaultDateRange) return null;

		return (
			<div className="rounded-lg border border-border/70 bg-muted/35 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground lg:text-[10px]">
				Showing this year&apos;s events by default. Older showcase events are
				still available if you widen the date range.
			</div>
		);
	};

	const renderRangeValueLabels = ({
		left,
		center,
		right,
	}: {
		left: string;
		center: string;
		right: string;
	}) => (
		<div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-xs text-muted-foreground lg:text-[11px]">
			<span className="min-w-0 truncate text-left">{left}</span>
			<span className="max-w-[9rem] truncate text-center font-medium text-foreground/78">
				{center}
			</span>
			<span className="min-w-0 truncate text-right">{right}</span>
		</div>
	);

	// Active Filters Component (reusable)
	const renderActiveFiltersDisplay = ({
		showHeading = true,
		compact = false,
		compactRows = "single",
	}: {
		showHeading?: boolean;
		compact?: boolean;
		compactRows?: "single" | "double";
	} = {}) => (
		<div
			className={`transition-opacity duration-200 ease-out ${
				hasActiveFilters
					? compact
						? "opacity-100"
						: "rounded-xl border border-border/70 bg-background/52 p-3 opacity-100"
					: "h-0 overflow-hidden opacity-0"
			}`}
		>
			{hasActiveFilters && (
				<>
					{showHeading && (
						<div className="mb-2 flex items-center justify-between gap-2">
							<div className="text-xs font-medium text-muted-foreground lg:text-[11px]">
								Active Filters ({activeFilterCount})
							</div>
							{isDesktopContentExpanded && (
								<ClearFiltersButton
									onClick={handleClearFilters}
									className="h-7 rounded-full px-3 text-xs lg:text-[11px]"
								>
									Clear
								</ClearFiltersButton>
							)}
							{!isDesktopContentExpanded && compact && (
								<div aria-hidden="true" className="h-7 w-[3.35rem] shrink-0" />
							)}
						</div>
					)}
					<div
						className={
							compact
								? compactRows === "double"
									? `flex max-h-[3.65rem] min-h-7 flex-wrap gap-1.5 overflow-y-auto pb-0.5 pr-1 ${hiddenScrollbarClassName} [&>*]:shrink-0`
									: "flex max-h-[3.65rem] min-h-7 min-w-0 flex-wrap gap-1.5 overflow-hidden"
								: "flex min-h-[28px] flex-wrap gap-2"
						}
					>
						{selectedOOOCPicks && (
							<Badge
								variant="secondary"
								className={
									compact
										? compactActiveFilterBadgeClassName
										: activeFilterBadgeClassName
								}
							>
								<Star className="h-3 w-3 mr-1 fill-yellow-400" />
								OOOC Picks
								<Button
									variant="ghost"
									size="sm"
									className={activeFilterRemoveButtonClassName}
									onClick={() =>
										handleFilterSelection(() => onOOOCPicksToggle(false))
									}
								>
									<X className="h-3 w-3" />
								</Button>
							</Badge>
						)}
						{hasSelectedDateRange && (
							<Badge
								variant="secondary"
								className={
									compact
										? compactActiveFilterBadgeClassName
										: activeFilterBadgeClassName
								}
							>
								<CalendarDays className="h-3 w-3 mr-1" />
								{formatDateRangeLabel(selectedDateRange)}
								<Button
									variant="ghost"
									size="sm"
									className={activeFilterRemoveButtonClassName}
									onClick={resetDateRangeToDefault}
								>
									<X className="h-3 w-3" />
								</Button>
							</Badge>
						)}
						{selectedDayNightPeriods.map((period) => (
							<Badge
								key={period}
								variant="secondary"
								className={
									compact
										? compactActiveFilterBadgeClassName
										: activeFilterBadgeClassName
								}
							>
								<span className="mr-1 inline-flex items-center text-muted-foreground">
									{renderDayNightIcon(period)}
								</span>
								{getDayNightLabel(period)}
								<Button
									variant="ghost"
									size="sm"
									className={activeFilterRemoveButtonClassName}
									onClick={() =>
										handleFilterSelection(() => onDayNightPeriodToggle(period))
									}
								>
									<X className="h-3 w-3" />
								</Button>
							</Badge>
						))}
						{selectedEventCategories.map((category) => {
							const categoryDefinition =
								getEventExperienceCategoryDefinition(category);
							const label = categoryDefinition?.label ?? category;
							return (
								<Badge
									key={category}
									variant="secondary"
									className={
										compact
											? compactActiveFilterBadgeClassName
											: activeFilterBadgeClassName
									}
								>
									{categoryDefinition?.key === "party" ? (
										<Clock className="mr-1 h-3 w-3" />
									) : (
										<Tag className="mr-1 h-3 w-3" />
									)}
									{label}
									<Button
										variant="ghost"
										size="sm"
										className={activeFilterRemoveButtonClassName}
										onClick={() =>
											handleFilterSelection(() =>
												onEventCategoryToggle(category),
											)
										}
									>
										<X className="h-3 w-3" />
									</Button>
								</Badge>
							);
						})}
						{selectedNationalities.map((nationality) => (
							<Badge
								key={nationality}
								variant="secondary"
								className={
									compact
										? compactActiveFilterBadgeClassName
										: activeFilterBadgeClassName
								}
							>
								{nationality}
								<Button
									variant="ghost"
									size="sm"
									className={activeFilterRemoveButtonClassName}
									onClick={() =>
										handleFilterSelection(() =>
											onNationalityToggle(nationality),
										)
									}
								>
									<X className="h-3 w-3" />
								</Button>
							</Badge>
						))}
						{selectedVenueTypes.map((venueType) => (
							<Badge
								key={venueType}
								variant="secondary"
								className={
									compact
										? compactActiveFilterBadgeClassName
										: activeFilterBadgeClassName
								}
							>
								<span className="mr-1 inline-flex items-center text-muted-foreground">
									{renderVenueTypeIcon(venueType)}
								</span>
								{getVenueTypeLabel(venueType)}
								<Button
									variant="ghost"
									size="sm"
									className={activeFilterRemoveButtonClassName}
									onClick={() =>
										handleFilterSelection(() => onVenueTypeToggle(venueType))
									}
								>
									<X className="h-3 w-3" />
								</Button>
							</Badge>
						))}
						{selectedIndoorPreference !== null && (
							<Badge
								variant="secondary"
								className={
									compact
										? compactActiveFilterBadgeClassName
										: activeFilterBadgeClassName
								}
							>
								<span className="mr-1 inline-flex items-center text-muted-foreground">
									{selectedIndoorPreference
										? renderVenueTypeIcon("indoor")
										: renderVenueTypeIcon("outdoor")}
								</span>
								{selectedIndoorPreference ? "Indoor" : "Outdoor"}
								<Button
									variant="ghost"
									size="sm"
									className={activeFilterRemoveButtonClassName}
									onClick={() =>
										handleFilterSelection(() => onIndoorPreferenceChange(null))
									}
								>
									<X className="h-3 w-3" />
								</Button>
							</Badge>
						)}
						{(selectedPriceRange[0] !== PRICE_RANGE_CONFIG.min ||
							selectedPriceRange[1] !== PRICE_RANGE_CONFIG.max) && (
							<Badge
								variant="secondary"
								className={
									compact
										? compactActiveFilterBadgeClassName
										: activeFilterBadgeClassName
								}
							>
								<Euro className="mr-1 h-3 w-3" />
								{formatPriceRange(selectedPriceRange)}
								<Button
									variant="ghost"
									size="sm"
									className={activeFilterRemoveButtonClassName}
									onClick={resetPriceRange}
								>
									<X className="h-3 w-3" />
								</Button>
							</Badge>
						)}
						{activeIncludeFreeOptions && (
							<Badge
								variant="secondary"
								className={
									compact
										? compactActiveFilterBadgeClassName
										: activeFilterBadgeClassName
								}
							>
								<Euro className="mr-1 h-3 w-3" />
								Free options
								<Button
									variant="ghost"
									size="sm"
									className={activeFilterRemoveButtonClassName}
									onClick={toggleIncludeFreeOptions}
								>
									<X className="h-3 w-3" />
								</Button>
							</Badge>
						)}
						{selectedAgeRange &&
							(selectedAgeRange[0] !== AGE_RANGE_CONFIG.min ||
								selectedAgeRange[1] !== AGE_RANGE_CONFIG.max) && (
								<Badge
									variant="secondary"
									className={
										compact
											? compactActiveFilterBadgeClassName
											: activeFilterBadgeClassName
									}
								>
									<Users className="mr-1 h-3 w-3" />
									{formatAgeRange(selectedAgeRange)}
									<Button
										variant="ghost"
										size="sm"
										className={activeFilterRemoveButtonClassName}
										onClick={resetAgeRange}
									>
										<X className="h-3 w-3" />
									</Button>
								</Badge>
							)}
						{selectedArrondissements.map((arr) => (
							<Badge
								key={arr}
								variant="secondary"
								className={
									compact
										? compactActiveFilterBadgeClassName
										: activeFilterBadgeClassName
								}
							>
								{formatLocationAreaShort(arr)}
								<Button
									variant="ghost"
									size="sm"
									className={activeFilterRemoveButtonClassName}
									onClick={() =>
										handleFilterSelection(() => onArrondissementToggle(arr))
									}
								>
									<X className="h-3 w-3" />
								</Button>
							</Badge>
						))}
						{activeGenreFilters
							.slice(0, 4)
							.map(({ genre, mode, genreLabel }) => (
								<Badge
									key={`${mode}-${genre}`}
									variant="secondary"
									className={getGenreActiveFilterBadgeClassName(mode, compact)}
									title={`${mode === "include" ? "Includes" : "Excludes"} ${genreLabel}`}
									aria-label={`${mode === "include" ? "Includes" : "Excludes"} ${genreLabel}`}
								>
									{mode === "include" ? (
										<Plus className="mr-1 h-3 w-3 text-emerald-600 dark:text-emerald-300" />
									) : (
										<Minus className="mr-1 h-3 w-3 text-red-600 dark:text-red-300" />
									)}
									{genreLabel}
									<Button
										variant="ghost"
										size="sm"
										aria-label={`Remove ${mode === "include" ? "included" : "excluded"} ${genreLabel} filter`}
										className={activeFilterRemoveButtonClassName}
										onClick={() =>
											handleFilterSelection(() =>
												mode === "include"
													? onGenreToggle(genre)
													: onGenreExcludeToggle(genre),
											)
										}
									>
										<X className="h-3 w-3" />
									</Button>
								</Badge>
							))}
						{activeGenreFilters.length > 4 && (
							<Badge
								variant="outline"
								className={
									compact
										? "h-7 shrink-0 rounded-full border-border/70 bg-background/60 px-2 text-xs font-normal lg:text-[11px]"
										: "h-7 rounded-full border-border/70 bg-background/60 px-2.5 text-xs font-normal lg:text-[11px]"
								}
							>
								+{activeGenreFilters.length - 4} more
							</Badge>
						)}
					</div>
				</>
			)}
		</div>
	);

	// Mobile floating button when closed - only show on mobile
	if (!isOpen) {
		return (
			<>
				{/* Mobile floating button */}
				{!hideFloatingButton && !localAppSettings.hideFloatingFilterButton && (
					<FilterButton
						id="tour-filter-button"
						onClickAction={() => {
							haptics.nudge();
							(isOpen ? onClose : onOpen)?.();
						}}
						hasActiveFilters={hasActiveFilters}
						activeFiltersCount={activeFilterCount}
						className="fixed bottom-[calc(env(safe-area-inset-bottom)+var(--oooc-mobile-nav-offset,1rem))] min-w-[8.25rem] rounded-full px-4 shadow-lg transition-[bottom] duration-300 ease-out lg:hidden"
						style={{
							zIndex: LAYERS.FLOATING_CONTROL + 1,
							right: "max(env(safe-area-inset-right), 1rem)",
						}}
						variant="outline"
						size="sm"
					/>
				)}

				{/* Desktop version - always visible */}
				<div id="tour-filter-panel" className="hidden lg:block">
					<Card
						id="tour-filter-rail"
						size="sm"
						className="ooo-site-card overflow-hidden py-0"
					>
						<CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 border-b border-border/70 py-4">
							<CardTitle className="flex min-w-0 items-center gap-2 whitespace-nowrap !text-[1.35rem] [font-family:var(--ooo-font-display)] font-light leading-none tracking-[0.01em]">
								<Filter
									className="h-5 w-5 shrink-0 text-muted-foreground/75"
									strokeWidth={1.6}
								/>
								Filters
								{hasActiveFilters && (
									<Badge
										variant="secondary"
										className="ml-2 border border-border/70 bg-secondary/72 text-xs lg:text-[11px]"
									>
										{activeFilterCount} active
									</Badge>
								)}
							</CardTitle>
							<div className="flex shrink-0 items-center gap-2">
								{hasActiveFilters && (
									<ClearFiltersButton
										onClick={handleClearFilters}
										className="h-7 px-2.5"
									/>
								)}
								{onToggleExpanded && (
									<Button
										variant="ghost"
										size="icon-sm"
										onClick={() => {
											haptics.nudge();
											onToggleExpanded();
										}}
										aria-label={
											isDesktopContentExpanded
												? "Collapse filters"
												: "Expand filters"
										}
										title={
											isDesktopContentExpanded
												? "Collapse filters"
												: "Expand filters"
										}
										className="h-8 w-8 rounded-full border border-border/70 bg-background/66 text-muted-foreground hover:bg-accent hover:text-foreground"
									>
										<ChevronDown
											className={`h-3.5 w-3.5 transition-transform transition-bouncy ${isDesktopContentExpanded ? "rotate-180" : "rotate-0"}`}
										/>
									</Button>
								)}
							</div>
						</CardHeader>

						<CardContent
							className={`motion-safe:transition-[max-height] motion-safe:duration-250 motion-safe:ease-out min-w-0 overflow-hidden relative py-3 ${
								isDesktopContentExpanded ? "max-h-[650px]" : "max-h-24"
							}`}
						>
							<div
								ref={desktopRailScrollRef}
								className={`h-[calc(650px-4rem)] min-w-0 overflow-x-hidden overflow-y-auto relative ${hiddenScrollbarClassName}`}
							>
								{/* Active Filters - Top when few filters */}
								{hasActiveFilters && uiDecisions.activeFiltersAtTop && (
									<div className="sticky top-0 z-10 -mx-1 border-b border-border/70 bg-card/95 px-1 pt-1.5 pb-1 backdrop-blur">
										{renderActiveFiltersDisplay({
											compact: true,
											compactRows: "single",
											showHeading: false,
										})}
									</div>
								)}

								<Accordion
									multiple
									value={openAccordionSections}
									onValueChange={(value) =>
										setOpenAccordionSections(value.filter(Boolean) as string[])
									}
									className="w-full space-y-1.5"
								>
									{/* Days & Times Section */}
									<AccordionItem value="days">
										<AccordionTrigger className="text-sm font-semibold uppercase tracking-[0.08em] text-foreground/86 hover:text-foreground transition-colors lg:text-[12px]">
											<span className="inline-flex items-center gap-1.5">
												<CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
												Date & Times
											</span>
											{(hasSelectedDateRange ||
												selectedDayNightPeriods.length > 0) && (
												<Badge
													variant="secondary"
													className="ml-2 border border-border/70 bg-secondary/72 text-xs lg:text-[11px]"
												>
													{(hasSelectedDateRange ? 1 : 0) +
														selectedDayNightPeriods.length}{" "}
													active
												</Badge>
											)}
										</AccordionTrigger>
										<AccordionContent>
											<div className={prioritySectionClassName}>
												{renderDefaultDateRangeHint()}
												{/* Day/Night Periods */}
												<div className={compactRailSectionClassName}>
													<div className="flex items-center justify-between mb-1">
														<h4 className={sectionTitleClassName}>
															Filter by Time
														</h4>
													</div>
													<div className="grid grid-cols-2 gap-1">
														{DAY_NIGHT_PERIODS.map(
															({ key, label, timeRange }) => (
																<Toggle
																	key={key}
																	pressed={selectedDayNightPeriods.includes(
																		key,
																	)}
																	onPressedChange={() =>
																		onDayNightPeriodToggle(key)
																	}
																	size="sm"
																	className={`${denseToggleClassName} justify-center`}
																	title={timeRange}
																>
																	<span className="inline-flex min-w-0 items-center gap-1">
																		<span className="shrink-0 text-muted-foreground">
																			{renderDayNightIcon(key)}
																		</span>
																		<span className="min-w-0 truncate">
																			{label}
																		</span>
																	</span>
																</Toggle>
															),
														)}
													</div>
												</div>

												<DateRangePickerControl
													selectedDateRange={selectedDateRange}
													defaultDateRange={defaultDateRange}
													onDateRangeChange={onDateRangeChange}
													availableEventDates={availableEventDates}
													quickSelectEventDates={quickSelectEventDates}
													formatDateLabel={formatDateLabel}
													formatDateRangeLabel={formatDateRangeLabel}
													sectionClassName={sectionClassName}
													sectionTitleClassName={sectionTitleClassName}
													denseToggleClassName={denseToggleClassName}
												/>
											</div>
										</AccordionContent>
									</AccordionItem>

									{/* Location Section */}
									<AccordionItem value="location">
										<AccordionTrigger className="text-sm font-semibold uppercase tracking-[0.08em] text-foreground/86 hover:text-foreground transition-colors lg:text-[12px]">
											Location
											{selectedArrondissements.length > 0 && (
												<Badge
													variant="secondary"
													className="ml-2 border border-border/70 bg-secondary/72 text-xs lg:text-[11px]"
												>
													{selectedArrondissements.length} active
												</Badge>
											)}
										</AccordionTrigger>
										<AccordionContent>
											<div className="space-y-3">
												<div className="flex items-center">
													<h3 className={sectionTitleClassName}>
														Location / Area
													</h3>
													<InfoPopover aria-label="Explain Paris arrondissement filters">
														{arrondissementHelp}
													</InfoPopover>
												</div>
												<div className="grid min-h-[5rem] grid-cols-3 gap-1.5 content-start">
													{availableArrondissements.map((arr) => {
														const locationLabel = formatLocationAreaShort(arr);
														const isWideLocation =
															arr === "greater-paris" ||
															arr === "outside-paris";

														return (
															<Toggle
																key={arr}
																pressed={selectedArrondissements.includes(arr)}
																onPressedChange={() =>
																	onArrondissementToggle(arr)
																}
																size="sm"
																className={`${denseToggleClassName} justify-center px-2 ${isWideLocation ? "col-span-2" : ""}`}
															>
																<span className="min-w-0 truncate">
																	{locationLabel}
																</span>
															</Toggle>
														);
													})}
												</div>
											</div>
										</AccordionContent>
									</AccordionItem>

									{/* Music & Culture Section */}
									<AccordionItem value="music">
										<AccordionTrigger className="text-sm font-semibold uppercase tracking-[0.08em] text-foreground/86 hover:text-foreground transition-colors lg:text-[12px]">
											Music & Culture
											{(activeGenreFilters.length > 0 ||
												selectedNationalities.length > 0) && (
												<Badge
													variant="secondary"
													className="ml-2 border border-border/70 bg-secondary/72 text-xs lg:text-[11px]"
												>
													{activeGenreFilters.length +
														selectedNationalities.length}{" "}
													active
												</Badge>
											)}
										</AccordionTrigger>
										<AccordionContent>
											<div className="space-y-4">
												{/* Music Genres */}
												<div>
													<h3 className={sectionTitleClassName}>
														Music Genres
													</h3>
													{genreModeLegend}
													<div className="relative mb-2 mt-2">
														<Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
														<Input
															type="search"
															value={genreSearchQuery}
															onChange={(event) =>
																setGenreSearchQuery(event.target.value)
															}
															placeholder="Search genres"
															className="h-8 rounded-md border-border/75 bg-background/68 pl-8 text-xs lg:text-[11px]"
															aria-label="Search music genres"
														/>
													</div>
													<div className="relative contain-layout">
														<div
															className={`grid min-h-[8rem] max-h-36 grid-cols-1 gap-1.5 overflow-y-auto rounded-md border border-border/70 bg-background/55 p-1.5 min-[1180px]:grid-cols-2 ${hiddenScrollbarClassName}`}
														>
															{filteredGenreOptions.map(
																({ key, label, color }) => {
																	const isIncluded =
																		selectedGenres.includes(key);
																	const isExcluded =
																		excludedGenres.includes(key);

																	return (
																		<div
																			key={key}
																			className="flex h-8 min-w-0 items-center gap-1 rounded-lg border border-border/75 bg-background/68 px-1.5 text-xs text-foreground/90 lg:text-[11px]"
																		>
																			<div
																				className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${color}`}
																			/>
																			<span className="min-w-0 flex-1 truncate">
																				{label}
																			</span>
																			<div className="ml-auto flex shrink-0 items-center gap-1">
																				<Button
																					type="button"
																					variant="ghost"
																					size="icon-xs"
																					aria-pressed={isIncluded}
																					aria-label={`Include ${label}`}
																					title={`Include ${label}`}
																					onClick={() =>
																						handleFilterSelection(() =>
																							onGenreToggle(key),
																						)
																					}
																					className={
																						isIncluded
																							? "border border-emerald-500/50 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
																							: "border border-transparent text-muted-foreground hover:border-emerald-500/35 hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-300"
																					}
																				>
																					<Check className="h-3 w-3" />
																				</Button>
																				<Button
																					type="button"
																					variant="ghost"
																					size="icon-xs"
																					aria-pressed={isExcluded}
																					aria-label={`Exclude ${label}`}
																					title={`Exclude ${label}`}
																					onClick={() =>
																						handleFilterSelection(() =>
																							onGenreExcludeToggle(key),
																						)
																					}
																					className={
																						isExcluded
																							? "border border-red-500/50 bg-red-500/15 text-red-700 hover:bg-red-500/20 dark:text-red-300"
																							: "border border-transparent text-muted-foreground hover:border-red-500/35 hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300"
																					}
																				>
																					<X className="h-3 w-3" />
																				</Button>
																			</div>
																		</div>
																	);
																},
															)}
															{filteredGenreOptions.length === 0 && (
																<p className="col-span-2 px-2 py-6 text-center text-xs text-muted-foreground lg:text-[11px]">
																	No genres found.
																</p>
															)}
														</div>
														<div className="absolute top-1.5 left-1.5 right-3 h-3 bg-gradient-to-b from-background/88 to-transparent pointer-events-none" />
														<div className="absolute bottom-5 left-1.5 right-3 h-5 bg-gradient-to-t from-background/90 to-transparent pointer-events-none" />
														<div className="mt-1 text-center text-[11px] text-muted-foreground/88 lg:text-[10px]">
															{genreSearchQuery.trim()
																? `${filteredGenreOptions.length} of ${genreOptions.length} genres`
																: `${genreOptions.length} genres`}
														</div>
													</div>
												</div>

												{/* Host Nationality */}
												<div>
													<div className="flex items-center">
														<h3 className={sectionTitleClassName}>
															Host nationality{" "}
															{selectedNationalities.length > 1 && (
																<span className="text-sm text-muted-foreground font-normal lg:text-[11px]">
																	(must INCLUDE)
																</span>
															)}
														</h3>
														<InfoPopover aria-label="Explain host nationality filters">
															{hostNationalityHelp}
														</InfoPopover>
													</div>
													<div className="grid grid-cols-2 gap-1.5 min-[1180px]:grid-cols-3">
														{availableNationalities.map(
															({ key, flag, shortCode }) => (
																<Toggle
																	key={key}
																	pressed={selectedNationalities.includes(key)}
																	onPressedChange={() =>
																		onNationalityToggle(key)
																	}
																	className={regularToggleClassName}
																	size="sm"
																>
																	<span className="mr-1.5 shrink-0 text-sm lg:text-xs">
																		{flag}
																	</span>
																	<span className="min-w-0 truncate text-xs lg:text-[11px]">
																		{shortCode}
																	</span>
																</Toggle>
															),
														)}
														{availableNationalities.length === 0 && (
															<p className="col-span-3 text-xs text-muted-foreground lg:text-[11px]">
																No country filters available.
															</p>
														)}
													</div>
												</div>
											</div>
										</AccordionContent>
									</AccordionItem>

									{/* Preferences Section */}
									<AccordionItem value="preferences">
										<AccordionTrigger className="text-sm font-semibold uppercase tracking-[0.08em] text-foreground/86 hover:text-foreground transition-colors lg:text-[12px]">
											Preferences
											{(selectedVenueTypes.length > 0 ||
												selectedIndoorPreference !== null ||
												selectedPriceRange[0] !== PRICE_RANGE_CONFIG.min ||
												selectedPriceRange[1] !== PRICE_RANGE_CONFIG.max ||
												activeIncludeFreeOptions ||
												selectedAgeRange !== null ||
												selectedEventCategories.length > 0 ||
												selectedOOOCPicks) && (
												<Badge
													variant="secondary"
													className="ml-2 border border-border/70 bg-secondary/72 text-xs lg:text-[11px]"
												>
													{
														[
															selectedVenueTypes.length > 0,
															selectedIndoorPreference !== null,
															selectedPriceRange[0] !==
																PRICE_RANGE_CONFIG.min ||
																selectedPriceRange[1] !==
																	PRICE_RANGE_CONFIG.max,
															activeIncludeFreeOptions,
															selectedAgeRange !== null,
															selectedEventCategories.length > 0,
															selectedOOOCPicks,
														].filter(Boolean).length
													}{" "}
													active
												</Badge>
											)}
										</AccordionTrigger>
										<AccordionContent>
											<div className="space-y-4">
												{eventCategoryOptions.length > 0 && (
													<div
														className={priorityEventCategorySectionClassName}
													>
														<div className="flex items-center">
															<h3 className={sectionTitleClassName}>
																<span className="inline-flex items-center gap-1.5">
																	<Tag className="h-3.5 w-3.5" />
																	Event Category
																</span>
															</h3>
															<InfoPopover aria-label="Explain event category filters">
																{eventCategoryHelp}
															</InfoPopover>
														</div>
														<p className="text-[11px] leading-relaxed text-muted-foreground">
															Event category is the listing type (not music
															genres). Use it to separate party-style events
															from activities, food, culture, or wellness
															experiences.
														</p>
														<div className="grid grid-cols-1 gap-1.5 min-[1180px]:grid-cols-2">
															{eventCategoryOptions.map((category) => {
																const selected =
																	selectedEventCategories.includes(category.key);

																return (
																	<Toggle
																		key={category.key}
																		pressed={selected}
																		onPressedChange={() =>
																			handleFilterSelection(() =>
																				onEventCategoryToggle(category.key),
																			)
																		}
																		className={getEventCategoryToggleClassName(
																			category.key,
																			selected,
																		)}
																		size="sm"
																		title={category.description}
																	>
																		<span className="inline-flex min-w-0 items-center gap-1 text-xs lg:text-[11px]">
																			{category.key === "party" ? (
																				<Clock className="h-3.5 w-3.5 shrink-0 opacity-75" />
																			) : (
																				<Tag className="h-3.5 w-3.5 shrink-0 opacity-75" />
																			)}
																			<span className="min-w-0 truncate">
																				{category.label}
																			</span>
																		</span>
																	</Toggle>
																);
															})}
														</div>
													</div>
												)}

												{/* OOOC Picks */}
												<div className="space-y-2">
													<div className="flex items-center">
														<h3 className={sectionTitleClassName}>
															OOOC Picks
														</h3>
														<InfoPopover aria-label="Explain OOOC Picks">
															{ooocPickHelp}
														</InfoPopover>
													</div>
													<Toggle
														pressed={selectedOOOCPicks}
														onPressedChange={(pressed) =>
															handleFilterSelection(() =>
																onOOOCPicksToggle(pressed),
															)
														}
														className={denseToggleClassName}
														size="sm"
													>
														<Star className="h-3.5 w-3.5 mr-1.5 shrink-0 fill-yellow-400" />
														<span className="min-w-0 truncate text-xs lg:text-[11px]">
															Show only OOOC Picks
														</span>
													</Toggle>
												</div>

												{/* Venue Type */}
												<div>
													<div className="flex items-center">
														<h3 className={sectionTitleClassName}>
															Venue Type
														</h3>
														<InfoPopover aria-label="Explain venue type filters">
															{venueTypeHelp}
														</InfoPopover>
													</div>
													<div className="grid grid-cols-1 gap-1.5 min-[1180px]:grid-cols-2">
														{VENUE_TYPES.map(({ key, label }) => (
															<Toggle
																key={key}
																pressed={selectedVenueTypes.includes(key)}
																onPressedChange={() =>
																	handleFilterSelection(() =>
																		onVenueTypeToggle(key),
																	)
																}
																className={regularToggleClassName}
																size="sm"
															>
																<span className="inline-flex min-w-0 items-center gap-1 text-xs lg:text-[11px]">
																	<span className="shrink-0 text-muted-foreground">
																		{renderVenueTypeIcon(key)}
																	</span>
																	<span className="min-w-0 truncate">
																		{label}
																	</span>
																</span>
															</Toggle>
														))}
													</div>
												</div>

												{/* Price Range */}
												<div className="space-y-2">
													<h3 className={sectionTitleClassName}>Price Range</h3>
													<div className="space-y-2 px-1">
														<Slider
															value={selectedPriceRange}
															onValueChange={(value) =>
																onPriceRangeChange(value as [number, number])
															}
															min={PRICE_RANGE_CONFIG.min}
															max={PRICE_RANGE_CONFIG.max}
															step={PRICE_RANGE_CONFIG.step}
															className="w-full"
															aria-label="Price range filter"
														/>
														{renderRangeValueLabels({
															left: `€${PRICE_RANGE_CONFIG.min}`,
															center: formatPriceRange(selectedPriceRange),
															right: `€${PRICE_RANGE_CONFIG.max}+`,
														})}
														{isFreeOnlyPriceRange && (
															<button
																type="button"
																role="switch"
																aria-checked={activeIncludeFreeOptions}
																onClick={toggleIncludeFreeOptions}
																className="flex w-full items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/65 px-3 py-2 text-left text-xs text-foreground/85 transition-colors hover:bg-accent/60 lg:text-[11px]"
															>
																<span className="min-w-0">
																	<span className="block font-medium">
																		Include free options
																	</span>
																	<span className="block text-muted-foreground">
																		Free RSVP, free-before, or free-to-paid
																		ranges
																	</span>
																</span>
																<span
																	className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
																		activeIncludeFreeOptions
																			? "bg-emerald-500"
																			: "bg-muted-foreground/30"
																	}`}
																	aria-hidden="true"
																>
																	<span
																		className={`absolute size-4 rounded-full bg-background shadow-sm transition-transform ${
																			activeIncludeFreeOptions
																				? "translate-x-4"
																				: "translate-x-0.5"
																		}`}
																	/>
																</span>
															</button>
														)}
														{(selectedPriceRange[0] !==
															PRICE_RANGE_CONFIG.min ||
															selectedPriceRange[1] !==
																PRICE_RANGE_CONFIG.max) && (
															<div className="flex justify-center">
																<Button
																	variant="ghost"
																	size="sm"
																	onClick={resetPriceRange}
																	className="h-7 rounded-full border border-border/70 px-3 text-xs text-foreground/80 hover:bg-accent lg:text-[11px]"
																>
																	Clear price filter
																</Button>
															</div>
														)}
													</div>
												</div>

												{/* Age Range */}
												<div className="space-y-2">
													<div className="flex items-center">
														<h3 className={sectionTitleClassName}>Age Range</h3>
														<InfoPopover aria-label="Explain age range filters">
															{ageRangeHelp}
														</InfoPopover>
													</div>
													<div className="space-y-2 px-1">
														<Slider
															value={
																selectedAgeRange ||
																AGE_RANGE_CONFIG.defaultRange
															}
															onValueChange={(value) =>
																onAgeRangeChange(value as [number, number])
															}
															min={AGE_RANGE_CONFIG.min}
															max={AGE_RANGE_CONFIG.max}
															step={AGE_RANGE_CONFIG.step}
															className="w-full"
															aria-label="Age range filter"
														/>
														{renderRangeValueLabels({
															left: `${AGE_RANGE_CONFIG.min} or less`,
															center: selectedAgeRange
																? formatAgeRange(selectedAgeRange)
																: "All ages",
															right: `${AGE_RANGE_CONFIG.max}+`,
														})}
														{selectedAgeRange && (
															<div className="flex justify-center">
																<Button
																	variant="ghost"
																	size="sm"
																	onClick={resetAgeRange}
																	className="h-7 rounded-full border border-border/70 px-3 text-xs text-foreground/80 hover:bg-accent lg:text-[11px]"
																>
																	Clear age filter
																</Button>
															</div>
														)}
													</div>
												</div>
											</div>
										</AccordionContent>
									</AccordionItem>
								</Accordion>

								{/* Active Filters - Bottom when many filters */}
								{hasActiveFilters &&
									!uiDecisions.activeFiltersAtTop &&
									renderActiveFiltersDisplay({
										compact: true,
										compactRows: "double",
									})}

								<div className="mt-2 text-center text-[11px] text-muted-foreground/80 lg:text-[10px]">
									Showing {filteredEventsCount} matching event
									{filteredEventsCount !== 1 ? "s" : ""}.
								</div>
							</div>
							{!isDesktopContentExpanded && (
								<div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex h-20 items-end justify-center bg-gradient-to-t from-card via-card/96 to-card/10 pb-3">
									<p className="text-[11px] tracking-[0.04em] text-muted-foreground/92 lg:text-[10px]">
										Expand filters to refine the view
									</p>
								</div>
							)}
						</CardContent>
					</Card>
				</div>
			</>
		);
	}

	const openPanel = (
		<div
			className={`fixed inset-0 overscroll-none bg-black/45 backdrop-blur-[2px] ${
				forceDrawer ? "" : "lg:static lg:bg-transparent lg:z-auto"
			}`}
			style={{
				zIndex: LAYERS.OVERLAY,
				paddingRight: "env(safe-area-inset-right)",
				paddingLeft: "env(safe-area-inset-left)",
			}}
			onPointerDown={(pointerEvent) => {
				if (pointerEvent.target !== pointerEvent.currentTarget) return;
				onClose();
			}}
		>
			<div
				id="tour-filter-panel"
				className={`absolute right-0 top-0 h-full w-full max-w-sm border-l border-border/70 bg-background/97 ${
					forceDrawer ? "" : "lg:static lg:h-fit lg:max-w-none lg:border-l-0"
				}`}
			>
				<Card
					className={`ooo-site-card flex h-full flex-col border-0 py-0 ${
						forceDrawer ? "" : "lg:h-fit lg:border"
					}`}
				>
					<CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 border-b border-border/70 py-5">
						<CardTitle className="flex min-w-0 items-center gap-2 whitespace-nowrap text-[1.5rem] [font-family:var(--ooo-font-display)] font-light leading-none tracking-[0.01em]">
							<Filter
								className="h-5.5 w-5.5 shrink-0 text-muted-foreground/75"
								strokeWidth={1.6}
							/>
							Filters
							{hasActiveFilters && (
								<Badge
									variant="secondary"
									className="ml-2 hidden border border-border/70 bg-secondary/72 text-xs lg:inline-flex"
								>
									{activeFilterCount} active
								</Badge>
							)}
							<Badge
								variant="outline"
								className="ml-2 hidden border-border/70 bg-background/52 text-xs"
							>
								{filteredEventsCount} result
								{filteredEventsCount !== 1 ? "s" : ""}
							</Badge>
						</CardTitle>
						<div className="flex shrink-0 items-center gap-2">
							{hasActiveFilters && (
								<ClearFiltersButton
									onClick={handleClearFilters}
									className="hidden h-7 px-2.5 lg:inline-flex"
								/>
							)}
							<Button
								variant="outline"
								size="icon"
								onClick={() => {
									haptics.light();
									onClose();
								}}
								className={`h-8 w-8 rounded-full border-border/70 bg-background/70 hover:bg-accent ${
									forceDrawer ? "" : "lg:hidden"
								}`}
							>
								<X className="h-4 w-4" />
							</Button>
						</div>
					</CardHeader>

					{hasActiveFilters && (
						<div className="border-b border-border/70 bg-card/72 px-4 py-2.5 lg:hidden">
							<div className="flex items-center justify-between gap-3">
								<div className="min-w-0">
									<p className="text-xs font-medium text-foreground/88">
										{activeFilterCount} active filter
										{activeFilterCount !== 1 ? "s" : ""}
										<span className="mx-1.5 text-muted-foreground/50">/</span>
										<span className="font-normal text-muted-foreground">
											{filteredEventsCount} result
											{filteredEventsCount !== 1 ? "s" : ""}
										</span>
									</p>
								</div>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={handleClearFilters}
									className="h-7 shrink-0 rounded-full border border-dashed border-border/70 px-3 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
								>
									Clear
								</Button>
							</div>
							<div className="mt-1.5">
								{renderActiveFiltersDisplay({
									showHeading: false,
									compact: true,
								})}
							</div>
						</div>
					)}

					<CardContent
						className={`min-h-0 flex-1 touch-pan-y space-y-6 overscroll-y-contain overflow-y-auto py-4 ${hiddenScrollbarClassName} ${
							forceDrawer ? "" : "lg:overflow-y-visible"
						}`}
					>
						{/* Active Filters - Top on desktop when few filters */}
						{uiDecisions.activeFiltersAtTop && (
							<div className="hidden lg:block">
								{renderActiveFiltersDisplay()}
							</div>
						)}

						{/* Conditional Layout: Accordion vs Expanded */}
						{uiDecisions.useAccordion ? (
							// Accordion Layout for Desktop when space is needed
							<div className="hidden lg:block">
								<Accordion
									multiple
									value={openAccordionSections}
									onValueChange={(value) =>
										setOpenAccordionSections(value.filter(Boolean) as string[])
									}
									className="w-full"
								>
									<AccordionItem value="days">
										<AccordionTrigger className="text-base font-semibold hover:text-primary transition-colors">
											<span className="inline-flex items-center gap-1.5">
												<CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
												Date & Times
											</span>
											{(hasSelectedDateRange ||
												selectedDayNightPeriods.length > 0) && (
												<Badge
													variant="secondary"
													className="ml-2 border border-border/70 bg-secondary/72 text-xs"
												>
													{(hasSelectedDateRange ? 1 : 0) +
														selectedDayNightPeriods.length}
												</Badge>
											)}
										</AccordionTrigger>
										<AccordionContent>
											{/* Compact Days Section for Accordion */}
											<div className={prioritySectionClassName}>
												{renderDefaultDateRangeHint()}
												{/* Day/Night Periods */}
												<div className="p-1.5 bg-muted/20 rounded-md border overflow-hidden">
													<div className="flex items-center justify-between mb-1">
														<h4 className="text-xs font-medium truncate">
															Filter by Time
														</h4>
													</div>
													<div className="grid grid-cols-2 gap-1">
														{DAY_NIGHT_PERIODS.map(
															({ key, label, timeRange }) => (
																<Toggle
																	key={key}
																	pressed={selectedDayNightPeriods.includes(
																		key,
																	)}
																	onPressedChange={() =>
																		onDayNightPeriodToggle(key)
																	}
																	size="sm"
																	className="text-xs px-1.5 py-1 sm:px-2 flex-1 justify-center min-w-0 truncate"
																	title={timeRange}
																>
																	<span className="inline-flex items-center gap-1">
																		<span className="text-muted-foreground">
																			{renderDayNightIcon(key)}
																		</span>
																		<span>{label}</span>
																	</span>
																</Toggle>
															),
														)}
													</div>
												</div>

												<DateRangePickerControl
													selectedDateRange={selectedDateRange}
													defaultDateRange={defaultDateRange}
													onDateRangeChange={onDateRangeChange}
													availableEventDates={availableEventDates}
													quickSelectEventDates={quickSelectEventDates}
													formatDateLabel={formatDateLabel}
													formatDateRangeLabel={formatDateRangeLabel}
													sectionClassName={sectionClassName}
													sectionTitleClassName={sectionTitleClassName}
													denseToggleClassName={denseToggleClassName}
												/>
											</div>
										</AccordionContent>
									</AccordionItem>
									{/* Add other accordion sections here when needed */}
								</Accordion>
							</div>
						) : (
							// Expanded Layout (Mobile always, Desktop when space allows)
							<div className="space-y-6 lg:space-y-4">
								{/* Days & Times */}
								<div className={prioritySectionClassName}>
									<div className="flex items-center mb-3">
										<div className="inline-flex items-center gap-1.5">
											<CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
											<h3 className={sectionTitleClassName}>Date & Times</h3>
										</div>
										<InfoPopover
											aria-label="Show day and night time definitions"
											contentClassName="space-y-1.5"
										>
											<p className="inline-flex items-center gap-1.5">
												<strong>Day:</strong> 6:00 AM - 9:59 PM
												<Sun className="h-3.5 w-3.5" />
											</p>
											<p className="inline-flex items-center gap-1.5">
												<strong>Night:</strong> 10:00 PM - 5:59 AM
												<Moon className="h-3.5 w-3.5" />
											</p>
										</InfoPopover>
									</div>

									<div className="space-y-2">
										{renderDefaultDateRangeHint()}
										{/* Day/Night Periods */}
										<div className={sectionClassName}>
											<div className="flex items-center justify-between mb-2">
												<h4 className={sectionTitleClassName}>
													Filter by Time
												</h4>
											</div>
											<div className="grid grid-cols-2 gap-2">
												{DAY_NIGHT_PERIODS.map(({ key, label, timeRange }) => (
													<Toggle
														key={key}
														pressed={selectedDayNightPeriods.includes(key)}
														onPressedChange={() =>
															handleFilterSelection(() =>
																onDayNightPeriodToggle(key),
															)
														}
														size="sm"
														className={regularToggleClassName}
														title={timeRange}
													>
														<span className="inline-flex items-center gap-1">
															<span className="text-muted-foreground">
																{renderDayNightIcon(key)}
															</span>
															<span>{label}</span>
														</span>
													</Toggle>
												))}
											</div>
										</div>

										<DateRangePickerControl
											mobileNative
											selectedDateRange={selectedDateRange}
											defaultDateRange={defaultDateRange}
											onDateRangeChange={onDateRangeChange}
											availableEventDates={availableEventDates}
											quickSelectEventDates={quickSelectEventDates}
											formatDateLabel={formatDateLabel}
											formatDateRangeLabel={formatDateRangeLabel}
											sectionClassName={sectionClassName}
											sectionTitleClassName={sectionTitleClassName}
											denseToggleClassName={denseToggleClassName}
										/>
									</div>
								</div>

								{/* Event Category */}
								{eventCategoryOptions.length > 0 && (
									<div className={priorityEventCategorySectionClassName}>
										<div className="flex items-center">
											<h3 className={sectionTitleClassName}>
												<span className="inline-flex items-center gap-1.5">
													<Tag className="h-3.5 w-3.5" />
													Event Category
												</span>
											</h3>
											<InfoPopover aria-label="Explain event category filters">
												{eventCategoryHelp}
											</InfoPopover>
										</div>
										<p className="text-xs leading-relaxed text-muted-foreground lg:text-[11px]">
											Event category is the listing type (not music genres). Use
											it to separate party-style events from activities, food,
											culture, or wellness experiences.
										</p>
										<div className="grid grid-cols-2 gap-1">
											{eventCategoryOptions.map((category) => {
												const selected = selectedEventCategories.includes(
													category.key,
												);

												return (
													<Toggle
														key={category.key}
														pressed={selected}
														onPressedChange={() =>
															handleFilterSelection(() =>
																onEventCategoryToggle(category.key),
															)
														}
														className={getEventCategoryToggleClassName(
															category.key,
															selected,
														)}
														size="sm"
														title={category.description}
													>
														<span className="inline-flex min-w-0 items-center gap-1 text-xs">
															{category.key === "party" ? (
																<Clock className="h-3.5 w-3.5 shrink-0 opacity-75" />
															) : (
																<Tag className="h-3.5 w-3.5 shrink-0 opacity-75" />
															)}
															<span className="min-w-0 truncate">
																{category.label}
															</span>
														</span>
													</Toggle>
												);
											})}
										</div>
									</div>
								)}

								{/* OOOC Picks */}
								<div className={sectionClassName}>
									<div className="flex items-center">
										<h3 className={sectionTitleClassName}>OOOC Picks</h3>
										<InfoPopover aria-label="Explain OOOC Picks">
											{ooocPickHelp}
										</InfoPopover>
									</div>
									<Toggle
										pressed={selectedOOOCPicks}
										onPressedChange={(pressed) =>
											handleFilterSelection(() => onOOOCPicksToggle(pressed))
										}
										className={regularToggleClassName}
										size="sm"
									>
										<Star className="h-4 w-4 mr-2 fill-yellow-400" />
										<span className="text-xs">Show only OOOC Picks</span>
									</Toggle>
								</div>

								{/* Venue Type */}
								<div className={sectionClassName}>
									<div className="flex items-center">
										<h3 className={sectionTitleClassName}>Venue Type</h3>
										<InfoPopover aria-label="Explain venue type filters">
											{venueTypeHelp}
										</InfoPopover>
									</div>
									<div className="grid grid-cols-2 gap-1">
										{VENUE_TYPES.map(({ key, label }) => (
											<Toggle
												key={key}
												pressed={selectedVenueTypes.includes(key)}
												onPressedChange={() =>
													handleFilterSelection(() => onVenueTypeToggle(key))
												}
												className={regularToggleClassName}
												size="sm"
											>
												<span className="inline-flex items-center gap-1 text-xs">
													<span className="text-muted-foreground">
														{renderVenueTypeIcon(key)}
													</span>
													<span>{label}</span>
												</span>
											</Toggle>
										))}
									</div>
								</div>

								{/* Host Nationality */}
								<div className={sectionClassName}>
									<div className="flex items-center">
										<h3 className={sectionTitleClassName}>
											Host nationality{" "}
											{selectedNationalities.length > 1 && (
												<span className="text-sm text-muted-foreground font-normal">
													(must INCLUDE)
												</span>
											)}
										</h3>
										<InfoPopover aria-label="Explain host nationality filters">
											{hostNationalityHelp}
										</InfoPopover>
									</div>
									<div className="grid grid-cols-3 gap-1">
										{availableNationalities.map(({ key, flag, shortCode }) => (
											<Toggle
												key={key}
												pressed={selectedNationalities.includes(key)}
												onPressedChange={() =>
													handleFilterSelection(() => onNationalityToggle(key))
												}
												className={regularToggleClassName}
												size="sm"
											>
												<span className="mr-1.5 text-sm">{flag}</span>
												<span className="text-xs">{shortCode}</span>
											</Toggle>
										))}
										{availableNationalities.length === 0 && (
											<p className="col-span-3 text-xs text-muted-foreground">
												No country filters available.
											</p>
										)}
									</div>
								</div>

								{/* Price Range */}
								<div className={sectionClassName}>
									<h3 className={sectionTitleClassName}>Price Range</h3>
									<div className="space-y-2 px-1">
										<Slider
											value={selectedPriceRange}
											onValueChange={(value) =>
												onPriceRangeChange(value as [number, number])
											}
											min={PRICE_RANGE_CONFIG.min}
											max={PRICE_RANGE_CONFIG.max}
											step={PRICE_RANGE_CONFIG.step}
											className="w-full"
											aria-label="Price range filter"
										/>
										{renderRangeValueLabels({
											left: `€${PRICE_RANGE_CONFIG.min}`,
											center: formatPriceRange(selectedPriceRange),
											right: `€${PRICE_RANGE_CONFIG.max}+`,
										})}
										{isFreeOnlyPriceRange && (
											<button
												type="button"
												role="switch"
												aria-checked={activeIncludeFreeOptions}
												onClick={toggleIncludeFreeOptions}
												className="flex w-full items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/65 px-3 py-2 text-left text-xs text-foreground/85 transition-colors hover:bg-accent/60"
											>
												<span className="min-w-0">
													<span className="block font-medium">
														Include free options
													</span>
													<span className="block text-muted-foreground">
														Free RSVP, free-before, or free-to-paid ranges
													</span>
												</span>
												<span
													className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
														activeIncludeFreeOptions
															? "bg-emerald-500"
															: "bg-muted-foreground/30"
													}`}
													aria-hidden="true"
												>
													<span
														className={`absolute size-4 rounded-full bg-background shadow-sm transition-transform ${
															activeIncludeFreeOptions
																? "translate-x-4"
																: "translate-x-0.5"
														}`}
													/>
												</span>
											</button>
										)}
										{(selectedPriceRange[0] !== PRICE_RANGE_CONFIG.min ||
											selectedPriceRange[1] !== PRICE_RANGE_CONFIG.max) && (
											<div className="flex justify-center">
												<Button
													variant="ghost"
													size="sm"
													onClick={resetPriceRange}
													className="h-7 rounded-full border border-border/70 px-3 text-xs text-foreground/80 hover:bg-accent"
												>
													Clear price filter
												</Button>
											</div>
										)}
									</div>
								</div>

								{/* Age Range */}
								<div className={sectionClassName}>
									<div className="flex items-center">
										<h3 className={sectionTitleClassName}>Age Range</h3>
										<InfoPopover aria-label="Explain age range filters">
											{ageRangeHelp}
										</InfoPopover>
									</div>
									<div className="space-y-2 px-1">
										<Slider
											value={selectedAgeRange || AGE_RANGE_CONFIG.defaultRange}
											onValueChange={(value) =>
												onAgeRangeChange(value as [number, number])
											}
											min={AGE_RANGE_CONFIG.min}
											max={AGE_RANGE_CONFIG.max}
											step={AGE_RANGE_CONFIG.step}
											className="w-full"
											aria-label="Age range filter"
										/>
										{renderRangeValueLabels({
											left: `${AGE_RANGE_CONFIG.min} or less`,
											center: selectedAgeRange
												? formatAgeRange(selectedAgeRange)
												: "All ages",
											right: `${AGE_RANGE_CONFIG.max}+`,
										})}
										{selectedAgeRange && (
											<div className="flex justify-center">
												<Button
													variant="ghost"
													size="sm"
													onClick={resetAgeRange}
													className="h-7 rounded-full border border-border/70 px-3 text-xs text-foreground/80 hover:bg-accent"
												>
													Clear age filter
												</Button>
											</div>
										)}
									</div>
								</div>

								{/* Music Genres */}
								<div className={sectionClassName}>
									<h3 className={sectionTitleClassName}>Music Genres</h3>
									{genreModeLegend}
									<div className="relative mb-2">
										<Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
										<Input
											type="search"
											value={genreSearchQuery}
											onChange={(event) =>
												setGenreSearchQuery(event.target.value)
											}
											placeholder="Search genres"
											className="h-8 rounded-md border-border/75 bg-background/68 pl-8 text-xs"
											aria-label="Search music genres"
										/>
									</div>
									<div className="relative contain-layout">
										<div
											className={`grid grid-cols-2 gap-1 max-h-48 min-h-[12rem] overflow-y-auto rounded-md border border-border/70 bg-background/55 p-2 ${hiddenScrollbarClassName}`}
										>
											{filteredGenreOptions.map(({ key, label, color }) => {
												const isIncluded = selectedGenres.includes(key);
												const isExcluded = excludedGenres.includes(key);

												return (
													<div
														key={key}
														className="flex h-8 min-w-0 items-center gap-1 rounded-lg border border-border/75 bg-background/68 px-1.5 text-xs text-foreground/90"
													>
														<div
															className={`h-2 w-2 flex-shrink-0 rounded-full ${color}`}
														/>
														<span className="min-w-0 flex-1 truncate">
															{label}
														</span>
														<div className="ml-auto flex shrink-0 items-center gap-1">
															<Button
																type="button"
																variant="ghost"
																size="icon-xs"
																aria-pressed={isIncluded}
																aria-label={`Include ${label}`}
																title={`Include ${label}`}
																onClick={() =>
																	handleFilterSelection(() =>
																		onGenreToggle(key),
																	)
																}
																className={
																	isIncluded
																		? "border border-emerald-500/50 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
																		: "border border-transparent text-muted-foreground hover:border-emerald-500/35 hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-300"
																}
															>
																<Check className="h-3 w-3" />
															</Button>
															<Button
																type="button"
																variant="ghost"
																size="icon-xs"
																aria-pressed={isExcluded}
																aria-label={`Exclude ${label}`}
																title={`Exclude ${label}`}
																onClick={() =>
																	handleFilterSelection(() =>
																		onGenreExcludeToggle(key),
																	)
																}
																className={
																	isExcluded
																		? "border border-red-500/50 bg-red-500/15 text-red-700 hover:bg-red-500/20 dark:text-red-300"
																		: "border border-transparent text-muted-foreground hover:border-red-500/35 hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300"
																}
															>
																<X className="h-3 w-3" />
															</Button>
														</div>
													</div>
												);
											})}
											{filteredGenreOptions.length === 0 && (
												<p className="col-span-2 px-2 py-8 text-center text-xs text-muted-foreground">
													No genres found.
												</p>
											)}
										</div>
										<div className="absolute top-2 left-2 right-3 h-3 bg-gradient-to-b from-background/88 to-transparent pointer-events-none" />
										<div className="absolute bottom-6 left-2 right-3 h-5 bg-gradient-to-t from-background/90 to-transparent pointer-events-none" />
										<div className="mt-1 h-4 text-center text-xs text-muted-foreground/88">
											{genreSearchQuery.trim()
												? `${filteredGenreOptions.length} of ${genreOptions.length} genres`
												: `${genreOptions.length} genres`}
										</div>
									</div>
								</div>

								{/* Arrondissements */}
								<div className={sectionClassName}>
									<div className="flex items-center">
										<h3 className={sectionTitleClassName}>Location / Area</h3>
										<InfoPopover aria-label="Explain Paris arrondissement filters">
											{arrondissementHelp}
										</InfoPopover>
									</div>
									<div className="grid grid-cols-4 gap-1 min-h-[7rem] content-start lg:grid-cols-5">
										{availableArrondissements.map((arr) => {
											const locationLabel = formatLocationAreaShort(arr);
											const isWideLocation =
												arr === "greater-paris" || arr === "outside-paris";

											return (
												<Toggle
													key={arr}
													pressed={selectedArrondissements.includes(arr)}
													onPressedChange={() =>
														handleFilterSelection(() =>
															onArrondissementToggle(arr),
														)
													}
													size="sm"
													className={`${denseToggleClassName} ${isWideLocation ? "col-span-2" : ""}`}
												>
													<span className="min-w-0 truncate">
														{locationLabel}
													</span>
												</Toggle>
											);
										})}
									</div>
								</div>
							</div>
						)}

						{/* Active Filters - Bottom on desktop when many filters */}
						{!uiDecisions.activeFiltersAtTop && (
							<div className="hidden lg:block">
								{renderActiveFiltersDisplay()}
							</div>
						)}
					</CardContent>
					<div
						className={`flex items-center justify-end gap-2 border-t border-border/70 bg-background/76 px-4 py-3 ${
							forceDrawer ? "" : "lg:hidden"
						}`}
					>
						<Button
							type="button"
							size="sm"
							onClick={() => {
								haptics.success();
								onClose();
							}}
							className="ml-auto h-8 rounded-full px-4 text-xs"
						>
							Done ({filteredEventsCount})
						</Button>
					</div>
				</Card>
			</div>
		</div>
	);

	if (forceDrawer && typeof document !== "undefined") {
		return createPortal(openPanel, document.body);
	}

	return openPanel;
};

export default FilterPanel;
