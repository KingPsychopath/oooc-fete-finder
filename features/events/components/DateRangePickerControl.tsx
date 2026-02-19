"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Toggle } from "@/components/ui/toggle";
import type { DateRangeFilter } from "@/features/events/filtering";
import { CalendarDays } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";

type DateRangePickerControlProps = {
	compact?: boolean;
	mobileNative?: boolean;
	selectedDateRange: DateRangeFilter;
	onDateRangeChange: (dateRange: DateRangeFilter) => void;
	availableEventDates: string[];
	quickSelectEventDates: string[];
	formatDateLabel: (isoDate: string) => string;
	formatDateRangeLabel: (dateRange: DateRangeFilter) => string;
	sectionClassName: string;
	sectionTitleClassName: string;
	denseToggleClassName: string;
};

function DateRangePickerControl({
	compact = false,
	mobileNative = false,
	selectedDateRange,
	onDateRangeChange,
	availableEventDates,
	quickSelectEventDates,
	formatDateLabel,
	formatDateRangeLabel,
	sectionClassName,
	sectionTitleClassName,
	denseToggleClassName,
}: DateRangePickerControlProps) {
	const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);

	const hasSelectedDateRange =
		selectedDateRange.from !== null || selectedDateRange.to !== null;

	const toLocalDate = useCallback((isoDate: string | null): Date | undefined => {
		if (!isoDate) return undefined;
		const [year, month, day] = isoDate.split("-").map(Number);
		if (!year || !month || !day) return undefined;
		return new Date(year, month - 1, day);
	}, []);

	const toISODate = useCallback((date: Date | undefined): string | null => {
		if (!date) return null;
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const day = String(date.getDate()).padStart(2, "0");
		return `${year}-${month}-${day}`;
	}, []);

	const dateBounds = useMemo(() => {
		if (availableEventDates.length === 0)
			return { min: undefined, max: undefined };
		return {
			min: availableEventDates[0],
			max: availableEventDates[availableEventDates.length - 1],
		};
	}, [availableEventDates]);

	const calendarDateBounds = useMemo(
		() => ({
			min: toLocalDate(dateBounds.min ?? null),
			max: toLocalDate(dateBounds.max ?? null),
		}),
		[dateBounds.max, dateBounds.min, toLocalDate],
	);

	const selectedCalendarRange = useMemo<DateRange | undefined>(() => {
		const from = toLocalDate(selectedDateRange.from);
		const to = toLocalDate(selectedDateRange.to);
		if (!from && !to) return undefined;
		return { from, to };
	}, [selectedDateRange.from, selectedDateRange.to, toLocalDate]);

	const defaultCalendarMonth = useMemo(() => {
		if (selectedCalendarRange?.from) return selectedCalendarRange.from;
		if (selectedCalendarRange?.to) return selectedCalendarRange.to;

		const now = new Date();
		const nowMonthIndex = now.getFullYear() * 12 + now.getMonth();
		const monthStarts = new Map<number, Date>();

		for (const isoDate of availableEventDates) {
			const parsed = toLocalDate(isoDate);
			if (!parsed) continue;
			const monthStart = new Date(parsed.getFullYear(), parsed.getMonth(), 1);
			const monthIndex = monthStart.getFullYear() * 12 + monthStart.getMonth();
			if (!monthStarts.has(monthIndex)) {
				monthStarts.set(monthIndex, monthStart);
			}
		}

		const sortedCandidates = Array.from(monthStarts.entries()).sort(
			([leftIndex], [rightIndex]) => {
				const leftDistance = Math.abs(leftIndex - nowMonthIndex);
				const rightDistance = Math.abs(rightIndex - nowMonthIndex);
				if (leftDistance !== rightDistance) return leftDistance - rightDistance;

				const leftIsPast = leftIndex < nowMonthIndex;
				const rightIsPast = rightIndex < nowMonthIndex;
				if (leftIsPast !== rightIsPast) return leftIsPast ? 1 : -1;

				return leftIndex - rightIndex;
			},
		);

		if (sortedCandidates.length > 0) {
			return sortedCandidates[0][1];
		}

		return new Date(now.getFullYear(), now.getMonth(), 1);
	}, [availableEventDates, selectedCalendarRange, toLocalDate]);

	return (
		<div className={sectionClassName}>
			<div className="flex items-center justify-between">
				<h4 className={sectionTitleClassName}>Pick Date Range</h4>
				{hasSelectedDateRange && (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-7 rounded-full border border-border/70 px-2 text-xs text-foreground/80 hover:bg-accent"
						onClick={() =>
							onDateRangeChange({
								from: null,
								to: null,
							})
						}
					>
						Clear
					</Button>
				)}
			</div>
			{mobileNative ? (
				<div className="grid grid-cols-2 gap-2">
					<Input
						type="date"
						value={selectedDateRange.from ?? ""}
						min={dateBounds.min}
						max={selectedDateRange.to ?? dateBounds.max}
						onChange={(event) =>
							onDateRangeChange({
								from: event.target.value || null,
								to: selectedDateRange.to,
							})
						}
						className="h-8 border-border/75 bg-background/68 text-xs"
						aria-label="Filter events from date"
					/>
					<Input
						type="date"
						value={selectedDateRange.to ?? ""}
						min={selectedDateRange.from ?? dateBounds.min}
						max={dateBounds.max}
						onChange={(event) =>
							onDateRangeChange({
								from: selectedDateRange.from,
								to: event.target.value || null,
							})
						}
						className="h-8 border-border/75 bg-background/68 text-xs"
						aria-label="Filter events to date"
					/>
				</div>
			) : (
				<Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
					<PopoverTrigger
						render={
							<Button
								variant="outline"
								className="h-8 w-full justify-start px-2.5 font-normal text-xs"
								aria-label="Open date range picker"
							>
								<CalendarDays data-icon="inline-start" className="h-3.5 w-3.5" />
								{hasSelectedDateRange ? (
									formatDateRangeLabel(selectedDateRange)
								) : (
									<span>Pick a date range</span>
								)}
							</Button>
						}
					/>
					<PopoverContent className="w-auto p-0" align="start">
						<Calendar
							mode="range"
							defaultMonth={defaultCalendarMonth}
							selected={selectedCalendarRange}
							onSelect={(range) => {
								const from = toISODate(range?.from);
								const to = toISODate(range?.to);
								onDateRangeChange({ from, to });
								if (from && to) {
									setIsDatePopoverOpen(false);
									return;
								}
								setIsDatePopoverOpen(true);
							}}
							numberOfMonths={2}
							disabled={(date) => {
								if (calendarDateBounds.min && date < calendarDateBounds.min) {
									return true;
								}
								if (calendarDateBounds.max && date > calendarDateBounds.max) {
									return true;
								}
								return false;
							}}
						/>
					</PopoverContent>
				</Popover>
			)}
			{quickSelectEventDates.length > 0 && (
				<div className={`grid ${compact ? "grid-cols-2" : "grid-cols-2"} gap-1`}>
					{quickSelectEventDates.slice(0, 4).map((date) => (
						<Toggle
							key={date}
							pressed={selectedDateRange.from === date && selectedDateRange.to === date}
							onPressedChange={(pressed) =>
								onDateRangeChange(
									pressed
										? {
												from: date,
												to: date,
											}
										: {
												from: null,
												to: null,
											},
								)
							}
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
}

export { DateRangePickerControl };
