/**
 * 🔧 Google Integration Status & Validation
 *
 * The app uses Google for two things only:
 * 1. Geocoding (GOOGLE_MAPS_API_KEY)
 * 2. Admin import/preview from Sheet (GOOGLE_SHEET_ID + service account, or REMOTE_CSV_URL)
 */

import { GoogleCloudAPI } from "./api";

/**
 * 🎯 Integration Summary
 */
export const GOOGLE_INTEGRATION_GUIDE = {
	Geocoding: "GOOGLE_MAPS_API_KEY — address → coordinates for the map",
	"Admin sheet import/preview":
		"GOOGLE_SHEET_ID + service account or REMOTE_CSV_URL — Import/Preview in admin",
} as const;

/**
 * 🔧 Configuration Check
 * Validate Google Cloud API configuration (Sheets, Geocoding)
 */
export const validateGoogleIntegrations = () => {
	const gcpConfigured = GoogleCloudAPI.isConfigured();
	const geocodingConfigured = GoogleCloudAPI.supportsGeocoding();

	return {
		gcp: {
			configured: gcpConfigured,
			purpose: "Reading event data (Sheets)",
			status: gcpConfigured ? "✅ Ready" : "❌ Missing service account",
		},
		geocoding: {
			configured: geocodingConfigured,
			purpose: "Geocoding (Maps API key)",
			status: geocodingConfigured ? "✅ Ready" : "❌ Missing GOOGLE_MAPS_API_KEY",
		},
		overall:
			gcpConfigured && geocodingConfigured
				? "✅ Fully configured"
				: gcpConfigured || geocodingConfigured
					? "⚠️ Partial configuration"
					: "❌ Not configured",
	};
};
