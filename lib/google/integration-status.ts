/**
 * 🔧 Google Integration Status & Validation
 *
 * Utilities to check configuration and status of both Google integrations
 */

import { GoogleCloudAPI } from "./api";
import { GoogleAppsScript } from "./apps-script";

/**
 * 🎯 Integration Summary
 * Quick reference for which approach to use when
 */
export const GOOGLE_INTEGRATION_GUIDE = {
	"Reading event data": "Use GoogleCloudAPI.fetchEventData()",
	"Writing user data": "Use GoogleAppsScript.submitUserData()",
	"Admin statistics": "Use GoogleAppsScript.getAdminStats()",
	"Admin cleanup": "Use GoogleAppsScript.cleanupDuplicates()",
	"Batch operations": "Use GoogleCloudAPI (better for large datasets)",
	"Simple webhooks": "Use GoogleAppsScript (easier deployment)",
} as const;

/**
 * 🔧 Configuration Check
 * Validate both integration approaches
 */
export const validateGoogleIntegrations = () => {
	const gcpConfigured = GoogleCloudAPI.isConfigured();
	const scriptConfigured = GoogleAppsScript.isConfigured();

	return {
		gcp: {
			configured: gcpConfigured,
			purpose: "Reading event data",
			status: gcpConfigured ? "✅ Ready" : "❌ Missing service account",
		},
		appsScript: {
			configured: scriptConfigured,
			purpose: "Writing user data & admin functions",
			status: scriptConfigured ? "✅ Ready" : "❌ Missing webhook URL",
		},
		overall:
			gcpConfigured && scriptConfigured
				? "✅ Fully configured"
				: "⚠️ Partial configuration",
	};
};
