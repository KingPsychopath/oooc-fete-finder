import { parseISODateParts } from "@/features/events/date-utils";
import {
	type Event,
	formatLocationAreaShort,
	getEventLocationDisplay,
} from "@/features/events/types";
import type { MapProvider } from "@/features/maps/types";
import { distanceKmBetweenEvents } from "@/features/plans/route-suggestion";
import type { UserPlan } from "@/features/plans/types";

export type RouteMapCoverage = "full-route" | "first-leg" | "single-stop";

export interface RouteMapTarget {
	url: string;
	coverage: RouteMapCoverage;
	provider: Exclude<MapProvider, "ask">;
}

const ROUTE_TIMEZONE = "Europe/Paris";
const DEFAULT_START_TIME = { hours: 20, minutes: 0 };
const DEFAULT_DURATION_MINUTES = 90;

const pad = (value: number): string => value.toString().padStart(2, "0");

const escapeICSValue = (value: string): string =>
	value
		.replace(/\\/g, "\\\\")
		.replace(/,/g, "\\,")
		.replace(/;/g, "\\;")
		.replace(/\r?\n/g, "\\n");

const foldICSLine = (line: string): string => {
	const maxLength = 72;
	if (line.length <= maxLength) return line;

	const chunks: string[] = [];
	let remaining = line;
	while (remaining.length > maxLength) {
		chunks.push(remaining.slice(0, maxLength));
		remaining = ` ${remaining.slice(maxLength)}`;
	}
	chunks.push(remaining);
	return chunks.join("\r\n");
};

const parseClockTime = (
	time: string | null | undefined,
): { hours: number; minutes: number } | null => {
	if (!time || time.trim().toLowerCase() === "tbc") return null;
	const match = time
		.trim()
		.toLowerCase()
		.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
	if (!match) return null;

	let hours = Number.parseInt(match[1], 10);
	const minutes = Number.parseInt(match[2] ?? "0", 10);
	if (hours > 23 || minutes > 59) return null;

	const meridiem = match[3];
	if (meridiem === "pm" && hours !== 12) hours += 12;
	if (meridiem === "am" && hours === 12) hours = 0;

	return { hours, minutes };
};

const addMinutes = (
	date: { year: number; month: number; day: number },
	time: { hours: number; minutes: number },
	minutesToAdd: number,
): {
	year: number;
	month: number;
	day: number;
	hours: number;
	minutes: number;
} => {
	const value = new Date(
		Date.UTC(date.year, date.month - 1, date.day, time.hours, time.minutes),
	);
	value.setUTCMinutes(value.getUTCMinutes() + minutesToAdd);
	return {
		year: value.getUTCFullYear(),
		month: value.getUTCMonth() + 1,
		day: value.getUTCDate(),
		hours: value.getUTCHours(),
		minutes: value.getUTCMinutes(),
	};
};

const compareDateTimes = (
	left: ReturnType<typeof addMinutes>,
	right: ReturnType<typeof addMinutes>,
): number =>
	left.year - right.year ||
	left.month - right.month ||
	left.day - right.day ||
	left.hours - right.hours ||
	left.minutes - right.minutes;

const formatICSDateTime = (value: ReturnType<typeof addMinutes>): string =>
	`${value.year}${pad(value.month)}${pad(value.day)}T${pad(value.hours)}${pad(value.minutes)}00`;

const getRouteLocation = (event: Event): string => {
	const display = getEventLocationDisplay(event);

	if (display.state === "single" && display.singleLocation) {
		return `${display.singleLocation}, ${display.areaLongLabel}, Paris, France`;
	}

	if (display.state === "multiple-listed") {
		const locations = display.listedLocationEntries.length
			? display.listedLocationEntries
			: display.listedLocations.map((name) => ({
					name,
					arrondissement: undefined,
				}));
		const label = locations
			.map((location) => {
				const area = location.arrondissement
					? ` (${formatLocationAreaShort(location.arrondissement)})`
					: "";
				return `${location.name}${area}`;
			})
			.join(" / ");
		return label ? `${label}, Paris, France` : "Multiple locations, Paris";
	}

	if (display.state === "multiple-unlisted") {
		return "Multiple locations, Paris";
	}

	return "Location TBC";
};

const getPrimaryLink = (event: Event): string | null => {
	const link =
		event.links?.find((candidate) => candidate && candidate !== "#") ??
		event.link;
	return link && link !== "#" ? link : null;
};

const getEventPoint = (event: Event): string => {
	if (event.coordinates) {
		return `${event.coordinates.lat},${event.coordinates.lng}`;
	}
	const area = formatLocationAreaShort(event.arrondissement);
	const location = getRouteLocation(event);
	return `${event.name}, ${location}, ${area}, Paris, France`;
};

export const buildRouteMapTarget = (
	events: Event[],
	preference: Exclude<MapProvider, "ask">,
	_userAgent = "",
): RouteMapTarget | null => {
	if (events.length === 0) return null;

	const provider = preference === "system" ? "google" : preference;
	const points = events.map(getEventPoint);

	if (events.length === 1) {
		const query = encodeURIComponent(points[0]);
		return {
			provider,
			coverage: "single-stop",
			url:
				provider === "apple"
					? `https://maps.apple.com/?q=${query}`
					: `https://www.google.com/maps/search/?api=1&query=${query}`,
		};
	}

	if (provider === "apple") {
		return {
			provider,
			coverage: "first-leg",
			url: `https://maps.apple.com/?saddr=${encodeURIComponent(points[0])}&daddr=${encodeURIComponent(points[1])}&dirflg=w`,
		};
	}

	const origin = encodeURIComponent(points[0]);
	const destination = encodeURIComponent(points[points.length - 1]);
	const waypoints = points.slice(1, -1).map(encodeURIComponent).join("%7C");
	const waypointQuery = waypoints ? `&waypoints=${waypoints}` : "";

	return {
		provider: "google",
		coverage: "full-route",
		url: `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypointQuery}&travelmode=walking`,
	};
};

export const buildRouteText = (plan: UserPlan, events: Event[]): string => {
	const lines = [plan.title];
	for (const [index, event] of events.entries()) {
		const previous = events[index - 1];
		const distance =
			previous && event ? distanceKmBetweenEvents(previous, event) : null;
		const distanceLabel =
			distance === null
				? null
				: `From stop ${index}: ${distance.toFixed(1)} km direct`;
		lines.push(
			[
				`${index + 1}. ${event.time && event.time !== "TBC" ? event.time : "Time TBC"} ${event.name}`,
				formatLocationAreaShort(event.arrondissement),
				distanceLabel,
			]
				.filter(Boolean)
				.join(" · "),
		);
	}
	return lines.join("\n");
};

export const generateRouteICSContent = (
	plan: UserPlan,
	events: Event[],
	now = new Date(),
): string => {
	if (events.length === 0) return "";

	const timestamp = now
		.toISOString()
		.replace(/[-:]/g, "")
		.replace(/\.\d{3}Z$/, "Z");
	const headerLines = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//OOOC Fete Finder//Route Calendar//EN",
		"CALSCALE:GREGORIAN",
		"METHOD:PUBLISH",
	];
	const eventLines: string[] = [];
	const routeMapUrl = buildRouteMapTarget(events, "google")?.url ?? null;

	for (const [index, event] of events.entries()) {
		const dateParts = parseISODateParts(event.date || plan.planDate);
		if (!dateParts) continue;

		const startTime = parseClockTime(event.time) ?? DEFAULT_START_TIME;
		const startDateTime = addMinutes(dateParts, startTime, 0);
		const explicitEndTime = parseClockTime(event.endTime);
		const nextEvent = events[index + 1];
		const nextDateParts = nextEvent
			? parseISODateParts(nextEvent.date || plan.planDate)
			: null;
		const nextStartTime = parseClockTime(nextEvent?.time);
		let endDateTime = explicitEndTime
			? addMinutes(dateParts, explicitEndTime, 0)
			: nextDateParts && nextStartTime
				? addMinutes(nextDateParts, nextStartTime, 0)
				: addMinutes(dateParts, startTime, DEFAULT_DURATION_MINUTES);

		if (compareDateTimes(endDateTime, startDateTime) <= 0) {
			endDateTime = addMinutes(dateParts, startTime, DEFAULT_DURATION_MINUTES);
		}

		const previous = events[index - 1];
		const distance =
			previous && event ? distanceKmBetweenEvents(previous, event) : null;
		const link = getPrimaryLink(event);
		const description = [
			plan.title,
			`Stop ${index + 1} of ${events.length}`,
			distance === null
				? null
				: `From stop ${index}: ${distance.toFixed(1)} km direct`,
			routeMapUrl ? `Full route map: ${routeMapUrl}` : null,
			link ? `Event link: ${link}` : null,
			"Added via OOOC Fete Finder",
		]
			.filter(Boolean)
			.join("\n");

		eventLines.push(
			"BEGIN:VEVENT",
			`UID:oooc-route-${plan.id}-${event.eventKey}-${index + 1}@oooc-fete-finder.com`,
			`DTSTAMP:${timestamp}`,
			`DTSTART;TZID=${ROUTE_TIMEZONE}:${formatICSDateTime(startDateTime)}`,
			`DTEND;TZID=${ROUTE_TIMEZONE}:${formatICSDateTime(endDateTime)}`,
			`SUMMARY:${escapeICSValue(`Stop ${index + 1}: ${event.name}`)}`,
			`DESCRIPTION:${escapeICSValue(description)}`,
			`LOCATION:${escapeICSValue(getRouteLocation(event))}`,
			"STATUS:CONFIRMED",
			"TRANSP:OPAQUE",
			"END:VEVENT",
		);
	}

	if (eventLines.length === 0) return "";

	return [...headerLines, ...eventLines, "END:VCALENDAR"]
		.map(foldICSLine)
		.join("\r\n");
};

export const getRouteICSFileName = (plan: UserPlan): string => {
	const slug =
		plan.title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "") || "route";
	return `${slug}-${plan.planDate}.ics`;
};

export const downloadRouteICSFile = (
	plan: UserPlan,
	events: Event[],
): boolean => {
	const content = generateRouteICSContent(plan, events);
	if (!content) return false;

	const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
	const link = document.createElement("a");
	link.href = URL.createObjectURL(blob);
	link.download = getRouteICSFileName(plan);
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(link.href);
	return true;
};
