import "server-only";

import archiveSiteSettingsData from "@/data/archive-site-settings.json";
import archiveLocationsData from "@/data/event-locations.json";
import type { EventLocation } from "@/features/events/types";

type ArchiveKVRecord = {
	updatedAt?: string | null;
	value?: unknown;
};

type ArchiveSiteSettingsData = {
	version?: number;
	exportedAt?: string | null;
	values?: Record<string, ArchiveKVRecord>;
};

type ArchiveLocationPayload = {
	version?: string;
	lastUpdated?: string;
	exportedAt?: string;
	sourceUpdatedAt?: string;
	locations?: Record<string, EventLocation>;
};

export const ARCHIVE_KV_KEYS = {
	slidingBanner: "ui:sliding-banner:v1",
	searchChips: "ui:search-chips:v1",
	eventSubmissions: "events:submissions:settings:v1",
} as const;

const archiveSiteSettings = archiveSiteSettingsData as ArchiveSiteSettingsData;

export const getArchiveKVValue = <TValue>(key: string): TValue | null => {
	const record = archiveSiteSettings.values?.[key];
	if (!record || record.value == null) return null;
	return record.value as TValue;
};

export const getArchiveLocationPayload = (): {
	version: string;
	lastUpdated: string;
	locations: Record<string, EventLocation>;
} => {
	const payload = archiveLocationsData as ArchiveLocationPayload;
	return {
		version: typeof payload.version === "string" ? payload.version : "1.0.0",
		lastUpdated:
			typeof payload.lastUpdated === "string"
				? payload.lastUpdated
				: new Date(0).toISOString(),
		locations:
			payload.locations && typeof payload.locations === "object"
				? payload.locations
				: {},
	};
};
