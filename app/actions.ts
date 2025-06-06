"use server";

import { promises as fs } from "fs";
import path from "path";
import Papa from "papaparse";
import jwt from "jsonwebtoken";
import { parseCSVContent, convertCSVRowToEvent } from "@/utils/csvParser";
import { Event, EventDay, MusicGenre, Nationality, VenueType } from "@/types/events";
import { USE_CSV_DATA } from "@/data/events";

// Cache the events data in memory
let cachedEvents: Event[] | null = null;
let lastFetchTime = 0;
let lastRemoteFetchTime = 0;

// Cache configuration - can be overridden via environment variables
const CACHE_DURATION = parseInt(process.env.CACHE_DURATION_MS || '3600000'); // 1 hour default
const REMOTE_REFRESH_INTERVAL = parseInt(process.env.REMOTE_REFRESH_INTERVAL_MS || '300000'); // 5 minutes default

// Google Sheets CSV URL - configurable via environment variable
const REMOTE_CSV_URL = process.env.REMOTE_CSV_URL || "";

// Track data source for debugging
let lastDataSource: 'remote' | 'local' | 'cached' = 'cached';
let lastRemoteSuccessTime = 0;
let lastRemoteErrorMessage = "";

// Local CSV file fallback date (you should update this when you update the local CSV)
const LOCAL_CSV_LAST_UPDATED = process.env.LOCAL_CSV_LAST_UPDATED || "2025-01-18";

// Simple in-memory email storage (will reset on deployment, but good for development)
const collectedEmails: Array<{
	email: string;
	timestamp: string;
	consent: boolean;
	source: string;
}> = [];

/**
 * Fetch CSV content from Google Sheets using Service Account (most secure)
 */
async function fetchRemoteCSVWithServiceAccount(): Promise<string> {
	const GOOGLE_SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
	const GOOGLE_SERVICE_ACCOUNT_FILE = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
	const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
	const GOOGLE_SHEET_RANGE = process.env.GOOGLE_SHEET_RANGE || 'A:Z';
	
	if ((!GOOGLE_SERVICE_ACCOUNT_KEY && !GOOGLE_SERVICE_ACCOUNT_FILE) || !GOOGLE_SHEET_ID) {
		throw new Error('Service account credentials not configured. Set GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_SERVICE_ACCOUNT_FILE and GOOGLE_SHEET_ID environment variables.');
	}

	try {
		console.log('🔐 Attempting to fetch Google Sheet with service account authentication...');
		
		// Parse the service account key (from environment variable or file)
		let serviceAccount;
		try {
			if (GOOGLE_SERVICE_ACCOUNT_KEY) {
				serviceAccount = JSON.parse(GOOGLE_SERVICE_ACCOUNT_KEY);
			} else if (GOOGLE_SERVICE_ACCOUNT_FILE) {
				const filePath = path.resolve(process.cwd(), GOOGLE_SERVICE_ACCOUNT_FILE);
				const fileContent = await fs.readFile(filePath, 'utf-8');
				serviceAccount = JSON.parse(fileContent);
			}
		} catch (parseError) {
			const errorMsg = parseError instanceof Error ? parseError.message : 'Unknown parse error';
			throw new Error(`Failed to parse service account credentials: ${errorMsg}`);
		}

		// Create JWT token for service account
		const now = Math.floor(Date.now() / 1000);
		const payload = {
			iss: serviceAccount.client_email,
			scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
			aud: 'https://oauth2.googleapis.com/token',
			exp: now + 3600,
			iat: now,
		};

		// Sign JWT with private key
		const token = jwt.sign(payload, serviceAccount.private_key, { algorithm: 'RS256' });

		// Exchange JWT for access token
		const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: new URLSearchParams({
				grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
				assertion: token,
			}),
		});

		if (!tokenResponse.ok) {
			throw new Error(`Token exchange failed: ${tokenResponse.status} ${tokenResponse.statusText}`);
		}

		const tokenData = await tokenResponse.json();
		const accessToken = tokenData.access_token;

		if (!accessToken) {
			throw new Error('No access token received from Google OAuth');
		}

		// Use access token to fetch sheet data
		const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${GOOGLE_SHEET_RANGE}`;
		
		const response = await fetch(apiUrl, {
			headers: {
				'Authorization': `Bearer ${accessToken}`,
				'Cache-Control': 'no-cache',
				'Pragma': 'no-cache'
			}
		});

		if (!response.ok) {
			throw new Error(`Google Sheets API error: ${response.status} ${response.statusText}`);
		}

		const data = await response.json();
		
		if (!data.values || !Array.isArray(data.values)) {
			throw new Error('Invalid response format from Google Sheets API');
		}

		// Convert array of arrays to CSV format
		// First, determine the maximum number of columns
		const maxColumns = Math.max(...data.values.map((row: string[]) => row.length));
		
		const csvContent = data.values
			.map((row: string[]) => {
				// Pad row to ensure it has the same number of columns as the longest row
				const paddedRow = [...row];
				while (paddedRow.length < maxColumns) {
					paddedRow.push('');
				}
				return paddedRow.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',');
			})
			.join('\n');

		// Success! Update tracking variables
		lastRemoteSuccessTime = Date.now();
		lastRemoteErrorMessage = "";

		console.log(`✅ Successfully fetched private Google Sheet via service account (${csvContent.length} characters)`);
		console.log(`📊 Remote data is live and up-to-date as of ${new Date().toISOString()}`);
		return csvContent;
		
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown service account error';
		console.error('❌ Service account authentication failed:', errorMessage);
		throw new Error(errorMessage);
	}
}

/**
 * Fetch CSV content from Google Sheets using API Key (simpler but less secure)
 */
async function fetchRemoteCSVWithAuth(): Promise<string> {
	const GOOGLE_SHEETS_API_KEY = process.env.GOOGLE_SHEETS_API_KEY;
	const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
	const GOOGLE_SHEET_RANGE = process.env.GOOGLE_SHEET_RANGE || 'A:Z';
	
	if (!GOOGLE_SHEETS_API_KEY || !GOOGLE_SHEET_ID) {
		throw new Error('Google Sheets API credentials not configured. Set GOOGLE_SHEETS_API_KEY and GOOGLE_SHEET_ID environment variables.');
	}

	const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${GOOGLE_SHEET_RANGE}?key=${GOOGLE_SHEETS_API_KEY}`;

	try {
		console.log('🔑 Attempting to fetch private Google Sheet via API key...');
		
		const response = await fetch(apiUrl, {
			headers: {
				'Cache-Control': 'no-cache',
				'Pragma': 'no-cache'
			}
		});

		if (!response.ok) {
			throw new Error(`Google Sheets API error: ${response.status} ${response.statusText}`);
		}

		const data = await response.json();
		
		if (!data.values || !Array.isArray(data.values)) {
			throw new Error('Invalid response format from Google Sheets API');
		}

		// Convert array of arrays to CSV format
		// First, determine the maximum number of columns
		const maxColumns = Math.max(...data.values.map((row: string[]) => row.length));
		
		const csvContent = data.values
			.map((row: string[]) => {
				// Pad row to ensure it has the same number of columns as the longest row
				const paddedRow = [...row];
				while (paddedRow.length < maxColumns) {
					paddedRow.push('');
				}
				return paddedRow.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',');
			})
			.join('\n');

		// Success! Update tracking variables
		lastRemoteSuccessTime = Date.now();
		lastRemoteErrorMessage = "";

		console.log(`✅ Successfully fetched private Google Sheet via API key (${csvContent.length} characters)`);
		console.log(`📊 Remote data is live and up-to-date as of ${new Date().toISOString()}`);
		return csvContent;
		
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown API error';
		console.error('❌ Failed to fetch via Google Sheets API key:', errorMessage);
		throw new Error(errorMessage);
	}
}

/**
 * Fetch CSV content from Google Sheets (tries multiple methods in order)
 */
async function fetchRemoteCSV(): Promise<string> {
	const methods = [
		{ name: 'Direct CSV', fn: () => REMOTE_CSV_URL ? fetchRemoteCSVDirect() : Promise.reject(new Error('No REMOTE_CSV_URL configured')) },
		{ name: 'Service Account', fn: fetchRemoteCSVWithServiceAccount },
		{ name: 'API Key', fn: fetchRemoteCSVWithAuth }
	];

	let lastError: Error | null = null;

	for (const method of methods) {
		try {
			console.log(`🔄 Trying ${method.name} method...`);
			return await method.fn();
		} catch (error) {
			lastError = error instanceof Error ? error : new Error('Unknown error');
			console.log(`❌ ${method.name} method failed: ${lastError.message}`);
		}
	}

	// If all methods fail, throw the last error
	throw lastError || new Error('All authentication methods failed');
}

/**
 * Direct CSV fetch (original method)
 */
async function fetchRemoteCSVDirect(): Promise<string> {
	if (!REMOTE_CSV_URL) {
		throw new Error('REMOTE_CSV_URL environment variable is not configured');
	}

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
	
	try {
		console.log('🌐 Attempting to fetch remote CSV from Google Sheets...');
		
		const response = await fetch(REMOTE_CSV_URL, {
			signal: controller.signal,
			headers: {
				'Cache-Control': 'no-cache',
				'Pragma': 'no-cache'
			}
		});
		
		clearTimeout(timeoutId);
		
		if (!response.ok) {
			const errorMsg = `HTTP ${response.status}: ${response.statusText}`;
			lastRemoteErrorMessage = errorMsg;
			throw new Error(errorMsg);
		}
		
		const csvContent = await response.text();
		
		if (!csvContent || csvContent.trim().length === 0) {
			const errorMsg = 'Empty CSV content received';
			lastRemoteErrorMessage = errorMsg;
			throw new Error(errorMsg);
		}
		
		// Basic validation - ensure it looks like CSV
		if (!csvContent.includes(',') && !csvContent.includes('\n')) {
			const errorMsg = 'Invalid CSV format - no delimiters found';
			lastRemoteErrorMessage = errorMsg;
			throw new Error(errorMsg);
		}
		
		// Success! Update tracking variables
		lastRemoteSuccessTime = Date.now();
		lastRemoteErrorMessage = "";
		
		console.log(`✅ Successfully fetched remote CSV from Google Sheets (${csvContent.length} characters)`);
		console.log(`📊 Remote data is live and up-to-date as of ${new Date().toISOString()}`);
		
		return csvContent;
	} catch (error) {
		clearTimeout(timeoutId);
		
		let errorMessage: string;
		if (error instanceof Error && error.name === 'AbortError') {
			errorMessage = 'Request timeout - Google Sheets took too long to respond';
		} else if (error instanceof Error) {
			errorMessage = error.message;
		} else {
			errorMessage = 'Unknown error occurred';
		}
		
		lastRemoteErrorMessage = errorMessage;
		console.error('❌ Failed to fetch remote CSV:', errorMessage);
		
		throw new Error(errorMessage);
	}
}

/**
 * Fetch CSV content from local file
 */
async function fetchLocalCSV(): Promise<string> {
	const csvPath = path.join(process.cwd(), "data", "oooc-list-tracker4.csv");
	return await fs.readFile(csvPath, "utf-8");
}

/**
 * Get events data with smart caching and fallback logic
 */
export async function getEvents(forceRefresh: boolean = false): Promise<{
	success: boolean;
	data: Event[];
	count: number;
	cached: boolean;
	source: 'remote' | 'local' | 'cached';
	error?: string;
	lastUpdate?: string;
}> {
	try {
		const now = Date.now();
		
		// Return cached data if valid and not forcing refresh
		if (!forceRefresh && cachedEvents && now - lastFetchTime < CACHE_DURATION) {
			return {
				success: true,
				data: cachedEvents,
				count: cachedEvents.length,
				cached: true,
				source: lastDataSource,
				lastUpdate: new Date(lastFetchTime).toISOString(),
			};
		}

		let csvContent: string;
		const errors: string[] = [];

		// Try to fetch data based on USE_CSV_DATA flag
		if (USE_CSV_DATA) {
			// First try remote CSV if it's time for a refresh or forced
			const shouldTryRemote = forceRefresh || 
				now - lastRemoteFetchTime > REMOTE_REFRESH_INTERVAL ||
				!cachedEvents; // Always try remote if we have no cached data

			if (shouldTryRemote) {
				try {
					csvContent = await fetchRemoteCSV();
					lastRemoteFetchTime = now;
					console.log('📡 Using remote CSV data from Google Sheets');
					lastDataSource = 'remote';
				} catch (remoteError) {
					const errorMsg = remoteError instanceof Error ? remoteError.message : 'Unknown remote error';
					errors.push(`Remote CSV fetch failed: ${errorMsg}`);
					console.warn('⚠️ Remote CSV fetch failed, trying local fallback:', errorMsg);
					
					try {
						csvContent = await fetchLocalCSV();
						console.log('📁 Using local CSV fallback');
						console.log(`⚠️ Note: Local CSV data may be out of date. Last updated: ${LOCAL_CSV_LAST_UPDATED}`);
						lastDataSource = 'local';
					} catch (localError) {
						const localErrorMsg = localError instanceof Error ? localError.message : 'Unknown local error';
						errors.push(`Local CSV fallback failed: ${localErrorMsg}`);
						throw new Error(`Both remote and local CSV failed: Remote: ${errorMsg}, Local: ${localErrorMsg}`);
					}
				}
			} else {
				// Use local CSV if we're not trying remote
				try {
					csvContent = await fetchLocalCSV();
					console.log('📁 Using local CSV data (remote not due for refresh)');
					lastDataSource = 'local';
				} catch (localError) {
					const localErrorMsg = localError instanceof Error ? localError.message : 'Unknown local error';
					errors.push(`Local CSV failed: ${localErrorMsg}`);
					throw new Error(`Local CSV failed: ${localErrorMsg}`);
				}
			}
		} else {
			// USE_CSV_DATA is false, use local CSV
			csvContent = await fetchLocalCSV();
			console.log('📁 Using local CSV data (USE_CSV_DATA is false)');
			lastDataSource = 'local';
		}

		// Parse the CSV content
		const csvRows = parseCSVContent(csvContent);

		// Convert to Event objects
		const events: Event[] = csvRows.map((row, index) =>
			convertCSVRowToEvent(row, index),
		);

		// Update cache
		cachedEvents = events;
		lastFetchTime = now;

		const result: {
			success: boolean;
			data: Event[];
			count: number;
			cached: boolean;
			source: 'remote' | 'local' | 'cached';
			lastUpdate: string;
			error?: string;
		} = {
			success: true,
			data: events,
			count: events.length,
			cached: false,
			source: lastDataSource,
			lastUpdate: new Date(lastFetchTime).toISOString(),
		};

		// Add error info if there were non-fatal errors
		if (errors.length > 0) {
			result.error = `Warnings: ${errors.join('; ')}`;
		}

		console.log(`✅ Successfully loaded ${events.length} events from ${lastDataSource} CSV`);
		return result;

	} catch (error) {
		console.error("❌ Error loading CSV events:", error);
		const errorMessage = error instanceof Error ? error.message : "Unknown error";

		// If we have cached data, return it even if expired
		if (cachedEvents) {
			console.log("⚠️ Returning expired cached data due to error");
			return {
				success: true,
				data: cachedEvents,
				count: cachedEvents.length,
				cached: true,
				source: lastDataSource,
				error: `Using cached data due to error: ${errorMessage}`,
				lastUpdate: new Date(lastFetchTime).toISOString(),
			};
		}

		return {
			success: false,
			data: [],
			count: 0,
			cached: false,
			source: 'local',
			error: errorMessage,
		};
	}
}

/**
 * Force refresh the events cache - useful for admin panel
 */
export async function forceRefreshEvents(): Promise<{
	success: boolean;
	message: string;
	data?: Event[];
	count?: number;
	source?: 'remote' | 'local' | 'cached';
	error?: string;
}> {
	try {
		console.log('🔄 Force refreshing events cache...');
		const result = await getEvents(true);
		
		if (result.success) {
			return {
				success: true,
				message: `Successfully refreshed ${result.count} events from ${result.source} source`,
				data: result.data,
				count: result.count,
				source: result.source,
			};
		} else {
			return {
				success: false,
				message: 'Failed to refresh events',
				error: result.error,
			};
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		console.error('❌ Force refresh failed:', errorMessage);
		return {
			success: false,
			message: 'Force refresh failed',
			error: errorMessage,
		};
	}
}

/**
 * Get cache and system status - useful for admin panel
 */
export async function getCacheStatus(): Promise<{
	hasCachedData: boolean;
	lastFetchTime: string | null;
	lastRemoteFetchTime: string | null;
	lastRemoteSuccessTime: string | null;
	lastRemoteErrorMessage: string;
	cacheAge: number;
	nextRemoteCheck: number;
	dataSource: 'remote' | 'local' | 'cached';
	useCsvData: boolean;
	eventCount: number;
	localCsvLastUpdated: string;
	remoteConfigured: boolean;
}> {
	const now = Date.now();
	
	return {
		hasCachedData: cachedEvents !== null,
		lastFetchTime: lastFetchTime ? new Date(lastFetchTime).toISOString() : null,
		lastRemoteFetchTime: lastRemoteFetchTime ? new Date(lastRemoteFetchTime).toISOString() : null,
		lastRemoteSuccessTime: lastRemoteSuccessTime ? new Date(lastRemoteSuccessTime).toISOString() : null,
		lastRemoteErrorMessage: lastRemoteErrorMessage,
		cacheAge: lastFetchTime ? now - lastFetchTime : 0,
		nextRemoteCheck: lastRemoteFetchTime ? Math.max(0, REMOTE_REFRESH_INTERVAL - (now - lastRemoteFetchTime)) : 0,
		dataSource: lastDataSource,
		useCsvData: USE_CSV_DATA,
		eventCount: cachedEvents?.length || 0,
		localCsvLastUpdated: LOCAL_CSV_LAST_UPDATED,
		remoteConfigured: Boolean(REMOTE_CSV_URL),
	};
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
		
		console.log("About to push email to collectedEmails array. Current length:", collectedEmails.length);
		collectedEmails.push(emailRecord);
		console.log("After push - new length:", collectedEmails.length);
		console.log("Just added:", emailRecord);
		
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
	
	// Debug logging
	console.log("Admin panel accessed - current emails in memory:", collectedEmails.length);
	console.log("Emails:", collectedEmails);
	
	return {
		success: true,
		emails: collectedEmails,
		count: collectedEmails.length
	};
}
