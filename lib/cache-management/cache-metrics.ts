/**
 * Cache Performance Metrics
 * Handles cache hit/miss tracking, performance monitoring, and statistics
 */

export interface CacheMetricsData {
	cacheHits: number;
	cacheMisses: number;
	totalRequests: number;
	lastReset: number;
	fetchTimes: number[];
	errorCount: number;
	memoryCleanups: number;
	hitRate: number;
	averageFetchTime: number;
	uptime: number;
}

/**
 * Cache Performance Metrics Manager
 */
export class CacheMetrics {
	private static metrics = {
		cacheHits: 0,
		cacheMisses: 0,
		totalRequests: 0,
		lastReset: Date.now(),
		fetchTimes: [] as number[],
		errorCount: 0,
		memoryCleanups: 0,
	};
	
	/**
	 * Record a cache hit
	 */
	static recordCacheHit(): void {
		this.metrics.cacheHits++;
		this.metrics.totalRequests++;
	}
	
	/**
	 * Record a cache miss
	 */
	static recordCacheMiss(): void {
		this.metrics.cacheMisses++;
		this.metrics.totalRequests++;
	}
	
	/**
	 * Record fetch duration for performance tracking
	 */
	static recordFetchTime(duration: number): void {
		this.metrics.fetchTimes.push(duration);
		// Keep only last 100 measurements to prevent memory buildup
		if (this.metrics.fetchTimes.length > 100) {
			this.metrics.fetchTimes = this.metrics.fetchTimes.slice(-100);
		}
	}
	
	/**
	 * Record an error occurrence
	 */
	static recordError(): void {
		this.metrics.errorCount++;
	}
	
	/**
	 * Record a memory cleanup event
	 */
	static recordMemoryCleanup(): void {
		this.metrics.memoryCleanups++;
	}
	
	/**
	 * Get comprehensive cache metrics
	 */
	static getMetrics(): CacheMetricsData {
		const totalRequests = this.metrics.totalRequests;
		const hitRate = totalRequests > 0 ? (this.metrics.cacheHits / totalRequests) * 100 : 0;
		const avgFetchTime = this.metrics.fetchTimes.length > 0 
			? this.metrics.fetchTimes.reduce((sum, time) => sum + time, 0) / this.metrics.fetchTimes.length 
			: 0;
		
		return {
			...this.metrics,
			hitRate: parseFloat(hitRate.toFixed(2)),
			averageFetchTime: Math.round(avgFetchTime),
			uptime: Date.now() - this.metrics.lastReset,
		};
	}
	
	/**
	 * Reset all metrics
	 */
	static resetMetrics(): void {
		this.metrics = {
			cacheHits: 0,
			cacheMisses: 0,
			totalRequests: 0,
			lastReset: Date.now(),
			fetchTimes: [],
			errorCount: 0,
			memoryCleanups: 0,
		};
		console.log("📊 Cache metrics reset");
	}
	
	/**
	 * Get formatted metrics summary for logging
	 */
	static getMetricsSummary(): string {
		const metrics = this.getMetrics();
		const uptimeHours = (metrics.uptime / (1000 * 60 * 60)).toFixed(1);
		
		return [
			`📊 Cache Metrics Summary:`,
			`   Hit Rate: ${metrics.hitRate}% (${metrics.cacheHits}/${metrics.totalRequests})`,
			`   Avg Fetch Time: ${metrics.averageFetchTime}ms`,
			`   Errors: ${metrics.errorCount}`,
			`   Memory Cleanups: ${metrics.memoryCleanups}`,
			`   Uptime: ${uptimeHours}h`
		].join('\n');
	}
} 