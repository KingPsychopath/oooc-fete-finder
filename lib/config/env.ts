import { clientLog } from "@/lib/platform/client-logger";
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

const isServerRuntime = typeof window === "undefined";
const rawDataMode = process.env.DATA_MODE?.trim() ?? "";
const isVercelHosted = process.env.VERCEL === "1";
const vercelEnv = process.env.VERCEL_ENV;
const isVercelDeployTarget =
	isVercelHosted && (vercelEnv === "production" || vercelEnv === "preview");

if (
	isServerRuntime &&
	process.env.NODE_ENV === "production" &&
	isVercelDeployTarget &&
	!rawDataMode
) {
	throw new Error(
		"Missing required DATA_MODE in production. Set DATA_MODE to remote, local, or test.",
	);
}

if (isServerRuntime && !rawDataMode) {
	clientLog.warn(
		"env",
		"DATA_MODE is not set; defaulting to remote. Set DATA_MODE explicitly for Vercel preview/production deploys.",
	);
}

type EnvIssueSegment = PropertyKey | { key: PropertyKey };
type EnvValidationIssue = {
	message: string;
	path?: readonly EnvIssueSegment[];
};

const formatEnvIssuePath = (path: EnvValidationIssue["path"]): string => {
	if (!path || path.length === 0) {
		return "unknown";
	}

	return path
		.map((segment) =>
			typeof segment === "object" && segment !== null && "key" in segment
				? String(segment.key)
				: String(segment),
		)
		.join(".");
};

const formatEnvValidationMessage = (
	issues: readonly EnvValidationIssue[],
): string => {
	const details = issues
		.map((issue) => `- ${formatEnvIssuePath(issue.path)}: ${issue.message}`)
		.join("\n");

	return [
		"Invalid environment variables:",
		details,
		"",
		"Set/fix these values in .env.local (development) or your deployment env settings, then restart the server.",
	].join("\n");
};

export const env = createEnv({
	/**
	 * Server-side Environment Variables
	 * These are never sent to the client and can only be accessed on the server
	 */
	server: {
		// Core settings
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),
		ADMIN_KEY: z.string().default(""),
		AUTH_SECRET: z
			.string()
			.trim()
			.min(32, "AUTH_SECRET must be at least 32 characters long"),
		DATABASE_URL: z.string().optional(),
		POSTGRES_POOL_MAX: z.string().optional(),
		DATA_MODE: z.enum(["remote", "local", "test"]).default("remote"),
		ADMIN_RESET_PASSCODE: z.string().optional(),

		// Google configuration
		GOOGLE_MAPS_API_KEY: z.string().optional(),
		GOOGLE_SHEET_ID: z.string().optional(),
		GOOGLE_SERVICE_ACCOUNT_KEY: z.string().optional(),
		REMOTE_CSV_URL: z.string().url().optional(),
		CRON_SECRET: z.string().optional(),
		DEPLOY_REVALIDATE_SECRET: z.string().optional(),
		STRIPE_WEBHOOK_SECRET: z.string().optional(),
		STRIPE_PAYMENT_LINK_ID_SPOTLIGHT_STANDARD: z.string().optional(),
		STRIPE_PAYMENT_LINK_ID_SPOTLIGHT_TAKEOVER: z.string().optional(),
		STRIPE_PAYMENT_LINK_ID_PROMOTED: z.string().optional(),
		STRIPE_PAYMENT_LINK_ID_ADDON_WHATSAPP: z.string().optional(),
		STRIPE_PAYMENT_LINK_ID_ADDON_NEWSLETTER: z.string().optional(),
	},

	/**
	 * Client-side Environment Variables
	 * These are sent to the client and can be accessed anywhere
	 * Must be prefixed with NEXT_PUBLIC_
	 */
	client: {
		NEXT_PUBLIC_BASE_PATH: z.string().default(""),
		NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
	},

	/**
	 * Runtime Environment Variables
	 * Maps the actual process.env values to the schema
	 */
	runtimeEnv: {
		// Server
		NODE_ENV: process.env.NODE_ENV,
		ADMIN_KEY: process.env.ADMIN_KEY,
		AUTH_SECRET: process.env.AUTH_SECRET,
		DATABASE_URL: process.env.DATABASE_URL,
		POSTGRES_POOL_MAX: process.env.POSTGRES_POOL_MAX,
		DATA_MODE: process.env.DATA_MODE,
		ADMIN_RESET_PASSCODE: process.env.ADMIN_RESET_PASSCODE,

		// Google configuration
		GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,
		GOOGLE_SHEET_ID: process.env.GOOGLE_SHEET_ID,
		GOOGLE_SERVICE_ACCOUNT_KEY: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
		REMOTE_CSV_URL: process.env.REMOTE_CSV_URL,
		CRON_SECRET: process.env.CRON_SECRET,
		DEPLOY_REVALIDATE_SECRET: process.env.DEPLOY_REVALIDATE_SECRET,
		STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
		STRIPE_PAYMENT_LINK_ID_SPOTLIGHT_STANDARD:
			process.env.STRIPE_PAYMENT_LINK_ID_SPOTLIGHT_STANDARD,
		STRIPE_PAYMENT_LINK_ID_SPOTLIGHT_TAKEOVER:
			process.env.STRIPE_PAYMENT_LINK_ID_SPOTLIGHT_TAKEOVER,
		STRIPE_PAYMENT_LINK_ID_PROMOTED:
			process.env.STRIPE_PAYMENT_LINK_ID_PROMOTED,
		STRIPE_PAYMENT_LINK_ID_ADDON_WHATSAPP:
			process.env.STRIPE_PAYMENT_LINK_ID_ADDON_WHATSAPP,
		STRIPE_PAYMENT_LINK_ID_ADDON_NEWSLETTER:
			process.env.STRIPE_PAYMENT_LINK_ID_ADDON_NEWSLETTER,

		// Client
		NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH,
		NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
	},

	/**
	 * Skip validation during build time in some cases
	 */
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
	emptyStringAsUndefined: true,
	onValidationError: (issues) => {
		const message = formatEnvValidationMessage(issues);
		console.error(message);
		throw new Error(message);
	},
});

/**
 * Check if admin authentication is enabled.
 */
export const isAdminAuthEnabled = () => env.ADMIN_KEY.trim().length > 0;
