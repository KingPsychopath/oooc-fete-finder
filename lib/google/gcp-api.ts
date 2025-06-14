/**
 * 📖 Google Cloud Platform Service Account API
 * 
 * Used for: Reading event data from Google Sheets
 * File: lib/data-management/google-sheets.ts
 * Auth: Service account with private key
 * Scope: spreadsheets.readonly
 */

// Re-export with clear naming
export {
	fetchRemoteCSVWithServiceAccount as fetchEventDataViaGCP,
} from "../data-management/google-sheets";

/**
 * Google Cloud Platform API utilities
 */
export const GoogleCloudAPI = {
	/**
	 * Fetch event data using GCP Service Account
	 */
	fetchEventData: async (sheetId: string, range: string = "A:Z") => {
		const { fetchRemoteCSVWithServiceAccount } = await import(
			"../data-management/google-sheets"
		);
		return fetchRemoteCSVWithServiceAccount(sheetId, range);
	},

	/**
	 * Check if GCP authentication is configured
	 */
	isConfigured: () => {
		return Boolean(
			process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
				process.env.GOOGLE_SERVICE_ACCOUNT_FILE,
		);
	},

	/**
	 * Get configuration status
	 */
	getConfig: () => ({
		hasServiceAccount: Boolean(
			process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
				process.env.GOOGLE_SERVICE_ACCOUNT_FILE,
		),
		sheetId: process.env.GOOGLE_SHEET_ID || null,
		range: process.env.GOOGLE_SHEET_RANGE || "A:Z",
	}),
} as const; 