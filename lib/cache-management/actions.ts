"use server";

import { validateAdminAccessFromServerContext } from "@/lib/admin/admin-validation";
import { CacheInvalidationManager, CacheManager } from "./cache-manager";

/**
 * Cache Management Server Actions
 *
 * Server actions specifically related to cache invalidation, revalidation,
 * and cache busting operations. Colocated with cache management modules.
 */

// Helper function to validate admin access (key or session token)
async function validateAdminAccess(keyOrToken?: string): Promise<boolean> {
	return validateAdminAccessFromServerContext(keyOrToken ?? null);
}

/**
 * Emergency cache bust - clear all cache layers immediately
 */
export async function emergencyCacheBust(): Promise<{
	success: boolean;
	message: string;
	operations: string[];
	errors: string[];
}> {
	return CacheInvalidationManager.emergencyCacheBust();
}

/**
 * Smart cache invalidation - only invalidate if data changed
 */
export async function smartCacheInvalidation(paths: string[] = ["/"]): Promise<{
	success: boolean;
	clearedPaths: string[];
	errors: string[];
}> {
	return CacheInvalidationManager.clearAllCaches(paths);
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
	console.log("🔄 Revalidate server action called");

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
			console.warn(
				`⚠️ Invalid path provided, falling back to root: ${inputPath}`,
			);
			return "/";
		}

		return normalizedPath;
	};

	const normalizedPath = normalizePath(path);

	console.log("📋 Revalidate request:", {
		normalizedPath,
		timestamp: new Date().toISOString(),
	});

	try {
		console.log("✅ Admin access verified, starting full revalidation...");

		// Use the centralized cache manager for full revalidation
		const revalidationResult =
			await CacheManager.fullRevalidation(normalizedPath);

		const processingTime = Date.now() - startTime;
		console.log(`✅ Revalidation completed in ${processingTime}ms`);

		return {
			...revalidationResult,
			processingTimeMs: processingTime,
		};
	} catch (error) {
		const processingTime = Date.now() - startTime;
		console.error("❌ Revalidation error:", error);

		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
			processingTimeMs: processingTime,
		};
	}
}
