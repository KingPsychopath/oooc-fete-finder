export type CommunityInviteProps = {
	whatsappUrl?: string;
	delayAfterChatClick?: number;
	delayAfterDismiss?: number;
	scrollHideThreshold?: number;
	className?: string;
};

export type UseCommunityInviteStorageOptions = {
	delayAfterChatClick?: number;
	delayAfterDismiss?: number;
	initialDelay?: number;
};

export type CommunityInviteStorageReturn = {
	shouldShow: boolean;
	markChatClicked: () => void;
	markDismissed: () => void;
	clearStorage: () => void;
	checkShouldShow: () => boolean;
};

export type CommunityInviteConfig = {
	readonly WHATSAPP_URL: string;
	readonly COOKIE_NAME: string;
	readonly DELAYS: {
		readonly AFTER_CHAT_CLICK: number;
		readonly AFTER_DISMISS: number;
		readonly INITIAL_DELAY: number;
	};
	readonly SCROLL: {
		readonly HIDE_THRESHOLD_PERCENTAGE: number;
	};
	readonly UI: {
		readonly ANIMATION_DURATION: number;
		readonly Z_INDEX: number;
		readonly EDGE_OFFSET: string;
	};
	readonly CONTENT: {
		readonly TITLE: string;
		readonly DESCRIPTION: string;
		readonly CTA_TEXT: string;
	};
};
