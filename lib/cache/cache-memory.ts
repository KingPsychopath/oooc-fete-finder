/**
 * Cache Memory Management
 * Handles memory usage monitoring, limits, and cleanup for cache operations
 */

import { log } from "@/lib/platform/logger";
import { Event } from "@/features/events/types";
import type { MemoryLimitsCheck, MemoryStats } from "./cache-types";

import { getCacheConfig } from "@/lib/cache/cache-config";

// Memory management configuration - lazy loaded from environment
const getMemoryConfig = () => {
	const config = getCacheConfig();
	return {
		/** Maximum memory usage for cache in bytes (50MB default) */
		MAX_MEMORY_USAGE: config.maxMemoryUsage,

		/** Memory check interval in ms (5 minutes) */
		MEMORY_CHECK_INTERVAL: config.memoryCheckInterval,

		/** Cleanup threshold percentage (80% of max memory) */
		CLEANUP_THRESHOLD: config.cleanupThreshold,

		/** Emergency cleanup threshold (95% of max memory) */
		EMERGENCY_THRESHOLD: config.emergencyThreshold,
	} as const;
};

/**
 * Cache Memory Manager
 */
export class CacheMemoryManager {
	/**
	 * Calculate approximate memory usage of event data
	 */
	static calculateMemoryUsage(events: Event[] | null): number {
		if (!events || events.length === 0) return 0;

		try {
			// Rough estimation: JSON.stringify size * 2 (for object overhead)
			const jsonSize = JSON.stringify(events).length;
			return jsonSize * 2;
		} catch (error) {
			log.warn(
				"cache",
				"Failed to calculate memory usage, using fallback",
				{ error: error instanceof Error ? error.message : "Unknown error" },
			);
			return events.length * 2048;
		}
	}

	/**
	 * Check if memory usage is within limits
	 */
	static checkMemoryLimits(
		currentUsage: number,
		eventCount: number = 0,
		lastMemoryCheck: number = 0,
	): MemoryLimitsCheck {
		const now = Date.now();
		const maxLimit = getMemoryConfig().MAX_MEMORY_USAGE;
		const utilizationPercent = (currentUsage / maxLimit) * 100;

		const stats: MemoryStats = {
			currentUsage,
			maxLimit,
			utilizationPercent,
			eventCount,
			averageSizePerEvent: eventCount > 0 ? currentUsage / eventCount : 0,
		};

		const needsEmergencyCleanup =
			utilizationPercent > getMemoryConfig().EMERGENCY_THRESHOLD * 100;
		const needsCleanup =
			utilizationPercent > getMemoryConfig().CLEANUP_THRESHOLD * 100;
		const withinLimits = utilizationPercent < 100;

		return {
			withinLimits,
			needsCleanup,
			needsEmergencyCleanup,
			stats,
		};
	}

	/**
	 * Validate memory usage before cache update
	 */
	static validateMemoryForUpdate(
		newData: Event[],
		_currentUsage: number,
		clearCacheCallback: () => void,
	): boolean {
		const newMemoryUsage = this.calculateMemoryUsage(newData);
		const memoryCheck = this.checkMemoryLimits(newMemoryUsage, newData.length);

		if (memoryCheck.needsEmergencyCleanup) {
			log.warn("cache", "Memory limit exceeded, attempting cleanup", {
				requestedMB: (newMemoryUsage / 1024 / 1024).toFixed(2),
				limitMB: (getMemoryConfig().MAX_MEMORY_USAGE / 1024 / 1024).toFixed(
					2,
				),
			});
			clearCacheCallback();

			// Try again after cleanup
			const recheckMemory = this.checkMemoryLimits(
				newMemoryUsage,
				newData.length,
			);

			if (recheckMemory.needsEmergencyCleanup) {
				log.warn("cache", "Still exceeds memory limits after cleanup, rejecting update");
				return false;
			}
		}

		return true;
	}

	/**
	 * Get memory configuration
	 */
	static getMemoryConfig() {
		const config = getMemoryConfig();
		return {
			...config,
			maxMemoryMB: (config.MAX_MEMORY_USAGE / 1024 / 1024).toFixed(1),
			cleanupThresholdMB: (
				(config.MAX_MEMORY_USAGE * config.CLEANUP_THRESHOLD) /
				1024 /
				1024
			).toFixed(1),
			emergencyThresholdMB: (
				(config.MAX_MEMORY_USAGE * config.EMERGENCY_THRESHOLD) /
				1024 /
				1024
			).toFixed(1),
		};
	}

	/**
	 * Format memory usage for display
	 */
	static formatMemoryUsage(bytes: number): string {
		const mb = bytes / 1024 / 1024;
		return `${mb.toFixed(2)}MB`;
	}

	/**
	 * Get memory health status
	 */
	static getMemoryHealth(
		currentUsage: number,
		_eventCount: number = 0,
	): {
		status: "healthy" | "warning" | "critical";
		message: string;
		utilizationPercent: number;
	} {
		const utilizationPercent =
			(currentUsage / getMemoryConfig().MAX_MEMORY_USAGE) * 100;

		let status: "healthy" | "warning" | "critical";
		let message: string;

		if (utilizationPercent > getMemoryConfig().EMERGENCY_THRESHOLD * 100) {
			status = "critical";
			message = "Memory usage critical - immediate cleanup required";
		} else if (utilizationPercent > getMemoryConfig().CLEANUP_THRESHOLD * 100) {
			status = "warning";
			message = "Memory usage high - cleanup recommended";
		} else {
			status = "healthy";
			message = "Memory usage within normal limits";
		}

		return {
			status,
			message,
			utilizationPercent: parseFloat(utilizationPercent.toFixed(1)),
		};
	}
}
