"use client";

import type { Event } from "@/types/events";
import {
	MUSIC_GENRES,
	NATIONALITIES,
	VENUE_TYPES,
	formatAge,
	formatDayWithDate,
	formatPrice,
	formatVenueTypeIcons,
} from "@/types/events";

type ShareableImageGeneratorProps = {
	event: Event;
	onError: (message: string) => void;
};

const generateShareableImage = async (event: Event): Promise<void> => {
	// Create a subtle camera flash effect
	const flashOverlay = document.createElement("div");
	flashOverlay.style.position = "fixed";
	flashOverlay.style.top = "0";
	flashOverlay.style.left = "0";
	flashOverlay.style.width = "100vw";
	flashOverlay.style.height = "100vh";
	flashOverlay.style.backgroundColor = "#ffffff";
	flashOverlay.style.zIndex = "99999";
	flashOverlay.style.opacity = "0";
	flashOverlay.style.pointerEvents = "none";
	flashOverlay.style.transition = "opacity 0.3s ease-in-out";

	// Add flash to body and trigger animation
	document.body.appendChild(flashOverlay);

	// Brief flash animation
	setTimeout(() => {
		flashOverlay.style.opacity = "0.3";
	}, 50);

	setTimeout(() => {
		flashOverlay.style.opacity = "0";
	}, 400);

	// Remove flash overlay after animation
	setTimeout(() => {
		if (document.body.contains(flashOverlay)) {
			document.body.removeChild(flashOverlay);
		}
	}, 800);

	// Create a modal overlay to temporarily show the content
	const overlay = document.createElement("div");
	overlay.style.position = "fixed";
	overlay.style.top = "0";
	overlay.style.left = "0";
	overlay.style.width = "100vw";
	overlay.style.height = "100vh";
	overlay.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
	overlay.style.zIndex = "10000";
	overlay.style.display = "flex";
	overlay.style.alignItems = "center";
	overlay.style.justifyContent = "center";

	// Create a temporary div for the shareable content
	const shareContainer = document.createElement("div");
	shareContainer.style.width = "400px";
	shareContainer.style.height = "700px";
	shareContainer.style.background =
		"linear-gradient(145deg, #f3e8d8 0%, #ead9c1 45%, #ddc6a5 100%)";
	shareContainer.style.borderRadius = "24px";
	shareContainer.style.padding = "24px";
	shareContainer.style.fontFamily =
		'"Degular", "Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
	shareContainer.style.color = "#2f2418";
	shareContainer.style.boxSizing = "border-box";
	shareContainer.style.display = "flex";
	shareContainer.style.flexDirection = "column";
	shareContainer.style.justifyContent = "space-between";
	shareContainer.style.position = "relative";

	// Create the HTML content for the shareable image
	shareContainer.innerHTML = `
		<div style="flex: 1; display: flex; flex-direction: column;">
			<!-- Header with badges -->
			<div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px;">
				<div style="display: flex; flex-direction: column; gap: 8px;">
					${event.isOOOCPick ? '<div style="background: #f0be39; color: #2f2418; padding: 10px 16px; border-radius: 16px; font-size: 11px; font-weight: 700; display: inline-block; text-align: center; letter-spacing: 0.5px; white-space: nowrap;">OOOC PICK</div>' : ""}
				</div>
				<div style="background: rgba(60,43,27,0.08); color: #2f2418; padding: 6px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">
					${event.arrondissement === "unknown" ? "TBC" : `${event.arrondissement}e`}
				</div>
			</div>
			
			<!-- Event Title -->
			<h1 style="font-size: 30px; font-weight: 400; margin: 0 0 20px 0; line-height: 1.08; color: #2f2418; word-wrap: break-word; letter-spacing: -0.3px; font-family: 'Swear Display', 'Times New Roman', serif;">${event.name}</h1>
			
			<!-- Main Details Card -->
			<div style="background: rgba(255,255,255,0.42); border: 1px solid rgba(60,43,27,0.14); border-radius: 16px; padding: 20px; margin-bottom: 16px; backdrop-filter: blur(6px);">
				<div style="display: flex; align-items: center; margin-bottom: 12px;">
					<div style="margin-right: 10px; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: #6a543c; min-width: 56px;">Date</div>
					<span style="font-size: 14px; color: #2f2418; font-weight: 500;">${formatDayWithDate(event.day, event.date)}</span>
				</div>
				
				${
					event.time && event.time !== "TBC"
						? `
					<div style="display: flex; align-items: center; margin-bottom: 12px;">
						<div style="margin-right: 10px; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: #6a543c; min-width: 56px;">Time</div>
						<span style="font-size: 14px; font-family: 'JetBrains Mono', 'SF Mono', Monaco, monospace; color: #2f2418; font-weight: 500;">${event.time}${event.endTime && event.endTime !== "TBC" ? ` - ${event.endTime}` : ""}</span>
					</div>
				`
						: ""
				}
				
				${
					event.location && event.location !== "TBA"
						? `
					<div style="display: flex; align-items: center; margin-bottom: 12px;">
						<div style="margin-right: 10px; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: #6a543c; min-width: 56px;">Place</div>
						<span style="font-size: 13px; color: #3b2d1e; word-wrap: break-word; line-height: 1.3; font-weight: 400;">${event.location}</span>
					</div>
				`
						: ""
				}
				
				<div style="display: flex; align-items: center; margin-bottom: 12px;">
					<div style="margin-right: 10px; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: #6a543c; min-width: 56px;">Price</div>
					<span style="font-size: 16px; font-weight: 700; color: ${formatPrice(event.price) === "Free" ? "#0f7a4b" : "#2f2418"};">${formatPrice(event.price)}</span>
				</div>

				${
					event.age
						? `
					<div style="display: flex; align-items: center;">
						<div style="margin-right: 10px; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: #6a543c; min-width: 56px;">Age</div>
						<span style="font-size: 14px; color: #2f2418; font-weight: 500;">${formatAge(event.age)}</span>
					</div>
				`
						: ""
				}
			</div>
			
			<!-- Event Type -->
			<div style="margin-bottom: 16px;">
				<div style="background: rgba(60,43,27,0.1); color: #2f2418; padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; display: inline-block;">
					${event.type}
				</div>
			</div>

			<!-- Genre Tags -->
			${
				event.genre && event.genre.length > 0
					? `
				<div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px;">
					${event.genre
						.map(
							(genre) => `
						<div style="background: rgba(60,43,27,0.1); color: #2f2418; padding: 6px 12px; border-radius: 16px; font-size: 11px; white-space: nowrap; display: flex; align-items: center; gap: 4px; font-weight: 500;">
							${MUSIC_GENRES.find((g) => g.key === genre)?.label || genre}
						</div>
					`,
						)
						.join("")}
				</div>
			`
					: ""
			}

			<!-- Nationality Tags -->
			${
				event.nationality && event.nationality.length > 0
					? `
				<div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px;">
					${event.nationality
						.slice(0, 3)
						.map(
							(nationality) => `
						<div style="background: rgba(60,43,27,0.1); color: #2f2418; padding: 6px 12px; border-radius: 16px; font-size: 11px; white-space: nowrap; font-weight: 500;">
							${NATIONALITIES.find((n) => n.key === nationality)?.flag} ${NATIONALITIES.find((n) => n.key === nationality)?.shortCode || nationality}
						</div>
					`,
						)
						.join("")}
				</div>
			`
					: ""
			}

			<!-- Environment Badge -->
			${
				event.venueTypes && event.venueTypes.length > 0
					? `
				<div style="margin-bottom: 16px;">
					<div style="background: rgba(60,43,27,0.1); color: #2f2418; padding: 6px 12px; border-radius: 16px; font-size: 11px; display: inline-block; white-space: nowrap; font-weight: 500;">
						${formatVenueTypeIcons(event)} ${event.venueTypes
							.map((vt) => VENUE_TYPES.find((v) => v.key === vt)?.label)
							.filter(Boolean)
							.join(" & ")}
					</div>
				</div>
			`
					: event.indoor !== undefined
						? `
				<div style="margin-bottom: 16px;">
					<div style="background: rgba(60,43,27,0.1); color: #2f2418; padding: 6px 12px; border-radius: 16px; font-size: 11px; display: inline-block; white-space: nowrap; font-weight: 500;">
						${event.indoor ? "Indoor" : "Outdoor"}
					</div>
				</div>
			`
						: ""
			}
		</div>
		
		<!-- Footer Branding -->
		<div style="text-align: center; padding-top: 20px; border-top: 1px solid rgba(60,43,27,0.22); margin-top: auto;">
			<div style="font-size: 16px; font-weight: 700; margin-bottom: 4px; color: #2f2418; letter-spacing: 0.5px;">OOOC Fête Finder</div>
			<div style="font-size: 12px; opacity: 0.9; color: #3b2d1e; font-weight: 400;">Curated Paris events, updated live</div>
		</div>
	`;

	// Add container to overlay and overlay to body
	overlay.appendChild(shareContainer);
	document.body.appendChild(overlay);

	try {
		// Wait a moment for styles to be applied and rendered
		await new Promise((resolve) => setTimeout(resolve, 200));

		// Dynamic import of modern-screenshot
		const { domToCanvas } = await import("modern-screenshot");

		const canvas = await domToCanvas(shareContainer, {
			scale: 2, // Higher resolution for crisp images
			quality: 1, // Maximum quality
			width: 400,
			height: 700,
		});

		// Verify canvas has content by checking if it's not just white
		const context = canvas.getContext("2d");
		const imageData = context?.getImageData(
			0,
			0,
			Math.min(100, canvas.width),
			Math.min(100, canvas.height),
		);
		const hasContent = imageData?.data.some((channel, index) => {
			// Check if any pixel has non-white color in the first 100x100 area
			return index % 4 !== 3 && channel !== 255;
		});

		if (!hasContent) {
			throw new Error(
				"Generated image appears to be blank - content may not be rendering",
			);
		}

		// Create download link as fallback
		const link = document.createElement("a");
		link.download = `${event.name.replace(/[^a-z0-9]/gi, "_").toLowerCase()}-event.png`;
		link.href = canvas.toDataURL("image/png", 1.0);

		// Check if we can use the Web Share API (primarily mobile)
		if (navigator.share) {
			// Convert canvas to blob for sharing
			canvas.toBlob(
				async (blob: Blob | null) => {
					if (blob) {
						const file = new File([blob], `${event.name}-event.png`, {
							type: "image/png",
						});
						try {
							await navigator.share({
								title: `${event.name} - OOOC Fête Finder`,
								text: `Check out this event: ${event.name}`,
								files: [file],
							});
						} catch {
							// If native sharing fails, download the image
							link.click();
						}
					} else {
						// If blob creation fails, download the image
						link.click();
					}
				},
				"image/png",
				1.0,
			);
		} else {
			// Desktop browsers - download the image
			link.click();
		}
	} catch (error) {
		console.error("Error generating shareable image:", error);
		throw error;
	} finally {
		// Remove the overlay after a short delay to prevent flashing
		setTimeout(() => {
			if (document.body.contains(overlay)) {
				document.body.removeChild(overlay);
			}
		}, 100);
	}
};

export const ShareableImageGenerator = ({
	event,
	onError,
}: ShareableImageGeneratorProps) => {
	const handleGenerateImage = async () => {
		try {
			await generateShareableImage(event);
		} catch (error) {
			onError(
				error instanceof Error ? error.message : "Unknown error occurred",
			);
		}
	};

	return { generateImage: handleGenerateImage };
};

export default ShareableImageGenerator;
