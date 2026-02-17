import path from "path";
import { validateAdminKeyForApiRoute } from "@/features/auth/admin-validation";
import { log } from "@/lib/platform/logger";
import { mkdir, writeFile } from "fs/promises";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
	try {
		// Check for admin authentication
		const adminKey = request.headers.get("x-admin-key");

		if (!(await validateAdminKeyForApiRoute(request, adminKey))) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const data = await request.formData();
		const file: File | null = data.get("image") as unknown as File;
		const imageType: string = data.get("type") as string;

		if (!file) {
			return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
		}

		// Validate file type
		const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
		if (!allowedTypes.includes(file.type)) {
			return NextResponse.json(
				{
					error: "Invalid file type. Only PNG, JPEG, and WebP are allowed.",
				},
				{ status: 400 },
			);
		}

		// Validate file size (max 5MB)
		const maxSize = 5 * 1024 * 1024; // 5MB
		if (file.size > maxSize) {
			return NextResponse.json(
				{
					error: "File too large. Maximum size is 5MB.",
				},
				{ status: 400 },
			);
		}

		const bytes = await file.arrayBuffer();
		const buffer = Buffer.from(bytes);

		// Create uploads directory if it doesn't exist
		const uploadsDir = path.join(process.cwd(), "public", "og-images");
		try {
			await mkdir(uploadsDir, { recursive: true });
		} catch {
			// Directory might already exist, ignore error
		}

		// Generate unique filename
		const timestamp = Date.now();
		const extension = file.name.split(".").pop();
		const filename = `${imageType || "custom"}-${timestamp}.${extension}`;
		const filepath = path.join(uploadsDir, filename);

		// Write file
		await writeFile(filepath, buffer);

		// Return public URL
		const publicUrl = `/og-images/${filename}`;

		return NextResponse.json({
			success: true,
			url: publicUrl,
			filename,
			type: file.type,
			size: file.size,
		});
	} catch (error) {
		log.error("og-upload", "Upload error", undefined, error);
		return NextResponse.json(
			{
				error: "Failed to upload file",
			},
			{ status: 500 },
		);
	}
}

export async function GET(request: NextRequest) {
	try {
		// List uploaded images
		const { searchParams } = new URL(request.url);
		const adminKey = searchParams.get("adminKey");

		if (!(await validateAdminKeyForApiRoute(request, adminKey))) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Simple response for now - in production you'd scan the directory
		return NextResponse.json({
			images: [],
			message: "Image listing not implemented yet",
		});
	} catch (error) {
		log.error("og-upload", "List images error", undefined, error);
		return NextResponse.json(
			{
				error: "Failed to list images",
			},
			{ status: 500 },
		);
	}
}
