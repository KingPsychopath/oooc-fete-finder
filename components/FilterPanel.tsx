"use client";

import type React from "react";
import { useState, useRef, useEffect, useMemo, useCallback, memo } from "react";
import { Filter, X, Info, ChevronDown } from "lucide-react";
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
	EVENT_TYPES,
	NATIONALITIES,
	PRICE_RANGE_CONFIG,
	formatPriceRange,
	type EventDay,
	type DayNightPeriod,
	type MusicGenre,
	type EventType,
	type Nationality,
	type ParisArrondissement,
} from "@/types/events";
import { Slider } from "@/components/ui/slider";

type FilterPanelProps = {
	selectedDays: EventDay[];
	selectedDayNightPeriods: DayNightPeriod[];
	selectedArrondissements: ParisArrondissement[];
	selectedGenres: MusicGenre[];
	selectedEventTypes: EventType[];
	selectedNationalities: Nationality[];
	selectedIndoorPreference: boolean | null;
	selectedPriceRange: [number, number];
	onDayToggle: (day: EventDay) => void;
	onDayNightPeriodToggle: (period: DayNightPeriod) => void;
	onArrondissementToggle: (arrondissement: ParisArrondissement) => void;
	onGenreToggle: (genre: MusicGenre) => void;
	onEventTypeToggle: (eventType: EventType) => void;
	onNationalityToggle: (nationality: Nationality) => void;
	onIndoorPreferenceChange: (preference: boolean | null) => void;
	onPriceRangeChange: (range: [number, number]) => void;
	onClearFilters: () => void;
	availableArrondissements: ParisArrondissement[];
	isOpen: boolean;
	onClose: () => void;
	onOpen?: () => void;
};

const FilterPanel: React.FC<FilterPanelProps> = ({
	selectedDays,
	selectedDayNightPeriods,
	selectedArrondissements,
	selectedGenres,
	selectedEventTypes,
	selectedNationalities,
	selectedIndoorPreference,
	selectedPriceRange,
	onDayToggle,
	onDayNightPeriodToggle,
	onArrondissementToggle,
	onGenreToggle,
	onEventTypeToggle,
	onNationalityToggle,
	onIndoorPreferenceChange,
	onPriceRangeChange,
	onClearFilters,
	availableArrondissements,
	isOpen,
	onClose,
	onOpen,
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

	// Memoize the hasActiveFilters calculation
	const hasActiveFilters = useMemo(
		() =>
			selectedDays.length > 0 ||
			selectedDayNightPeriods.length > 0 ||
			selectedArrondissements.length > 0 ||
			selectedGenres.length > 0 ||
			selectedEventTypes.length > 0 ||
			selectedNationalities.length > 0 ||
			selectedIndoorPreference !== null ||
			selectedPriceRange[0] !== PRICE_RANGE_CONFIG.min ||
			selectedPriceRange[1] !== PRICE_RANGE_CONFIG.max,
		[
			selectedDays,
			selectedDayNightPeriods,
			selectedArrondissements,
			selectedGenres,
			selectedEventTypes,
			selectedNationalities,
			selectedIndoorPreference,
			selectedPriceRange,
		],
	);

	// Memoize the active filter count
	const activeFilterCount = useMemo(() => {
		return (
			selectedDays.length +
			selectedDayNightPeriods.length +
			selectedArrondissements.length +
			selectedGenres.length +
			selectedEventTypes.length +
			selectedNationalities.length +
			(selectedIndoorPreference !== null ? 1 : 0) +
			(selectedPriceRange[0] !== PRICE_RANGE_CONFIG.min ||
			selectedPriceRange[1] !== PRICE_RANGE_CONFIG.max
				? 1
				: 0)
		);
	}, [
		selectedDays,
		selectedDayNightPeriods,
		selectedArrondissements,
		selectedGenres,
		selectedEventTypes,
		selectedNationalities,
		selectedIndoorPreference,
		selectedPriceRange,
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

	// Active Filters Component (reusable)
	const ActiveFiltersDisplay = () => (
		<div className={`transition-all duration-200 ease-in-out ${hasActiveFilters ? 'pb-4 border-b opacity-100' : 'h-0 overflow-hidden opacity-0'}`}>
			{hasActiveFilters && (
				<>
					<div className="text-xs font-medium text-muted-foreground mb-2">
						Active Filters ({activeFilterCount}):
					</div>
					<div className="flex flex-wrap gap-2 min-h-[28px]">
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
						{selectedEventTypes.map((eventType) => (
							<Badge key={eventType} variant="secondary" className="text-xs">
								{EVENT_TYPES.find((t) => t.key === eventType)?.label}
								<Button
									variant="ghost"
									size="sm"
									className="h-auto p-0 ml-1 hover:bg-transparent"
									onClick={() => onEventTypeToggle(eventType)}
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
					<Card className="h-fit">
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
							<CardTitle className="flex items-center">
								<Filter className="h-5 w-5 mr-2" />
								Filters
								{hasActiveFilters && (
									<Badge variant="secondary" className="ml-2 text-xs">
										{activeFilterCount}
									</Badge>
								)}
							</CardTitle>
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
						</CardHeader>

						<CardContent className="space-y-6">
							{/* Active Filters - Top when few filters */}
							{uiDecisions.activeFiltersAtTop && <ActiveFiltersDisplay />}

							{/* Conditional Layout: Accordion vs Expanded */}
							{uiDecisions.useAccordion ? (
								// Accordion Layout when space is needed
								<Accordion
									type="multiple"
									value={openAccordionSections}
									onValueChange={setOpenAccordionSections}
									className="w-full"
								>
									<AccordionItem value="days">
										<AccordionTrigger className="text-sm font-medium">
											Days & Times
											{(selectedDays.length > 0 || selectedDayNightPeriods.length > 0) && (
												<Badge variant="secondary" className="ml-2 text-xs">
													{selectedDays.length + selectedDayNightPeriods.length}
												</Badge>
											)}
										</AccordionTrigger>
										<AccordionContent>
											{/* Compact Days Section for Accordion */}
											<div className="space-y-3">
												<div className="grid grid-cols-2 gap-2">
													{EVENT_DAYS.map(({ key, label, color }) => (
														<Toggle
															key={key}
															pressed={selectedDays.includes(key)}
															onPressedChange={() => onDayToggle(key)}
															size="sm"
															className="text-xs justify-start"
														>
															<div className={`w-2 h-2 rounded-full ${color} mr-1.5`} />
															{label}
														</Toggle>
													))}
												</div>
												{selectedDays.length > 0 && (
													<div className="flex flex-wrap gap-1">
														{DAY_NIGHT_PERIODS.map(({ key, label, icon }) => (
															<Toggle
																key={key}
																pressed={selectedDayNightPeriods.includes(key)}
																onPressedChange={() => onDayNightPeriodToggle(key)}
																size="sm"
																className="text-xs"
															>
																{icon} {label}
															</Toggle>
														))}
													</div>
												)}
											</div>
										</AccordionContent>
									</AccordionItem>
									{/* Add other accordion sections here when needed */}
								</Accordion>
							) : (
								// Expanded Layout when space allows
								<div className="space-y-4">
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
															<p><strong>Day:</strong> 6:00 AM - 9:59 PM ☀️</p>
															<p><strong>Night:</strong> 10:00 PM - 5:59 AM 🌙</p>
														</div>
													</TooltipContent>
												</Tooltip>
											</TooltipProvider>
										</div>

										<div className="space-y-2">
											<div className="grid grid-cols-2 gap-2">
												{EVENT_DAYS.map(({ key, label, color }) => (
													<div key={key} className="space-y-1">
														<Toggle
															pressed={selectedDays.includes(key)}
															onPressedChange={() => onDayToggle(key)}
															className="justify-start w-full h-8"
															size="sm"
														>
															<div className={`w-2 h-2 rounded-full ${color} mr-1.5`} />
															<span className="text-xs">{label}</span>
														</Toggle>

														{selectedDays.includes(key) && (
															<div className="ml-4 flex flex-wrap gap-1">
																{DAY_NIGHT_PERIODS.map(
																	({ key: periodKey, label: periodLabel, icon }) => (
																		<Toggle
																			key={periodKey}
																			pressed={selectedDayNightPeriods.includes(periodKey)}
																			onPressedChange={() =>
																				onDayNightPeriodToggle(periodKey)
																			}
																			size="sm"
																			className="text-xs h-6 px-2"
																		>
																			{icon} {periodLabel}
																		</Toggle>
																	),
																)}
															</div>
														)}
													</div>
												))}
											</div>
										</div>
									</div>

									{/* Rest of desktop sections with compact styling */}
									{/* Event Types */}
									<div>
										<h3 className="font-semibold mb-3">Event Types</h3>
										<div className="space-y-1">
											{EVENT_TYPES.map(({ key, label, icon }) => (
												<Toggle
													key={key}
													pressed={selectedEventTypes.includes(key)}
													onPressedChange={() => onEventTypeToggle(key)}
													className="justify-start w-full h-8"
													size="sm"
												>
													<span className="mr-1.5 text-sm">{icon}</span>
													<span className="text-xs">{label}</span>
												</Toggle>
											))}
										</div>
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
												pressed={selectedIndoorPreference === null}
												onPressedChange={() => onIndoorPreferenceChange(null)}
												className="justify-start w-full h-8"
												size="sm"
											>
												<span className="text-xs">Both Indoor & Outdoor</span>
											</Toggle>
											<Toggle
												pressed={selectedIndoorPreference === true}
												onPressedChange={() => onIndoorPreferenceChange(true)}
												className="justify-start w-full h-8"
												size="sm"
											>
												<span className="text-xs">🏢 Indoor Only</span>
											</Toggle>
											<Toggle
												pressed={selectedIndoorPreference === false}
												onPressedChange={() => onIndoorPreferenceChange(false)}
												className="justify-start w-full h-8"
												size="sm"
											>
												<span className="text-xs">🌤️ Outdoor Only</span>
											</Toggle>
										</div>
									</div>

									{/* Price Range */}
									<div>
										<h3 className="font-semibold mb-3">Price Range</h3>
										<div className="space-y-2 px-1">
											<Slider
												value={selectedPriceRange}
												onValueChange={(value) => onPriceRangeChange(value as [number, number])}
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
														<div className={`w-2 h-2 rounded-full ${color} mr-1.5 flex-shrink-0`} />
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
									{activeFilterCount}
								</Badge>
							)}
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
											{(selectedDays.length > 0 || selectedDayNightPeriods.length > 0) && (
												<Badge variant="secondary" className="ml-2 text-xs">
													{selectedDays.length + selectedDayNightPeriods.length}
												</Badge>
											)}
										</AccordionTrigger>
										<AccordionContent>
											{/* Compact Days Section for Accordion */}
											<div className="space-y-3">
												<div className="grid grid-cols-2 gap-2">
													{EVENT_DAYS.map(({ key, label, color }) => (
														<Toggle
															key={key}
															pressed={selectedDays.includes(key)}
															onPressedChange={() => onDayToggle(key)}
															size="sm"
															className="text-xs justify-start"
														>
															<div className={`w-2 h-2 rounded-full ${color} mr-1.5`} />
															{label}
														</Toggle>
													))}
												</div>
												{selectedDays.length > 0 && (
													<div className="flex flex-wrap gap-1">
														{DAY_NIGHT_PERIODS.map(({ key, label, icon }) => (
															<Toggle
																key={key}
																pressed={selectedDayNightPeriods.includes(key)}
																onPressedChange={() => onDayNightPeriodToggle(key)}
																size="sm"
																className="text-xs"
															>
																{icon} {label}
															</Toggle>
														))}
													</div>
												)}
											</div>
										</AccordionContent>
									</AccordionItem>
									{/* Add other accordion sections here */}
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
														<p><strong>Day:</strong> 6:00 AM - 9:59 PM ☀️</p>
														<p><strong>Night:</strong> 10:00 PM - 5:59 AM 🌙</p>
													</div>
												</TooltipContent>
											</Tooltip>
										</TooltipProvider>
									</div>

									<div className="space-y-2">
										<div className="grid grid-cols-2 gap-2">
											{EVENT_DAYS.map(({ key, label, color }) => (
												<div key={key} className="space-y-1">
													<Toggle
														pressed={selectedDays.includes(key)}
														onPressedChange={() => onDayToggle(key)}
														className="justify-start w-full h-8"
														size="sm"
													>
														<div className={`w-2 h-2 rounded-full ${color} mr-1.5`} />
														<span className="text-xs">{label}</span>
													</Toggle>

													{selectedDays.includes(key) && (
														<div className="ml-4 flex flex-wrap gap-1">
															{DAY_NIGHT_PERIODS.map(
																({ key: periodKey, label: periodLabel, icon }) => (
																	<Toggle
																		key={periodKey}
																		pressed={selectedDayNightPeriods.includes(periodKey)}
																		onPressedChange={() =>
																			onDayNightPeriodToggle(periodKey)
																		}
																		size="sm"
																		className="text-xs h-6 px-2"
																	>
																		{icon} {periodLabel}
																	</Toggle>
																),
															)}
														</div>
													)}
												</div>
											))}
										</div>
									</div>
								</div>

								{/* Event Types */}
								<div>
									<h3 className="font-semibold mb-3">Event Types</h3>
									<div className="space-y-1">
										{EVENT_TYPES.map(({ key, label, icon }) => (
											<Toggle
												key={key}
												pressed={selectedEventTypes.includes(key)}
												onPressedChange={() => onEventTypeToggle(key)}
												className="justify-start w-full h-8"
												size="sm"
											>
												<span className="mr-1.5 text-sm">{icon}</span>
												<span className="text-xs">{label}</span>
											</Toggle>
										))}
									</div>
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
											pressed={selectedIndoorPreference === null}
											onPressedChange={() => onIndoorPreferenceChange(null)}
											className="justify-start w-full h-8"
											size="sm"
										>
											<span className="text-xs">Both Indoor & Outdoor</span>
										</Toggle>
										<Toggle
											pressed={selectedIndoorPreference === true}
											onPressedChange={() => onIndoorPreferenceChange(true)}
											className="justify-start w-full h-8"
											size="sm"
										>
											<span className="text-xs">🏢 Indoor Only</span>
										</Toggle>
										<Toggle
											pressed={selectedIndoorPreference === false}
											onPressedChange={() => onIndoorPreferenceChange(false)}
											className="justify-start w-full h-8"
											size="sm"
										>
											<span className="text-xs">🌤️ Outdoor Only</span>
										</Toggle>
									</div>
								</div>

								{/* Price Range */}
								<div>
									<h3 className="font-semibold mb-3">Price Range</h3>
									<div className="space-y-2 px-1">
										<Slider
											value={selectedPriceRange}
											onValueChange={(value) => onPriceRangeChange(value as [number, number])}
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
													<div className={`w-2 h-2 rounded-full ${color} mr-1.5 flex-shrink-0`} />
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

						{/* Active Filters - Bottom (Desktop when many filters) */}
						{!uiDecisions.activeFiltersAtTop && <ActiveFiltersDisplay />}
					</CardContent>
				</Card>
			</div>
		</div>
	);
};

export default FilterPanel;
