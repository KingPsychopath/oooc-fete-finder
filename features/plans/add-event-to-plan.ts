import type { Event } from "@/features/events/types";
import type { PlanUpsertInput, UserPlan } from "@/features/plans/types";

const WEEKDAY_LABELS = [
	"Sun",
	"Mon",
	"Tue",
	"Wed",
	"Thu",
	"Fri",
	"Sat",
] as const;
const MONTH_LABELS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
] as const;

const createPlanTitle = (date: string): string => {
	const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!match) return "My route";
	const year = Number.parseInt(match[1], 10);
	const monthIndex = Number.parseInt(match[2], 10) - 1;
	const day = Number.parseInt(match[3], 10);
	const parsed = new Date(Date.UTC(year, monthIndex, day));
	if (
		parsed.getUTCFullYear() !== year ||
		parsed.getUTCMonth() !== monthIndex ||
		parsed.getUTCDate() !== day
	) {
		return "My route";
	}
	return `Route for ${WEEKDAY_LABELS[parsed.getUTCDay()]} ${day} ${MONTH_LABELS[monthIndex]}`;
};

export const buildPlanWithAddedEvent = (
	event: Event,
	existingPlan: UserPlan | undefined,
): PlanUpsertInput => {
	const existingStops = existingPlan?.stops ?? [];
	const hasEvent = existingStops.some(
		(stop) =>
			stop.eventKey.trim().toLowerCase() ===
			event.eventKey.trim().toLowerCase(),
	);

	return {
		id: existingPlan?.id,
		planDate: event.date,
		title: existingPlan?.title ?? createPlanTitle(event.date),
		visibility: existingPlan?.visibility ?? "private",
		stops: hasEvent
			? existingStops
			: [
					...existingStops,
					{
						eventKey: event.eventKey,
						stopOrder: existingStops.length + 1,
						locked: true,
						arrivalTime: event.time ?? null,
						departureTime: event.endTime ?? null,
						travelMinutesFromPrevious: null,
					},
				],
	};
};
