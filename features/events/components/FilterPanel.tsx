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
} from "@/features/events/types";
import { LAYERS } from "@/lib/ui/layers";
import {
	OVERLAY_BODY_ATTRIBUTE,
	setBodyOverlayAttribute,
} from "@/lib/ui/overlay-state";
import {
	Building2,
	CalendarDays,
	ChevronDown,
	Euro,
	Filter,
	Moon,
	Search,
	Star,
	Sun,
	Trees,
	Users,
	X,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type FilterPanelProps = {
	selectedDateRange: DateRangeFilter;
	defaultDateRange: DateRangeFilter;
	selectedDayNightPeriods: DayNightPeriod[];
	selectedArrondissements: ParisArrondissement[];
	selectedGenres: MusicGenre[];
	selectedNationalities: Nationality[];
	selectedVenueTypes: VenueType[];
	selectedIndoorPreference: boolean | null;
	selectedPriceRange: [number, number];
	selectedAgeRange: AgeRange | null;
	selectedOOOCPicks: boolean;
	onDateRangeChange: (dateRange: DateRangeFilter) => void;
	onDayNightPeriodToggle: (period: DayNightPeriod) => void;
	onArrondissementToggle: (arrondissement: ParisArrondissement) => void;
	onGenreToggle: (genre: MusicGenre) => void;
	onNationalityToggle: (nationality: Nationality) => void;
	onVenueTypeToggle: (venueType: VenueType) => void;
	onIndoorPreferenceChange: (preference: boolean | null) => void;
	onPriceRangeChange: (range: [number, number]) => void;
	onAgeRangeChange: (range: AgeRange | null) => void;
	onOOOCPicksToggle: (selected: boolean) => void;
	onClearFilters: () => void;
	availableArrondissements: ParisArrondissement[];
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
};

const FilterPanel: React.FC<FilterPanelProps> = ({
	selectedDateRange,
	defaultDateRange,
	selectedDayNightPeriods,
	selectedArrondissements,
	selectedGenres,
	selectedNationalities,
	selectedVenueTypes,
	selectedIndoorPreference,
	selectedPriceRange,
	selectedAgeRange,
	selectedOOOCPicks,
	onDateRangeChange,
	onDayNightPeriodToggle,
	onArrondissementToggle,
	onGenreToggle,
	onNationalityToggle,
	onVenueTypeToggle,
	onIndoorPreferenceChange,
	onPriceRangeChange,
	onAgeRangeChange,
	onOOOCPicksToggle,
	onClearFilters,
	availableArrondissements,
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
}) => {
	const sectionClassName =
		"space-y-3 rounded-xl border border-border/70 bg-background/58 p-3";
	const sectionTitleClassName =
		"text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground";
	const denseToggleClassName =
		"h-7 min-w-0 justify-start border border-border/75 bg-background/68 text-xs text-foreground/90 hover:bg-accent data-[state=on]:bg-accent data-[state=on]:text-accent-foreground";
	const regularToggleClassName =
		"h-8 min-w-0 justify-start border border-border/75 bg-background/68 text-xs text-foreground/90 hover:bg-accent data-[state=on]:bg-accent data-[state=on]:text-accent-foreground";
	const compactRailSectionClassName =
		"space-y-2.5 rounded-lg border border-border/70 bg-background/58 p-2.5";
	const genreOptions = availableGenres ?? MUSIC_GENRES;
	const [genreSearchQuery, setGenreSearchQuery] = useState("");
	const activeFilterBadgeClassName =
		"h-7 gap-1 rounded-full border border-border/70 bg-background/72 px-2.5 text-xs font-normal shadow-none";
	const compactActiveFilterBadgeClassName =
		"h-7 gap-1 rounded-full border border-border/70 bg-background/80 px-2 text-xs font-normal shadow-none";
	const activeFilterRemoveButtonClassName =
		"h-auto p-0 ml-1 text-muted-foreground hover:bg-transparent hover:text-foreground";
	const ooocPickHelp =
		"OOOC Picks are events highlighted by Out Of Office Collective as especially worth considering.";
	const hostNationalityHelp =
		"The country or cultural background associated with the event host or promoter. Selecting more than one means events must include all selected host nationalities.";
	const arrondissementHelp =
		"Arr. is short for arrondissement: Paris's numbered neighbourhood districts. Use it to narrow events by area.";
	const venueTypeHelp =
		"Venue type filters events by setting, such as indoor club spaces or outdoor/open-air locations.";
	const ageRangeHelp =
		"Age range primarily reflects the minimum allowed age for an event. It can also hint at the typical attendee age when organisers provide that context.";

	// Stable accordion state for desktop compact mode
	const [openAccordionSections, setOpenAccordionSections] = useState<string[]>([
		"days",
		"types",
		"price",
	]);
	const desktopRailScrollRef = useRef<HTMLDivElement>(null);

	// Stable price range reset handler
	const resetPriceRange = useCallback(() => {
		onPriceRangeChange(PRICE_RANGE_CONFIG.defaultRange);
	}, [onPriceRangeChange]);

	// Stable age range reset handler
	const resetAgeRange = useCallback(() => {
		onAgeRangeChange(null);
	}, [onAgeRangeChange]);

	// Memoize the hasActiveFilters calculation
	const hasActiveFilters = useMemo(
		() =>
			hasActiveEventFilters(
				{
					selectedDateRange,
					selectedDayNightPeriods,
					selectedArrondissements,
					selectedGenres,
					selectedNationalities,
					selectedVenueTypes,
					selectedIndoorPreference,
					selectedPriceRange,
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
			selectedNationalities,
			selectedVenueTypes,
			selectedIndoorPreference,
			selectedPriceRange,
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
					selectedNationalities,
					selectedVenueTypes,
					selectedIndoorPreference,
					selectedPriceRange,
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
			selectedNationalities,
			selectedVenueTypes,
			selectedIndoorPreference,
			selectedPriceRange,
			selectedAgeRange,
			selectedOOOCPicks,
		],
	);
	const filteredGenreOptions = useMemo(() => {
		const normalizedQuery = genreSearchQuery.trim().toLowerCase();
		if (!normalizedQuery) return genreOptions;

		return genreOptions.filter(({ key, label }) => {
			if (selectedGenres.includes(key)) return true;
			return (
				label.toLowerCase().includes(normalizedQuery) ||
				key.toLowerCase().includes(normalizedQuery)
			);
		});
	}, [genreOptions, genreSearchQuery, selectedGenres]);

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
		onDateRangeChange(defaultDateRange);
	}, [defaultDateRange, onDateRangeChange]);

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

	const DefaultDateRangeHint = () => {
		if (!isUsingDefaultDateRange) return null;

		return (
			<div className="rounded-lg border border-border/70 bg-muted/35 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
				Showing this year&apos;s events by default. Older showcase events are
				still available if you widen the date range.
			</div>
		);
	};

	const RangeValueLabels = ({
		left,
		center,
		right,
	}: {
		left: string;
		center: string;
		right: string;
	}) => (
		<div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-xs text-muted-foreground">
			<span className="min-w-0 truncate text-left">{left}</span>
			<span className="max-w-[9rem] truncate text-center font-medium text-foreground/78">
				{center}
			</span>
			<span className="min-w-0 truncate text-right">{right}</span>
		</div>
	);

	// Active Filters Component (reusable)
	const ActiveFiltersDisplay = ({
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
							<div className="text-xs font-medium text-muted-foreground">
								Active Filters ({activeFilterCount})
							</div>
							{isDesktopContentExpanded && (
								<ClearFiltersButton
									onClick={onClearFilters}
									className="h-7 rounded-full px-3 text-xs"
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
									? "flex max-h-[3.65rem] min-h-7 flex-wrap gap-1.5 overflow-y-auto pb-0.5 pr-1 [scrollbar-color:color-mix(in_oklab,var(--muted-foreground)_34%,transparent)_transparent] [scrollbar-width:thin] [&>*]:shrink-0 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/28 [&::-webkit-scrollbar-track]:bg-transparent"
									: "grid max-h-[3.65rem] auto-cols-max grid-flow-col grid-rows-2 gap-1.5 overflow-x-auto pb-0.5 [mask-image:linear-gradient(to_right,black_calc(100%_-_24px),transparent)] [scrollbar-width:none] [&>*]:shrink-0 [&::-webkit-scrollbar]:hidden"
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
									onClick={() => onOOOCPicksToggle(false)}
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
									onClick={() => onDayNightPeriodToggle(period)}
								>
									<X className="h-3 w-3" />
								</Button>
							</Badge>
						))}
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
									onClick={() => onNationalityToggle(nationality)}
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
									onClick={() => onVenueTypeToggle(venueType)}
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
									onClick={() => onIndoorPreferenceChange(null)}
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
									onClick={() => onArrondissementToggle(arr)}
								>
									<X className="h-3 w-3" />
								</Button>
							</Badge>
						))}
						{selectedGenres.slice(0, 4).map((genre) => (
							<Badge
								key={genre}
								variant="secondary"
								className={
									compact
										? compactActiveFilterBadgeClassName
										: activeFilterBadgeClassName
								}
							>
								{genreOptions.find((g) => g.key === genre)?.label ?? genre}
								<Button
									variant="ghost"
									size="sm"
									className={activeFilterRemoveButtonClassName}
									onClick={() => onGenreToggle(genre)}
								>
									<X className="h-3 w-3" />
								</Button>
							</Badge>
						))}
						{selectedGenres.length > 4 && (
							<Badge
								variant="outline"
								className={
									compact
										? "h-7 shrink-0 rounded-full border-border/70 bg-background/60 px-2 text-xs font-normal"
										: "h-7 rounded-full border-border/70 bg-background/60 px-2.5 text-xs font-normal"
								}
							>
								+{selectedGenres.length - 4} more
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
				{!hideFloatingButton && (
					<FilterButton
						id="tour-filter-button"
						onClickAction={onOpen || onClose}
						hasActiveFilters={hasActiveFilters}
						activeFiltersCount={activeFilterCount}
						className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+var(--oooc-mobile-nav-offset,1rem))] min-w-[8.25rem] rounded-full px-4 shadow-lg transition-[bottom] duration-300 ease-out lg:hidden"
						style={{ zIndex: LAYERS.FLOATING_CONTROL + 1 }}
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
						<CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 border-b border-border/70 py-5">
							<CardTitle className="flex min-w-0 items-center whitespace-nowrap text-[1.35rem] [font-family:var(--ooo-font-display)] font-light leading-none">
								<Filter className="mr-2.5 h-5 w-5 stroke-[1.8]" />
								Filters
								{hasActiveFilters && (
									<Badge
										variant="secondary"
										className="ml-2 border border-border/70 bg-secondary/72 text-xs"
									>
										{activeFilterCount} active
									</Badge>
								)}
							</CardTitle>
							<div className="flex shrink-0 items-center gap-2">
								{hasActiveFilters &&
									(!isDesktopContentExpanded ||
									!uiDecisions.activeFiltersAtTop ? (
										<ClearFiltersButton
											onClick={onClearFilters}
											className="h-7 px-2.5"
										/>
									) : (
										<div
											aria-hidden="true"
											className="h-7 w-[3.875rem] shrink-0"
										/>
									))}
								{onToggleExpanded && (
									<Button
										variant="ghost"
										size="icon-sm"
										onClick={onToggleExpanded}
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
										className="rounded-full border border-border/70 bg-background/66 text-muted-foreground hover:bg-accent hover:text-foreground"
									>
										<ChevronDown
											className={`h-4 w-4 transition-transform transition-bouncy ${isDesktopContentExpanded ? "rotate-180" : "rotate-0"}`}
										/>
									</Button>
								)}
							</div>
						</CardHeader>

						<CardContent
							className={`motion-safe:transition-[max-height] motion-safe:duration-250 motion-safe:ease-out overflow-hidden relative py-3 ${
								isDesktopContentExpanded ? "max-h-[650px]" : "max-h-24"
							}`}
						>
							<div
								ref={desktopRailScrollRef}
								className="h-[calc(650px-4rem)] overflow-y-auto relative"
							>
								{/* Active Filters - Top when few filters */}
								{hasActiveFilters && uiDecisions.activeFiltersAtTop && (
									<div className="sticky top-0 z-10 bg-card/95 pb-1.5 backdrop-blur">
										<ActiveFiltersDisplay compact compactRows="double" />
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
										<AccordionTrigger className="text-sm font-semibold uppercase tracking-[0.08em] text-foreground/86 hover:text-foreground transition-colors">
											Date & Times
											{(hasSelectedDateRange ||
												selectedDayNightPeriods.length > 0) && (
												<Badge
													variant="secondary"
													className="ml-2 border border-border/70 bg-secondary/72 text-xs"
												>
													{(hasSelectedDateRange ? 1 : 0) +
														selectedDayNightPeriods.length}{" "}
													active
												</Badge>
											)}
										</AccordionTrigger>
										<AccordionContent>
											<div className="space-y-3">
												<DefaultDateRangeHint />
												{/* Day/Night Periods */}
												<div className={compactRailSectionClassName}>
													<div className="flex items-center justify-between mb-1">
														<h4 className={sectionTitleClassName}>
															Filter by Time
														</h4>
													</div>
													<div className="grid grid-cols-2 gap-1">
														{DAY_NIGHT_PERIODS.map(({ key, label }) => (
															<Toggle
																key={key}
																pressed={selectedDayNightPeriods.includes(key)}
																onPressedChange={() =>
																	onDayNightPeriodToggle(key)
																}
																size="sm"
																className={`${denseToggleClassName} justify-center`}
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
										<AccordionTrigger className="text-sm font-semibold uppercase tracking-[0.08em] text-foreground/86 hover:text-foreground transition-colors">
											Location
											{selectedArrondissements.length > 0 && (
												<Badge
													variant="secondary"
													className="ml-2 border border-border/70 bg-secondary/72 text-xs"
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
										<AccordionTrigger className="text-sm font-semibold uppercase tracking-[0.08em] text-foreground/86 hover:text-foreground transition-colors">
											Music & Culture
											{(selectedGenres.length > 0 ||
												selectedNationalities.length > 0) && (
												<Badge
													variant="secondary"
													className="ml-2 border border-border/70 bg-secondary/72 text-xs"
												>
													{selectedGenres.length + selectedNationalities.length}{" "}
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
													<div className="relative mb-2 mt-2">
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
														<div className="grid min-h-[8rem] max-h-36 grid-cols-1 gap-1.5 overflow-y-auto rounded-md border border-border/70 bg-background/55 p-1.5 [scrollbar-color:color-mix(in_oklab,var(--muted-foreground)_34%,transparent)_transparent] [scrollbar-width:thin] min-[1180px]:grid-cols-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/28 [&::-webkit-scrollbar-track]:bg-transparent">
															{filteredGenreOptions.map(
																({ key, label, color }) => (
																	<Toggle
																		key={key}
																		pressed={selectedGenres.includes(key)}
																		onPressedChange={() => onGenreToggle(key)}
																		className={denseToggleClassName}
																		size="sm"
																	>
																		<div
																			className={`w-1.5 h-1.5 rounded-full ${color} mr-1.5 flex-shrink-0`}
																		/>
																		<span className="text-xs truncate">
																			{label}
																		</span>
																	</Toggle>
																),
															)}
															{filteredGenreOptions.length === 0 && (
																<p className="col-span-2 px-2 py-6 text-center text-xs text-muted-foreground">
																	No genres found.
																</p>
															)}
														</div>
														<div className="absolute top-1.5 left-1.5 right-3 h-3 bg-gradient-to-b from-background/88 to-transparent pointer-events-none" />
														<div className="absolute bottom-5 left-1.5 right-3 h-5 bg-gradient-to-t from-background/90 to-transparent pointer-events-none" />
														<div className="mt-1 text-center text-[11px] text-muted-foreground/88">
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
																<span className="text-sm text-muted-foreground font-normal">
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
																	<span className="mr-1.5 text-sm">{flag}</span>
																	<span className="text-xs">{shortCode}</span>
																</Toggle>
															),
														)}
														{availableNationalities.length === 0 && (
															<p className="col-span-3 text-xs text-muted-foreground">
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
										<AccordionTrigger className="text-sm font-semibold uppercase tracking-[0.08em] text-foreground/86 hover:text-foreground transition-colors">
											Preferences
											{(selectedVenueTypes.length > 0 ||
												selectedIndoorPreference !== null ||
												selectedPriceRange[0] !== PRICE_RANGE_CONFIG.min ||
												selectedPriceRange[1] !== PRICE_RANGE_CONFIG.max ||
												selectedAgeRange !== null ||
												selectedOOOCPicks) && (
												<Badge
													variant="secondary"
													className="ml-2 border border-border/70 bg-secondary/72 text-xs"
												>
													{
														[
															selectedVenueTypes.length > 0,
															selectedIndoorPreference !== null,
															selectedPriceRange[0] !==
																PRICE_RANGE_CONFIG.min ||
																selectedPriceRange[1] !==
																	PRICE_RANGE_CONFIG.max,
															selectedAgeRange !== null,
															selectedOOOCPicks,
														].filter(Boolean).length
													}{" "}
													active
												</Badge>
											)}
										</AccordionTrigger>
										<AccordionContent>
											<div className="space-y-4">
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
														onPressedChange={onOOOCPicksToggle}
														className={denseToggleClassName}
														size="sm"
													>
														<Star className="h-3.5 w-3.5 mr-1.5 fill-yellow-400" />
														<span className="text-xs">
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
																onPressedChange={() => onVenueTypeToggle(key)}
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
														<RangeValueLabels
															left={`€${PRICE_RANGE_CONFIG.min}`}
															center={formatPriceRange(selectedPriceRange)}
															right={`€${PRICE_RANGE_CONFIG.max}+`}
														/>
														{(selectedPriceRange[0] !==
															PRICE_RANGE_CONFIG.min ||
															selectedPriceRange[1] !==
																PRICE_RANGE_CONFIG.max) && (
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
														<RangeValueLabels
															left={`${AGE_RANGE_CONFIG.min} or less`}
															center={
																selectedAgeRange
																	? formatAgeRange(selectedAgeRange)
																	: "All ages"
															}
															right={`${AGE_RANGE_CONFIG.max}+`}
														/>
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
											</div>
										</AccordionContent>
									</AccordionItem>
								</Accordion>

								{/* Active Filters - Bottom when many filters */}
								{hasActiveFilters && !uiDecisions.activeFiltersAtTop && (
									<ActiveFiltersDisplay compact compactRows="double" />
								)}

								<div className="mt-2 text-center text-[11px] text-muted-foreground/80">
									Showing {filteredEventsCount} matching event
									{filteredEventsCount !== 1 ? "s" : ""}.
								</div>
							</div>
							{!isDesktopContentExpanded && (
								<div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex h-20 items-end justify-center bg-gradient-to-t from-card via-card/96 to-card/10 pb-3">
									<p className="text-[11px] tracking-[0.04em] text-muted-foreground/92">
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

	return (
		<div
			className="fixed inset-0 bg-black/45 backdrop-blur-[2px] lg:static lg:bg-transparent lg:z-auto"
			style={{ zIndex: LAYERS.OVERLAY }}
			onPointerDown={(pointerEvent) => {
				if (pointerEvent.target !== pointerEvent.currentTarget) return;
				onClose();
			}}
		>
			<div
				id="tour-filter-panel"
				className="absolute right-0 top-0 h-full w-full max-w-sm border-l border-border/70 bg-background/97 lg:static lg:max-w-none lg:border-l-0 lg:h-fit"
			>
				<Card className="ooo-site-card flex h-full flex-col border-0 py-0 lg:h-fit lg:border">
					<CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/70 py-5 pb-4">
						<CardTitle className="flex items-center text-[1.45rem] [font-family:var(--ooo-font-display)] font-light">
							<Filter className="h-5 w-5 mr-2" />
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
						<div className="flex items-center space-x-2">
							{hasActiveFilters &&
								(!isDesktopContentExpanded ||
									!uiDecisions.activeFiltersAtTop) && (
									<ClearFiltersButton
										onClick={onClearFilters}
										className="hidden h-8 lg:inline-flex"
									>
										Clear filters
									</ClearFiltersButton>
								)}
							<Button
								variant="outline"
								size="icon"
								onClick={onClose}
								className="h-8 w-8 rounded-full border-border/70 bg-background/70 hover:bg-accent lg:hidden"
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
									onClick={onClearFilters}
									className="h-7 shrink-0 rounded-full border border-dashed border-border/70 px-3 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
								>
									Clear
								</Button>
							</div>
							<div className="mt-1.5">
								<ActiveFiltersDisplay showHeading={false} compact />
							</div>
						</div>
					)}

					<CardContent className="min-h-0 flex-1 space-y-6 overflow-y-auto py-4 lg:overflow-y-visible">
						{/* Active Filters - Top on desktop when few filters */}
						{uiDecisions.activeFiltersAtTop && (
							<div className="hidden lg:block">
								<ActiveFiltersDisplay />
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
											Date & Times
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
											<div className="space-y-3">
												<DefaultDateRangeHint />
												{/* Day/Night Periods */}
												<div className="p-1.5 bg-muted/20 rounded-md border overflow-hidden">
													<div className="flex items-center justify-between mb-1">
														<h4 className="text-xs font-medium truncate">
															Filter by Time
														</h4>
													</div>
													<div className="grid grid-cols-2 gap-1">
														{DAY_NIGHT_PERIODS.map(({ key, label }) => (
															<Toggle
																key={key}
																pressed={selectedDayNightPeriods.includes(key)}
																onPressedChange={() =>
																	onDayNightPeriodToggle(key)
																}
																size="sm"
																className="text-xs px-1.5 py-1 sm:px-2 flex-1 justify-center min-w-0 truncate"
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
								<div className={sectionClassName}>
									<div className="flex items-center mb-3">
										<h3 className={sectionTitleClassName}>Date & Times</h3>
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
										<DefaultDateRangeHint />
										{/* Day/Night Periods */}
										<div className={sectionClassName}>
											<div className="flex items-center justify-between mb-2">
												<h4 className={sectionTitleClassName}>
													Filter by Time
												</h4>
											</div>
											<div className="grid grid-cols-2 gap-2">
												{DAY_NIGHT_PERIODS.map(({ key, label }) => (
													<Toggle
														key={key}
														pressed={selectedDayNightPeriods.includes(key)}
														onPressedChange={() => onDayNightPeriodToggle(key)}
														size="sm"
														className={regularToggleClassName}
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
										onPressedChange={onOOOCPicksToggle}
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
												onPressedChange={() => onVenueTypeToggle(key)}
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
												onPressedChange={() => onNationalityToggle(key)}
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
										<RangeValueLabels
											left={`€${PRICE_RANGE_CONFIG.min}`}
											center={formatPriceRange(selectedPriceRange)}
											right={`€${PRICE_RANGE_CONFIG.max}+`}
										/>
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
										<RangeValueLabels
											left={`${AGE_RANGE_CONFIG.min} or less`}
											center={
												selectedAgeRange
													? formatAgeRange(selectedAgeRange)
													: "All ages"
											}
											right={`${AGE_RANGE_CONFIG.max}+`}
										/>
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
										<div className="grid grid-cols-2 gap-1 max-h-48 min-h-[12rem] overflow-y-auto rounded-md border border-border/70 bg-background/55 p-2 [scrollbar-color:color-mix(in_oklab,var(--muted-foreground)_34%,transparent)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/28 [&::-webkit-scrollbar-track]:bg-transparent">
											{filteredGenreOptions.map(({ key, label, color }) => (
												<Toggle
													key={key}
													pressed={selectedGenres.includes(key)}
													onPressedChange={() => onGenreToggle(key)}
													className={denseToggleClassName}
													size="sm"
												>
													<div
														className={`w-2 h-2 rounded-full ${color} mr-1.5 flex-shrink-0`}
													/>
													<span className="text-xs truncate">{label}</span>
												</Toggle>
											))}
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
													onPressedChange={() => onArrondissementToggle(arr)}
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
								<ActiveFiltersDisplay />
							</div>
						)}
					</CardContent>
					<div className="flex items-center justify-end gap-2 border-t border-border/70 bg-background/76 px-4 py-3 lg:hidden">
						<Button
							type="button"
							size="sm"
							onClick={onClose}
							className="ml-auto h-8 rounded-full px-4 text-xs"
						>
							Done ({filteredEventsCount})
						</Button>
					</div>
				</Card>
			</div>
		</div>
	);
};

export default FilterPanel;
