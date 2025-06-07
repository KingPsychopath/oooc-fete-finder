import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

// Admin key validation function for consistency
const validateAdminKey = (providedKey: string | null): boolean => {
	const expectedKey = process.env.ADMIN_KEY || "your-secret-key-123";
	return providedKey === expectedKey && providedKey.length > 0;
};

// Validate and normalize path for revalidation
const normalizePath = (path: string | null): string => {
	if (!path || typeof path !== "string") {
		return "/";
	}
	
	// Ensure path starts with /
	const normalizedPath = path.startsWith("/") ? path : `/${path}`;
	
	// Basic path validation to prevent malicious paths
	if (normalizedPath.includes("..") || !normalizedPath.match(/^\/[\w\-\/]*$/)) {
		console.warn(`⚠️ Invalid path provided, falling back to root: ${path}`);
		return "/";
	}
	
	return normalizedPath;
};

export async function POST(request: NextRequest) {
	const startTime = Date.now();
	console.log("🔄 Revalidate API called via POST");

	try {
		// Parse request body with timeout handling
		const body = await Promise.race([
			request.json(),
			new Promise((_, reject) => 
				setTimeout(() => reject(new Error("Request timeout")), 10000)
			)
		]) as { adminKey?: string; path?: string };

		const { adminKey, path = "/" } = body;
		const normalizedPath = normalizePath(path);

		console.log("📋 Revalidate request:", {
			adminKey: adminKey ? "***" : "missing",
			originalPath: path,
			normalizedPath,
			timestamp: new Date().toISOString(),
		});

		// Verify admin access with improved validation
		if (!validateAdminKey(adminKey || null)) {
			console.error("❌ Admin key validation failed:", {
				provided: adminKey ? "***" : "missing",
				expected: process.env.ADMIN_KEY ? "***" : "not set",
			});
			return NextResponse.json(
				{ 
					success: false, 
					message: "Unauthorized access - invalid admin key",
					error: "INVALID_ADMIN_KEY"
				},
				{ status: 401 },
			);
		}

		console.log("✅ Admin key verified, attempting revalidation...");

		// Revalidate with error handling
		try {
			revalidatePath(normalizedPath, "page");
			console.log(`🔄 Revalidation completed for path: ${normalizedPath}`);
		} catch (revalidationError) {
			console.error("❌ Revalidation failed:", revalidationError);
			return NextResponse.json(
				{
					success: false,
					message: "Failed to revalidate path",
					error: "REVALIDATION_FAILED",
					details: revalidationError instanceof Error ? revalidationError.message : "Unknown error",
				},
				{ status: 500 },
			);
		}

		const processingTime = Date.now() - startTime;
		console.log(`✅ Revalidation successful in ${processingTime}ms`);

		return NextResponse.json({
			success: true,
			message: `Page revalidated successfully for path: ${normalizedPath}`,
			path: normalizedPath,
			timestamp: new Date().toISOString(),
			processingTimeMs: processingTime,
		});

	} catch (error) {
		const processingTime = Date.now() - startTime;
		console.error("❌ Revalidation error:", error);
		
		return NextResponse.json(
			{
				success: false,
				message: "Failed to process revalidation request",
				error: error instanceof Error ? error.message : "Unknown error",
				timestamp: new Date().toISOString(),
				processingTimeMs: processingTime,
			},
			{ status: 500 },
		);
	}
}

// Enhanced GET endpoint for testing and debugging
export async function GET(request: NextRequest) {
	const startTime = Date.now();
	console.log("🔄 Revalidate API called via GET");

	try {
		const searchParams = request.nextUrl.searchParams;
		const adminKey = searchParams.get("adminKey");
		const path = searchParams.get("path") || "/";
		const normalizedPath = normalizePath(path);

		console.log("📋 GET Revalidate request:", {
			adminKey: adminKey ? "***" : "missing",
			originalPath: path,
			normalizedPath,
			timestamp: new Date().toISOString(),
		});

		// Verify admin access
		if (!validateAdminKey(adminKey)) {
			console.error("❌ GET Admin key validation failed");
			return NextResponse.json(
				{ 
					success: false, 
					message: "Unauthorized access - invalid admin key",
					error: "INVALID_ADMIN_KEY"
				},
				{ status: 401 },
			);
		}

		try {
			revalidatePath(normalizedPath, "page");
			console.log(`🔄 GET Revalidation completed for path: ${normalizedPath}`);
		} catch (revalidationError) {
			console.error("❌ GET Revalidation failed:", revalidationError);
			return NextResponse.json(
				{
					success: false,
					message: "Failed to revalidate path",
					error: "REVALIDATION_FAILED",
					details: revalidationError instanceof Error ? revalidationError.message : "Unknown error",
				},
				{ status: 500 },
			);
		}

		const processingTime = Date.now() - startTime;
		console.log(`✅ GET Revalidation successful in ${processingTime}ms`);

		return NextResponse.json({
			success: true,
			message: `Page revalidated successfully for path: ${normalizedPath}`,
			path: normalizedPath,
			timestamp: new Date().toISOString(),
			processingTimeMs: processingTime,
			method: "GET",
		});

	} catch (error) {
		const processingTime = Date.now() - startTime;
		console.error("❌ GET Revalidation error:", error);
		
		return NextResponse.json(
			{
				success: false,
				message: "Failed to process GET revalidation request",
				error: error instanceof Error ? error.message : "Unknown error",
				timestamp: new Date().toISOString(),
				processingTimeMs: processingTime,
			},
			{ status: 500 },
		);
	}
}
