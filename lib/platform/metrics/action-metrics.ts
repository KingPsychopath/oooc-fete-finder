import "server-only";

import { log } from "@/lib/platform/logger";
import {
	type ActionMetricSummary,
	getActionMetricsRepository,
} from "@/lib/platform/postgres/action-metrics-repository";
import { withQueryCountTracking } from "@/lib/platform/postgres/query-count-context";

const shouldSample = (rate: number): boolean => {
	const normalized = Math.min(1, Math.max(0, rate));
	if (normalized >= 1) return true;
	return Math.random() < normalized;
};

export const withActionMetric = async <T>(
	actionName: string,
	task: () => Promise<T>,
	options?: {
		sampleRate?: number;
	},
): Promise<T> => {
	const sampleRate = options?.sampleRate ?? 1;
	const shouldRecord = shouldSample(sampleRate);
	if (!shouldRecord) {
		return task();
	}

	const startedAt = Date.now();
	let queryCount = 0;
	let success = false;
	try {
		const tracked = await withQueryCountTracking(task);
		queryCount = tracked.queryCount;
		success = true;
		return tracked.result;
	} finally {
		const repository = getActionMetricsRepository();
		if (repository) {
			try {
				await repository.recordMetric({
					actionName,
					durationMs: Date.now() - startedAt,
					queryCount,
					success,
					recordedAt: new Date().toISOString(),
				});
			} catch (error) {
				log.warn("action-metrics", "Failed to record action metric", {
					actionName,
					error: error instanceof Error ? error.message : "Unknown error",
				});
			}
		}
	}
};

export const getActionMetricSummaries = async (): Promise<{
	last15Minutes: ActionMetricSummary[];
	last24Hours: ActionMetricSummary[];
}> => {
	const repository = getActionMetricsRepository();
	if (!repository) {
		return {
			last15Minutes: [],
			last24Hours: [],
		};
	}

	const [last15Minutes, last24Hours] = await Promise.all([
		repository.summarizeWindow(15),
		repository.summarizeWindow(24 * 60),
	]);

	return { last15Minutes, last24Hours };
};
