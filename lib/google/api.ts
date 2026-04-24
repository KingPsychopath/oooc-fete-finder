/**
 * 🔄 Unified Google Cloud API
 *
 * Provides a unified interface to all Google Cloud services.
 * This is the main entry point for Google geocoding integrations.
 */

export { GoogleGeocodingAPI } from "./geocoding/api";

import { GoogleGeocodingAPI } from "./geocoding/api";

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
	// Geocoding functionality
	geocodeAddress: GoogleGeocodingAPI.geocodeAddress,
	geocodeAddressesBatch: GoogleGeocodingAPI.geocodeAddressesBatch,
	reverseGeocode: GoogleGeocodingAPI.reverseGeocode,

	// Geocoding support check (Maps Geocoding API requires an API key)
	supportsGeocoding: () => {
		const { env } = require("@/lib/config/env");
		return Boolean(env.GOOGLE_MAPS_API_KEY?.trim());
	},
} as const;
