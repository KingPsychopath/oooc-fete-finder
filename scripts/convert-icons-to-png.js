#!/usr/bin/env node

/**
 * Convert SVG icons to PNG format for PWA
 * Uses Sharp for high-quality image conversion
 */

const sharp = require("sharp");
const fs = require("fs").promises;
const path = require("path");

const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const FAVICON_SIZES = [16, 32, 48];

async function convertIconsToPNG() {
	try {
		console.log("🖼️  Converting favicon.svg to all PNG sizes...");

		const iconsDir = path.join(__dirname, "..", "public", "icons");
		const faviconSvgPath = path.join(__dirname, "..", "public", "favicon.svg");

		// Ensure directory exists
		await fs.mkdir(iconsDir, { recursive: true });

		// Check if main favicon.svg exists
		try {
			await fs.access(faviconSvgPath);
			console.log("✅ Found favicon.svg as source");
		} catch {
			throw new Error("favicon.svg not found in public directory");
		}

		// Convert PWA icons from main favicon.svg
		for (const size of ICON_SIZES) {
			const pngPath = path.join(iconsDir, `icon-${size}x${size}.png`);

			try {
				await sharp(faviconSvgPath)
					.resize(size, size, {
						fit: "contain",
						background: { r: 0, g: 0, b: 0, alpha: 0 },
					})
					.png({
						quality: 100,
						compressionLevel: 6,
					})
					.toFile(pngPath);

				console.log(`✅ Generated icon-${size}x${size}.png from favicon.svg`);
			} catch (error) {
				console.warn(
					`⚠️  Could not generate ${size}x${size} icon:`,
					error.message,
				);
			}
		}

		// Convert main favicon
		const faviconPngPath = path.join(__dirname, "..", "public", "favicon.png");

		try {
			await sharp(faviconSvgPath)
				.resize(32, 32, {
					fit: "contain",
					background: { r: 0, g: 0, b: 0, alpha: 0 },
				})
				.png({ quality: 100 })
				.toFile(faviconPngPath);
			console.log("✅ Generated favicon.png from favicon.svg");
		} catch (error) {
			console.warn("⚠️  Could not generate favicon.png:", error.message);
		}

		// Convert additional favicon sizes from main favicon.svg
		for (const size of FAVICON_SIZES) {
			const pngPath = path.join(
				__dirname,
				"..",
				"public",
				`favicon-${size}x${size}.png`,
			);

			try {
				await sharp(faviconSvgPath)
					.resize(size, size, {
						fit: "contain",
						background: { r: 0, g: 0, b: 0, alpha: 0 },
					})
					.png({ quality: 100 })
					.toFile(pngPath);
				console.log(
					`✅ Generated favicon-${size}x${size}.png from favicon.svg`,
				);
			} catch (error) {
				console.warn(
					`⚠️  Could not generate favicon-${size}x${size}.png:`,
					error.message,
				);
			}
		}

		// Generate 32x32 icon for manifest
		const icon32Path = path.join(iconsDir, "icon-32x32.png");
		try {
			await sharp(faviconSvgPath)
				.resize(32, 32, {
					fit: "contain",
					background: { r: 0, g: 0, b: 0, alpha: 0 },
				})
				.png({ quality: 100 })
				.toFile(icon32Path);
			console.log("✅ Generated icon-32x32.png for manifest");
		} catch (error) {
			console.warn("⚠️  Could not generate icon-32x32.png:", error.message);
		}

		console.log("🎉 PNG icon conversion complete!");
	} catch (error) {
		console.error("❌ Error converting icons:", error);
		process.exit(1);
	}
}

// Run the script
if (require.main === module) {
	convertIconsToPNG();
}

module.exports = { convertIconsToPNG };
