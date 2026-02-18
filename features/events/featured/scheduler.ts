import type { FeatureSlotConfig, FeaturedScheduleEntry } from "./types";

export interface ComputedFeatureWindow {
	id: string;
	effectiveStartAt: string;
	effectiveEndAt: string;
}

const toTimestamp = (value: string): number => {
	const parsed = new Date(value).getTime();
	return Number.isNaN(parsed) ? 0 : parsed;
};

const sortForScheduling = (
	entries: readonly FeaturedScheduleEntry[],
): FeaturedScheduleEntry[] => {
	return [...entries].sort((left, right) => {
		const requestedDiff =
			toTimestamp(left.requestedStartAt) - toTimestamp(right.requestedStartAt);
		if (requestedDiff !== 0) return requestedDiff;

		const createdDiff =
			toTimestamp(left.createdAt) - toTimestamp(right.createdAt);
		if (createdDiff !== 0) return createdDiff;

		const keyDiff = left.eventKey.localeCompare(right.eventKey);
		if (keyDiff !== 0) return keyDiff;

		return left.id.localeCompare(right.id);
	});
};

/**
 * Deterministically allocate feature windows with a max concurrent slot cap.
 */
export const allocateFeaturedQueueWindows = (
	entries: readonly FeaturedScheduleEntry[],
	slotConfig: Pick<FeatureSlotConfig, "maxConcurrent">,
): ComputedFeatureWindow[] => {
	const sorted = sortForScheduling(entries);
	const slots = Array.from(
		{ length: Math.max(1, slotConfig.maxConcurrent) },
		() => Number.NEGATIVE_INFINITY,
	);

	return sorted.map((entry) => {
		const requestedStartAt = toTimestamp(entry.requestedStartAt);

		let slotIndex = 0;
		for (let index = 1; index < slots.length; index += 1) {
			if (slots[index] < slots[slotIndex]) {
				slotIndex = index;
			}
		}

		const effectiveStart = Math.max(requestedStartAt, slots[slotIndex]);
		const effectiveEnd =
			effectiveStart + entry.durationHours * 60 * 60 * 1000;

		slots[slotIndex] = effectiveEnd;

		return {
			id: entry.id,
			effectiveStartAt: new Date(effectiveStart).toISOString(),
			effectiveEndAt: new Date(effectiveEnd).toISOString(),
		};
	});
};
