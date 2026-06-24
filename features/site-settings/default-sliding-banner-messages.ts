export const DEFAULT_SLIDING_BANNER_MESSAGES = [
	"Curated by Out Of Office Collective",
	"2026 Fête archive is open",
	"Submit events for the next Paris season",
	"OOOC routes, exchange and updates in one place",
] as const;

export const getDefaultSlidingBannerMessages = (): string[] => [
	...DEFAULT_SLIDING_BANNER_MESSAGES,
];
