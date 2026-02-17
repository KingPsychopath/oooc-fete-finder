export interface SlidingBannerSettings {
	version: 1;
	enabled: boolean;
	messages: string[];
	messageDurationMs: number;
	desktopMessageCount: 1 | 2;
	updatedAt: string;
	updatedBy: string;
}

export interface SlidingBannerPublicSettings {
	enabled: boolean;
	messages: string[];
	messageDurationMs: number;
	desktopMessageCount: 1 | 2;
	updatedAt: string;
}

export interface SlidingBannerStoreStatus {
	provider: "file" | "memory" | "postgres";
	location: string;
	key: string;
	updatedAt: string;
	updatedBy: string;
}
