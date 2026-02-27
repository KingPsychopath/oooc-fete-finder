"use server";

import { validateAdminAccessFromServerContext } from "@/features/auth/admin-validation";
import { getLiveEvents } from "@/features/data-management/runtime-service";
import { getEventEngagementRepository } from "@/lib/platform/postgres/event-engagement-repository";

const assertAdmin = async () => {
	const authorized = await validateAdminAccessFromServerContext();
	if (!authorized) {
		throw new Error("Unauthorized access");
	}
};

const toPercent = (numerator: number, denominator: number): number => {
	if (denominator <= 0) return 0;
	return Math.round((numerator / denominator) * 1000) / 10;
};

export async function getEventEngagementDashboard(windowDays = 30): Promise<
	| {
			success: true;
			windowDays: number;
			range: {
				startAt: string;
				endAt: string;
			};
			summary: {
				clickCount: number;
				outboundClickCount: number;
				calendarSyncCount: number;
				uniqueSessionCount: number;
				outboundRate: number;
				calendarRate: number;
			};
			rows: Array<{
				eventKey: string;
				eventName: string;
				clickCount: number;
				outboundClickCount: number;
				calendarSyncCount: number;
				uniqueSessionCount: number;
				outboundRate: number;
				calendarRate: number;
			}>;
	  }
	| {
			success: false;
			error: string;
	  }
> {
	try {
		await assertAdmin();
		const repository = getEventEngagementRepository();
		if (!repository) {
			return { success: false, error: "Postgres not configured" };
		}

		const safeWindowDays = Math.max(1, Math.min(windowDays, 365));
		const endAt = new Date().toISOString();
		const startDate = new Date();
		startDate.setDate(startDate.getDate() - safeWindowDays);
		const startAt = startDate.toISOString();

		const [summary, topRows, eventsResult] = await Promise.all([
			repository.summarizeWindow({ startAt, endAt }),
			repository.listTopEvents({ startAt, endAt, limit: 40 }),
			getLiveEvents({ includeFeaturedProjection: false }),
		]);

		const eventNameByKey = new Map<string, string>();
		if (eventsResult.success) {
			for (const event of eventsResult.data) {
				eventNameByKey.set(event.eventKey, event.name);
			}
		}

		return {
			success: true,
			windowDays: safeWindowDays,
			range: { startAt, endAt },
			summary: {
				clickCount: summary.clickCount,
				outboundClickCount: summary.outboundClickCount,
				calendarSyncCount: summary.calendarSyncCount,
				uniqueSessionCount: summary.uniqueSessionCount,
				outboundRate: toPercent(summary.outboundClickCount, summary.clickCount),
				calendarRate: toPercent(summary.calendarSyncCount, summary.clickCount),
			},
			rows: topRows.map((row) => ({
				eventKey: row.eventKey,
				eventName: eventNameByKey.get(row.eventKey) || row.eventKey,
				clickCount: row.clickCount,
				outboundClickCount: row.outboundClickCount,
				calendarSyncCount: row.calendarSyncCount,
				uniqueSessionCount: row.uniqueSessionCount,
				outboundRate: toPercent(row.outboundClickCount, row.clickCount),
				calendarRate: toPercent(row.calendarSyncCount, row.clickCount),
			})),
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error.message
					: "Unknown event engagement error",
		};
	}
}
