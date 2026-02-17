"use server";

import { validateAdminAccessFromServerContext } from "@/features/auth/admin-validation";
import { invalidateSlidingBannerCache } from "./cache";
import { getPublicSlidingBannerSettingsCached } from "./queries";
import { SlidingBannerStore } from "./sliding-banner-store";
import type {
	SlidingBannerPublicSettings,
	SlidingBannerSettings,
	SlidingBannerStoreStatus,
} from "./types";

interface SlidingBannerAdminResponse {
	success: boolean;
	settings?: SlidingBannerSettings;
	store?: SlidingBannerStoreStatus;
	error?: string;
}

interface SlidingBannerPublicResponse {
	success: boolean;
	settings: SlidingBannerPublicSettings;
	error?: string;
}

const normalizeMessagesInput = (messages: string[]): string[] => {
	return messages
		.map((message) => message.replace(/\s+/g, " ").trim())
		.filter((message) => message.length > 0);
};

export async function getPublicSlidingBannerSettings(): Promise<SlidingBannerPublicResponse> {
	try {
		const settings = await getPublicSlidingBannerSettingsCached();
		return {
			success: true,
			settings,
		};
	} catch (error) {
		return {
			success: false,
			settings: SlidingBannerStore.getDefaultPublicSettings(),
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

export async function getAdminSlidingBannerSettings(
	keyOrToken?: string,
): Promise<SlidingBannerAdminResponse> {
	if (!(await validateAdminAccessFromServerContext(keyOrToken ?? null))) {
		return { success: false, error: "Unauthorized access" };
	}

	try {
		const [settings, store] = await Promise.all([
			SlidingBannerStore.getSettings(),
			SlidingBannerStore.getStatus(),
		]);
		return {
			success: true,
			settings,
			store,
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

export async function updateAdminSlidingBannerSettings(
	keyOrToken: string | undefined,
	updates: Partial<
		Pick<
			SlidingBannerSettings,
			"enabled" | "messages" | "messageDurationMs" | "desktopMessageCount"
		>
	>,
): Promise<SlidingBannerAdminResponse & { message?: string }> {
	if (!(await validateAdminAccessFromServerContext(keyOrToken ?? null))) {
		return {
			success: false,
			error: "Unauthorized access",
		};
	}

	try {
		const current = await SlidingBannerStore.getSettings();
		const effectiveEnabled =
			typeof updates.enabled === "boolean" ? updates.enabled : current.enabled;
		const effectiveMessages = Array.isArray(updates.messages)
			? updates.messages
			: current.messages;
		const normalizedMessages = normalizeMessagesInput(effectiveMessages);

		if (effectiveEnabled && normalizedMessages.length === 0) {
			return {
				success: false,
				error: "Banner needs at least one message when enabled",
			};
		}

		const settings = await SlidingBannerStore.updateSettings(
			updates,
			"admin-panel",
		);
		invalidateSlidingBannerCache();
		const store = await SlidingBannerStore.getStatus();
		return {
			success: true,
			settings,
			store,
			message: `Saved ${settings.messages.length} banner message${settings.messages.length === 1 ? "" : "s"}`,
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}
