import type { Event } from "@/features/events/types";
import type { UserPlanStop } from "@/features/plans/types";

const normalizeEventKey = (value: string): string => value.trim().toLowerCase();

export const mergePinnedStopsIntoRoute = ({
	proposedEvents,
	existingStops,
	eventsByKey,
}: {
	proposedEvents: Event[];
	existingStops: UserPlanStop[];
	eventsByKey: Map<string, Event>;
}): Event[] => {
	const pinnedStops = existingStops
		.filter((stop) => stop.locked)
		.slice()
		.sort((left, right) => left.stopOrder - right.stopOrder);

	if (pinnedStops.length === 0) return proposedEvents;

	const targetLength = Math.max(proposedEvents.length, pinnedStops.length);
	const pinnedKeys = new Set(
		pinnedStops.map((stop) => normalizeEventKey(stop.eventKey)),
	);
	const merged = new Array<Event | null>(targetLength).fill(null);

	for (const stop of pinnedStops) {
		const event =
			proposedEvents.find(
				(item) =>
					normalizeEventKey(item.eventKey) === normalizeEventKey(stop.eventKey),
			) ?? eventsByKey.get(normalizeEventKey(stop.eventKey));
		if (!event) continue;

		const preferredIndex = Math.min(
			Math.max(stop.stopOrder - 1, 0),
			targetLength - 1,
		);
		const availableIndex = findAvailableIndex(merged, preferredIndex);
		if (availableIndex !== null) merged[availableIndex] = event;
	}

	let fillIndex = 0;
	for (const event of proposedEvents) {
		if (pinnedKeys.has(normalizeEventKey(event.eventKey))) continue;
		while (fillIndex < merged.length && merged[fillIndex]) fillIndex += 1;
		if (fillIndex >= merged.length) break;
		merged[fillIndex] = event;
	}

	return merged.filter((event): event is Event => Boolean(event));
};

const findAvailableIndex = (
	items: Array<Event | null>,
	preferredIndex: number,
): number | null => {
	if (!items[preferredIndex]) return preferredIndex;

	for (let index = preferredIndex + 1; index < items.length; index += 1) {
		if (!items[index]) return index;
	}
	for (let index = preferredIndex - 1; index >= 0; index -= 1) {
		if (!items[index]) return index;
	}
	return null;
};
