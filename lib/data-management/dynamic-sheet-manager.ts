/**
 * Dynamic Sheet Manager
 *
 * Handles runtime configuration of data sources for admin operations.
 * This is separate from the main data management to avoid circular dependencies
 * and keep concerns separated.
 */

/**
 * Configuration for dynamic sheet overrides
 * @interface DynamicSheetConfig
 * @property {string | null} sheetId - Sheet identifier (could be Google Sheet ID, file path, etc.)
 * @property {string | null} range - Sheet range to fetch (for Google Sheets)
 */
interface DynamicSheetConfig {
	sheetId: string | null;
	range: string | null;
}

// Dynamic sheet override (stored in memory for admin use)
let dynamicSheetConfig: DynamicSheetConfig = {
	sheetId: null,
	range: null,
};

/**
 * Simple utility to extract Google Sheet ID from URL or validate direct ID
 * This is a lightweight version that doesn't require Google API imports
 */
function extractSheetId(input: string): string | null {
	if (!input) return null;

	// Pattern to match Google Sheets ID from various URL formats
	const patterns = [
		/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
		/^([a-zA-Z0-9-_]{44})$/, // Direct sheet ID (44 characters)
	];

	for (const pattern of patterns) {
		const match = input.match(pattern);
		if (match) return match[1];
	}

	return null;
}

/**
 * Dynamic Sheet Manager class
 *
 * Provides methods for managing dynamic sheet configurations without
 * dependencies on Google APIs or other heavy imports.
 */
export class DynamicSheetManager {
	/**
	 * Set dynamic sheet configuration for admin overrides
	 *
	 * Allows runtime configuration of sheet source without environment changes.
	 * Useful for admin operations and testing different data sources.
	 *
	 * @param {string | null} sheetId - Sheet ID, URL, or file path
	 * @param {string | null} [range="A:Z"] - Sheet range to fetch (for Google Sheets)
	 * @returns {Promise<{success: boolean; message: string; sheetId?: string; range?: string}>} Operation result
	 */
	static async setDynamicSheet(
		sheetId: string | null,
		range: string | null = null,
	): Promise<{
		success: boolean;
		message: string;
		sheetId?: string;
		range?: string;
	}> {
		try {
			if (!sheetId || sheetId.trim() === "") {
				// Clear dynamic override
				dynamicSheetConfig = { sheetId: null, range: null };
				return {
					success: true,
					message:
						"Dynamic sheet override cleared - using environment variables",
				};
			}

			// For Google Sheets, try to extract the ID
			// For other sources (like file paths), use as-is
			let processedSheetId = sheetId.trim();

			// Only try to extract if it looks like a Google Sheets URL
			if (sheetId.includes("docs.google.com/spreadsheets")) {
				const extractedId = extractSheetId(sheetId);
				if (!extractedId) {
					return {
						success: false,
						message: "Invalid Google Sheet URL format",
					};
				}
				processedSheetId = extractedId;
			}

			// Set dynamic override
			dynamicSheetConfig = {
				sheetId: processedSheetId,
				range: (range && range.trim()) || "A:Z",
			};

			console.log(
				`🔄 Dynamic sheet set: ${dynamicSheetConfig.sheetId} (Range: ${dynamicSheetConfig.range})`,
			);

			return {
				success: true,
				message: "Dynamic sheet override set successfully",
				sheetId: dynamicSheetConfig.sheetId || undefined,
				range: dynamicSheetConfig.range || undefined,
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			console.error("❌ Error setting dynamic sheet:", errorMessage);
			return {
				success: false,
				message: `Error: ${errorMessage}`,
			};
		}
	}

	/**
	 * Get current dynamic sheet configuration
	 *
	 * @returns {{sheetId: string | null; range: string | null; isActive: boolean}} Current configuration state
	 */
	static getDynamicSheetConfig(): {
		sheetId: string | null;
		range: string | null;
		isActive: boolean;
	} {
		return {
			sheetId: dynamicSheetConfig.sheetId,
			range: dynamicSheetConfig.range,
			isActive: dynamicSheetConfig.sheetId !== null,
		};
	}

	/**
	 * Check if a dynamic override is currently active
	 *
	 * @returns {boolean} Whether a dynamic override is active
	 */
	static hasDynamicOverride(): boolean {
		return dynamicSheetConfig.sheetId !== null;
	}

	/**
	 * Get the effective sheet configuration (dynamic override or fallback)
	 *
	 * @param {string | null} fallbackSheetId - Fallback sheet ID from environment
	 * @param {string | null} fallbackRange - Fallback range from environment
	 * @returns {{sheetId: string | null; range: string | null; isDynamic: boolean}} Effective configuration
	 */
	static getEffectiveConfig(
		fallbackSheetId: string | null = null,
		fallbackRange: string | null = "A:Z",
	): {
		sheetId: string | null;
		range: string | null;
		isDynamic: boolean;
	} {
		const isDynamic = this.hasDynamicOverride();

		return {
			sheetId: isDynamic ? dynamicSheetConfig.sheetId : fallbackSheetId,
			range: isDynamic ? dynamicSheetConfig.range : fallbackRange,
			isDynamic,
		};
	}
}
