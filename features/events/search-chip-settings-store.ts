import "server-only";

import { getKVStore, getKVStoreInfo } from "@/lib/platform/kv/kv-store-factory";

const SEARCH_CHIP_SETTINGS_KEY = "ui:search-chips:v1";
const SEARCH_CHIP_HISTORY_KEY = "ui:search-chips:history:v1";
const HISTORY_RETENTION_BUCKETS = 6;
const REFRESH_BUCKET_MS = 12 * 60 * 60 * 1000;

export interface SearchChipSettings {
	version: 1;
	dynamicChipsEnabled: boolean;
	maxDynamicChips: number;
	updatedAt: string;
	updatedBy: string;
}

export interface SearchChipPublicSettings {
	dynamicChipsEnabled: boolean;
	maxDynamicChips: number;
	updatedAt: string;
}

export interface SearchChipStoreStatus {
	provider: "file" | "memory" | "postgres";
	location: string;
	key: string;
	updatedAt: string;
	updatedBy: string;
}

interface SearchChipHistoryBucket {
	bucket: number;
	eventQueries: string[];
	recordedAt: string;
}

interface SearchChipHistory {
	version: 1;
	buckets: SearchChipHistoryBucket[];
}

const buildDefaultSettings = (): SearchChipSettings => ({
	version: 1,
	dynamicChipsEnabled: true,
	maxDynamicChips: 4,
	updatedAt: new Date(0).toISOString(),
	updatedBy: "system-default",
});

const FALLBACK_SETTINGS = buildDefaultSettings();

const normalizeSettings = (
	candidate: Partial<SearchChipSettings> | null | undefined,
	fallback: SearchChipSettings,
): SearchChipSettings => {
	const parsedMax = Number.parseInt(
		String(candidate?.maxDynamicChips ?? ""),
		10,
	);
	return {
		version: 1,
		dynamicChipsEnabled:
			typeof candidate?.dynamicChipsEnabled === "boolean"
				? candidate.dynamicChipsEnabled
				: fallback.dynamicChipsEnabled,
		maxDynamicChips: Number.isFinite(parsedMax)
			? Math.max(0, Math.min(parsedMax, 4))
			: fallback.maxDynamicChips,
		updatedAt:
			typeof candidate?.updatedAt === "string" &&
			Number.isFinite(new Date(candidate.updatedAt).getTime())
				? new Date(candidate.updatedAt).toISOString()
				: fallback.updatedAt,
		updatedBy:
			typeof candidate?.updatedBy === "string" &&
			candidate.updatedBy.trim().length > 0
				? candidate.updatedBy.trim()
				: fallback.updatedBy,
	};
};

const parseStoredSettings = (raw: string | null): SearchChipSettings => {
	if (!raw) return buildDefaultSettings();
	try {
		const parsed = JSON.parse(raw) as Partial<SearchChipSettings>;
		return normalizeSettings(parsed, FALLBACK_SETTINGS);
	} catch {
		return buildDefaultSettings();
	}
};

const getCurrentHistoryBucket = (now: Date = new Date()): number =>
	Math.floor(now.getTime() / REFRESH_BUCKET_MS);

const parseStoredHistory = (raw: string | null): SearchChipHistory => {
	if (!raw) return { version: 1, buckets: [] };
	try {
		const parsed = JSON.parse(raw) as Partial<SearchChipHistory>;
		const buckets = Array.isArray(parsed.buckets) ? parsed.buckets : [];
		return {
			version: 1,
			buckets: buckets
				.map((bucket) => ({
					bucket: Number.parseInt(String(bucket.bucket ?? ""), 10),
					eventQueries: Array.isArray(bucket.eventQueries)
						? bucket.eventQueries
								.filter((query): query is string => typeof query === "string")
								.map((query) => query.trim())
								.filter((query) => query.length > 0)
						: [],
					recordedAt:
						typeof bucket.recordedAt === "string"
							? bucket.recordedAt
							: new Date(0).toISOString(),
				}))
				.filter((bucket) => Number.isFinite(bucket.bucket)),
		};
	} catch {
		return { version: 1, buckets: [] };
	}
};

const toPublicSettings = (
	settings: SearchChipSettings,
): SearchChipPublicSettings => ({
	dynamicChipsEnabled: settings.dynamicChipsEnabled,
	maxDynamicChips: settings.maxDynamicChips,
	updatedAt: settings.updatedAt,
});

export class SearchChipSettingsStore {
	private static async readSettings(): Promise<SearchChipSettings> {
		const kv = await getKVStore();
		const raw = await kv.get(SEARCH_CHIP_SETTINGS_KEY);
		return parseStoredSettings(raw);
	}

	private static async writeSettings(
		settings: SearchChipSettings,
	): Promise<void> {
		const kv = await getKVStore();
		await kv.set(SEARCH_CHIP_SETTINGS_KEY, JSON.stringify(settings));
	}

	static getDefaultSettings(): SearchChipSettings {
		return buildDefaultSettings();
	}

	static getDefaultPublicSettings(): SearchChipPublicSettings {
		return toPublicSettings(this.getDefaultSettings());
	}

	static async getSettings(): Promise<SearchChipSettings> {
		return this.readSettings();
	}

	static async getPublicSettings(): Promise<SearchChipPublicSettings> {
		return toPublicSettings(await this.readSettings());
	}

	static async updateSettings(
		updates: Partial<
			Pick<SearchChipSettings, "dynamicChipsEnabled" | "maxDynamicChips">
		>,
		updatedBy: string,
	): Promise<SearchChipSettings> {
		const current = await this.readSettings();
		const next = normalizeSettings(
			{
				...current,
				...updates,
				updatedAt: new Date().toISOString(),
				updatedBy,
			},
			current,
		);
		await this.writeSettings(next);
		return next;
	}

	static async getStatus(): Promise<SearchChipStoreStatus> {
		const [providerInfo, settings] = await Promise.all([
			getKVStoreInfo(),
			this.readSettings(),
		]);
		return {
			provider: providerInfo.provider,
			location: providerInfo.location,
			key: SEARCH_CHIP_SETTINGS_KEY,
			updatedAt: settings.updatedAt,
			updatedBy: settings.updatedBy,
		};
	}

	static async getSuppressedEventQueries(
		now: Date = new Date(),
	): Promise<string[]> {
		const kv = await getKVStore();
		const history = parseStoredHistory(await kv.get(SEARCH_CHIP_HISTORY_KEY));
		const currentBucket = getCurrentHistoryBucket(now);
		const previousBuckets = [currentBucket - 1, currentBucket - 2];
		const querySets = previousBuckets.map(
			(bucket) =>
				new Set(
					history.buckets.find((entry) => entry.bucket === bucket)
						?.eventQueries ?? [],
				),
		);
		if (querySets.some((set) => set.size === 0)) return [];
		return [...querySets[0]].filter((query) => querySets[1].has(query));
	}

	static async recordEventChipSelection(
		eventQueries: string[],
		now: Date = new Date(),
	): Promise<void> {
		const kv = await getKVStore();
		const history = parseStoredHistory(await kv.get(SEARCH_CHIP_HISTORY_KEY));
		const currentBucket = getCurrentHistoryBucket(now);
		const normalizedQueries = Array.from(
			new Set(
				eventQueries
					.map((query) => query.replace(/\s+/g, " ").trim())
					.filter((query) => query.length > 0),
			),
		);
		const nextBuckets = [
			...history.buckets.filter((entry) => entry.bucket !== currentBucket),
			{
				bucket: currentBucket,
				eventQueries: normalizedQueries,
				recordedAt: now.toISOString(),
			},
		]
			.sort((left, right) => right.bucket - left.bucket)
			.slice(0, HISTORY_RETENTION_BUCKETS);
		await kv.set(
			SEARCH_CHIP_HISTORY_KEY,
			JSON.stringify({ version: 1, buckets: nextBuckets }),
		);
	}
}
