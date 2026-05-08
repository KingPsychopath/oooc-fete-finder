import type { Event } from "@/features/events/types";

export const toHomepageEventPayload = (event: Event): Event => {
	const payload: Event = { ...event };
	delete payload.coordinates;
	return payload;
};
