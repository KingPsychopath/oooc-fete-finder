import type { Event } from "@/features/events/types";
import { clientLog } from "@/lib/platform/client-logger";

/**
 * Generate an .ics file content for a calendar event
 */
export function generateICSContent(event: Event): string {
	const now = new Date();
	const timestamp = now
		.toISOString()
		.replace(/[-:]/g, "")
		.replace(/\.\d{3}Z$/, "Z");

	// Parse the event date and time
	const eventDate = new Date(event.date);

	// Handle time parsing - assume Paris timezone (UTC+1/UTC+2)
	let startDateTime: Date;
	let endDateTime: Date;

	if (event.time && event.time !== "TBC") {
		// Parse time (format: "HH:MM" or "HH:MM AM/PM")
		const [hours, minutes] = parseTime(event.time);
		startDateTime = new Date(eventDate);
		startDateTime.setHours(hours, minutes, 0, 0);

		if (event.endTime && event.endTime !== "TBC") {
			const [endHours, endMinutes] = parseTime(event.endTime);
			endDateTime = new Date(eventDate);
			endDateTime.setHours(endHours, endMinutes, 0, 0);

			// Handle end time that crosses midnight
			if (endDateTime <= startDateTime) {
				endDateTime.setDate(endDateTime.getDate() + 1);
			}
		} else {
			// Default to 3 hours duration if no end time
			endDateTime = new Date(startDateTime);
			endDateTime.setHours(startDateTime.getHours() + 3);
		}
	} else {
		// All day event if no time specified
		startDateTime = new Date(eventDate);
		startDateTime.setHours(20, 0, 0, 0); // Default to 8 PM
		endDateTime = new Date(startDateTime);
		endDateTime.setHours(23, 59, 0, 0); // End at 11:59 PM
	}

	// Format dates for .ics (YYYYMMDDTHHMMSSZ format, but we'll use local time)
	const formatDate = (date: Date) => {
		return date
			.toISOString()
			.replace(/[-:]/g, "")
			.replace(/\.\d{3}Z$/, "");
	};

	const startDateFormatted = formatDate(startDateTime);
	const endDateFormatted = formatDate(endDateTime);

	// Prepare event details
	const summary = event.name.replace(/[,;\\]/g, "\\$&");
	const description = createEventDescription(event);
	const location =
		event.location && event.location !== "TBA"
			? `${event.location}, ${event.arrondissement}e Arrondissement, Paris, France`.replace(
					/[,;\\]/g,
					"\\$&",
				)
			: `${event.arrondissement}e Arrondissement, Paris, France`;

	const uid = `oooc-${event.name.replace(/\s+/g, "-").toLowerCase()}-${event.date}@oooc-fete-finder.com`;

	// Generate .ics content
	const icsContent = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//OOOC Fete Finder//Event Calendar//EN",
		"CALSCALE:GREGORIAN",
		"METHOD:PUBLISH",
		"BEGIN:VEVENT",
		`UID:${uid}`,
		`DTSTAMP:${timestamp}`,
		`DTSTART:${startDateFormatted}`,
		`DTEND:${endDateFormatted}`,
		`SUMMARY:${summary}`,
		`DESCRIPTION:${description}`,
		`LOCATION:${location}`,
		"STATUS:CONFIRMED",
		"TRANSP:OPAQUE",
		"END:VEVENT",
		"END:VCALENDAR",
	].join("\r\n");

	return icsContent;
}

/**
 * Parse time string to hours and minutes
 */
function parseTime(timeStr: string): [number, number] {
	const time = timeStr.trim().toLowerCase();

	// Handle AM/PM format
	const isAM = time.includes("am");
	const isPM = time.includes("pm");

	// Extract numbers
	const timeOnly = time.replace(/[ap]m/g, "").trim();
	const [hoursStr, minutesStr = "0"] = timeOnly.split(":");

	let hours = parseInt(hoursStr, 10);
	const minutes = parseInt(minutesStr, 10);

	// Convert to 24-hour format
	if (isPM && hours !== 12) {
		hours += 12;
	} else if (isAM && hours === 12) {
		hours = 0;
	}

	return [hours, minutes];
}

/**
 * Create a detailed description for the calendar event
 */
function createEventDescription(event: Event): string {
	const parts: string[] = [];

	if (event.description) {
		parts.push(event.description);
		parts.push(""); // Empty line
	}

	// Add event details
	const details: string[] = [];

	if (event.genre && event.genre.length > 0) {
		details.push(`Music: ${event.genre.join(", ")}`);
	}

	if (event.category) {
		details.push(`Category: ${event.category}`);
	}

	if (event.price !== undefined) {
		const price =
			event.price === "0" || event.price === "Free"
				? "Free"
				: `€${event.price}`;
		details.push(`Price: ${price}`);
	}

	if (event.age) {
		details.push(`Age: ${event.age}`);
	}

	if (details.length > 0) {
		parts.push(...details);
		parts.push(""); // Empty line
	}

	// Add verification status
	if (!event.verified) {
		parts.push("⚠️ Unverified event - details may change");
		parts.push("");
	}

	// Add link
	const primaryLink =
		event.links && event.links.length > 0 ? event.links[0] : event.link;
	if (primaryLink && primaryLink !== "#") {
		parts.push(`Event Details: ${primaryLink}`);
	}

	parts.push(""); // Empty line
	parts.push("📅 Added via OOOC Fete Finder");

	// Join parts and properly escape for ICS format
	const description = parts.join("\n");
	// Escape special characters for ICS: commas, semicolons, backslashes, and newlines
	return description
		.replace(/\\/g, "\\\\") // Escape backslashes first
		.replace(/,/g, "\\,") // Escape commas
		.replace(/;/g, "\\;") // Escape semicolons
		.replace(/\n/g, "\\n"); // Convert newlines to ICS format
}

/**
 * Download the .ics file
 */
export function downloadICSFile(event: Event): void {
	const icsContent = generateICSContent(event);
	const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
	const fileName = `${event.name
		.replace(/[^a-zA-Z0-9\s]/g, "")
		.replace(/\s+/g, "-")
		.toLowerCase()}-${event.date}.ics`;

	// Create download link
	const link = document.createElement("a");
	link.href = URL.createObjectURL(blob);
	link.download = fileName;

	// Trigger download
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);

	// Clean up
	URL.revokeObjectURL(link.href);
}

/**
 * Add event to calendar (universal method)
 * This will trigger the native calendar app on mobile devices
 * and download .ics file on desktop
 */
export function addToCalendar(event: Event): void {
	try {
		// Check if we're on mobile
		const isMobile =
			/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
				navigator.userAgent,
			);

		if (isMobile) {
			// On mobile, try to use the data URL approach which often opens the native calendar
			const icsContent = generateICSContent(event);
			const dataUri = `data:text/calendar;charset=utf8,${encodeURIComponent(icsContent)}`;

			// Try to open in calendar app
			const link = document.createElement("a");
			link.href = dataUri;
			link.download = `${event.name
				.replace(/[^a-zA-Z0-9\s]/g, "")
				.replace(/\s+/g, "-")
				.toLowerCase()}-${event.date}.ics`;

			// Try opening the link - on many mobile browsers this will trigger the calendar app
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		} else {
			// On desktop, download the .ics file
			downloadICSFile(event);
		}
	} catch (error) {
		clientLog.error(
			"events.calendar",
			"Error adding event to calendar",
			undefined,
			error,
		);
		// Fallback to download
		downloadICSFile(event);
	}
}
