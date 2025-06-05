"use server";

import { promises as fs } from "fs";
import path from "path";
import Papa from "papaparse";
import { parseCSVContent, convertCSVRowToEvent } from "@/utils/csvParser";
import { Event, EventDay, MusicGenre, Nationality, VenueType } from "@/types/events";

// Cache the events data in memory
let cachedEvents: Event[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 3600 * 1000; // 1 hour in milliseconds

export async function getEvents(): Promise<{
	success: boolean;
	data: Event[];
	count: number;
	cached: boolean;
	error?: string;
}> {
	try {
		// Check if we have valid cached data
		const now = Date.now();
		if (cachedEvents && now - lastFetchTime < CACHE_DURATION) {
			return {
				success: true,
				data: cachedEvents,
				count: cachedEvents.length,
				cached: true,
			};
		}

		// Read the CSV file from the server-side
		const csvPath = path.join(process.cwd(), "data", "oooc-list-tracker4.csv");
		const csvContent = await fs.readFile(csvPath, "utf-8");

		// Parse the CSV content
		const csvRows = parseCSVContent(csvContent);

		// Convert to Event objects
		const events: Event[] = csvRows.map((row, index) =>
			convertCSVRowToEvent(row, index),
		);

		// Update cache
		cachedEvents = events;
		lastFetchTime = now;

		return {
			success: true,
			data: events,
			count: events.length,
			cached: false,
		};
	} catch (error) {
		console.error("Error loading CSV events:", error);

		// If we have cached data, return it even if expired
		if (cachedEvents) {
			console.log("Returning cached data due to error");
			return {
				success: true,
				data: cachedEvents,
				count: cachedEvents.length,
				cached: true,
				error: "Using cached data due to error",
			};
		}

		return {
			success: false,
			data: [],
			count: 0,
			cached: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

// Email authentication server action
export async function authenticateUser(formData: FormData) {
	"use server";
	
	const email = formData.get("email") as string;
	const consent = formData.get("consent") === "true";
	
	// Validation
	if (!email) {
		return { success: false, error: "Email is required" };
	}
	
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	if (!emailRegex.test(email)) {
		return { success: false, error: "Invalid email address" };
	}
	
	if (!consent) {
		return { success: false, error: "Consent is required" };
	}
	
	try {
		// Log the authentication with consent info
		console.log("User authenticated:", {
			email,
			consent,
			timestamp: new Date().toISOString(),
			source: 'fete-finder-auth'
		});
		
		// Here you would typically:
		// await storeEmailWithConsent({
		//   email,
		//   consentGiven: true,
		//   consentTimestamp: new Date(),
		//   source: 'fete-finder-auth'
		// });
		
		return { 
			success: true, 
			message: "Email collected with consent",
			email 
		};
	} catch (error) {
		console.error("Error processing email:", error);
		return { success: false, error: "Something went wrong. Please try again." };
	}
}
