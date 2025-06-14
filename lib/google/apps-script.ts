/**
 * ✍️ Google Apps Script Integration
 * 
 * Used for: Writing user data and admin functions
 * File: scripts/enhanced-google-apps-script.js
 * Auth: Public webhook endpoint
 * Deployment: https://script.google.com/macros/s/.../exec
 */

/**
 * Google Apps Script utilities
 */
export const GoogleAppsScript = {
	/**
	 * Submit user authentication data
	 */
	submitUserData: async (userData: {
		firstName: string;
		lastName: string;
		email: string;
		consent: boolean;
		source: string;
		timestamp: string;
	}) => {
		const { submitUserDataToScript } = await import("./apps-script-actions");
		return submitUserDataToScript(userData.firstName, userData.lastName, userData.email);
	},

	/**
	 * Get admin statistics
	 */
	getAdminStats: async (adminKey?: string) => {
		const { getScriptStats } = await import("./apps-script-actions");
		return getScriptStats(adminKey);
	},

	/**
	 * Get recent entries
	 */
	getRecentEntries: async (adminKey?: string, limit: number = 5) => {
		const { getRecentScriptEntries } = await import("./apps-script-actions");
		return getRecentScriptEntries(adminKey, limit);
	},

	/**
	 * Cleanup duplicate entries
	 */
	cleanupDuplicates: async (adminKey?: string) => {
		const { cleanupScriptDuplicates } = await import("./apps-script-actions");
		return cleanupScriptDuplicates(adminKey);
	},

	/**
	 * Check if Apps Script is configured
	 */
	isConfigured: () => {
		return Boolean(process.env.GOOGLE_SHEETS_URL);
	},

	/**
	 * Get configuration status
	 */
	getConfig: () => ({
		webhookUrl: process.env.GOOGLE_SHEETS_URL || null,
		isConfigured: Boolean(process.env.GOOGLE_SHEETS_URL),
	}),
} as const; 