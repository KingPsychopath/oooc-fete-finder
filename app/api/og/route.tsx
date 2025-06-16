import { env } from "@/lib/config/env";
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

// Rate limiting store (in production, use Redis or similar)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 50; // requests per hour per IP
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in ms

// Allowed parameters to prevent injection
const ALLOWED_THEMES = ["default", "event", "admin", "custom"] as const;
const MAX_TEXT_LENGTH = 100;

function rateLimit(ip: string): boolean {
	const now = Date.now();
	const entry = rateLimitStore.get(ip);

	if (!entry || now > entry.resetTime) {
		rateLimitStore.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
		return true;
	}

	if (entry.count >= RATE_LIMIT) {
		return false;
	}

	entry.count++;
	return true;
}

function sanitizeText(text: string): string {
	return text
		.replace(/[<>]/g, "") // Remove potential HTML
		.substring(0, MAX_TEXT_LENGTH)
		.trim();
}

export async function GET(request: NextRequest) {
	try {
		// Rate limiting
		const forwarded = request.headers.get("x-forwarded-for");
		const ip = forwarded ? forwarded.split(",")[0] : "unknown";
		if (!rateLimit(ip)) {
			return new Response("Rate limit exceeded", { status: 429 });
		}

		const { searchParams } = new URL(request.url);

		// Check for default static image first (if no specific customization requested)
		const hasCustomParams =
			searchParams.has("title") ||
			searchParams.has("subtitle") ||
			searchParams.has("theme") ||
			searchParams.has("eventCount") ||
			searchParams.has("arrondissement") ||
			searchParams.has("localImage");

		if (!hasCustomParams) {
			// Try to serve static default image if it exists
			const defaultImagePaths = [
				"/og-image.png", // Standard location
				"/og-images/default.png", // Our folder
				env.DEFAULT_OG_IMAGE, // Environment override
			].filter(Boolean);

			for (const imagePath of defaultImagePaths) {
				try {
					const imageUrl = `${env.NEXT_PUBLIC_SITE_URL}${imagePath}`;
					const imageResponse = await fetch(imageUrl, { method: "HEAD" });

					if (imageResponse.ok) {
						// Static image exists, redirect to it
						console.log(`✅ Using static default image: ${imagePath}`);
						return Response.redirect(imageUrl, 302);
					}
				} catch (error) {
					// Log the specific path that failed, but continue gracefully
					console.log(
						`📝 Default image not found at ${imagePath} - continuing to dynamic generation`,
					);
					if (
						error instanceof Error &&
						error.message.includes("Unsupported image type")
					) {
						console.log(
							`💡 Note: "Unsupported image type: unknown" means the image file doesn't exist at this path`,
						);
					}
					// Continue to next path or dynamic generation
				}
			}

			// No static default images found, proceeding with dynamic generation
			console.log(
				`🎨 No static default images found - generating dynamic OG:image`,
			);
		}

		// Extract and sanitize parameters
		const title = sanitizeText(searchParams.get("title") || "Fête Finder");
		const subtitle = sanitizeText(
			searchParams.get("subtitle") || "Interactive Paris Music Events Map",
		);
		const themeParam = searchParams.get("theme") || "default";
		const theme = ALLOWED_THEMES.includes(
			themeParam as (typeof ALLOWED_THEMES)[number],
		)
			? themeParam
			: "default";
		const eventCount = Math.min(
			parseInt(searchParams.get("eventCount") || "0") || 0,
			9999,
		);
		const arrondissement = sanitizeText(
			searchParams.get("arrondissement") || "",
		);
		const localImageParam = searchParams.get("localImage");

		// Validate and sanitize local image path
		const localImage =
			localImageParam && localImageParam.startsWith("/og-images/")
				? localImageParam
				: null;

		// Check for default override image (put your default image as public/og-images/default.png)
		const defaultImagePath = "/og-images/default.png";
		const envDefaultImage = env.DEFAULT_OG_IMAGE; // Set DEFAULT_OG_IMAGE=/og-images/your-default.png
		const useDefaultImage =
			!localImage && !searchParams.has("title") && !searchParams.has("theme");
		const finalImage =
			localImage ||
			(envDefaultImage && useDefaultImage
				? envDefaultImage
				: useDefaultImage
					? defaultImagePath
					: null);

		// Generate dynamic content based on parameters
		let mainTitle = title;
		let description = subtitle;
		let emoji = "🎵";
		let bgGradient = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";

		if (theme === "event" && arrondissement) {
			mainTitle = `Events in ${arrondissement}`;
			description = `Discover live music during Fête de la Musique 2025`;
			emoji = "📍";
			bgGradient = "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)";
		} else if (theme === "admin") {
			mainTitle = "Admin Dashboard";
			description = "Event Management & Cache Control";
			emoji = "⚙️";
			bgGradient = "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)";
		} else if (eventCount > 0) {
			description = `${eventCount} live music events across Paris`;
		}

		// Determine background style
		const backgroundStyle = finalImage
			? {
					backgroundImage: `url(${env.NEXT_PUBLIC_SITE_URL}${finalImage})`,
					backgroundSize: "cover",
					backgroundPosition: "center",
					backgroundRepeat: "no-repeat",
				}
			: {
					background: bgGradient,
				};

		// Log what we're generating
		if (finalImage) {
			console.log(`🖼️ Generating OG:image with background: ${finalImage}`);
		} else {
			console.log(`🎨 Generating dynamic OG:image with ${theme} theme`);
		}

		return new ImageResponse(
			<div
				style={{
					height: "100%",
					width: "100%",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					backgroundColor: "#ffffff",
					...backgroundStyle,
					fontFamily:
						'"Inter", "Geist", -apple-system, BlinkMacSystemFont, sans-serif',
					position: "relative",
				}}
			>
				{/* Overlay for text readability when using local images */}
				{finalImage && (
					<div
						style={{
							position: "absolute",
							top: 0,
							left: 0,
							right: 0,
							bottom: 0,
							background: "rgba(0, 0, 0, 0.4)",
						}}
					/>
				)}

				{/* Subtle pattern overlay (only for gradient backgrounds) */}
				{!finalImage && (
					<div
						style={{
							position: "absolute",
							top: 0,
							left: 0,
							right: 0,
							bottom: 0,
							backgroundImage: `radial-gradient(circle at 20% 80%, rgba(255,255,255,0.08) 1px, transparent 1px),
                                 radial-gradient(circle at 80% 20%, rgba(255,255,255,0.08) 1px, transparent 1px),
                                 radial-gradient(circle at 41% 20%, rgba(255,255,255,0.05) 1px, transparent 1px)`,
							backgroundSize: "30px 30px, 40px 40px, 50px 50px",
						}}
					/>
				)}

				{/* Main content card */}
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						justifyContent: "center",
						padding: "60px 50px",
						background: finalImage
							? "rgba(255, 255, 255, 0.9)"
							: "rgba(255, 255, 255, 0.95)",
						borderRadius: "24px",
						boxShadow: "0 20px 40px -12px rgba(0, 0, 0, 0.2)",
						backdropFilter: "blur(12px)",
						maxWidth: "800px",
						margin: "0 40px",
						textAlign: "center",
						border: "1px solid rgba(255, 255, 255, 0.2)",
						position: "relative",
						zIndex: 2,
					}}
				>
					{/* Icon/Emoji (hide when using local image to avoid clutter) */}
					{!finalImage && (
						<div
							style={{
								fontSize: "64px",
								marginBottom: "20px",
								filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.1))",
							}}
						>
							{emoji}
						</div>
					)}

					{/* Main Title */}
					<h1
						style={{
							fontSize: "56px",
							fontWeight: "700",
							margin: "0 0 12px 0",
							color: finalImage ? "#1a1a1a" : "#1a1a1a",
							lineHeight: "1.1",
							letterSpacing: "-0.02em",
						}}
					>
						{mainTitle}
					</h1>

					{/* Subtitle */}
					<p
						style={{
							fontSize: "24px",
							color: finalImage ? "#333" : "#525252",
							margin: "0 0 24px 0",
							fontWeight: "400",
							lineHeight: "1.4",
							maxWidth: "600px",
						}}
					>
						{description}
					</p>

					{/* Event count badge */}
					{eventCount > 0 && (
						<div
							style={{
								display: "flex",
								alignItems: "center",
								padding: "8px 16px",
								background: "rgba(102, 126, 234, 0.1)",
								borderRadius: "20px",
								fontSize: "16px",
								color: "#667eea",
								fontWeight: "600",
								marginBottom: "16px",
							}}
						>
							{eventCount} Events Available
						</div>
					)}

					{/* Brand footer */}
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: "8px",
							fontSize: "18px",
							color: finalImage ? "#666" : "#888",
							fontWeight: "500",
							marginTop: "8px",
						}}
					>
						<span>Out Of Office Collective</span>
						<span style={{ color: "#ccc", fontSize: "14px" }}>•</span>
						<span style={{ fontSize: "16px" }}>2025</span>
					</div>
				</div>

				{/* Bottom brand stripe */}
				<div
					style={{
						position: "absolute",
						bottom: 0,
						left: 0,
						right: 0,
						height: "4px",
						background: "rgba(255, 255, 255, 0.8)",
						zIndex: 1,
					}}
				/>
			</div>,
			{
				width: 1200,
				height: 630,
			},
		);
	} catch (error) {
		console.error("🚨 OG Image generation error:", error);

		// Provide specific guidance for common errors
		if (error instanceof Error) {
			if (error.message.includes("Unsupported image type")) {
				console.error(
					"💡 Image Error: The specified image file could not be loaded. This usually means:",
				);
				console.error(
					"   - The image file does not exist at the specified path",
				);
				console.error(
					"   - The image format is not supported (use PNG, JPEG, or WebP)",
				);
				console.error("   - The image path is incorrect or inaccessible");
				console.error("🔄 Falling back to simple text-based OG:image");
			} else if (error.message.includes("fetch")) {
				console.error("💡 Network Error: Could not fetch image from URL");
				console.error("🔄 Falling back to simple text-based OG:image");
			} else {
				console.error("💡 General Error: OG:image generation failed");
				console.error("🔄 Using fallback image");
			}
		}

		// Return a simple fallback image
		return new ImageResponse(
			<div
				style={{
					height: "100%",
					width: "100%",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					backgroundColor: "#f3f4f6",
					fontSize: "32px",
					color: "#374151",
					fontFamily: "Inter, sans-serif",
				}}
			>
				Fête Finder - OOOC
			</div>,
			{
				width: 1200,
				height: 630,
			},
		);
	}
}
