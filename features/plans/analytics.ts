"use client";

import {
	flushDiscoveryAnalytics,
	trackDiscoveryAnalytics,
} from "@/features/events/engagement/client-tracking";
import {
	type PlanAnalyticsAction,
	type PlanAnalyticsSurface,
	getPlanAnalyticsGroup,
} from "@/features/plans/analytics-events";

export type { PlanAnalyticsAction, PlanAnalyticsSurface };

interface PlanAnalyticsInput {
	action: PlanAnalyticsAction;
	surface: PlanAnalyticsSurface;
	planId?: string | null;
	planDate?: string | null;
	eventKey?: string | null;
	stopCount?: number | null;
	value?: string | number | boolean | null;
	flushImmediately?: boolean;
}

const cleanPart = (value: string): string =>
	value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9._:-]+/g, "_")
		.slice(0, 80);

const formatDetail = ({
	planId,
	planDate,
	eventKey,
	stopCount,
	value,
}: Omit<PlanAnalyticsInput, "action" | "surface">): string | undefined => {
	const parts = [
		planDate ? `date=${cleanPart(planDate)}` : null,
		planId ? `plan=${cleanPart(planId).slice(0, 24)}` : null,
		eventKey ? `event=${cleanPart(eventKey).slice(0, 96)}` : null,
		typeof stopCount === "number" && Number.isFinite(stopCount)
			? `stops=${Math.max(0, Math.min(99, Math.floor(stopCount)))}`
			: null,
		typeof value === "string" && value.trim()
			? `value=${cleanPart(value).slice(0, 80)}`
			: typeof value === "number" && Number.isFinite(value)
				? `value=${value}`
				: typeof value === "boolean"
					? `value=${value ? "true" : "false"}`
					: null,
	].filter((part): part is string => Boolean(part));

	return parts.length > 0 ? parts.join(";").slice(0, 280) : undefined;
};

export const trackPlanAnalytics = (input: PlanAnalyticsInput): void => {
	trackDiscoveryAnalytics({
		actionType: "plan_action",
		filterGroup: getPlanAnalyticsGroup(input.surface),
		filterValue: input.action,
		searchQuery: formatDetail(input),
	});
	if (input.flushImmediately) {
		flushDiscoveryAnalytics(true);
	}
};
