import "server-only";

import type { Event } from "@/features/events/types";
import { getFeaturedEventRepository } from "@/lib/platform/postgres/featured-event-repository";
import { FEATURED_EVENTS_CONFIG } from "./constants";
import { formatDateTimeInParis, parseParisDateTimeInput } from "./paris-time";
import { allocateFeaturedQueueWindows } from "./scheduler";
import type {
	FeatureSlotConfig,
	FeaturedProjection,
	FeaturedQueueItem,
	FeaturedQueueState,
	FeaturedScheduleEntry,
} from "./types";

const FEATURED_SLOT_CONFIG: FeatureSlotConfig = {
	maxConcurrent: FEATURED_EVENTS_CONFIG.MAX_FEATURED_EVENTS,
	defaultDurationHours: FEATURED_EVENTS_CONFIG.FEATURE_DURATION_HOURS,
	timezone: FEATURED_EVENTS_CONFIG.TIMEZONE,
	recentEndedWindowHours: FEATURED_EVENTS_CONFIG.RECENT_ENDED_WINDOW_HOURS,
};

const toTimestamp = (value: string): number => {
	const parsed = new Date(value).getTime();
	return Number.isNaN(parsed) ? 0 : parsed;
};

const sortByEffectiveStart = (
	entries: readonly FeaturedScheduleEntry[],
): FeaturedScheduleEntry[] => {
	return [...entries].sort((left, right) => {
		const diff =
			toTimestamp(left.effectiveStartAt) - toTimestamp(right.effectiveStartAt);
		if (diff !== 0) return diff;
		return left.id.localeCompare(right.id);
	});
};

const buildQueuePositionMap = (
	scheduledEntries: readonly FeaturedScheduleEntry[],
): Map<string, number> => {
	const sorted = sortByEffectiveStart(scheduledEntries);
	return new Map(sorted.map((entry, index) => [entry.id, index + 1]));
};

const deriveQueueState = (
	entry: FeaturedScheduleEntry,
	nowMs: number,
	recentWindowMs: number,
): FeaturedQueueState => {
	if (entry.status === "cancelled") return "cancelled";

	const startMs = toTimestamp(entry.effectiveStartAt);
	const endMs = toTimestamp(entry.effectiveEndAt);

	if (entry.status === "scheduled") {
		if (startMs <= nowMs && nowMs < endMs) return "active";
		if (nowMs < startMs) return "upcoming";
	}

	if (nowMs - endMs <= recentWindowMs) {
		return "recent-ended";
	}

	return "completed";
};

const getRepositoryOrThrow = () => {
	const repository = getFeaturedEventRepository();
	if (!repository) {
		throw new Error(
			"Featured scheduler requires Postgres. Configure DATABASE_URL.",
		);
	}
	return repository;
};

const reviveZeroDurationEntriesIfSupported = async (
	repository: ReturnType<typeof getRepositoryOrThrow>,
): Promise<void> => {
	const candidate = repository as unknown as {
		reviveZeroDurationCompletedEntries?: () => Promise<number>;
	};
	if (typeof candidate.reviveZeroDurationCompletedEntries === "function") {
		await candidate.reviveZeroDurationCompletedEntries();
	}
};

const sanitizeDurationHours = (durationHours?: number): number => {
	const fallback = FEATURED_SLOT_CONFIG.defaultDurationHours;
	if (!Number.isFinite(durationHours)) return fallback;
	return Math.max(1, Math.min(168, Math.round(durationHours as number)));
};

const normalizeRequestedStartAt = (raw?: string): string => {
	if (!raw || raw.trim().length === 0) {
		return new Date().toISOString();
	}

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

export const getFeatureSlotConfig = (): FeatureSlotConfig =>
	FEATURED_SLOT_CONFIG;

export const recomputeFeaturedQueue = async (): Promise<void> => {
	const repository = getRepositoryOrThrow();
	await reviveZeroDurationEntriesIfSupported(repository);
	const scheduledEntries = await repository.listEntries({
		statuses: ["scheduled"],
	});
	const windows = allocateFeaturedQueueWindows(
		scheduledEntries,
		FEATURED_SLOT_CONFIG,
	);
	await repository.updateComputedWindows(windows);
};

export const listFeaturedEntries = async (): Promise<
	FeaturedScheduleEntry[]
> => {
	const repository = getFeaturedEventRepository();
	if (!repository) return [];
	await repository.markCompletedEntries(new Date().toISOString());
	return repository.listEntries();
};

export const scheduleFeaturedEntry = async (input: {
	eventKey: string;
	requestedStartAt?: string;
	durationHours?: number;
	createdBy?: string;
}): Promise<FeaturedScheduleEntry> => {
	const repository = getRepositoryOrThrow();
	const created = await repository.createScheduledEntry({
		eventKey: input.eventKey.trim(),
		requestedStartAt: normalizeRequestedStartAt(input.requestedStartAt),
		durationHours: sanitizeDurationHours(input.durationHours),
		createdBy: input.createdBy?.trim() || "admin-panel",
	});
	await recomputeFeaturedQueue();
	const entries = await repository.listEntries({ statuses: ["scheduled"] });
	return entries.find((entry) => entry.id === created.id) ?? created;
};

export const cancelFeaturedEntry = async (id: string): Promise<boolean> => {
	const repository = getRepositoryOrThrow();
	const cancelled = await repository.cancelEntry(id);
	if (cancelled) {
		await recomputeFeaturedQueue();
	}
	return cancelled;
};

export const rescheduleFeaturedEntry = async (input: {
	id: string;
	requestedStartAt: string;
	durationHours?: number;
}): Promise<boolean> => {
	const repository = getRepositoryOrThrow();
	const updated = await repository.rescheduleEntry({
		id: input.id,
		requestedStartAt: normalizeRequestedStartAt(input.requestedStartAt),
		durationHours: sanitizeDurationHours(input.durationHours),
	});
	if (updated) {
		await recomputeFeaturedQueue();
	}
	return updated;
};

export const clearFeaturedQueueHistory = async (): Promise<number> => {
	const repository = getRepositoryOrThrow();
	return repository.clearAllEntries();
};

export const getFeaturedProjection = async (
	now: Date = new Date(),
): Promise<FeaturedProjection> => {
	const entries = await listFeaturedEntries();
	const nowMs = now.getTime();
	const recentWindowMs =
		FEATURED_SLOT_CONFIG.recentEndedWindowHours * 60 * 60 * 1000;

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
		slotConfig: FEATURED_SLOT_CONFIG,
	};
};

export const buildFeaturedQueueItems = async (
	events: Event[],
): Promise<{
	items: FeaturedQueueItem[];
	activeCount: number;
	slotConfig: FeatureSlotConfig;
}> => {
	const entries = await listFeaturedEntries();
	const projection = await getFeaturedProjection();
	const nowMs = Date.now();
	const recentWindowMs =
		FEATURED_SLOT_CONFIG.recentEndedWindowHours * 60 * 60 * 1000;
	const eventNameByKey = new Map(
		events.map((event) => [event.eventKey, event.name] as const),
	);
	const scheduledPositions = buildQueuePositionMap(
		entries.filter((entry) => entry.status === "scheduled"),
	);

	const items = entries.map((entry) => ({
		...entry,
		eventName: eventNameByKey.get(entry.eventKey) || entry.eventKey,
		state: deriveQueueState(entry, nowMs, recentWindowMs),
		queuePosition:
			entry.status === "scheduled"
				? (scheduledPositions.get(entry.id) ?? null)
				: null,
	}));

	return {
		items,
		activeCount: projection.active.length,
		slotConfig: projection.slotConfig,
	};
};

export const applyFeaturedProjectionToEvents = async (
	events: Event[],
): Promise<Event[]> => {
	const projection = await getFeaturedProjection();
	const activeByKey = new Map(
		projection.active.map((entry) => [entry.eventKey, entry] as const),
	);

	return events.map((event) => {
		const active = activeByKey.get(event.eventKey);
		return {
			...event,
			isFeatured: Boolean(active),
			featuredAt: active?.effectiveStartAt,
		};
	});
};

export const buildFeaturedStatusEvents = async (
	events: Event[],
): Promise<Event[]> => {
	const projection = await getFeaturedProjection();
	const byEventKey = new Map(
		events.map((event) => [event.eventKey, event] as const),
	);
	const mergedEntries = [...projection.active, ...projection.recentEnded];
	const uniqueByEventKey = new Map<string, FeaturedScheduleEntry>();

	for (const entry of mergedEntries) {
		if (!uniqueByEventKey.has(entry.eventKey)) {
			uniqueByEventKey.set(entry.eventKey, entry);
		}
	}

	const featuredStatusEvents: Event[] = [];
	for (const entry of uniqueByEventKey.values()) {
		const event = byEventKey.get(entry.eventKey);
		if (!event) continue;
		featuredStatusEvents.push({
			...event,
			isFeatured: true,
			featuredAt: entry.effectiveStartAt,
		});
	}

	return featuredStatusEvents;
};

export const formatFeaturedDateTime = (value: string): string =>
	formatDateTimeInParis(value);
