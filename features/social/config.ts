import type { CommunityInviteConfig } from "./types";

export const COMMUNITY_INVITE_CONFIG: CommunityInviteConfig = {
	WHATSAPP_URL: "https://chat.whatsapp.com/DcwqLpx0oHl093E3uApKQj",
	COOKIE_NAME: "oooc_community_invite",
	DELAYS: {
		AFTER_CHAT_CLICK: 4 * 24 * 60 * 60 * 1000, // 4 days
		AFTER_DISMISS: 2 * 24 * 60 * 60 * 1000, // 2 days
		INITIAL_DELAY: 1000, // 1 second
	},
	SCROLL: {
		HIDE_THRESHOLD_PERCENTAGE: 20,
	},
	UI: {
		ANIMATION_DURATION: 300,
		Z_INDEX: 50,
		EDGE_OFFSET: "20px",
	},
	CONTENT: {
		TITLE: "Join the collective",
		DESCRIPTION:
			"Get real-time Paris updates and share your finds with the OOOC community.",
		CTA_TEXT: "Open WhatsApp Group",
	},
} as const;
