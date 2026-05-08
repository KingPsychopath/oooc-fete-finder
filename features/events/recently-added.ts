import type { Event } from "./types";

export const NEW_EVENT_WINDOW_DAYS = 4;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const getRecentlyAddedCutoff = (now: Date = new Date()): Date =>
	new Date(now.getTime() - NEW_EVENT_WINDOW_DAYS * MS_PER_DAY);

export const isRecentlyAddedEvent = (
	event: Pick<Event, "firstSeenAt">,
	now: Date = new Date(),
): boolean => {
	if (!event.firstSeenAt) return false;
	const firstSeenTime = Date.parse(event.firstSeenAt);
	if (!Number.isFinite(firstSeenTime)) return false;
	return firstSeenTime >= getRecentlyAddedCutoff(now).getTime();
};

export const formatRecentlyAddedLabel = (
	event: Pick<Event, "firstSeenAt">,
	now: Date = new Date(),
): string => {
	if (!event.firstSeenAt) return "Added recently";
	const firstSeenTime = Date.parse(event.firstSeenAt);
	if (!Number.isFinite(firstSeenTime)) return "Added recently";

	const elapsedMs = Math.max(0, now.getTime() - firstSeenTime);
	const elapsedDays = Math.floor(elapsedMs / MS_PER_DAY);
	if (elapsedDays <= 0) return "Added today";
	if (elapsedDays === 1) return "Added yesterday";
	return `Added ${elapsedDays} days ago`;
};
