"use server";

import { recordAdminActivity } from "@/features/admin/activity/record";
import { validateAdminAccessFromServerContext } from "@/features/auth/admin-validation";
import { getLiveEvents } from "@/features/data-management/runtime-service";
import { getDiscoveryAnalyticsRepository } from "@/lib/platform/postgres/discovery-analytics-repository";
import {
	SEARCH_CHIP_SIGNALS_REVALIDATE_SECONDS,
	invalidateSearchChipSettingsCache,
} from "./search-chip-cache";
import {
	buildDynamicSearchChipDebugMatches,
	type SearchChipDebugMatch,
} from "./search-chips";
import {
	type SearchChipSettings,
	SearchChipSettingsStore,
	type SearchChipStoreStatus,
} from "./search-chip-settings-store";

const SIGNAL_WINDOW_DAYS = 7;
const SIGNAL_RECENT_WINDOW_DAYS = 2;

interface SearchChipSignalStatus {
	available: boolean;
	windowDays: number;
	recentWindowDays: number;
	cacheRevalidateSeconds: number | false;
	signalCount: number;
	lastSeenAt?: string;
	error?: string;
}

interface SearchChipAdminResponse {
	success: boolean;
	settings?: SearchChipSettings;
	store?: SearchChipStoreStatus;
	signalStatus?: SearchChipSignalStatus;
	chipDebugMatches?: SearchChipDebugMatch[];
	error?: string;
	message?: string;
}

const buildSignalWindow = (): {
	startAt: string;
	endAt: string;
	recentStartAt: string;
} => {
	const end = new Date();
	const start = new Date(end);
	start.setDate(start.getDate() - SIGNAL_WINDOW_DAYS);
	const recentStart = new Date(end);
	recentStart.setDate(recentStart.getDate() - SIGNAL_RECENT_WINDOW_DAYS);
	return {
		startAt: start.toISOString(),
		endAt: end.toISOString(),
		recentStartAt: recentStart.toISOString(),
	};
};

async function getSearchChipSignalStatus(): Promise<SearchChipSignalStatus> {
	const repository = getDiscoveryAnalyticsRepository();
	const base = {
		windowDays: SIGNAL_WINDOW_DAYS,
		recentWindowDays: SIGNAL_RECENT_WINDOW_DAYS,
		cacheRevalidateSeconds: SEARCH_CHIP_SIGNALS_REVALIDATE_SECONDS,
	};
	if (!repository) {
		return {
			...base,
			available: false,
			signalCount: 0,
			error: "Discovery analytics store unavailable",
		};
	}
	try {
		const signals = await repository.listTopSearchSignals({
			...buildSignalWindow(),
			limit: 250,
			excludeSearchSource: "popular_chip",
		});
		const lastSeenAt = signals.reduce<string | undefined>(
			(latest, signal) =>
				!latest || signal.lastSeenAt > latest ? signal.lastSeenAt : latest,
			undefined,
		);
		return {
			...base,
			available: true,
			signalCount: signals.length,
			lastSeenAt,
		};
	} catch (error) {
		return {
			...base,
			available: false,
			signalCount: 0,
			error:
				error instanceof Error
					? error.message
					: "Unable to load search signal status",
		};
	}
}

async function getSearchChipDebugMatches(
	maxDynamicChips: number,
): Promise<SearchChipDebugMatch[]> {
	const repository = getDiscoveryAnalyticsRepository();
	if (!repository) return [];
	const [signals, eventsResult] = await Promise.all([
		repository.listTopSearchSignals({
			...buildSignalWindow(),
			limit: 250,
			excludeSearchSource: "popular_chip",
		}),
		getLiveEvents({ includeEngagementProjection: false }),
	]);
	if (!eventsResult.success || eventsResult.data.length === 0) return [];
	return buildDynamicSearchChipDebugMatches(signals, eventsResult.data, {
		maxChips: maxDynamicChips,
	});
}

export async function getAdminSearchChipSettings(
	keyOrToken?: string,
): Promise<SearchChipAdminResponse> {
	if (!(await validateAdminAccessFromServerContext(keyOrToken ?? null))) {
		return { success: false, error: "Unauthorized access" };
	}
	try {
		const [settings, store, signalStatus] = await Promise.all([
			SearchChipSettingsStore.getSettings(),
			SearchChipSettingsStore.getStatus(),
			getSearchChipSignalStatus(),
		]);
		const chipDebugMatches = settings.dynamicChipsEnabled
			? await getSearchChipDebugMatches(settings.maxDynamicChips)
			: [];
		return { success: true, settings, store, signalStatus, chipDebugMatches };
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
			signalStatus: await getSearchChipSignalStatus(),
			chipDebugMatches: settings.dynamicChipsEnabled
				? await getSearchChipDebugMatches(settings.maxDynamicChips)
				: [],
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
