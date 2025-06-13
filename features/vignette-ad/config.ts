import type { VignetteAdConfig } from "./types";

// Vignette Ad Configuration
export const VIGNETTE_AD_CONFIG: VignetteAdConfig = {
	// WhatsApp chat URL
	WHATSAPP_URL: "https://chat.whatsapp.com/DcwqLpx0oHl093E3uApKQj",

	// Delay configurations (in milliseconds)
	DELAYS: {
		// How long to wait after user clicks the chat link before showing again
		AFTER_CHAT_CLICK: 4 * 24 * 60 * 60 * 1000, // 4 days

		// How long to wait after user dismisses the ad before showing again
		AFTER_DISMISS: 2 * 24 * 60 * 60 * 1000, // 2 days

		// Initial delay before showing the ad on page load
		INITIAL_DELAY: 1000, // 1 second
	},

	// Scroll behavior configuration
	SCROLL: {
		// Hide the ad after scrolling past this percentage of the page
		HIDE_THRESHOLD_PERCENTAGE: 20, // Hide after scrolling 20% down
	},

	// UI Configuration
	UI: {
		// Animation duration
		ANIMATION_DURATION: 300, // milliseconds

		// Z-index for the vignette ad
		Z_INDEX: 50,

		// Position offset from edges
		EDGE_OFFSET: "20px",
	},

	// Content Configuration
	CONTENT: {
		TITLE: "Join Our Community",
		DESCRIPTION:
			"Connect with music lovers and get real-time Paris event updates.",
		CTA_TEXT: "Join WhatsApp Chat",
	},
} as const;
