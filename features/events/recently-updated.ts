import type { Event } from "./types";

export const UPDATED_EVENT_WINDOW_DAYS = 4;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const getRecentlyUpdatedCutoff = (now: Date = new Date()): Date =>
	new Date(now.getTime() - UPDATED_EVENT_WINDOW_DAYS * MS_PER_DAY);

export const isRecentlyUpdatedEvent = (
	event: Pick<Event, "firstSeenAt" | "lastMeaningfulChangeAt">,
	now: Date = new Date(),
): boolean => {
	if (!event.lastMeaningfulChangeAt) return false;
	const changedTime = Date.parse(event.lastMeaningfulChangeAt);
	if (!Number.isFinite(changedTime)) return false;

	if (event.firstSeenAt) {
		const firstSeenTime = Date.parse(event.firstSeenAt);
		if (Number.isFinite(firstSeenTime) && changedTime <= firstSeenTime) {
			return false;
		}
	}

	return changedTime >= getRecentlyUpdatedCutoff(now).getTime();
};

export const formatRecentlyUpdatedLabel = (
	event: Pick<Event, "lastMeaningfulChangeAt">,
	now: Date = new Date(),
): string => {
	if (!event.lastMeaningfulChangeAt) return "Updated recently";
	const changedTime = Date.parse(event.lastMeaningfulChangeAt);
	if (!Number.isFinite(changedTime)) return "Updated recently";

	const elapsedMs = Math.max(0, now.getTime() - changedTime);
	const elapsedDays = Math.floor(elapsedMs / MS_PER_DAY);
	if (elapsedDays <= 0) return "Updated today";
	if (elapsedDays === 1) return "Updated yesterday";
	return `Updated ${elapsedDays} days ago`;
};
