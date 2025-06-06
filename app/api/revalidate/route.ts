import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export async function POST(request: NextRequest) {
	try {
		console.log("🔄 Revalidate API called");

		const body = await request.json();
		const { adminKey, path = "/" } = body;

		console.log("📋 Revalidate request:", {
			adminKey: adminKey ? "***" : "missing",
			path,
		});

		// Verify admin access
		const expectedKey = process.env.ADMIN_KEY || "your-secret-key-123";
		console.log("🔑 Expected admin key:", expectedKey ? "***" : "not set");

		if (adminKey !== expectedKey) {
			console.error("❌ Admin key mismatch");
			return NextResponse.json(
				{ success: false, message: "Unauthorized access" },
				{ status: 401 },
			);
		}

		console.log("✅ Admin key verified, attempting revalidation...");

		// Revalidate the specified path (default to homepage)
		revalidatePath(path, "page");

		console.log(`🔄 On-demand revalidation triggered for path: ${path}`);

		return NextResponse.json({
			success: true,
			message: `Page revalidated successfully for path: ${path}`,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error("❌ Revalidation error:", error);
		return NextResponse.json(
			{
				success: false,
				message: "Failed to revalidate",
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}

// Also support GET requests for easier testing
export async function GET(request: NextRequest) {
	const searchParams = request.nextUrl.searchParams;
	const adminKey = searchParams.get("adminKey");
	const path = searchParams.get("path") || "/";

	// Verify admin access
	const expectedKey = process.env.ADMIN_KEY || "your-secret-key-123";
	if (adminKey !== expectedKey) {
		return NextResponse.json(
			{ success: false, message: "Unauthorized access" },
			{ status: 401 },
		);
	}

	try {
		// Revalidate the specified path
		revalidatePath(path, "page");

		console.log(`🔄 On-demand revalidation triggered for path: ${path}`);

		return NextResponse.json({
			success: true,
			message: `Page revalidated successfully for path: ${path}`,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error("❌ Revalidation error:", error);
		return NextResponse.json(
			{
				success: false,
				message: "Failed to revalidate",
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
