/**
 * 🔄 Unified Google Cloud API
 *
 * Provides a unified interface to all Google Cloud services.
 * This is the main entry point for Google integrations.
 */

// Re-export from focused modules
export { GoogleSheetsAPI } from "./sheets/api";
export { GoogleGeocodingAPI } from "./geocoding/api";

import { GoogleGeocodingAPI } from "./geocoding/api";
// Import for internal use
import { GoogleSheetsAPI } from "./sheets/api";

// Re-export types
export type {
	ServiceAccountCredentials,
	GoogleSheetsFetchResult,
	GoogleSheetsFetchError,
} from "./sheets/api";

export type {
	GeocodingResult,
	GeocodingError,
	GeocodingBatchResult,
} from "./geocoding/api";

/**
 * Unified Google Cloud API - Backwards compatibility
 *
 * This maintains the same interface as the old GoogleCloudAPI but
 * now delegates to the focused modules.
 */
export const GoogleCloudAPI = {
	// Sheets functionality
	fetchSheetsData: GoogleSheetsAPI.fetchSheetsData,
	buildSheetsUrl: GoogleSheetsAPI.buildSheetsUrl,
	extractSheetId: GoogleSheetsAPI.extractSheetId,
	fetchPublicCSV: GoogleSheetsAPI.fetchPublicCSV,
	fetchWithServiceAccount: GoogleSheetsAPI.fetchWithServiceAccount,

	// Geocoding functionality
	geocodeAddress: GoogleGeocodingAPI.geocodeAddress,
	geocodeAddressesBatch: GoogleGeocodingAPI.geocodeAddressesBatch,
	reverseGeocode: GoogleGeocodingAPI.reverseGeocode,

	// Configuration check
	isConfigured: () => {
		const { env } = require("@/lib/config/env");
		return Boolean(
			env.GOOGLE_SERVICE_ACCOUNT_KEY || env.GOOGLE_SERVICE_ACCOUNT_FILE,
		);
	},

	// Geocoding support check
	supportsGeocoding: () => {
		const { env } = require("@/lib/config/env");
		return Boolean(
			env.GOOGLE_SERVICE_ACCOUNT_KEY || env.GOOGLE_SERVICE_ACCOUNT_FILE,
		);
	},
} as const;
