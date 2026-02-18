import type { EventLocation } from "@/features/events/types";
import { log } from "@/lib/platform/logger";
import { getKVStore } from "@/lib/platform/kv/kv-store-factory";

/**
 * Location storage configuration
 */
const STORAGE_CONFIG = {
	storageKey: "maps:locations:v1",
	version: "1.0.0",
} as const;

/**
 * Storage payload data structure
 */
type StoragePayloadData = {
	version: string;
	lastUpdated: string;
	locations: Record<string, EventLocation>;
};

/**
 * Location Storage - Handles persistent KV operations only
 */
export class LocationStorage {
	/**
	 * Load all stored locations from KV
	 */
	static async load(): Promise<Map<string, EventLocation>> {
		try {
			const store = await getKVStore();
			const content = await store.get(STORAGE_CONFIG.storageKey);
			if (!content) {
				return new Map();
			}
			const data = JSON.parse(content) as Partial<StoragePayloadData>;

			// Version check
			if (data.version !== STORAGE_CONFIG.version) {
				log.warn("maps.storage", "Storage version mismatch, starting fresh", {
					expected: STORAGE_CONFIG.version,
					found: data.version,
				});
				return new Map();
			}

			if (!data.locations || typeof data.locations !== "object") {
				return new Map();
			}

			// Convert to Map
			const locationMap = new Map<string, EventLocation>();
			Object.entries(data.locations).forEach(([key, location]) => {
				locationMap.set(key, location as EventLocation);
			});

			return locationMap;
		} catch (error) {
			log.warn("maps.storage", "Failed to load location storage", {
				error: error instanceof Error ? error.message : String(error),
			});
			return new Map();
		}
	}

	/**
	 * Save all locations to KV
	 */
	static async save(locations: Map<string, EventLocation>): Promise<void> {
		try {
			const store = await getKVStore();
			const data: StoragePayloadData = {
				version: STORAGE_CONFIG.version,
				lastUpdated: new Date().toISOString(),
				locations: Object.fromEntries(locations.entries()),
			};
			await store.set(STORAGE_CONFIG.storageKey, JSON.stringify(data));
		} catch (error) {
			log.error("maps.storage", "Failed to save location storage", undefined, error);
			throw error;
		}
	}

	/**
	 * Clear all stored locations
	 */
	static async clear(): Promise<void> {
		const store = await getKVStore();
		await store.delete(STORAGE_CONFIG.storageKey);
	}
}
