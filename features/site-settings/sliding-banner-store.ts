import "server-only";

import { getKVStore, getKVStoreInfo } from "@/lib/platform/kv/kv-store-factory";
import type {
	SlidingBannerPublicSettings,
	SlidingBannerSettings,
	SlidingBannerStoreStatus,
} from "./types";

const SLIDING_BANNER_SETTINGS_KEY = "ui:sliding-banner:v1";

const MAX_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 160;
const MIN_MESSAGE_DURATION_MS = 1800;
const MAX_MESSAGE_DURATION_MS = 12000;

const DEFAULT_MESSAGES = [
	"Curated by Out Of Office Collective",
	"Paris summer rhythm, mapped live",
	"Postgres-first event workflow",
	"Tap essentials for playlist, food and toilets",
];

const buildDefaultSettings = (): SlidingBannerSettings => ({
	version: 1,
	enabled: true,
	messages: [...DEFAULT_MESSAGES],
	messageDurationMs: 4200,
	desktopMessageCount: 2,
	updatedAt: new Date(0).toISOString(),
	updatedBy: "system-default",
});

const FALLBACK_SETTINGS = buildDefaultSettings();

const clamp = (value: number, min: number, max: number): number =>
	Math.max(min, Math.min(max, value));

const normalizeNumber = (
	value: unknown,
	fallback: number,
	min: number,
	max: number,
): number => {
	const parsed =
		typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
	if (!Number.isFinite(parsed)) return fallback;
	return clamp(Math.round(parsed), min, max);
};

const normalizeMessages = (value: unknown, fallback: string[]): string[] => {
	if (!Array.isArray(value)) {
		return [...fallback];
	}

	return value
		.filter((message): message is string => typeof message === "string")
		.map((message) => message.replace(/\s+/g, " ").trim())
		.filter((message) => message.length > 0)
		.slice(0, MAX_MESSAGES)
		.map((message) =>
			message.length > MAX_MESSAGE_LENGTH
				? message.slice(0, MAX_MESSAGE_LENGTH)
				: message,
		);
};

const normalizeTimestamp = (value: unknown, fallback: string): string => {
	if (typeof value !== "string" || value.trim().length === 0) return fallback;
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return fallback;
	return parsed.toISOString();
};

const normalizeActor = (value: unknown, fallback: string): string => {
	if (typeof value !== "string") return fallback;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : fallback;
};

const normalizeDesktopMessageCount = (
	value: unknown,
	fallback: 1 | 2,
): 1 | 2 => {
	if (value === 1 || value === "1") return 1;
	if (value === 2 || value === "2") return 2;
	return fallback;
};

const normalizeSettings = (
	candidate: Partial<SlidingBannerSettings> | null | undefined,
	fallback: SlidingBannerSettings,
): SlidingBannerSettings => ({
	version: 1,
	enabled:
		typeof candidate?.enabled === "boolean"
			? candidate.enabled
			: fallback.enabled,
	messages: normalizeMessages(candidate?.messages, fallback.messages),
	messageDurationMs: normalizeNumber(
		candidate?.messageDurationMs,
		fallback.messageDurationMs,
		MIN_MESSAGE_DURATION_MS,
		MAX_MESSAGE_DURATION_MS,
	),
	desktopMessageCount: normalizeDesktopMessageCount(
		candidate?.desktopMessageCount,
		fallback.desktopMessageCount,
	),
	updatedAt: normalizeTimestamp(candidate?.updatedAt, fallback.updatedAt),
	updatedBy: normalizeActor(candidate?.updatedBy, fallback.updatedBy),
});

const parseStoredSettings = (raw: string | null): SlidingBannerSettings => {
	if (!raw) return buildDefaultSettings();

	try {
		const parsed = JSON.parse(raw) as Partial<SlidingBannerSettings>;
		return normalizeSettings(parsed, FALLBACK_SETTINGS);
	} catch {
		return buildDefaultSettings();
	}
};

const toPublicSettings = (
	settings: SlidingBannerSettings,
): SlidingBannerPublicSettings => ({
	enabled: settings.enabled,
	messages: [...settings.messages],
	messageDurationMs: settings.messageDurationMs,
	desktopMessageCount: settings.desktopMessageCount,
	updatedAt: settings.updatedAt,
});

export class SlidingBannerStore {
	private static async readSettings(): Promise<SlidingBannerSettings> {
		const kv = await getKVStore();
		const raw = await kv.get(SLIDING_BANNER_SETTINGS_KEY);
		return parseStoredSettings(raw);
	}

	private static async writeSettings(
		settings: SlidingBannerSettings,
	): Promise<void> {
		const kv = await getKVStore();
		await kv.set(SLIDING_BANNER_SETTINGS_KEY, JSON.stringify(settings));
	}

	static getDefaultSettings(): SlidingBannerSettings {
		return buildDefaultSettings();
	}

	static getDefaultPublicSettings(): SlidingBannerPublicSettings {
		return toPublicSettings(this.getDefaultSettings());
	}

	static async getSettings(): Promise<SlidingBannerSettings> {
		return this.readSettings();
	}

	static async getPublicSettings(): Promise<SlidingBannerPublicSettings> {
		const settings = await this.readSettings();
		return toPublicSettings(settings);
	}

	static async updateSettings(
		updates: Partial<
			Pick<
				SlidingBannerSettings,
				"enabled" | "messages" | "messageDurationMs" | "desktopMessageCount"
			>
		>,
		updatedBy: string,
	): Promise<SlidingBannerSettings> {
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

	static async getStatus(): Promise<SlidingBannerStoreStatus> {
		const [providerInfo, settings] = await Promise.all([
			getKVStoreInfo(),
			this.readSettings(),
		]);
		return {
			provider: providerInfo.provider,
			location: providerInfo.location,
			key: SLIDING_BANNER_SETTINGS_KEY,
			updatedAt: settings.updatedAt,
			updatedBy: settings.updatedBy,
		};
	}

	static async resetToDefault(): Promise<void> {
		const kv = await getKVStore();
		await kv.delete(SLIDING_BANNER_SETTINGS_KEY);
	}
}
