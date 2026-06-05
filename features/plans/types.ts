import type { EventExperienceCategory } from "@/features/events/types";

export type PlanVisibility = "private" | "unlisted";

export type PlanSuggestionMode = "balanced" | "close" | "saved" | "vibe";

export const MAX_PLANS_PER_DATE = 10;

export interface PlanPreferenceInput {
	date: string;
	stopCount: number;
	startPeriod: "day" | "evening" | "late" | "anytime";
	routeStartTime: string | null;
	anchoredStops: Array<{
		eventKey: string;
		stopOrder: number;
	}>;
	vibes: EventExperienceCategory[];
	travelTolerance: "close" | "balanced" | "adventurous";
	budget: "free" | "low" | "any";
	mustIncludeEventKeys: string[];
	preferSavedEvents: boolean;
}

export interface UserPlanStop {
	id: string;
	eventKey: string;
	stopOrder: number;
	locked: boolean;
	arrivalTime: string | null;
	departureTime: string | null;
	travelMinutesFromPrevious: number | null;
	createdAt: string;
	updatedAt: string;
}

export interface UserPlan {
	id: string;
	userId: string | null;
	ownerKey: string;
	planDate: string;
	title: string;
	visibility: PlanVisibility;
	shareToken: string | null;
	shareOwnerNameVisible: boolean;
	stops: UserPlanStop[];
	createdAt: string;
	updatedAt: string;
}

export interface SharedPlan extends UserPlan {
	ownerDisplayName: string;
}

export interface PlanRouteLeg {
	fromEventKey: string;
	toEventKey: string;
	distanceKm: number | null;
	estimatedMinutes: number | null;
}

export interface SuggestedPlan {
	id: string;
	title: string;
	date: string;
	mode: PlanSuggestionMode;
	eventKeys: string[];
	score: number;
	reasons: string[];
	legs: PlanRouteLeg[];
	preferences: PlanPreferenceInput;
}

export interface PlanUpsertInput {
	id?: string;
	planDate: string;
	title: string;
	visibility: PlanVisibility;
	shareOwnerNameVisible?: boolean;
	stops: Array<{
		id?: string;
		eventKey: string;
		stopOrder: number;
		locked?: boolean;
		arrivalTime?: string | null;
		departureTime?: string | null;
		travelMinutesFromPrevious?: number | null;
	}>;
}
