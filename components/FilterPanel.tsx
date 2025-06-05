"use client";

import type React from "react";
import { useState, useRef, useEffect, useMemo, useCallback, memo } from "react";
import { Filter, X, Info, ChevronDown, ChevronUp, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Toggle } from "@/components/ui/toggle";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { useOutsideClick } from "@/lib/useOutsideClick";
import {
	EVENT_DAYS,
	DAY_NIGHT_PERIODS,
	MUSIC_GENRES,
	NATIONALITIES,
	PRICE_RANGE_CONFIG,
	formatPriceRange,
	AGE_RANGE_CONFIG,
	formatAgeRange,
	type EventDay,
	type DayNightPeriod,
	type MusicGenre,
	type Nationality,
	type ParisArrondissement,
	type AgeRange,
} from "@/types/events";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type FilterPanelProps = {
	selectedDays: EventDay[];
	selectedDayNightPeriods: DayNightPeriod[];
	selectedArrondissements: ParisArrondissement[];
	selectedGenres: MusicGenre[];
	selectedNationalities: Nationality[];
	selectedIndoorPreference: boolean | null;
	selectedPriceRange: [number, number];
	selectedAgeRange: AgeRange | null;
	selectedOOOCPicks: boolean;
	onDayToggle: (day: EventDay) => void;
	onDayNightPeriodToggle: (period: DayNightPeriod) => void;
	onArrondissementToggle: (arrondissement: ParisArrondissement) => void;
	onGenreToggle: (genre: MusicGenre) => void;
	onNationalityToggle: (nationality: Nationality) => void;
	onIndoorPreferenceChange: (preference: boolean | null) => void;
	onPriceRangeChange: (range: [number, number]) => void;
	onAgeRangeChange: (range: AgeRange | null) => void;
	onOOOCPicksToggle: (selected: boolean) => void;
	onClearFilters: () => void;
	availableArrondissements: ParisArrondissement[];
	availableEventDays: EventDay[];
	filteredEventsCount: number;
	isOpen: boolean;
	onClose: () => void;
	onOpen?: () => void;
	isExpanded?: boolean;
	onToggleExpanded?: () => void;
};

const FilterPanel: React.FC<FilterPanelProps> = ({
	selectedDays,
	selectedDayNightPeriods,
	selectedArrondissements,
	selectedGenres,
	selectedNationalities,
	selectedIndoorPreference,
	selectedPriceRange,
	selectedAgeRange,
	selectedOOOCPicks,
	onDayToggle,
	onDayNightPeriodToggle,
	onArrondissementToggle,
	onGenreToggle,
	onNationalityToggle,
	onIndoorPreferenceChange,
	onPriceRangeChange,
	onAgeRangeChange,
	onOOOCPicksToggle,
	onClearFilters,
	availableArrondissements,
	availableEventDays,
	filteredEventsCount,
	isOpen,
	onClose,
	onOpen,
	isExpanded,
	onToggleExpanded,
}) => {
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
			selectedDays.length > 0 ||
			selectedDayNightPeriods.length > 0 ||
			selectedArrondissements.length > 0 ||
			selectedGenres.length > 0 ||
			selectedNationalities.length > 0 ||
			selectedIndoorPreference !== null ||
			selectedPriceRange[0] !== PRICE_RANGE_CONFIG.min ||
			selectedPriceRange[1] !== PRICE_RANGE_CONFIG.max ||
			(selectedAgeRange !== null &&
				(selectedAgeRange[0] !== AGE_RANGE_CONFIG.min ||
					selectedAgeRange[1] !== AGE_RANGE_CONFIG.max)) ||
			selectedOOOCPicks,
		[
			selectedDays,
			selectedDayNightPeriods,
			selectedArrondissements,
			selectedGenres,
			selectedNationalities,
			selectedIndoorPreference,
			selectedPriceRange,
			selectedAgeRange,
			selectedOOOCPicks,
		],
	);

	// Memoize the active filter count
	const activeFilterCount = useMemo(() => {
		return (
			selectedDays.length +
			selectedDayNightPeriods.length +
			selectedArrondissements.length +
			selectedGenres.length +
			selectedNationalities.length +
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
		selectedDays,
		selectedDayNightPeriods,
		selectedArrondissements,
		selectedGenres,
		selectedNationalities,
		selectedIndoorPreference,
		selectedPriceRange,
		selectedAgeRange,
		selectedOOOCPicks,
	]);

	// Decision logic for UI variations
	const uiDecisions = useMemo(() => {
		return {
			// Use accordion on desktop when space is limited or many filters are active
			useAccordion: activeFilterCount > 8,
			// Show active filters at top on mobile, bottom on desktop (unless many active)
			activeFiltersAtTop: activeFilterCount <= 5,
			// Use compact layout when many filters are active
			useCompactLayout: activeFilterCount > 10,
		};
	}, [activeFilterCount]);

	// Use outside click hook for mobile
	const panelRef = useOutsideClick<HTMLDivElement>(() => {
		if (isOpen) {
			onClose();
		}
	});

	// Filter EVENT_DAYS to only show days that are available in the events data
	const filteredEventDays = useMemo(() => {
		return EVENT_DAYS.filter(day => 
			availableEventDays.includes(day.key) || day.key === "tbc"
		);
	}, [availableEventDays]);

	// Active Filters Component (reusable)
	const ActiveFiltersDisplay = () => (
		<div
			className={`transition-all duration-200 ease-in-out ${hasActiveFilters ? "pb-4 border-b opacity-100" : "h-0 overflow-hidden opacity-0"}`}
		>
			{hasActiveFilters && (
				<>
					<div className="text-xs font-medium text-muted-foreground mb-2">
						Active Filters ({activeFilterCount}):
					</div>
					<div className="flex flex-wrap gap-2 min-h-[28px]">
						{selectedOOOCPicks && (
							<Badge variant="secondary" className="text-xs">
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
						{selectedDays.map((day) => (
							<Badge key={day} variant="secondary" className="text-xs">
								{EVENT_DAYS.find((d) => d.key === day)?.label}
								<Button
									variant="ghost"
									size="sm"
									className="h-auto p-0 ml-1 hover:bg-transparent"
									onClick={() => onDayToggle(day)}
								>
									<X className="h-3 w-3" />
								</Button>
							</Badge>
						))}
						{selectedDayNightPeriods.map((period) => (
							<Badge key={period} variant="secondary" className="text-xs">
								{DAY_NIGHT_PERIODS.find((p) => p.key === period)?.icon} {period}
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
							<Badge key={nationality} variant="secondary" className="text-xs">
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
						{selectedIndoorPreference !== null && (
							<Badge variant="secondary" className="text-xs">
								{selectedIndoorPreference ? "🏢 Indoor" : "🌤️ Outdoor"}
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
							<Badge variant="secondary" className="text-xs">
								💰 {formatPriceRange(selectedPriceRange)}
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
								<Badge variant="secondary" className="text-xs">
									👥 {formatAgeRange(selectedAgeRange)}
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
							<Badge key={arr} variant="secondary" className="text-xs">
								{arr === "unknown" ? "?" : `${arr}e`}
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
							<Badge key={genre} variant="secondary" className="text-xs">
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

	// Mobile floating button when closed - only show on mobile
	if (!isOpen) {
		return (
			<>
				{/* Mobile floating button */}
				<Button
					variant="outline"
					className="fixed bottom-4 right-4 z-40 shadow-lg lg:hidden"
					onClick={onOpen || onClose}
				>
					<Filter className="h-4 w-4 mr-2" />
					Filters
					{hasActiveFilters && (
						<Badge
							variant="destructive"
							className="ml-2 h-5 w-5 rounded-full p-0 text-xs"
						>
							{activeFilterCount}
						</Badge>
					)}
				</Button>

				{/* Desktop version - always visible */}
				<div className="hidden lg:block">
					<Card className="overflow-hidden">
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="flex items-center text-base">
								<Filter className="h-4 w-4 mr-2" />
								Event Filters
								{hasActiveFilters && (
									<Badge variant="secondary" className="ml-2 text-xs">
										{activeFilterCount} active
									</Badge>
								)}
								<Badge variant="outline" className="ml-2 text-xs">
									{filteredEventsCount} result{filteredEventsCount !== 1 ? 's' : ''}
								</Badge>
							</CardTitle>
							<div className="flex items-center space-x-2">
								{hasActiveFilters && (
									<Button
										variant="outline"
										size="sm"
										onClick={onClearFilters}
										className="text-xs h-7"
									>
										Clear all
									</Button>
								)}
								{onToggleExpanded && (
									<Button
										variant="ghost"
										size="sm"
										onClick={onToggleExpanded}
										className="text-muted-foreground hover:text-foreground"
									>
										{isExpanded ? (
											<>
												<ChevronUp className="h-4 w-4 mr-1" />
												Collapse
											</>
										) : (
											<>
												<ChevronDown className="h-4 w-4 mr-1" />
												Expand
											</>
										)}
									</Button>
								)}
							</div>
						</CardHeader>

						<CardContent
							className={`transition-all duration-300 ease-in-out overflow-hidden relative ${
								isExpanded === undefined || isExpanded
									? "max-h-[650px]"
									: "max-h-24"
							}`}
						>
							<div className="h-[calc(650px-4rem)] overflow-y-auto relative">
								{/* Active Filters - Top when few filters */}
								{uiDecisions.activeFiltersAtTop && <ActiveFiltersDisplay />}

								<Accordion
									type="multiple"
									value={openAccordionSections}
									onValueChange={setOpenAccordionSections}
									className="w-full space-y-2"
								>
									{/* Days & Times Section */}
									<AccordionItem value="days">
										<AccordionTrigger className="text-sm font-medium">
											Days & Times
											{(selectedDays.length > 0 ||
												selectedDayNightPeriods.length > 0) && (
												<Badge variant="secondary" className="ml-2 text-xs">
													{selectedDays.length + selectedDayNightPeriods.length}{" "}
													active
												</Badge>
											)}
										</AccordionTrigger>
										<AccordionContent>
											<div className="space-y-3">
												{/* Day/Night Periods */}
												<div className="p-1.5 bg-muted/20 rounded-md border overflow-hidden">
													<div className="flex items-center justify-between mb-1">
														<h4 className="text-xs font-medium truncate">
															Filter by Time
														</h4>
													</div>
													<div className="grid grid-cols-2 gap-1">
														{DAY_NIGHT_PERIODS.map(({ key, label, icon }) => (
															<Toggle
																key={key}
																pressed={selectedDayNightPeriods.includes(key)}
																onPressedChange={() =>
																	onDayNightPeriodToggle(key)
																}
																size="sm"
																className="text-xs h-6 px-2"
															>
																{icon} {label}
															</Toggle>
														))}
													</div>
												</div>

												{/* Days */}
												<div className="grid grid-cols-2 gap-1">
													{filteredEventDays.map(({ key, label, color }) => (
														<Toggle
															key={key}
															pressed={selectedDays.includes(key)}
															onPressedChange={() => onDayToggle(key)}
															className="text-xs justify-start"
															size="sm"
														>
															<div
																className={`w-2 h-2 rounded-full ${color} mr-1.5`}
															/>
															<span className="text-xs">{label}</span>
														</Toggle>
													))}
												</div>
											</div>
										</AccordionContent>
									</AccordionItem>

									{/* Location Section */}
									<AccordionItem value="location">
										<AccordionTrigger className="text-sm font-medium">
											Location
											{selectedArrondissements.length > 0 && (
												<Badge variant="secondary" className="ml-2 text-xs">
													{selectedArrondissements.length} active
												</Badge>
											)}
										</AccordionTrigger>
										<AccordionContent>
											<div className="space-y-3">
												<h3 className="font-medium text-sm mb-2">
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
															className="h-6 text-xs shrink-0"
														>
															{arr === "unknown" ? "?" : `${arr}e`}
														</Toggle>
													))}
												</div>
											</div>
										</AccordionContent>
									</AccordionItem>

									{/* Music & Culture Section */}
									<AccordionItem value="music">
										<AccordionTrigger className="text-sm font-medium">
											Music & Culture
											{(selectedGenres.length > 0 ||
												selectedNationalities.length > 0) && (
												<Badge variant="secondary" className="ml-2 text-xs">
													{selectedGenres.length + selectedNationalities.length}{" "}
													active
												</Badge>
											)}
										</AccordionTrigger>
										<AccordionContent>
											<div className="space-y-4">
												{/* Music Genres */}
												<div>
													<h3 className="font-medium text-sm mb-2">
														Music Genres
													</h3>
													<div className="relative contain-layout">
														<div className="grid grid-cols-2 gap-1 max-h-36 min-h-[8rem] overflow-y-auto border rounded-md p-1.5 bg-muted/20">
															{MUSIC_GENRES.map(({ key, label, color }) => (
																<Toggle
																	key={key}
																	pressed={selectedGenres.includes(key)}
																	onPressedChange={() => onGenreToggle(key)}
																	className="justify-start w-full h-6 shrink-0"
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
														<div className="text-xs text-muted-foreground mt-1 text-center opacity-70 flex items-center justify-center gap-1">
															<span>{MUSIC_GENRES.length} genres</span>
															<span className="text-muted-foreground/50">
																•
															</span>
															<span className="flex items-center gap-0.5">
																<span className="animate-bounce">↓</span>
																scroll
															</span>
														</div>
													</div>
												</div>

												{/* Nationality */}
												<div>
													<h3 className="font-medium text-sm mb-2">
														Nationality
													</h3>
													<div className="grid grid-cols-2 gap-1">
														{NATIONALITIES.map(({ key, flag, shortCode }) => (
															<Toggle
																key={key}
																pressed={selectedNationalities.includes(key)}
																onPressedChange={() => onNationalityToggle(key)}
																className="justify-start w-full h-7"
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
										<AccordionTrigger className="text-sm font-medium">
											Preferences
											{(selectedIndoorPreference !== null ||
												selectedPriceRange[0] !== PRICE_RANGE_CONFIG.min ||
												selectedPriceRange[1] !== PRICE_RANGE_CONFIG.max ||
												selectedAgeRange !== null ||
												selectedOOOCPicks) && (
												<Badge variant="secondary" className="ml-2 text-xs">
													{
														[
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
													<h3 className="font-medium text-sm mb-2">
														OOOC Picks
													</h3>
													<Toggle
														pressed={selectedOOOCPicks}
														onPressedChange={onOOOCPicksToggle}
														className="justify-start w-full h-7"
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
													<h3 className="font-medium text-sm mb-2">
														Venue Type
													</h3>
													<div className="grid grid-cols-2 gap-1">
														<Toggle
															pressed={selectedIndoorPreference === true}
															onPressedChange={(pressed) => {
																onIndoorPreferenceChange(pressed ? true : null);
															}}
															className="justify-start w-full h-7"
															size="sm"
														>
															<span className="text-xs">🏢 Indoor</span>
														</Toggle>
														<Toggle
															pressed={selectedIndoorPreference === false}
															onPressedChange={(pressed) => {
																onIndoorPreferenceChange(
																	pressed ? false : null,
																);
															}}
															className="justify-start w-full h-7"
															size="sm"
														>
															<span className="text-xs">🌤️ Outdoor</span>
														</Toggle>
													</div>
												</div>

												{/* Price Range */}
												<div>
													<h3 className="font-medium text-sm mb-2">
														Price Range
													</h3>
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
																	className="text-xs h-6 px-2"
																>
																	Clear price filter
																</Button>
															</div>
														)}
													</div>
												</div>

												{/* Age Range */}
												<div>
													<h3 className="font-medium text-sm mb-2">
														Age Range
													</h3>
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
																	className="text-xs h-6 px-2"
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

								{/* Scroll indicator at the bottom */}
								<div className="sticky bottom-0 left-0 right-0">
									<div className="h-8 bg-gradient-to-t from-background via-background/90 to-transparent pointer-events-none flex items-end justify-center pb-0.5 relative">
										<div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent blur-sm" />
										<div className="relative text-xs text-muted-foreground/70 flex items-center gap-1">
											<span className="animate-bounce">↓</span>
											scroll for more
										</div>
									</div>
								</div>
							</div>

							{/* Gradient overlay when collapsed */}
							{!(isExpanded === undefined || isExpanded) && (
								<div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-card to-transparent pointer-events-none" />
							)}
						</CardContent>
					</Card>
				</div>
			</>
		);
	}

	return (
		<div className="fixed inset-0 z-50 bg-black/50 lg:static lg:bg-transparent lg:z-auto">
			<div
				ref={panelRef}
				className="absolute right-0 top-0 h-full w-full max-w-sm bg-background border-l lg:static lg:max-w-none lg:border-l-0 lg:h-fit"
			>
				<Card className="h-full border-0 lg:border lg:h-fit">
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
						<CardTitle className="flex items-center">
							<Filter className="h-5 w-5 mr-2" />
							Filters
							{hasActiveFilters && (
								<Badge variant="secondary" className="ml-2 text-xs">
									{activeFilterCount} active
								</Badge>
							)}
							<Badge variant="outline" className="ml-2 text-xs">
								{filteredEventsCount} result{filteredEventsCount !== 1 ? 's' : ''}
							</Badge>
						</CardTitle>
						<div className="flex items-center space-x-2">
							{hasActiveFilters && (
								<Button
									variant="outline"
									size="sm"
									onClick={onClearFilters}
									className="text-xs"
								>
									Clear all
								</Button>
							)}
							<Button
								variant="outline"
								size="icon"
								onClick={onClose}
								className="h-8 w-8 lg:hidden"
							>
								<X className="h-4 w-4" />
							</Button>
						</div>
					</CardHeader>

					<CardContent className="space-y-6 overflow-y-auto lg:overflow-y-visible">
						{/* Active Filters - Top (Mobile) or when few filters */}
						{uiDecisions.activeFiltersAtTop && <ActiveFiltersDisplay />}

						{/* Conditional Layout: Accordion vs Expanded */}
						{uiDecisions.useAccordion ? (
							// Accordion Layout for Desktop when space is needed
							<div className="hidden lg:block">
								<Accordion
									type="multiple"
									value={openAccordionSections}
									onValueChange={setOpenAccordionSections}
									className="w-full"
								>
									<AccordionItem value="days">
										<AccordionTrigger className="text-sm font-medium">
											Days & Times
											{(selectedDays.length > 0 ||
												selectedDayNightPeriods.length > 0) && (
												<Badge variant="secondary" className="ml-2 text-xs">
													{selectedDays.length + selectedDayNightPeriods.length}
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
														{DAY_NIGHT_PERIODS.map(({ key, label, icon }) => (
															<Toggle
																key={key}
																pressed={selectedDayNightPeriods.includes(key)}
																onPressedChange={() =>
																	onDayNightPeriodToggle(key)
																}
																size="sm"
																className="text-xs px-1.5 py-1 sm:px-2 flex-1 justify-center min-w-0 truncate"
															>
																{icon} {label}
															</Toggle>
														))}
													</div>
												</div>

												{/* Days */}
												<div className="grid grid-cols-2 gap-2">
													{filteredEventDays.map(({ key, label, color }) => (
														<Toggle
															key={key}
															pressed={selectedDays.includes(key)}
															onPressedChange={() => onDayToggle(key)}
															size="sm"
															className={`text-xs justify-start`}
														>
															<div
																className={`w-2 h-2 rounded-full ${color} mr-1.5`}
															/>
															{label}
														</Toggle>
													))}
												</div>
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
								<div>
									<div className="flex items-center mb-3">
										<h3 className="font-semibold">Days & Times</h3>
										<TooltipProvider>
											<Tooltip>
												<TooltipTrigger asChild>
													<button
														className="h-4 w-4 ml-2 text-muted-foreground cursor-help focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-sm"
														type="button"
														aria-label="Show day and night time definitions"
													>
														<Info className="h-4 w-4" />
													</button>
												</TooltipTrigger>
												<TooltipContent>
													<div className="text-sm space-y-1">
														<p>
															<strong>Day:</strong> 6:00 AM - 9:59 PM ☀️
														</p>
														<p>
															<strong>Night:</strong> 10:00 PM - 5:59 AM 🌙
														</p>
													</div>
												</TooltipContent>
											</Tooltip>
										</TooltipProvider>
									</div>

									<div className="space-y-2">
										{/* Day/Night Periods */}
										<div className="p-2 bg-muted/20 rounded-md border overflow-hidden">
											<div className="flex items-center justify-between mb-2">
												<h4 className="text-sm font-medium truncate">
													Filter by Time
												</h4>
											</div>
											<div className="grid grid-cols-2 gap-2">
												{DAY_NIGHT_PERIODS.map(({ key, label, icon }) => (
													<Toggle
														key={key}
														pressed={selectedDayNightPeriods.includes(key)}
														onPressedChange={() => onDayNightPeriodToggle(key)}
														size="sm"
														className="text-xs h-8"
													>
														{icon} {label}
													</Toggle>
												))}
											</div>
										</div>

										{/* Days */}
										<div className="grid grid-cols-2 gap-2">
											{filteredEventDays.map(({ key, label, color }) => (
												<div key={key} className="space-y-1">
													<Toggle
														pressed={selectedDays.includes(key)}
														onPressedChange={() => onDayToggle(key)}
														className="justify-start w-full h-8"
														size="sm"
													>
														<div
															className={`w-2 h-2 rounded-full ${color} mr-1.5`}
														/>
														<span className="text-xs">{label}</span>
													</Toggle>
												</div>
											))}
										</div>
									</div>
								</div>

								{/* OOOC Picks */}
								<div>
									<h3 className="font-semibold mb-3">OOOC Picks</h3>
									<Toggle
										pressed={selectedOOOCPicks}
										onPressedChange={onOOOCPicksToggle}
										className="justify-start w-full h-8"
										size="sm"
									>
										<Star className="h-4 w-4 mr-2 fill-yellow-400" />
										<span className="text-xs">Show only OOOC Picks</span>
									</Toggle>
								</div>

								{/* Nationality */}
								<div>
									<h3 className="font-semibold mb-3">Nationality</h3>
									<div className="grid grid-cols-2 gap-1">
										{NATIONALITIES.map(({ key, flag, shortCode }) => (
											<Toggle
												key={key}
												pressed={selectedNationalities.includes(key)}
												onPressedChange={() => onNationalityToggle(key)}
												className="justify-start w-full h-8"
												size="sm"
											>
												<span className="mr-1.5 text-sm">{flag}</span>
												<span className="text-xs">{shortCode}</span>
											</Toggle>
										))}
									</div>
								</div>

								{/* Venue Type */}
								<div>
									<h3 className="font-semibold mb-3">Venue Type</h3>
									<div className="space-y-1">
										<Toggle
											pressed={selectedIndoorPreference === true}
											onPressedChange={(pressed) => {
												onIndoorPreferenceChange(pressed ? true : null);
											}}
											className="justify-start w-full h-8"
											size="sm"
										>
											<span className="text-xs">🏢 Indoor</span>
										</Toggle>
										<Toggle
											pressed={selectedIndoorPreference === false}
											onPressedChange={(pressed) => {
												onIndoorPreferenceChange(pressed ? false : null);
											}}
											className="justify-start w-full h-8"
											size="sm"
										>
											<span className="text-xs">🌤️ Outdoor</span>
										</Toggle>
									</div>
								</div>

								{/* Price Range */}
								<div>
									<h3 className="font-semibold mb-3">Price Range</h3>
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
													className="text-xs h-6 px-2"
												>
													Clear price filter
												</Button>
											</div>
										)}
									</div>
								</div>

								{/* Age Range */}
								<div>
									<h3 className="font-semibold mb-3">Age Range</h3>
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
													className="text-xs h-6 px-2"
												>
													Clear age filter
												</Button>
											</div>
										)}
									</div>
								</div>

								{/* Music Genres */}
								<div>
									<h3 className="font-semibold mb-3">Music Genres</h3>
									<div className="relative contain-layout">
										<div className="grid grid-cols-2 gap-1 max-h-48 min-h-[12rem] overflow-y-auto border rounded-md p-2 bg-muted/20">
											{MUSIC_GENRES.map(({ key, label, color }) => (
												<Toggle
													key={key}
													pressed={selectedGenres.includes(key)}
													onPressedChange={() => onGenreToggle(key)}
													className="justify-start w-full h-7 shrink-0"
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
										<div className="text-xs text-muted-foreground mt-1 text-center opacity-70 h-4">
											{MUSIC_GENRES.length} genres • scroll ↕
										</div>
									</div>
								</div>

								{/* Arrondissements */}
								<div>
									<h3 className="font-semibold mb-3">Arrondissements</h3>
									<div className="grid grid-cols-4 lg:grid-cols-5 gap-1 min-h-[7rem] content-start">
										{availableArrondissements.map((arr) => (
											<Toggle
												key={arr}
												pressed={selectedArrondissements.includes(arr)}
												onPressedChange={() => onArrondissementToggle(arr)}
												size="sm"
												className="h-7 text-xs shrink-0"
											>
												{arr === "unknown" ? "?" : `${arr}e`}
											</Toggle>
										))}
									</div>
								</div>
							</div>
						)}

						{/* Active Filters - Bottom when many filters */}
						{!uiDecisions.activeFiltersAtTop && <ActiveFiltersDisplay />}
					</CardContent>
				</Card>
			</div>
		</div>
	);
};

export default FilterPanel;
