import "server-only";

import { timingSafeEqual } from "crypto";
import { getLiveEvents } from "@/features/data-management/runtime-service";
import { getEventEngagementRepository } from "@/lib/platform/postgres/event-engagement-repository";
import { getPartnerActivationRepository } from "@/lib/platform/postgres/partner-activation-repository";

const secureCompare = (left: string, right: string): boolean => {
	try {
		const leftBuffer = Buffer.from(left, "utf8");
		const rightBuffer = Buffer.from(right, "utf8");
		if (leftBuffer.length !== rightBuffer.length) return false;
		return timingSafeEqual(leftBuffer, rightBuffer);
	} catch {
		return false;
	}
};

const toPercent = (numerator: number, denominator: number): number => {
	if (denominator <= 0) return 0;
	return Math.round((numerator / denominator) * 1000) / 10;
};

export async function getPartnerStatsSnapshot(input: {
	activationId: string;
	token: string;
}): Promise<
	| {
			success: true;
			data: {
				activationId: string;
				eventKey: string;
				eventName: string;
				tier: "spotlight" | "promoted";
				range: {
					startAt: string;
					endAt: string;
				};
				metrics: {
					clickCount: number;
					outboundClickCount: number;
					calendarSyncCount: number;
					uniqueSessionCount: number;
					outboundRate: number;
					calendarRate: number;
				};
				createdAt: string;
				updatedAt: string;
			};
	  }
	| {
			success: false;
			error: string;
			code: "invalid_token" | "not_found" | "not_ready" | "service_unavailable";
	  }
> {
	const activationRepository = getPartnerActivationRepository();
	const engagementRepository = getEventEngagementRepository();
	if (!activationRepository || !engagementRepository) {
		return {
			success: false,
			error: "Stats service unavailable",
			code: "service_unavailable",
		};
	}

	const activation = await activationRepository.findById(input.activationId);
	if (!activation) {
		return {
			success: false,
			error: "Partner stats record not found",
			code: "not_found",
		};
	}

	if (
		!activation.partnerStatsToken ||
		!secureCompare(activation.partnerStatsToken, input.token)
	) {
		return {
			success: false,
			error: "Invalid partner stats token",
			code: "invalid_token",
		};
	}

	if (!activation.fulfilledEventKey || !activation.fulfilledTier) {
		return {
			success: false,
			error: "Activation not fulfilled yet",
			code: "not_ready",
		};
	}

	const rangeStartAt =
		activation.fulfilledStartAt ||
		activation.activatedAt ||
		activation.createdAt;
	const nowIso = new Date().toISOString();
	const rangeEndAtRaw = activation.fulfilledEndAt || nowIso;
	const rangeEndAt =
		new Date(rangeEndAtRaw) < new Date(rangeStartAt) ? nowIso : rangeEndAtRaw;

	const [summary, eventsResult] = await Promise.all([
		engagementRepository.summarizeEventWindow({
			eventKey: activation.fulfilledEventKey,
			startAt: rangeStartAt,
			endAt: rangeEndAt,
		}),
		getLiveEvents({
			includeFeaturedProjection: false,
			includeEngagementProjection: false,
		}),
	]);

	const eventNameByKey = new Map<string, string>();
	if (eventsResult.success) {
		for (const event of eventsResult.data) {
			eventNameByKey.set(event.eventKey, event.name);
		}
	}

	return {
		success: true,
		data: {
			activationId: activation.id,
			eventKey: activation.fulfilledEventKey,
			eventName:
				eventNameByKey.get(activation.fulfilledEventKey) ||
				activation.eventName ||
				activation.fulfilledEventKey,
			tier: activation.fulfilledTier,
			range: {
				startAt: rangeStartAt,
				endAt: rangeEndAt,
			},
			metrics: {
				clickCount: summary.clickCount,
				outboundClickCount: summary.outboundClickCount,
				calendarSyncCount: summary.calendarSyncCount,
				uniqueSessionCount: summary.uniqueSessionCount,
				outboundRate: toPercent(summary.outboundClickCount, summary.clickCount),
				calendarRate: toPercent(summary.calendarSyncCount, summary.clickCount),
			},
			createdAt: activation.createdAt,
			updatedAt: activation.updatedAt,
		},
	};
}
