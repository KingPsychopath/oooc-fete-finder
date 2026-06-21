import type { SharedPlan, UserPlanStop } from "@/features/plans/types";

export type PublishedPlanStatus = "draft" | "active" | "archived" | "disabled";
export type PublishedPlanAliasStatus = "active" | "redirect" | "gone";
export type PublishedPlanKind = "official_plan";
export type PublishedPlanSourceStatus =
	| "current"
	| "changed"
	| "deleted"
	| "unshared"
	| "unknown"
	| "none";

export type PublishedPlanStopSnapshot = Pick<
	UserPlanStop,
	| "eventKey"
	| "stopOrder"
	| "locked"
	| "arrivalTime"
	| "departureTime"
	| "travelMinutesFromPrevious"
>;

export interface PublishedPlanVersion {
	id: string;
	publishedPlanId: string;
	versionNumber: number;
	title: string;
	description: string;
	planDate: string;
	stops: PublishedPlanStopSnapshot[];
	sourcePlanUpdatedAt: string | null;
	publishedBy: string | null;
	publishedAt: string;
	archivedAt: string | null;
}

export interface PublishedPlanAlias {
	pathSlug: string;
	publishedPlanId: string | null;
	targetVersionId: string | null;
	canonicalSlug: string | null;
	status: PublishedPlanAliasStatus;
	redirectToSlug: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface PublishedPlan {
	id: string;
	title: string;
	kind: PublishedPlanKind;
	status: PublishedPlanStatus;
	activeVersionId: string | null;
	sourcePlanId: string | null;
	sourceShareToken: string | null;
	createdBy: string | null;
	updatedBy: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface PublishedPlanAdminSummary {
	plan: PublishedPlan;
	activeVersion: PublishedPlanVersion | null;
	aliases: PublishedPlanAlias[];
	sourceStatus: PublishedPlanSourceStatus;
	sourcePlan: SharedPlan | null;
	stopCount: number;
}

export interface PublishedPlanResolution {
	plan: PublishedPlan;
	version: PublishedPlanVersion;
	alias: PublishedPlanAlias;
	canonicalSlug: string;
}

export interface PublishedPlanRedirectResolution {
	alias: PublishedPlanAlias;
	redirectToSlug: string;
}

export interface PublishedPlanGoneResolution {
	alias: PublishedPlanAlias;
}

export type PublishedPlanAliasResolution =
	| { kind: "published"; value: PublishedPlanResolution }
	| { kind: "redirect"; value: PublishedPlanRedirectResolution }
	| { kind: "gone"; value: PublishedPlanGoneResolution }
	| { kind: "not_found" };

export interface SharedPlanSearchResult {
	id: string;
	shareToken: string;
	title: string;
	planDate: string;
	ownerDisplayName: string;
	stopCount: number;
	updatedAt: string;
}
