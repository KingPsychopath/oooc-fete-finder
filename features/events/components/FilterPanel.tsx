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
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Toggle } from "@/components/ui/toggle";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { FilterButton } from "@/features/events/components/FilterButton";
import {
	AGE_RANGE_CONFIG,
	type AgeRange,
	DAY_NIGHT_PERIODS,
	type DayNightPeriod,
	MUSIC_GENRES,
	type MusicGenre,
	NATIONALITIES,
	type Nationality,
	PRICE_RANGE_CONFIG,
	type ParisArrondissement,
	VENUE_TYPES,
	type VenueType,
	formatAgeRange,
	formatPriceRange,
} from "@/features/events/types";
import { useOutsideClick } from "@/hooks/useOutsideClick";
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
	Info,
	Moon,
	Star,
	Sun,
	Trees,
	Users,
	X,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

type FilterPanelProps = {
	selectedDate: string | null;
	selectedDayNightPeriods: DayNightPeriod[];
	selectedArrondissements: ParisArrondissement[];
	selectedGenres: MusicGenre[];
	selectedNationalities: Nationality[];
	selectedVenueTypes: VenueType[];
	selectedIndoorPreference: boolean | null;
	selectedPriceRange: [number, number];
	selectedAgeRange: AgeRange | null;
	selectedOOOCPicks: boolean;
	onDateChange: (date: string | null) => void;
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
	availableEventDates: string[];
	filteredEventsCount: number;
	isOpen: boolean;
	onClose: () => void;
	onOpen?: () => void;
	isExpanded?: boolean;
	onToggleExpanded?: () => void;
};

const FilterPanel: React.FC<FilterPanelProps> = ({
	selectedDate,
	selectedDayNightPeriods,
	selectedArrondissements,
	selectedGenres,
	selectedNationalities,
	selectedVenueTypes,
	selectedIndoorPreference,
	selectedPriceRange,
	selectedAgeRange,
	selectedOOOCPicks,
	onDateChange,
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
	availableEventDates,
	filteredEventsCount,
	isOpen,
	onClose,
	onOpen,
	isExpanded,
	onToggleExpanded,
}) => {
	const sectionClassName =
		"space-y-3 rounded-xl border border-border/70 bg-background/58 p-3";
	const sectionTitleClassName =
		"text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground";
	const denseToggleClassName =
		"h-7 justify-start border border-border/75 bg-background/68 text-xs text-foreground/90 hover:bg-accent data-[state=on]:bg-accent data-[state=on]:text-accent-foreground";
	const regularToggleClassName =
		"h-8 justify-start border border-border/75 bg-background/68 text-xs text-foreground/90 hover:bg-accent data-[state=on]:bg-accent data-[state=on]:text-accent-foreground";

	// Stable accordion state for desktop compact mode
	const [openAccordionSections, setOpenAccordionSections] = useState<string[]>([
		"days",
		"types",
		"price",
	]);

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
			selectedDate !== null ||
			selectedDayNightPeriods.length > 0 ||
			selectedArrondissements.length > 0 ||
			selectedGenres.length > 0 ||
			selectedNationalities.length > 0 ||
			selectedVenueTypes.length > 0 ||
			selectedIndoorPreference !== null ||
			selectedPriceRange[0] !== PRICE_RANGE_CONFIG.min ||
			selectedPriceRange[1] !== PRICE_RANGE_CONFIG.max ||
			(selectedAgeRange !== null &&
				(selectedAgeRange[0] !== AGE_RANGE_CONFIG.min ||
					selectedAgeRange[1] !== AGE_RANGE_CONFIG.max)) ||
			selectedOOOCPicks,
		[
			selectedDate,
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
	const activeFilterCount = useMemo(() => {
		return (
			(selectedDate !== null ? 1 : 0) +
			selectedDayNightPeriods.length +
			selectedArrondissements.length +
			selectedGenres.length +
			selectedNationalities.length +
			selectedVenueTypes.length +
			(selectedIndoorPreference !== null ? 1 : 0) +
			(selectedPriceRange[0] !== PRICE_RANGE_CONFIG.min ||
			selectedPriceRange[1] !== PRICE_RANGE_CONFIG.max
				? 1
				: 0) +
			(selectedAgeRange !== null &&
			(selectedAgeRange[0] !== AGE_RANGE_CONFIG.min ||
				selectedAgeRange[1] !== AGE_RANGE_CONFIG.max)
				? 1
				: 0) +
			(selectedOOOCPicks ? 1 : 0)
		);
	}, [
		selectedDate,
		selectedDayNightPeriods,
		selectedArrondissements,
		selectedGenres,
		selectedNationalities,
		selectedVenueTypes,
		selectedIndoorPreference,
		selectedPriceRange,
		selectedAgeRange,
		selectedOOOCPicks,
	]);

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

	// Use outside click hook for mobile
	const panelRef = useOutsideClick<HTMLDivElement>(() => {
		if (isOpen) {
			onClose();
		}
	});

	useEffect(() => {
		setBodyOverlayAttribute(OVERLAY_BODY_ATTRIBUTE.FILTER_PANEL, isOpen);

		return () => {
			setBodyOverlayAttribute(OVERLAY_BODY_ATTRIBUTE.FILTER_PANEL, false);
		};
	}, [isOpen]);

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

	const dateBounds = useMemo(() => {
		if (availableEventDates.length === 0)
			return { min: undefined, max: undefined };
		return {
			min: availableEventDates[0],
			max: availableEventDates[availableEventDates.length - 1],
		};
	}, [availableEventDates]);

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

	// Active Filters Component (reusable)
	const ActiveFiltersDisplay = () => (
		<div
			className={`transition-opacity duration-200 ease-out ${hasActiveFilters ? "rounded-xl border border-border/70 bg-background/52 p-3 opacity-100" : "h-0 overflow-hidden opacity-0"}`}
		>
			{hasActiveFilters && (
				<>
					<div className="mb-2 flex items-center justify-between gap-2">
						<div className="text-xs font-medium text-muted-foreground">
							Active Filters ({activeFilterCount})
						</div>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={onClearFilters}
							className="h-7 rounded-full border border-border/70 px-3 text-xs text-foreground/80 hover:bg-accent"
						>
							Clear all
						</Button>
					</div>
					<div className="flex min-h-[28px] flex-wrap gap-2">
						{selectedOOOCPicks && (
							<Badge
								variant="secondary"
								className="border border-border/70 bg-secondary/72 text-xs"
							>
								<Star className="h-3 w-3 mr-1 fill-yellow-400" />
								OOOC Picks
								<Button
									variant="ghost"
									size="sm"
									className="h-auto p-0 ml-1 hover:bg-transparent"
									onClick={() => onOOOCPicksToggle(false)}
								>
									<X className="h-3 w-3" />
								</Button>
							</Badge>
						)}
						{selectedDate && (
							<Badge
								variant="secondary"
								className="border border-border/70 bg-secondary/72 text-xs"
							>
								<CalendarDays className="h-3 w-3 mr-1" />
								{formatDateLabel(selectedDate)}
								<Button
									variant="ghost"
									size="sm"
									className="h-auto p-0 ml-1 hover:bg-transparent"
									onClick={() => onDateChange(null)}
								>
									<X className="h-3 w-3" />
								</Button>
							</Badge>
						)}
						{selectedDayNightPeriods.map((period) => (
							<Badge
								key={period}
								variant="secondary"
								className="border border-border/70 bg-secondary/72 text-xs"
							>
								<span className="mr-1 inline-flex items-center text-muted-foreground">
									{renderDayNightIcon(period)}
								</span>
								{getDayNightLabel(period)}
								<Button
									variant="ghost"
									size="sm"
									className="h-auto p-0 ml-1 hover:bg-transparent"
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
								className="border border-border/70 bg-secondary/72 text-xs"
							>
								{nationality}
								<Button
									variant="ghost"
									size="sm"
									className="h-auto p-0 ml-1 hover:bg-transparent"
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
								className="border border-border/70 bg-secondary/72 text-xs"
							>
								<span className="mr-1 inline-flex items-center text-muted-foreground">
									{renderVenueTypeIcon(venueType)}
								</span>
								{getVenueTypeLabel(venueType)}
								<Button
									variant="ghost"
									size="sm"
									className="h-auto p-0 ml-1 hover:bg-transparent"
									onClick={() => onVenueTypeToggle(venueType)}
								>
									<X className="h-3 w-3" />
								</Button>
							</Badge>
						))}
						{selectedIndoorPreference !== null && (
							<Badge
								variant="secondary"
								className="border border-border/70 bg-secondary/72 text-xs"
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
									className="h-auto p-0 ml-1 hover:bg-transparent"
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
								className="border border-border/70 bg-secondary/72 text-xs"
							>
								<Euro className="mr-1 h-3 w-3" />
								{formatPriceRange(selectedPriceRange)}
								<Button
									variant="ghost"
									size="sm"
									className="h-auto p-0 ml-1 hover:bg-transparent"
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
									className="border border-border/70 bg-secondary/72 text-xs"
								>
									<Users className="mr-1 h-3 w-3" />
									{formatAgeRange(selectedAgeRange)}
									<Button
										variant="ghost"
										size="sm"
										className="h-auto p-0 ml-1 hover:bg-transparent"
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
								className="border border-border/70 bg-secondary/72 text-xs"
							>
								{arr === "unknown" ? "TBC" : `${arr}e`}
								<Button
									variant="ghost"
									size="sm"
									className="h-auto p-0 ml-1 hover:bg-transparent"
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
								className="border border-border/70 bg-secondary/72 text-xs"
							>
								{MUSIC_GENRES.find((g) => g.key === genre)?.label}
								<Button
									variant="ghost"
									size="sm"
									className="h-auto p-0 ml-1 hover:bg-transparent"
									onClick={() => onGenreToggle(genre)}
								>
									<X className="h-3 w-3" />
								</Button>
							</Badge>
						))}
						{selectedGenres.length > 4 && (
							<Badge variant="outline" className="text-xs">
								+{selectedGenres.length - 4} more
							</Badge>
						)}
					</div>
				</>
			)}
		</div>
	);

	const DatePickerControl = ({ compact = false }: { compact?: boolean }) => (
		<div className={sectionClassName}>
			<div className="flex items-center justify-between">
				<h4 className={sectionTitleClassName}>Pick Date</h4>
				{selectedDate && (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-7 rounded-full border border-border/70 px-2 text-xs text-foreground/80 hover:bg-accent"
						onClick={() => onDateChange(null)}
					>
						Clear
					</Button>
				)}
			</div>
			<Input
				type="date"
				value={selectedDate ?? ""}
				min={dateBounds.min}
				max={dateBounds.max}
				onChange={(event) => onDateChange(event.target.value || null)}
				className="h-8 border-border/75 bg-background/68 text-xs"
				aria-label="Filter by event date"
			/>
			{availableEventDates.length > 0 && (
				<div
					className={`grid ${compact ? "grid-cols-2" : "grid-cols-3"} gap-1`}
				>
					{availableEventDates.map((date) => (
						<Toggle
							key={date}
							pressed={selectedDate === date}
							onPressedChange={(pressed) => onDateChange(pressed ? date : null)}
							size="sm"
							className={denseToggleClassName}
						>
							{formatDateLabel(date)}
						</Toggle>
					))}
				</div>
			)}
		</div>
	);

	// Mobile floating button when closed - only show on mobile
	if (!isOpen) {
		return (
			<>
				{/* Mobile floating button */}
				<FilterButton
					onClickAction={onOpen || onClose}
					hasActiveFilters={hasActiveFilters}
					activeFiltersCount={activeFilterCount}
					className="fixed right-4 bottom-4 z-40 rounded-full shadow-lg lg:hidden"
					variant="outline"
					size="sm"
				/>

				{/* Desktop version - always visible */}
				<div className="hidden lg:block">
					<Card className="ooo-site-card overflow-hidden py-0">
						<CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/70 py-5 pb-4">
							<CardTitle className="flex items-center text-[1.55rem] [font-family:var(--ooo-font-display)] font-light">
								<Filter className="h-4 w-4 mr-2" />
								Event Filters
								{hasActiveFilters && (
									<Badge
										variant="secondary"
										className="ml-2 border border-border/70 bg-secondary/72 text-xs"
									>
										{activeFilterCount} active
									</Badge>
								)}
								<Badge
									variant="outline"
									className="ml-2 border-border/70 bg-background/52 text-xs"
								>
									{filteredEventsCount} result
									{filteredEventsCount !== 1 ? "s" : ""}
								</Badge>
							</CardTitle>
							<div className="flex items-center space-x-2">
								{hasActiveFilters && (
									<Button
										variant="outline"
										size="sm"
										onClick={onClearFilters}
										className="h-7 rounded-full border-border/70 bg-background/70 px-3 text-xs hover:bg-accent"
									>
										Clear all
									</Button>
								)}
								{onToggleExpanded && (
									<Button
										variant="ghost"
										size="sm"
										onClick={onToggleExpanded}
										className="w-[110px] shrink-0 justify-center rounded-full border border-border/70 bg-background/66 text-muted-foreground hover:bg-accent hover:text-foreground"
									>
										<ChevronDown
											className={`h-4 w-4 mr-1 transition-transform transition-bouncy ${isExpanded ? "rotate-180" : "rotate-0"}`}
										/>
										<span className="text-sm">
											{isExpanded ? "Collapse" : "Expand"}
										</span>
									</Button>
								)}
							</div>
						</CardHeader>

						<CardContent
							className={`motion-safe:transition-[max-height] motion-safe:duration-250 motion-safe:ease-out overflow-hidden relative ${
								isDesktopContentExpanded ? "max-h-[650px]" : "max-h-24"
							} py-4`}
						>
							<div className="h-[calc(650px-4rem)] overflow-y-auto relative">
								{/* Active Filters - Top when few filters */}
								{uiDecisions.activeFiltersAtTop && <ActiveFiltersDisplay />}

								<Accordion
									multiple
									value={openAccordionSections}
									onValueChange={(value) =>
										setOpenAccordionSections(value.filter(Boolean) as string[])
									}
									className="w-full space-y-2"
								>
									{/* Days & Times Section */}
									<AccordionItem value="days">
										<AccordionTrigger className="text-sm font-semibold uppercase tracking-[0.08em] text-foreground/86 hover:text-foreground transition-colors">
											Date & Times
											{(selectedDate !== null ||
												selectedDayNightPeriods.length > 0) && (
												<Badge
													variant="secondary"
													className="ml-2 border border-border/70 bg-secondary/72 text-xs"
												>
													{(selectedDate ? 1 : 0) +
														selectedDayNightPeriods.length}{" "}
													active
												</Badge>
											)}
										</AccordionTrigger>
										<AccordionContent>
											<div className="space-y-3">
												{/* Day/Night Periods */}
												<div className={sectionClassName}>
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
																className={denseToggleClassName}
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

												<DatePickerControl compact />
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
												<h3 className={sectionTitleClassName}>
													Arrondissements
												</h3>
												<div className="grid grid-cols-5 gap-1 min-h-[5rem] content-start">
													{availableArrondissements.map((arr) => (
														<Toggle
															key={arr}
															pressed={selectedArrondissements.includes(arr)}
															onPressedChange={() =>
																onArrondissementToggle(arr)
															}
															size="sm"
															className={denseToggleClassName}
														>
															{arr === "unknown" ? "TBC" : `${arr}e`}
														</Toggle>
													))}
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
													<div className="relative contain-layout">
														<div className="grid min-h-[8rem] max-h-36 grid-cols-2 gap-1 overflow-y-auto rounded-md border border-border/70 bg-background/55 p-1.5">
															{MUSIC_GENRES.map(({ key, label, color }) => (
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
															))}
														</div>
														<div className="absolute top-1.5 left-1.5 right-1.5 h-4 bg-gradient-to-b from-muted/40 to-transparent pointer-events-none" />
														<div className="absolute bottom-1.5 left-1.5 right-1.5 h-4 bg-gradient-to-t from-muted/40 to-transparent pointer-events-none" />
														<div className="mt-1 text-center text-[11px] text-muted-foreground/88">
															{MUSIC_GENRES.length} genres
														</div>
													</div>
												</div>

												{/* Nationality */}
												<div>
													<h3 className={sectionTitleClassName}>
														Nationality{" "}
														{selectedNationalities.length > 1 && (
															<span className="text-sm text-muted-foreground font-normal">
																(must INCLUDE)
															</span>
														)}
													</h3>
													<div className="grid grid-cols-3 gap-1">
														{NATIONALITIES.map(({ key, flag, shortCode }) => (
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
												<div>
													<h3 className={sectionTitleClassName}>OOOC Picks</h3>
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
													<h3 className={sectionTitleClassName}>Venue Type</h3>
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

												{/* Price Range */}
												<div>
													<h3 className={sectionTitleClassName}>Price Range</h3>
													<div className="space-y-1.5 px-1">
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
														<div className="flex justify-between text-xs text-muted-foreground">
															<span>€{PRICE_RANGE_CONFIG.min}</span>
															<span className="font-medium text-center">
																{formatPriceRange(selectedPriceRange)}
															</span>
															<span>€{PRICE_RANGE_CONFIG.max}+</span>
														</div>
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
												<div>
													<h3 className={sectionTitleClassName}>Age Range</h3>
													<div className="space-y-1.5 px-1">
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
														<div className="flex justify-between text-xs text-muted-foreground">
															<span>{AGE_RANGE_CONFIG.min} or less</span>
															<span className="font-medium text-center">
																{selectedAgeRange
																	? formatAgeRange(selectedAgeRange)
																	: "All ages"}
															</span>
															<span>{AGE_RANGE_CONFIG.max}+</span>
														</div>
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
								{!uiDecisions.activeFiltersAtTop && <ActiveFiltersDisplay />}

								<div className="mt-2 text-center text-[11px] text-muted-foreground/80">
									Showing {filteredEventsCount} matching event
									{filteredEventsCount !== 1 ? "s" : ""}.
								</div>
							</div>
							{!isDesktopContentExpanded && (
								<div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-card via-card/92 to-transparent pb-2 pt-5">
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
		>
			<div
				ref={panelRef}
				className="absolute right-0 top-0 h-full w-full max-w-sm border-l border-border/70 bg-background/97 lg:static lg:max-w-none lg:border-l-0 lg:h-fit"
			>
				<Card className="ooo-site-card h-full border-0 py-0 lg:h-fit lg:border">
					<CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/70 py-5 pb-4">
						<CardTitle className="flex items-center text-[1.45rem] [font-family:var(--ooo-font-display)] font-light">
							<Filter className="h-5 w-5 mr-2" />
							Filters
							{hasActiveFilters && (
								<Badge
									variant="secondary"
									className="ml-2 border border-border/70 bg-secondary/72 text-xs"
								>
									{activeFilterCount} active
								</Badge>
							)}
							<Badge
								variant="outline"
								className="ml-2 border-border/70 bg-background/52 text-xs"
							>
								{filteredEventsCount} result
								{filteredEventsCount !== 1 ? "s" : ""}
							</Badge>
						</CardTitle>
						<div className="flex items-center space-x-2">
							{hasActiveFilters && (
								<Button
									variant="outline"
									size="sm"
									onClick={onClearFilters}
									className="h-7 rounded-full border-border/70 bg-background/70 px-3 text-xs hover:bg-accent"
								>
									Clear all
								</Button>
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

					<CardContent className="space-y-6 overflow-y-auto py-4 lg:overflow-y-visible">
						{/* Active Filters - Top (Mobile) or when few filters */}
						{uiDecisions.activeFiltersAtTop && <ActiveFiltersDisplay />}

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
											{(selectedDate !== null ||
												selectedDayNightPeriods.length > 0) && (
												<Badge
													variant="secondary"
													className="ml-2 border border-border/70 bg-secondary/72 text-xs"
												>
													{(selectedDate ? 1 : 0) +
														selectedDayNightPeriods.length}
												</Badge>
											)}
										</AccordionTrigger>
										<AccordionContent>
											{/* Compact Days Section for Accordion */}
											<div className="space-y-3">
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

												<DatePickerControl compact />
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
										<TooltipProvider>
											<Tooltip>
												<TooltipTrigger
													render={
														<button
															className="h-4 w-4 ml-2 text-muted-foreground cursor-help focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
															type="button"
															aria-label="Show day and night time definitions"
														/>
													}
												>
													<Info className="h-4 w-4" />
												</TooltipTrigger>
												<TooltipContent>
													<div className="text-sm space-y-1">
														<p className="inline-flex items-center gap-1.5">
															<strong>Day:</strong> 6:00 AM - 9:59 PM
															<Sun className="h-3.5 w-3.5" />
														</p>
														<p className="inline-flex items-center gap-1.5">
															<strong>Night:</strong> 10:00 PM - 5:59 AM
															<Moon className="h-3.5 w-3.5" />
														</p>
													</div>
												</TooltipContent>
											</Tooltip>
										</TooltipProvider>
									</div>

									<div className="space-y-2">
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

										<DatePickerControl />
									</div>
								</div>

								{/* OOOC Picks */}
								<div className={sectionClassName}>
									<h3 className={sectionTitleClassName}>OOOC Picks</h3>
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
									<h3 className={sectionTitleClassName}>Venue Type</h3>
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

								{/* Nationality */}
								<div className={sectionClassName}>
									<h3 className={sectionTitleClassName}>
										Nationality{" "}
										{selectedNationalities.length > 1 && (
											<span className="text-sm text-muted-foreground font-normal">
												(must INCLUDE)
											</span>
										)}
									</h3>
									<div className="grid grid-cols-3 gap-1">
										{NATIONALITIES.map(({ key, flag, shortCode }) => (
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
										<div className="flex justify-between text-xs text-muted-foreground">
											<span>€{PRICE_RANGE_CONFIG.min}</span>
											<span className="font-medium text-center">
												{formatPriceRange(selectedPriceRange)}
											</span>
											<span>€{PRICE_RANGE_CONFIG.max}+</span>
										</div>
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
									<h3 className={sectionTitleClassName}>Age Range</h3>
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
										<div className="flex justify-between text-xs text-muted-foreground">
											<span>{AGE_RANGE_CONFIG.min} or less</span>
											<span className="font-medium text-center">
												{selectedAgeRange
													? formatAgeRange(selectedAgeRange)
													: "All ages"}
											</span>
											<span>{AGE_RANGE_CONFIG.max}+</span>
										</div>
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
									<div className="relative contain-layout">
										<div className="grid grid-cols-2 gap-1 max-h-48 min-h-[12rem] overflow-y-auto rounded-md border border-border/70 bg-background/55 p-2">
											{MUSIC_GENRES.map(({ key, label, color }) => (
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
										</div>
										<div className="absolute top-2 left-2 right-2 h-2 bg-gradient-to-b from-muted/40 to-transparent pointer-events-none" />
										<div className="absolute bottom-2 left-2 right-2 h-2 bg-gradient-to-t from-muted/40 to-transparent pointer-events-none" />
										<div className="mt-1 h-4 text-center text-xs text-muted-foreground/88">
											{MUSIC_GENRES.length} genres
										</div>
									</div>
								</div>

								{/* Arrondissements */}
								<div className={sectionClassName}>
									<h3 className={sectionTitleClassName}>Arrondissements</h3>
									<div className="grid grid-cols-4 lg:grid-cols-5 gap-1 min-h-[7rem] content-start">
										{availableArrondissements.map((arr) => (
											<Toggle
												key={arr}
												pressed={selectedArrondissements.includes(arr)}
												onPressedChange={() => onArrondissementToggle(arr)}
												size="sm"
												className={denseToggleClassName}
											>
												{arr === "unknown" ? "TBC" : `${arr}e`}
											</Toggle>
										))}
									</div>
								</div>
							</div>
						)}

						{/* Active Filters - Bottom when many filters */}
						{!uiDecisions.activeFiltersAtTop && <ActiveFiltersDisplay />}
					</CardContent>
					<div className="flex items-center justify-between gap-2 border-t border-border/70 bg-background/76 px-4 py-3 lg:hidden">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={onClearFilters}
							className="h-8 rounded-full border-border/75 bg-background/70 px-3 text-xs hover:bg-accent"
						>
							Clear filters
						</Button>
						<Button
							type="button"
							size="sm"
							onClick={onClose}
							className="h-8 rounded-full px-4 text-xs"
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
