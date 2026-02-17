"use server";

import { validateAdminAccessFromServerContext } from "@/features/auth/admin-validation";
import { log } from "@/lib/platform/logger";
import { CacheManager } from "./cache-manager";

/**
 * Cache Management Server Actions
 *
 * Minimal server action surface for cache refresh/revalidation.
 */

// Helper function to validate admin access (key or session token)
async function validateAdminAccess(keyOrToken?: string): Promise<boolean> {
	return validateAdminAccessFromServerContext(keyOrToken ?? null);
}

/**
 * Revalidate pages and refresh cache - replaces the API route
 */
export async function revalidatePages(
	keyOrToken?: string,
	path: string = "/",
): Promise<{
	success: boolean;
	message?: string;
	cacheRefreshed?: boolean;
	pageRevalidated?: boolean;
	processingTimeMs?: number;
	error?: string;
}> {
	"use server";

	const startTime = Date.now();
	log.info("cache", "Revalidate server action called");

	// Verify admin access
	if (!(await validateAdminAccess(keyOrToken))) {
		return { success: false, error: "Unauthorized access" };
	}

	// Validate and normalize path
	const normalizePath = (inputPath: string): string => {
		if (!inputPath || typeof inputPath !== "string") {
			return "/";
		}

		// Ensure path starts with /
		const normalizedPath = inputPath.startsWith("/")
			? inputPath
			: `/${inputPath}`;

		// Basic path validation to prevent malicious paths
		if (
			normalizedPath.includes("..") ||
			!normalizedPath.match(/^\/[\w\-\/]*$/)
		) {
			log.warn("cache", "Invalid revalidate path provided; using root", {
				inputPath,
			});
			return "/";
		}

		return normalizedPath;
	};

	const normalizedPath = normalizePath(path);

	log.info("cache", "Revalidate request", {
		normalizedPath,
		timestamp: new Date().toISOString(),
	});

	try {
		log.info("cache", "Admin access verified; starting full revalidation");

		// Use the centralized cache manager for full revalidation
		const revalidationResult =
			await CacheManager.fullRevalidation(normalizedPath);

		const processingTime = Date.now() - startTime;
		log.info("cache", "Revalidation completed", { processingTimeMs: processingTime });

		return {
			...revalidationResult,
			processingTimeMs: processingTime,
		};
	} catch (error) {
		const processingTime = Date.now() - startTime;
		log.error("cache", "Revalidation error", undefined, error);

		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
			processingTimeMs: processingTime,
		};
	}
}
