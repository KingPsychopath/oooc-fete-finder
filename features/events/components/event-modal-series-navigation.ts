import type { Event } from "@/features/events/types";

export type SeriesKeyboardNavigationKey = "ArrowLeft" | "ArrowRight";

interface SeriesKeyboardNavigationInput {
	currentEvent: Event | null;
	seriesEvents: Event[];
	key: string;
}

type KeyboardTargetLike = {
	tagName?: string;
	isContentEditable?: boolean;
	getAttribute?: (name: string) => string | null;
};

export function getSeriesKeyboardNavigationTarget({
	currentEvent,
	seriesEvents,
	key,
}: SeriesKeyboardNavigationInput): Event | undefined {
	if (!currentEvent) return undefined;
	if (key !== "ArrowLeft" && key !== "ArrowRight") return undefined;
	if (!currentEvent.seriesKey) return undefined;

	const orderedSeriesEvents = seriesEvents
		.filter((seriesEvent) => seriesEvent.seriesKey === currentEvent.seriesKey)
		.sort((left, right) => left.date.localeCompare(right.date));
	const activeSeriesIndex = orderedSeriesEvents.findIndex(
		(seriesEvent) => seriesEvent.eventKey === currentEvent.eventKey,
	);

	if (orderedSeriesEvents.length <= 1 || activeSeriesIndex < 0) {
		return undefined;
	}

	const targetIndex =
		key === "ArrowLeft" ? activeSeriesIndex - 1 : activeSeriesIndex + 1;

	return orderedSeriesEvents[targetIndex];
}

export function isEventModalTextEntryKeyTarget(
	target: EventTarget | KeyboardTargetLike | null,
): boolean {
	const candidate = target as KeyboardTargetLike | null;
	if (!candidate) return false;
	if (candidate.isContentEditable) return true;

	const role = candidate.getAttribute?.("role")?.toLowerCase();
	if (role === "textbox") return true;

	const tagName = candidate.tagName?.toLowerCase();
	return tagName === "input" || tagName === "select" || tagName === "textarea";
}
