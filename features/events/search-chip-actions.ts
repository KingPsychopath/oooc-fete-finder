"use server";

import { recordAdminActivity } from "@/features/admin/activity/record";
import { validateAdminAccessFromServerContext } from "@/features/auth/admin-validation";
import { invalidateSearchChipSettingsCache } from "./search-chip-cache";
import {
	type SearchChipSettings,
	SearchChipSettingsStore,
	type SearchChipStoreStatus,
} from "./search-chip-settings-store";

interface SearchChipAdminResponse {
	success: boolean;
	settings?: SearchChipSettings;
	store?: SearchChipStoreStatus;
	error?: string;
	message?: string;
}

export async function getAdminSearchChipSettings(
	keyOrToken?: string,
): Promise<SearchChipAdminResponse> {
	if (!(await validateAdminAccessFromServerContext(keyOrToken ?? null))) {
		return { success: false, error: "Unauthorized access" };
	}
	try {
		const [settings, store] = await Promise.all([
			SearchChipSettingsStore.getSettings(),
			SearchChipSettingsStore.getStatus(),
		]);
		return { success: true, settings, store };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

export async function updateAdminSearchChipSettings(
	keyOrToken: string | undefined,
	updates: Partial<
		Pick<SearchChipSettings, "dynamicChipsEnabled" | "maxDynamicChips">
	>,
): Promise<SearchChipAdminResponse> {
	if (!(await validateAdminAccessFromServerContext(keyOrToken ?? null))) {
		return { success: false, error: "Unauthorized access" };
	}
	try {
		const settings = await SearchChipSettingsStore.updateSettings(
			updates,
			"admin-panel",
		);
		invalidateSearchChipSettingsCache();
		const store = await SearchChipSettingsStore.getStatus();
		await recordAdminActivity({
			action: "settings.search_chips.updated",
			category: "settings",
			targetType: "search_chips",
			targetLabel: "Search chips",
			summary: `Dynamic search chips ${settings.dynamicChipsEnabled ? "enabled" : "disabled"}`,
			metadata: {
				dynamicChipsEnabled: settings.dynamicChipsEnabled,
				maxDynamicChips: settings.maxDynamicChips,
			},
			href: "/admin/content#search-chips",
		});
		return {
			success: true,
			settings,
			store,
			message: settings.dynamicChipsEnabled
				? "Dynamic search chips enabled"
				: "Dynamic search chips disabled",
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}
