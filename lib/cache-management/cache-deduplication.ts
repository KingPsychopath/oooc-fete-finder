/**
 * Cache Request Deduplication
 * Prevents race conditions by ensuring only one request of each type runs at a time
 */

/**
 * Generic request deduplicator to prevent race conditions
 */
export class RequestDeduplicator {
	private static pendingRequests = new Map<string, Promise<unknown>>();
	
	/**
	 * Deduplicate requests by key - if a request with the same key is already running,
	 * return that promise instead of starting a new one
	 */
	static async deduplicate<T>(
		key: string, 
		operation: () => Promise<T>
	): Promise<T> {
		// Check if operation is already in progress
		if (this.pendingRequests.has(key)) {
			console.log(`🔄 Request deduplication: ${key} already in progress, waiting for existing request`);
			return this.pendingRequests.get(key) as Promise<T>;
		}
		
		// Start new operation
		const promise = operation();
		this.pendingRequests.set(key, promise);
		
		try {
			const result = await promise;
			this.pendingRequests.delete(key);
			return result;
		} catch (error) {
			this.pendingRequests.delete(key);
			throw error;
		}
	}
	
	/**
	 * Check if a request is currently pending
	 */
	static isPending(key: string): boolean {
		return this.pendingRequests.has(key);
	}
	
	/**
	 * Get list of currently pending request keys
	 */
	static getPendingKeys(): string[] {
		return Array.from(this.pendingRequests.keys());
	}
	
	/**
	 * Clear all pending requests (useful for testing or error recovery)
	 */
	static clearPendingRequests(): void {
		console.log("🧹 Clearing pending request cache");
		this.pendingRequests.clear();
	}
	
	/**
	 * Get count of pending requests
	 */
	static getPendingCount(): number {
		return this.pendingRequests.size;
	}
}

/**
 * Specialized deduplicators for different types of cache operations
 */
export class CacheRequestDeduplicator {
	/**
	 * Deduplicate getEvents requests
	 */
	static async deduplicateGetEvents<T>(forceRefresh: boolean, operation: () => Promise<T>): Promise<T> {
		const key = `getEvents:${forceRefresh}`;
		return RequestDeduplicator.deduplicate(key, operation);
	}
	
	/**
	 * Deduplicate force refresh requests
	 */
	static async deduplicateForceRefresh<T>(operation: () => Promise<T>): Promise<T> {
		const key = 'forceRefresh';
		return RequestDeduplicator.deduplicate(key, operation);
	}
	
	/**
	 * Deduplicate full revalidation requests
	 */
	static async deduplicateFullRevalidation<T>(path: string, operation: () => Promise<T>): Promise<T> {
		const key = `fullRevalidation:${path}`;
		return RequestDeduplicator.deduplicate(key, operation);
	}
	
	/**
	 * Deduplicate cache status requests
	 */
	static async deduplicateCacheStatus<T>(operation: () => Promise<T>): Promise<T> {
		const key = 'cacheStatus';
		return RequestDeduplicator.deduplicate(key, operation);
	}
	
	/**
	 * Get deduplication status for monitoring
	 */
	static getDeduplicationStatus() {
		const pendingKeys = RequestDeduplicator.getPendingKeys();
		const pendingCount = RequestDeduplicator.getPendingCount();
		
		return {
			pendingCount,
			pendingKeys,
			hasGetEvents: pendingKeys.some(key => key.startsWith('getEvents:')),
			hasForceRefresh: pendingKeys.includes('forceRefresh'),
			hasFullRevalidation: pendingKeys.some(key => key.startsWith('fullRevalidation:')),
			hasCacheStatus: pendingKeys.includes('cacheStatus'),
		};
	}
} 