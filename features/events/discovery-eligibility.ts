import type { DateRangeFilter } from "@/features/events/filtering";
import type { Event } from "@/features/events/types";
import { isStrictISODate } from "./date-utils";

type DiscoveryEligibilityOptions = {
	dateRange: DateRangeFilter;
};

export const isEventInDiscoveryDateRange = (
	event: Event,
	dateRange: DateRangeFilter,
): boolean => {
	if (!dateRange.from && !dateRange.to) return true;
	if (!isStrictISODate(event.date)) return false;
	if (dateRange.from && event.date < dateRange.from) return false;
	if (dateRange.to && event.date > dateRange.to) return false;
	return true;
};

export const getDiscoveryEligibleEvents = (
	events: Event[],
	options: DiscoveryEligibilityOptions,
): Event[] =>
	events.filter((event) =>
		event ? isEventInDiscoveryDateRange(event, options.dateRange) : false,
	);
