export type AdminActivityActorType =
	| "admin_session"
	| "admin_key"
	| "cron"
	| "system";

export type AdminActivityCategory =
	| "auth"
	| "content"
	| "insights"
	| "operations"
	| "placements"
	| "settings";

export type AdminActivitySeverity = "info" | "warning" | "destructive";

export interface AdminActivityEvent {
	id: string;
	occurredAt: string;
	actorType: AdminActivityActorType;
	actorLabel: string;
	actorSessionJti: string | null;
	action: string;
	category: AdminActivityCategory;
	targetType: string;
	targetId: string | null;
	targetLabel: string | null;
	summary: string;
	metadata: Record<string, unknown>;
	severity: AdminActivitySeverity;
	href: string | null;
}

export interface AdminActivityRecordInput {
	actorType?: AdminActivityActorType;
	actorLabel?: string;
	actorSessionJti?: string | null;
	action: string;
	category: AdminActivityCategory;
	targetType: string;
	targetId?: string | null;
	targetLabel?: string | null;
	summary: string;
	metadata?: Record<string, unknown>;
	severity?: AdminActivitySeverity;
	href?: string | null;
}
