import "server-only";

import type { Event } from "@/features/events/types";
import {
	type PromotedEventRepositorySession,
	getPromotedEventRepository,
} from "@/lib/platform/postgres/promoted-event-repository";
import {
	formatDateTimeInParis,
	parseParisDateTimeInput,
} from "../featured/paris-time";
import { PROMOTED_EVENTS_CONFIG } from "./constants";
import type {
	PromotedProjection,
	PromotedQueueItem,
	PromotedScheduleEntry,
	PromotedSlotConfig,
	PromotedState,
} from "./types";

const PROMOTED_SLOT_CONFIG: PromotedSlotConfig = {
	defaultDurationHours: PROMOTED_EVENTS_CONFIG.DEFAULT_DURATION_HOURS,
	timezone: PROMOTED_EVENTS_CONFIG.TIMEZONE,
	recentEndedWindowHours: PROMOTED_EVENTS_CONFIG.RECENT_ENDED_WINDOW_HOURS,
};

const toTimestamp = (value: string): number => {
	const parsed = new Date(value).getTime();
	return Number.isNaN(parsed) ? 0 : parsed;
};

const sortByEffectiveStart = (
	entries: readonly PromotedScheduleEntry[],
): PromotedScheduleEntry[] => {
	return [...entries].sort((left, right) => {
		const diff =
			toTimestamp(left.effectiveStartAt) - toTimestamp(right.effectiveStartAt);
		if (diff !== 0) return diff;
		return left.id.localeCompare(right.id);
	});
};

const deriveState = (
	entry: PromotedScheduleEntry,
	nowMs: number,
	recentWindowMs: number,
): PromotedState => {
	if (entry.status === "cancelled") return "cancelled";
	const startMs = toTimestamp(entry.effectiveStartAt);
	const endMs = toTimestamp(entry.effectiveEndAt);
	if (entry.status === "scheduled") {
		if (startMs <= nowMs && nowMs < endMs) return "active";
		if (nowMs < startMs) return "upcoming";
	}
	if (nowMs - endMs <= recentWindowMs) return "recent-ended";
	return "completed";
};

const buildProjectionFromEntries = (
	entries: PromotedScheduleEntry[],
	now: Date,
): PromotedProjection => {
	const nowMs = now.getTime();
	const recentWindowMs =
		PROMOTED_SLOT_CONFIG.recentEndedWindowHours * 60 * 60 * 1000;
	const active = entries.filter((entry) => {
		if (entry.status !== "scheduled") return false;
		const startMs = toTimestamp(entry.effectiveStartAt);
		const endMs = toTimestamp(entry.effectiveEndAt);
		return startMs <= nowMs && nowMs < endMs;
	});
	const upcoming = entries.filter((entry) => {
		if (entry.status !== "scheduled") return false;
		return toTimestamp(entry.effectiveStartAt) > nowMs;
	});
	const recentEnded = entries.filter((entry) => {
		const endMs = toTimestamp(entry.effectiveEndAt);
		if (endMs >= nowMs) return false;
		return nowMs - endMs <= recentWindowMs;
	});
	return {
		active: sortByEffectiveStart(active),
		upcoming: sortByEffectiveStart(upcoming),
		recentEnded: sortByEffectiveStart(recentEnded),
	};
};

const sanitizeDurationHours = (durationHours?: number): number => {
	const fallback = PROMOTED_SLOT_CONFIG.defaultDurationHours;
	if (!Number.isFinite(durationHours)) return fallback;
	return Math.max(1, Math.min(168, Math.round(durationHours as number)));
};

const normalizeRequestedStartAt = (raw?: string): string => {
	if (!raw || raw.trim().length === 0) return new Date().toISOString();
	const trimmed = raw.trim();
	const direct = new Date(trimmed);
	if (
		!Number.isNaN(direct.getTime()) &&
		/[zZ]|[+-]\d{2}:\d{2}$/.test(trimmed)
	) {
		return direct.toISOString();
	}
	const parsedParis = parseParisDateTimeInput(trimmed);
	if (!parsedParis) {
		throw new Error(
			`Invalid schedule time "${raw}". Use YYYY-MM-DDTHH:mm (Paris time) or full ISO.`,
		);
	}
	return parsedParis.toISOString();
};

const getRepositoryOrThrow = () => {
	const repository = getPromotedEventRepository();
	if (!repository) {
		throw new Error(
			"Promoted scheduler requires Postgres. Configure DATABASE_URL.",
		);
	}
	return repository;
};

const recomputePromotedScheduleWithSession = async (
	session: PromotedEventRepositorySession,
): Promise<void> => {
	const scheduledEntries = await session.listEntries({
		statuses: ["scheduled"],
	});
	const windows = scheduledEntries.map((entry) => {
		const startMs = toTimestamp(entry.requestedStartAt);
		const endMs = startMs + entry.durationHours * 60 * 60 * 1000;
		return {
			id: entry.id,
			effectiveStartAt: new Date(startMs).toISOString(),
			effectiveEndAt: new Date(endMs).toISOString(),
		};
	});
	await session.updateComputedWindows(windows);
};

export const getPromotedSlotConfig = (): PromotedSlotConfig =>
	PROMOTED_SLOT_CONFIG;

export const listPromotedEntries = async (): Promise<
	PromotedScheduleEntry[]
> => {
	const repository = getPromotedEventRepository();
	if (!repository) return [];
	return repository.withScheduleLock(async (session) => {
		await session.markCompletedEntries(new Date().toISOString());
		return session.listEntries();
	});
};

export const schedulePromotedEntry = async (input: {
	eventKey: string;
	requestedStartAt?: string;
	durationHours?: number;
	createdBy?: string;
}): Promise<PromotedScheduleEntry> => {
	const repository = getRepositoryOrThrow();
	return repository.withScheduleLock(async (session) => {
		const created = await session.createScheduledEntry({
			eventKey: input.eventKey.trim(),
			requestedStartAt: normalizeRequestedStartAt(input.requestedStartAt),
			durationHours: sanitizeDurationHours(input.durationHours),
			createdBy: input.createdBy?.trim() || "admin-panel",
		});
		await recomputePromotedScheduleWithSession(session);
		const entries = await session.listEntries({ statuses: ["scheduled"] });
		return entries.find((entry) => entry.id === created.id) ?? created;
	});
};

export const cancelPromotedEntry = async (id: string): Promise<boolean> => {
	const repository = getRepositoryOrThrow();
	return repository.withScheduleLock(async (session) => {
		const cancelled = await session.cancelEntry(id);
		if (cancelled) {
			await recomputePromotedScheduleWithSession(session);
		}
		return cancelled;
	});
};

export const reschedulePromotedEntry = async (input: {
	id: string;
	requestedStartAt: string;
	durationHours?: number;
}): Promise<boolean> => {
	const repository = getRepositoryOrThrow();
	return repository.withScheduleLock(async (session) => {
		const updated = await session.rescheduleEntry({
			id: input.id,
			requestedStartAt: normalizeRequestedStartAt(input.requestedStartAt),
			durationHours: sanitizeDurationHours(input.durationHours),
		});
		if (updated) {
			await recomputePromotedScheduleWithSession(session);
		}
		return updated;
	});
};

export const clearPromotedQueueHistory = async (): Promise<number> => {
	const repository = getRepositoryOrThrow();
	return repository.withScheduleLock(async (session) =>
		session.clearAllEntries(),
	);
};

export const clearPromotedQueueOnly = async (): Promise<number> => {
	const repository = getRepositoryOrThrow();
	return repository.withScheduleLock(async (session) => {
		const cleared = await session.clearScheduledEntries();
		await recomputePromotedScheduleWithSession(session);
		return cleared;
	});
};

export const clearPromotedHistoryOnly = async (): Promise<number> => {
	const repository = getRepositoryOrThrow();
	return repository.withScheduleLock(async (session) =>
		session.clearHistoryEntries(),
	);
};

export const getPromotedProjection = async (
	now: Date = new Date(),
): Promise<PromotedProjection> => {
	const entries = await listPromotedEntries();
	return buildProjectionFromEntries(entries, now);
};

export const buildPromotedQueueItems = async (
	events: Event[],
): Promise<{
	items: PromotedQueueItem[];
	activeCount: number;
	slotConfig: PromotedSlotConfig;
}> => {
	const entries = await listPromotedEntries();
	const now = new Date();
	const projection = buildProjectionFromEntries(entries, now);
	const nowMs = now.getTime();
	const recentWindowMs =
		PROMOTED_SLOT_CONFIG.recentEndedWindowHours * 60 * 60 * 1000;
	const eventNameByKey = new Map(
		events.map((event) => [event.eventKey, event.name] as const),
	);

	const items = entries.map((entry) => ({
		...entry,
		eventName: eventNameByKey.get(entry.eventKey) || entry.eventKey,
		state: deriveState(entry, nowMs, recentWindowMs),
	}));

	return {
		items,
		activeCount: projection.active.length,
		slotConfig: PROMOTED_SLOT_CONFIG,
	};
};

export const applyPromotedProjectionToEvents = async (
	events: Event[],
): Promise<Event[]> => {
	const projection = await getPromotedProjection();
	const activeByKey = new Map(
		projection.active.map((entry) => [entry.eventKey, entry] as const),
	);
	return events.map((event) => {
		const active = activeByKey.get(event.eventKey);
		return {
			...event,
			isPromoted: Boolean(active),
			promotedAt: active?.effectiveStartAt,
			promotedEndsAt: active?.effectiveEndAt,
		};
	});
};

export const formatPromotedDateTime = (value: string): string =>
	formatDateTimeInParis(value);
