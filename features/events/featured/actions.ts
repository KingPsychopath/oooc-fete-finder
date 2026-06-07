"use server";

import { recordAdminActivity } from "@/features/admin/activity/record";
import { validateAdminAccessFromServerContext } from "@/features/auth/admin-validation";
import {
	getLiveEvents,
	revalidateEventsPaths,
} from "@/features/data-management/runtime-service";
import { toParisDateTimeLocalInput } from "./paris-time";
import {
	buildFeaturedQueueItems,
	cancelFeaturedEntry,
	clearFeaturedHistoryOnly as clearFeaturedHistoryOnlyService,
	clearFeaturedQueueHistory as clearFeaturedQueueHistoryService,
	clearFeaturedQueueOnly as clearFeaturedQueueOnlyService,
	formatFeaturedDateTime,
	getFeatureSlotConfig,
	recomputeFeaturedQueue,
	rescheduleFeaturedEntry,
	scheduleFeaturedEntry,
} from "./service";

const assertAdmin = async () => {
	const authorized = await validateAdminAccessFromServerContext();
	if (!authorized) {
		throw new Error("Unauthorized access");
	}
};

const sortEventOptions = (
	events: Awaited<ReturnType<typeof getLiveEvents>>["data"],
) => {
	return [...events]
		.sort((left, right) => left.name.localeCompare(right.name))
		.map((event) => ({
			eventKey: event.eventKey,
			seriesKey: event.seriesKey ?? "",
			name: event.name,
			date: event.date,
			dateRangeStart: event.dateRangeStart ?? "",
			dateRangeEnd: event.dateRangeEnd ?? "",
			occurrenceIndex: event.occurrenceIndex ?? null,
			occurrenceCount: event.occurrenceCount ?? null,
			time: event.time || "",
		}));
};

const normalizeEventKeys = (eventKeys: readonly string[]): string[] => [
	...new Set(eventKeys.map((key) => key.trim()).filter(Boolean)),
];

const featuredManagerHref = (entryId?: string): string =>
	`/admin/placements?placementMode=spotlight#${entryId ? `placement-${encodeURIComponent(entryId)}` : "featured-events-manager"}`;

export async function listFeaturedQueue(): Promise<{
	success: boolean;
	slotConfig?: ReturnType<typeof getFeatureSlotConfig>;
	activeCount?: number;
	queue?: Array<{
		id: string;
		eventKey: string;
		eventName: string;
		requestedStartAt: string;
		requestedStartAtParis: string;
		requestedStartAtParisInput: string;
		effectiveStartAt: string;
		effectiveStartAtParis: string;
		effectiveEndAt: string;
		effectiveEndAtParis: string;
		durationHours: number;
		status: "scheduled" | "cancelled" | "completed";
		state: "active" | "upcoming" | "recent-ended" | "completed" | "cancelled";
		queuePosition: number | null;
	}>;
	events?: Array<{
		eventKey: string;
		seriesKey: string;
		name: string;
		date: string;
		dateRangeStart: string;
		dateRangeEnd: string;
		occurrenceIndex: number | null;
		occurrenceCount: number | null;
		time: string;
	}>;
	error?: string;
}> {
	try {
		await assertAdmin();
		await recomputeFeaturedQueue();
		const eventsResult = await getLiveEvents({
			includeFeaturedProjection: false,
			includeEngagementProjection: false,
		});
		if (!eventsResult.success) {
			return {
				success: false,
				error: eventsResult.error || "Failed to load live events",
			};
		}

		const queue = await buildFeaturedQueueItems(eventsResult.data);
		return {
			success: true,
			slotConfig: queue.slotConfig,
			activeCount: queue.activeCount,
			queue: queue.items.map((item) => ({
				id: item.id,
				eventKey: item.eventKey,
				eventName: item.eventName,
				requestedStartAt: item.requestedStartAt,
				requestedStartAtParis: formatFeaturedDateTime(item.requestedStartAt),
				requestedStartAtParisInput: toParisDateTimeLocalInput(
					new Date(item.requestedStartAt),
				),
				effectiveStartAt: item.effectiveStartAt,
				effectiveStartAtParis: formatFeaturedDateTime(item.effectiveStartAt),
				effectiveEndAt: item.effectiveEndAt,
				effectiveEndAtParis: formatFeaturedDateTime(item.effectiveEndAt),
				durationHours: item.durationHours,
				status: item.status,
				state: item.state,
				queuePosition: item.queuePosition,
			})),
			events: sortEventOptions(eventsResult.data),
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown queue error",
		};
	}
}

export async function scheduleFeaturedEvents(
	eventKeys: readonly string[],
	requestedStartAt: string,
	durationHours?: number,
): Promise<{
	success: boolean;
	message: string;
	error?: string;
}> {
	try {
		await assertAdmin();
		const keys = normalizeEventKeys(eventKeys);
		if (keys.length === 0) {
			return { success: false, message: "Event key is required" };
		}

		const results = await Promise.allSettled(
			keys.map((eventKey) =>
				scheduleFeaturedEntry({
					eventKey,
					requestedStartAt,
					durationHours,
					createdBy: "admin-panel",
				}),
			),
		);
		const failedEventKeys = keys.filter(
			(_, index) => results[index]?.status === "rejected",
		);
		const scheduledEventKeys = keys.filter(
			(_, index) => results[index]?.status === "fulfilled",
		);
		const scheduledEntries = results
			.filter(
				(
					result,
				): result is PromiseFulfilledResult<
					Awaited<ReturnType<typeof scheduleFeaturedEntry>>
				> => result.status === "fulfilled",
			)
			.map((result) => result.value);
		revalidateEventsPaths(["/", "/feature-event"], { scope: "placements" });
		await recordAdminActivity({
			action: "placement.spotlight.scheduled",
			category: "placements",
			targetType: "spotlight_placement",
			targetId: scheduledEventKeys[0] ?? keys[0],
			targetLabel:
				scheduledEventKeys.length > 1
					? `${scheduledEventKeys.length} spotlight occurrences`
					: (scheduledEventKeys[0] ?? keys[0]),
			summary:
				scheduledEventKeys.length > 1
					? `${scheduledEventKeys.length} spotlight occurrences scheduled`
					: `Spotlight placement scheduled for ${scheduledEventKeys[0] ?? keys[0]}`,
			metadata: {
				requestedStartAt,
				durationHours,
				eventKeys: scheduledEventKeys,
				entryIds: scheduledEntries.map((entry) => entry.id),
				failedEventKeys,
			},
			href: featuredManagerHref(scheduledEntries[0]?.id),
		});

		if (failedEventKeys.length > 0) {
			return {
				success: false,
				message: `Scheduled ${scheduledEventKeys.length} of ${keys.length} featured occurrence${keys.length === 1 ? "" : "s"}`,
				error: `${failedEventKeys.length} event(s) could not be scheduled`,
			};
		}

		return {
			success: true,
			message:
				scheduledEventKeys.length > 1
					? `Featured schedule saved for ${scheduledEventKeys.length} occurrences and pages revalidated`
					: "Featured schedule saved and pages revalidated",
		};
	} catch (error) {
		return {
			success: false,
			message: "Failed to schedule featured event",
			error: error instanceof Error ? error.message : "Unknown schedule error",
		};
	}
}

export async function scheduleFeaturedEvent(
	eventKey: string,
	requestedStartAt: string,
	durationHours?: number,
): Promise<{
	success: boolean;
	message: string;
	error?: string;
}> {
	return scheduleFeaturedEvents([eventKey], requestedStartAt, durationHours);
}

export async function cancelFeaturedSchedule(entryId: string): Promise<{
	success: boolean;
	message: string;
	error?: string;
}> {
	try {
		await assertAdmin();
		const cancelled = await cancelFeaturedEntry(entryId);
		if (!cancelled) {
			return {
				success: false,
				message: "Featured entry not found",
			};
		}
		revalidateEventsPaths(["/", "/feature-event"], { scope: "placements" });
		await recordAdminActivity({
			action: "placement.spotlight.cancelled",
			category: "placements",
			targetType: "spotlight_placement",
			targetId: entryId,
			targetLabel: entryId,
			summary: "Spotlight placement cancelled",
			severity: "warning",
			href: featuredManagerHref(entryId),
		});

		return {
			success: true,
			message: "Featured entry cancelled and pages revalidated",
		};
	} catch (error) {
		return {
			success: false,
			message: "Failed to cancel featured entry",
			error: error instanceof Error ? error.message : "Unknown cancel error",
		};
	}
}

export async function rescheduleFeaturedEvent(
	entryId: string,
	requestedStartAt: string,
	durationHours?: number,
): Promise<{
	success: boolean;
	message: string;
	error?: string;
}> {
	try {
		await assertAdmin();
		const updated = await rescheduleFeaturedEntry({
			id: entryId,
			requestedStartAt,
			durationHours,
		});
		if (!updated) {
			return {
				success: false,
				message: "Featured entry not found",
			};
		}
		revalidateEventsPaths(["/", "/feature-event"], { scope: "placements" });
		await recordAdminActivity({
			action: "placement.spotlight.rescheduled",
			category: "placements",
			targetType: "spotlight_placement",
			targetId: entryId,
			targetLabel: entryId,
			summary: "Spotlight placement rescheduled",
			metadata: { requestedStartAt, durationHours },
			href: featuredManagerHref(entryId),
		});

		return {
			success: true,
			message: "Featured entry rescheduled and pages revalidated",
		};
	} catch (error) {
		return {
			success: false,
			message: "Failed to reschedule featured entry",
			error:
				error instanceof Error ? error.message : "Unknown reschedule error",
		};
	}
}

export async function clearFeaturedQueueHistory(): Promise<{
	success: boolean;
	message: string;
	error?: string;
}> {
	try {
		await assertAdmin();
		const clearedCount = await clearFeaturedQueueHistoryService();
		revalidateEventsPaths(["/", "/feature-event"], { scope: "placements" });
		await recordAdminActivity({
			action: "placement.spotlight.cleared_all",
			category: "placements",
			targetType: "spotlight_queue",
			targetLabel: "Spotlight queue and history",
			summary: `Cleared ${clearedCount} Spotlight queue/history entr${clearedCount === 1 ? "y" : "ies"}`,
			metadata: { clearedCount },
			severity: "destructive",
			href: featuredManagerHref(),
		});

		return {
			success: true,
			message: `Cleared ${clearedCount} featured queue/history entr${clearedCount === 1 ? "y" : "ies"}`,
		};
	} catch (error) {
		return {
			success: false,
			message: "Failed to clear featured queue/history",
			error: error instanceof Error ? error.message : "Unknown clear error",
		};
	}
}

export async function clearFeaturedQueue(): Promise<{
	success: boolean;
	message: string;
	error?: string;
}> {
	try {
		await assertAdmin();
		const clearedCount = await clearFeaturedQueueOnlyService();
		revalidateEventsPaths(["/", "/feature-event"], { scope: "placements" });
		await recordAdminActivity({
			action: "placement.spotlight.cleared_queue",
			category: "placements",
			targetType: "spotlight_queue",
			targetLabel: "Spotlight scheduled queue",
			summary: `Cleared ${clearedCount} scheduled Spotlight entr${clearedCount === 1 ? "y" : "ies"}`,
			metadata: { clearedCount },
			severity: "destructive",
			href: featuredManagerHref(),
		});
		return {
			success: true,
			message: `Cleared ${clearedCount} scheduled queue entr${clearedCount === 1 ? "y" : "ies"}`,
		};
	} catch (error) {
		return {
			success: false,
			message: "Failed to clear featured queue",
			error:
				error instanceof Error ? error.message : "Unknown clear queue error",
		};
	}
}

export async function clearFeaturedHistory(): Promise<{
	success: boolean;
	message: string;
	error?: string;
}> {
	try {
		await assertAdmin();
		const clearedCount = await clearFeaturedHistoryOnlyService();
		revalidateEventsPaths(["/", "/feature-event"], { scope: "placements" });
		await recordAdminActivity({
			action: "placement.spotlight.cleared_history",
			category: "placements",
			targetType: "spotlight_history",
			targetLabel: "Spotlight history",
			summary: `Cleared ${clearedCount} Spotlight history entr${clearedCount === 1 ? "y" : "ies"}`,
			metadata: { clearedCount },
			severity: "destructive",
			href: featuredManagerHref(),
		});
		return {
			success: true,
			message: `Cleared ${clearedCount} history entr${clearedCount === 1 ? "y" : "ies"}`,
		};
	} catch (error) {
		return {
			success: false,
			message: "Failed to clear featured history",
			error:
				error instanceof Error ? error.message : "Unknown clear history error",
		};
	}
}
