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

// Simple in-memory email storage (will reset on deployment, but good for development)
const collectedEmails: Array<{
	email: string;
	timestamp: string;
	consent: boolean;
	source: string;
}> = [];

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

// Optional Google Sheets integration
async function sendToGoogleSheets(emailRecord: {
	email: string;
	consent: boolean;
	timestamp: string;
	source: string;
}) {
	// Only run if Google Sheets credentials are provided
	if (!process.env.GOOGLE_SHEETS_URL) {
		return;
	}

	try {
		// Google Apps Script Web App URL (you'll create this)
		const response = await fetch(process.env.GOOGLE_SHEETS_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(emailRecord),
		});

		if (response.ok) {
			console.log('Email sent to Google Sheets successfully');
		}
	} catch (error) {
		console.error('Failed to send to Google Sheets:', error);
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
		// Store email in memory
		const emailRecord = {
			email,
			consent,
			timestamp: new Date().toISOString(),
			source: 'fete-finder-auth'
		};
		
		collectedEmails.push(emailRecord);
		
		// Log the authentication with consent info
		console.log("User authenticated:", emailRecord);
		
		// Optionally send to Google Sheets
		await sendToGoogleSheets(emailRecord);
		
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

// Admin function to get collected emails
export async function getCollectedEmails(adminKey?: string) {
	"use server";
	
	// Simple protection - you can set this as an environment variable
	const expectedKey = process.env.ADMIN_KEY || "your-secret-key-123";
	
	if (adminKey !== expectedKey) {
		return { success: false, error: "Unauthorized" };
	}
	
	return {
		success: true,
		emails: collectedEmails,
		count: collectedEmails.length
	};
}
