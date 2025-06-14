/**
 * 📖 Google Cloud Platform Service Account API
 * 
 * Used for: Reading event data from Google Sheets
 * File: lib/data-management/google-sheets.ts
 * Auth: Service account with private key
 * Scope: spreadsheets.readonly
 */

import { ServerEnvironmentManager } from "@/lib/config/env";

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
			ServerEnvironmentManager.get("GOOGLE_SERVICE_ACCOUNT_KEY") ||
				ServerEnvironmentManager.get("GOOGLE_SERVICE_ACCOUNT_FILE"),
		);
	},

	/**
	 * Get configuration status
	 */
	getConfig: () => ({
		hasServiceAccount: Boolean(
			ServerEnvironmentManager.get("GOOGLE_SERVICE_ACCOUNT_KEY") ||
				ServerEnvironmentManager.get("GOOGLE_SERVICE_ACCOUNT_FILE"),
		),
		sheetId: ServerEnvironmentManager.get("GOOGLE_SHEET_ID"),
		range: ServerEnvironmentManager.get("GOOGLE_SHEET_RANGE"),
	}),
} as const; 