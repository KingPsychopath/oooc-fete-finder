import type { Event } from "@/features/events/types";

export const toHomepageEventPayload = (event: Event): Event => {
	return { ...event };
};
