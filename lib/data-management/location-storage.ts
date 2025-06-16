import fs from "fs";
import path from "path";
import type { EventLocation } from "@/types/events";

/**
 * Location storage configuration
 */
const STORAGE_CONFIG = {
	filePath: "data/event-locations.json",
	version: "1.0.0",
} as const;

/**
 * Storage file data structure
 */
type StorageFileData = {
	version: string;
	lastUpdated: string;
	locations: Record<string, EventLocation>;
};

/**
 * Location Storage - Handles persistent file operations only
 */
export class LocationStorage {
	/**
	 * Load all stored locations from disk
	 */
	static async load(): Promise<Map<string, EventLocation>> {
		try {
			const filePath = path.join(process.cwd(), STORAGE_CONFIG.filePath);

			// Check if file exists
			try {
				await fs.promises.access(filePath);
			} catch {
				// File doesn't exist, return empty map
				return new Map();
			}

			const content = await fs.promises.readFile(filePath, "utf-8");
			const data: StorageFileData = JSON.parse(content);

			// Version check
			if (data.version !== STORAGE_CONFIG.version) {
				console.warn(`⚠️ Storage version mismatch, starting fresh`);
				return new Map();
			}

			// Convert to Map
			const locationMap = new Map<string, EventLocation>();
			Object.entries(data.locations).forEach(([key, location]) => {
				locationMap.set(key, location);
			});

			return locationMap;
		} catch (error) {
			console.warn("Failed to load location storage:", error);
			return new Map();
		}
	}

	/**
	 * Save all locations to disk
	 */
	static async save(locations: Map<string, EventLocation>): Promise<void> {
		try {
			const filePath = path.join(process.cwd(), STORAGE_CONFIG.filePath);
			const dir = path.dirname(filePath);

			// Ensure directory exists
			await fs.promises.mkdir(dir, { recursive: true });

			const data: StorageFileData = {
				version: STORAGE_CONFIG.version,
				lastUpdated: new Date().toISOString(),
				locations: Object.fromEntries(locations.entries()),
			};

			// Atomic write operation
			const tempPath = `${filePath}.tmp`;
			await fs.promises.writeFile(
				tempPath,
				JSON.stringify(data, null, 2),
				"utf-8",
			);
			await fs.promises.rename(tempPath, filePath);
		} catch {
			// Fallback to direct write
			try {
				const filePath = path.join(process.cwd(), STORAGE_CONFIG.filePath);
				const data: StorageFileData = {
					version: STORAGE_CONFIG.version,
					lastUpdated: new Date().toISOString(),
					locations: Object.fromEntries(locations.entries()),
				};
				await fs.promises.writeFile(
					filePath,
					JSON.stringify(data, null, 2),
					"utf-8",
				);
			} catch (fallbackError) {
				console.error("❌ Failed to save location storage:", fallbackError);
				throw fallbackError;
			}
		}
	}

	/**
	 * Clear all stored locations
	 */
	static async clear(): Promise<void> {
		await this.save(new Map());
	}
}
