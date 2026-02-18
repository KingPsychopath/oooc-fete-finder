import "server-only";

import { getKVStore, getKVStoreInfo } from "@/lib/platform/kv/kv-store-factory";
import type {
	EventSubmissionPublicSettings,
	EventSubmissionSettings,
	EventSubmissionSettingsStatus,
} from "./types";

const EVENT_SUBMISSION_SETTINGS_KEY = "events:submissions:settings:v1";

const DEFAULT_SETTINGS: EventSubmissionSettings = {
	version: 1,
	enabled: true,
	updatedAt: new Date(0).toISOString(),
	updatedBy: "system-default",
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

const normalizeSettings = (
	candidate: Partial<EventSubmissionSettings> | null | undefined,
): EventSubmissionSettings => {
	return {
		version: 1,
		enabled:
			typeof candidate?.enabled === "boolean"
				? candidate.enabled
				: DEFAULT_SETTINGS.enabled,
		updatedAt: normalizeTimestamp(candidate?.updatedAt, DEFAULT_SETTINGS.updatedAt),
		updatedBy: normalizeActor(candidate?.updatedBy, DEFAULT_SETTINGS.updatedBy),
	};
};

const parseStoredSettings = (raw: string | null): EventSubmissionSettings => {
	if (!raw) {
		return DEFAULT_SETTINGS;
	}

	try {
		const parsed = JSON.parse(raw) as Partial<EventSubmissionSettings>;
		return normalizeSettings(parsed);
	} catch {
		return DEFAULT_SETTINGS;
	}
};

const toPublicSettings = (
	settings: EventSubmissionSettings,
): EventSubmissionPublicSettings => ({
	enabled: settings.enabled,
	updatedAt: settings.updatedAt,
});

export class EventSubmissionSettingsStore {
	private static async readSettings(): Promise<EventSubmissionSettings> {
		const kv = await getKVStore();
		const raw = await kv.get(EVENT_SUBMISSION_SETTINGS_KEY);
		return parseStoredSettings(raw);
	}

	private static async writeSettings(settings: EventSubmissionSettings): Promise<void> {
		const kv = await getKVStore();
		await kv.set(EVENT_SUBMISSION_SETTINGS_KEY, JSON.stringify(settings));
	}

	static async getSettings(): Promise<EventSubmissionSettings> {
		return this.readSettings();
	}

	static async getPublicSettings(): Promise<EventSubmissionPublicSettings> {
		const settings = await this.readSettings();
		return toPublicSettings(settings);
	}

	static async updateEnabled(
		enabled: boolean,
		updatedBy: string,
	): Promise<EventSubmissionSettings> {
		const current = await this.readSettings();
		const next: EventSubmissionSettings = {
			...current,
			enabled,
			updatedAt: new Date().toISOString(),
			updatedBy: updatedBy.trim() || "admin-panel",
		};
		await this.writeSettings(next);
		return next;
	}

	static async getStatus(): Promise<EventSubmissionSettingsStatus> {
		const [provider, settings] = await Promise.all([
			getKVStoreInfo(),
			this.readSettings(),
		]);
		return {
			provider: provider.provider,
			location: provider.location,
			key: EVENT_SUBMISSION_SETTINGS_KEY,
			updatedAt: settings.updatedAt,
			updatedBy: settings.updatedBy,
		};
	}
}
